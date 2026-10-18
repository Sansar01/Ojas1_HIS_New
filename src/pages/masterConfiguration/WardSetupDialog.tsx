/**
 * Ward, room & bed setup — a dialog ON the Master Configuration page.
 *
 * Master Configuration owns the ward STRUCTURE; IPD owns its operational use
 * (bed occupancy, allocation, transfer, discharge). This console creates the
 * room types, lays out rooms, generates beds (one at a time or 01–N in a
 * batch) and maintains the amenity list + the per-room amenity mapping.
 *
 * Reads:  GET   /api/hospital/masters/room-types · /rooms · /beds · /bed-amenities
 * Writes: POST/PATCH/DELETE on the same masters + PUT /rooms/:id/amenities
 *         (all through `wardMasterService` — the only place those endpoints are
 *         known; the ward board imports the read half from there too)
 *
 * Opened from the Master Configuration hub (its tile) or deep-linked with
 * `/master-config?open=ward-setup` — the page itself is guarded by the
 * `master-config` entitlement (`ModuleRoute`). Writes are gated on the
 * `MASTER_WARDS_BEDS` capability feature ("Manage Wards & Beds") *or* the
 * module-level create/edit rights, so both ways of granting the ward master
 * work.
 * Deletes follow the server guards (room type with rooms, room with beds and
 * mapped amenities answer 400; an occupied/reserved bed answers 409
 * BED_DELETE_BLOCKED) — the toast shows the server's own message.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BedDouble,
  Building2,
  DoorOpen,
  Layers,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { usePermission } from "@/hooks";
import { toast } from "@/store/slices/uiSlice";
import { Badge, Button } from "@/components/ui/primitives";
import { Select, SearchInput } from "@/components/ui/fields";
import { DataTable, type Column } from "@/components/ui/table";
import { ErrorState, EmptyState } from "@/components/ui/feedback";
import { Dialog, useConfirmDialog } from "@/components/ui/overlays";
import { SectionPanel } from "@/components/common";
import { cn } from "@/utils/cn";
import { BED_STATUSES } from "@/types/ipdTypes";
import { WARD_GENDER_LABEL, wardGenderLabel } from "@/constants/ipd.constants";
import { wardMasterService } from "./wardMaster.service";
import { BedStatusBadge } from "@/pages/ipd/components";
import {
  AmenityForm,
  BedForm,
  BulkBedsForm,
  RoomAmenitiesForm,
  RoomForm,
  RoomTypeForm,
} from "./components/WardSetupForms";
import type {
  AmenityRow,
  BedRow,
  RoomRow,
  RoomTypeRow,
} from "@/types/ipdTypes";

type TabValue = "types" | "rooms" | "beds" | "amenities";

/** 404 ⇒ the ward & bed master is not deployed on this backend yet. */
const friendlyError = (e: any, fallback: string) =>
  e?.status === 404
    ? "The ward & bed master is not served by this backend yet — it ships on the backend branch hims-v2 and is not deployed. This screen stays empty (not broken) until then."
    : (e?.message ?? fallback);

const GENDER_FILTERS = [
  { value: "all", label: "Any ward" },
  ...Object.keys(WARD_GENDER_LABEL).map((value) => ({
    value,
    label: WARD_GENDER_LABEL[value],
  })),
];

const inr = (value: unknown) =>
  value === null || value === undefined || value === ""
    ? "—"
    : `₹${Number(value).toLocaleString("en-IN")}`;

export function WardSetupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const dispatch = useAppDispatch();
  const { canCreate, canEdit, hasFeature } = usePermission();
  const { ask, confirmNode } = useConfirmDialog();

  const [roomTypes, setRoomTypes] = useState<RoomTypeRow[]>([]);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [beds, setBeds] = useState<BedRow[]>([]);
  const [amenities, setAmenities] = useState<AmenityRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabValue>("types");

  /* filters */
  const [roomTypeFilter, setRoomTypeFilter] = useState("all");
  const [roomGenderFilter, setRoomGenderFilter] = useState("all");
  const [roomSearch, setRoomSearch] = useState("");
  const [bedRoomTypeFilter, setBedRoomTypeFilter] = useState("all");
  const [bedStatusFilter, setBedStatusFilter] = useState("all");
  const [bedSearch, setBedSearch] = useState("");

  /**
   * Each section shows its form at the top of the pane at all times — no
   * button reveals it, no second dialog. The row actions (Edit, a room's
   * Beds/Amenities) only load a target into the form that is already there;
   * `formSeq` is bumped after a save so the form remounts empty.
   */
  const [typeEditing, setTypeEditing] = useState<RoomTypeRow | null>(null);
  const [roomEditing, setRoomEditing] = useState<RoomRow | null>(null);
  const [amenitiesRoom, setAmenitiesRoom] = useState<RoomRow | null>(null);
  const [bedMode, setBedMode] = useState<"single" | "bulk">("single");
  const [bedRoomId, setBedRoomId] = useState<string | null>(null);
  const [amenityEditing, setAmenityEditing] = useState<AmenityRow | null>(null);
  const [formSeq, setFormSeq] = useState(0);

  const formRef = useRef<HTMLDivElement>(null);

  /** Switching section starts that section from a clean add form. */
  const resetForm = () => {
    setTypeEditing(null);
    setRoomEditing(null);
    setAmenitiesRoom(null);
    setBedMode("single");
    setBedRoomId(null);
    setAmenityEditing(null);
    setFormSeq((n) => n + 1);
  };

  /** A save refreshes the lists and remounts the form empty. */
  const afterSave = () => {
    void load();
    setFormSeq((n) => n + 1);
  };

  /* Pull the form into view when a row action loads a target into it. */
  useEffect(() => {
    if (
      typeEditing ||
      roomEditing ||
      amenitiesRoom ||
      amenityEditing ||
      bedRoomId
    ) {
      formRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [typeEditing, roomEditing, amenitiesRoom, amenityEditing, bedRoomId]);

  /* -------------------------------- loading -------------------------------- */

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [typesRes, roomsRes, bedsRes, amenitiesRes] = await Promise.all([
        wardMasterService.fetchRoomTypes(),
        wardMasterService.fetchRooms(),
        wardMasterService.fetchBeds({}),
        wardMasterService.fetchAmenities(),
      ]);
      if (typesRes.status === 200) setRoomTypes(typesRes.data ?? []);
      if (roomsRes.status === 200) setRooms(roomsRes.data ?? []);
      if (bedsRes.status === 200) setBeds(bedsRes.data ?? []);
      if (amenitiesRes.status === 200) setAmenities(amenitiesRes.data ?? []);
    } catch (e: any) {
      setError(friendlyError(e, "Could not load the ward & bed master"));
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * The console loads when the dialog opens. It is mounted (closed) with the
   * hub page, so loading on mount would fetch ward data nobody asked for.
   */
  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  /* -------------------------------- deletes -------------------------------- */

  const removeRoomType = (t: RoomTypeRow) =>
    ask({
      title: `Delete room type ${t.name}?`,
      description:
        "Only possible while no rooms are linked to it — otherwise the server refuses and keeps the ward intact.",
      confirmLabel: "Delete room type",
      action: async () => {
        try {
          const res = await wardMasterService.deleteRoomType(t.id);
          if (res.status >= 200 && res.status < 300) {
            dispatch(toast.success("Room type deleted", t.name));
            void load();
          }
        } catch (e: any) {
          dispatch(toast.error("Could not delete the room type", e?.message));
        }
      },
    });

  const removeRoom = (r: RoomRow) =>
    ask({
      title: `Delete room ${r.roomNumber}?`,
      description:
        "Only possible while no beds are linked to it — occupied beds can never vanish under a patient.",
      confirmLabel: "Delete room",
      action: async () => {
        try {
          const res = await wardMasterService.deleteRoom(r.id);
          if (res.status >= 200 && res.status < 300) {
            dispatch(toast.success("Room deleted", r.roomNumber));
            void load();
          }
        } catch (e: any) {
          dispatch(toast.error("Could not delete the room", e?.message));
        }
      },
    });

  const removeBed = (b: BedRow) =>
    ask({
      title: `Delete bed ${b.bedIdentifier}?`,
      description:
        "A bed that is OCCUPIED or RESERVED is refused by the server (409 BED_DELETE_BLOCKED).",
      confirmLabel: "Delete bed",
      action: async () => {
        try {
          const res = await wardMasterService.deleteBed(b.id);
          if (res.status >= 200 && res.status < 300) {
            dispatch(toast.success("Bed deleted", b.bedIdentifier));
            void load();
          }
        } catch (e: any) {
          dispatch(toast.error("Could not delete the bed", e?.message));
        }
      },
    });

  const removeAmenity = (a: AmenityRow) =>
    ask({
      title: `Delete amenity ${a.name}?`,
      description:
        "Blocked while rooms still map it — prefer turning it inactive instead of deleting.",
      confirmLabel: "Delete amenity",
      action: async () => {
        try {
          const res = await wardMasterService.deleteAmenity(a.id);
          if (res.status >= 200 && res.status < 300) {
            dispatch(toast.success("Amenity deleted", a.name));
            void load();
          }
        } catch (e: any) {
          dispatch(toast.error("Could not delete the amenity", e?.message));
        }
      },
    });

  /* ------------------------------- filtered -------------------------------- */

  const visibleRooms = useMemo(() => {
    const q = roomSearch.trim().toLowerCase();
    return rooms.filter((r) => {
      if (roomTypeFilter !== "all" && r.roomType?.id !== roomTypeFilter)
        return false;
      if (roomGenderFilter !== "all" && r.gender !== roomGenderFilter)
        return false;
      if (!q) return true;
      return `${r.roomNumber} ${r.roomType?.name ?? ""} ${r.floor ?? ""} ${r.wing ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [rooms, roomTypeFilter, roomGenderFilter, roomSearch]);

  const visibleBeds = useMemo(() => {
    const q = bedSearch.trim().toLowerCase();
    return beds.filter((b) => {
      if (
        bedRoomTypeFilter !== "all" &&
        b.room?.roomType?.id !== bedRoomTypeFilter
      )
        return false;
      if (
        bedStatusFilter !== "all" &&
        b.statusHistory?.[0]?.status !== bedStatusFilter
      )
        return false;
      if (!q) return true;
      return `${b.bedIdentifier} ${b.room?.roomNumber ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [beds, bedRoomTypeFilter, bedStatusFilter, bedSearch]);

  /* -------------------------------- columns -------------------------------- */

  const typeColumns: Column<RoomTypeRow>[] = [
    {
      key: "name",
      header: "Room type",
      render: (t) => (
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold text-ink-900">
            {t.name}
          </p>
          <p className="num mt-0.5 text-[11.5px] font-medium text-brand-600">
            {t.code}
          </p>
        </div>
      ),
    },
    {
      key: "flags",
      header: "Flags",
      hideBelow: "lg",
      render: (t) => (
        <div className="flex flex-wrap gap-1">
          {t.isCount && <Badge tone="brand">BOR</Badge>}
          {t.isEmergency && <Badge tone="coral">Emergency</Badge>}
          {t.isDaycare && <Badge tone="lagoon">Daycare</Badge>}
          {t.isDialysis && <Badge tone="amber">Dialysis</Badge>}
        </div>
      ),
    },
    {
      key: "rate",
      header: "Rate / day",
      hideBelow: "md",
      render: (t) => (
        <div className="num text-[12.5px]">
          <p className="font-semibold text-ink-800">{inr(t.defaultRate)}</p>
          <p className="text-[11px] text-ink-400">
            nursing {inr(t.nursingCharge)}
          </p>
        </div>
      ),
    },
    {
      key: "rooms",
      header: "Rooms",
      hideBelow: "md",
      render: (t) => (
        <span className="num text-[12.5px] text-ink-600">
          {t._count?.rooms ?? 0}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (t) =>
        t.isActive ? (
          <Badge tone="mint" dot>
            Active
          </Badge>
        ) : (
          <Badge tone="neutral">Inactive</Badge>
        ),
    },
  ];

  const roomColumns: Column<RoomRow>[] = [
    {
      key: "room",
      header: "Room",
      render: (r) => (
        <div className="min-w-0">
          <p className="num truncate text-[13.5px] font-semibold text-ink-900">
            {r.roomNumber}
          </p>
          <p className="truncate text-[11.5px] text-ink-400">
            {r.roomType?.name ?? "—"}
          </p>
        </div>
      ),
    },
    {
      key: "location",
      header: "Floor - Wing",
      hideBelow: "md",
      render: (r) => (
        <span className="text-[12.5px] text-ink-600">
          {[r.floor, r.wing].filter(Boolean).join(" · ") || "—"}
        </span>
      ),
    },
    {
      key: "gender",
      header: "Gender",
      hideBelow: "md",
      render: (r) => (
        <span className="text-[12.5px] text-ink-600">
          {wardGenderLabel(r.gender)}
        </span>
      ),
    },
    {
      key: "beds",
      header: "Beds",
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="num text-[12.5px] font-semibold text-ink-800">
            {r._count?.beds ?? 0}
          </span>
          <span className="text-[11.5px] text-ink-400">
            {r.amenities?.length ? `· ${r.amenities.length} amenities` : ""}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      hideBelow: "lg",
      render: (r) =>
        r.isActive ? (
          <Badge tone="mint" dot>
            Active
          </Badge>
        ) : (
          <Badge tone="neutral">Inactive</Badge>
        ),
    },
  ];

  const bedColumns: Column<BedRow>[] = [
    {
      key: "bed",
      header: "Bed",
      render: (b) => (
        <div className="min-w-0">
          <p className="num truncate text-[13.5px] font-semibold text-ink-900">
            {b.bedIdentifier}
          </p>
          <p className="truncate text-[11.5px] text-ink-400">
            {b.room?.roomNumber ?? "—"} · {b.room?.roomType?.name ?? "—"}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "State",
      render: (b) => (
        <BedStatusBadge status={b.statusHistory?.[0]?.status ?? "AVAILABLE"} />
      ),
    },
    {
      key: "active",
      header: "Active",
      hideBelow: "md",
      render: (b) =>
        b.isActive ? (
          <Badge tone="mint">Yes</Badge>
        ) : (
          <Badge tone="neutral">No</Badge>
        ),
    },
  ];

  const amenityColumns: Column<AmenityRow>[] = [
    {
      key: "name",
      header: "Amenity",
      render: (a) => (
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold text-ink-900">
            {a.name}
          </p>
          <p className="num truncate text-[11.5px] text-brand-600">{a.code}</p>
        </div>
      ),
    },
    {
      key: "icon",
      header: "Icon",
      hideBelow: "lg",
      render: (a) => (
        <span className="num text-[12px] text-ink-500">{a.icon || "—"}</span>
      ),
    },
    {
      key: "rooms",
      header: "Mapped rooms",
      hideBelow: "md",
      render: (a) => (
        <span className="num text-[12.5px] text-ink-600">
          {a._count?.rooms ?? 0}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (a) =>
        a.isActive ? (
          <Badge tone="mint" dot>
            Active
          </Badge>
        ) : (
          <Badge tone="neutral">Inactive</Badge>
        ),
    },
  ];

  /* --------------------------------- render -------------------------------- */

  /**
   * The ward & bed master is its own capability: the catalogue grants it as
   * the `MASTER_WARDS_BEDS` feature under MASTER_CONFIG ("Manage Wards &
   * Beds"), which carries no action. Holding it opens every write here; a
   * role with only the module-level create/edit rights keeps the same access
   * it had before.
   */
  const canManageWards = hasFeature("master-config", "MASTER_WARDS_BEDS");
  const canCreateWards = canManageWards || canCreate("master-config");
  const canEditWards = canManageWards || canEdit("master-config");
  const writable = canCreateWards || canEditWards;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        size="full"
        height="calc(100vh - 15rem)"
        title="Ward, Room & Bed Setup"
        description="The configuration console of the ward & bed master: room types, rooms, beds and amenities. Everything the ward board reads is created here."
        footer={
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="neutral">{roomTypes.length} room types</Badge>
              <Badge tone="brand">{rooms.length} rooms</Badge>
              <Badge tone="mint">{beds.length} beds</Badge>
              <Badge tone="lagoon">{amenities.length} amenities</Badge>
            </div>
          </>
        }
      >
        {error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : (
          <div className="grid gap-4 md:grid-cols-[236px_1fr]">
            {/* ─── SIDEBAR — the four masters, same rail as the global
                configuration modal. Selecting one switches the pane. ─── */}
            <nav className="max-h-[60vh] overflow-y-auto rounded-xl border border-ink-100 bg-ink-25/40 p-2 md:sticky md:top-0 md:self-start">
              <p className="px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.11em] text-ink-400">
                Ward master
              </p>
              {(
                [
                  {
                    value: "types",
                    label: "Room types",
                    icon: <Layers />,
                    count: roomTypes.length,
                  },
                  {
                    value: "rooms",
                    label: "Rooms",
                    icon: <DoorOpen />,
                    count: rooms.length,
                  },
                  {
                    value: "beds",
                    label: "Beds",
                    icon: <BedDouble />,
                    count: beds.length,
                  },
                  {
                    value: "amenities",
                    label: "Amenities",
                    icon: <Sparkles />,
                    count: amenities.length,
                  },
                ] as {
                  value: TabValue;
                  label: string;
                  icon: React.ReactNode;
                  count: number;
                }[]
              ).map((t) => {
                const active = tab === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setTab(t.value);
                      resetForm();
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors",
                      active
                        ? "bg-brand-600 font-medium text-white"
                        : "text-ink-700 hover:bg-ink-100",
                    )}
                  >
                    <span
                      className={cn(
                        "shrink-0 [&_svg]:size-4",
                        active ? "text-white" : "text-ink-400",
                      )}
                    >
                      {t.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{t.label}</span>
                    <span
                      className={cn(
                        "num rounded px-1.5 py-0.5 text-[10px] font-semibold",
                        active
                          ? "bg-white/25 text-white"
                          : "bg-ink-200 text-ink-600",
                      )}
                    >
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* ─── CONTENT PANE: the active form first (never a second
                modal), then that section's table. ─── */}
            <section className="min-w-0 space-y-3">
              {/* ─── The section's form, always visible: room types / a room /
                  a bed or a bulk run / an amenity. The table follows below.
                  Read-only roles get the tables without the form. ─── */}
              {writable && (
                <div ref={formRef} className="space-y-3">
                  {tab === "types" && (
                    <RoomTypeForm
                      key={`type-${typeEditing?.id ?? "new"}-${formSeq}`}
                      editing={typeEditing}
                      onDone={afterSave}
                      onClose={() => setTypeEditing(null)}
                    />
                  )}

                  {tab === "rooms" &&
                    (amenitiesRoom ? (
                      <RoomAmenitiesForm
                        key={`amenity-map-${amenitiesRoom.id}-${formSeq}`}
                        room={amenitiesRoom}
                        onDone={afterSave}
                        onClose={() => setAmenitiesRoom(null)}
                      />
                    ) : (
                      <RoomForm
                        key={`room-${roomEditing?.id ?? "new"}-${formSeq}`}
                        editing={roomEditing}
                        roomTypes={roomTypes}
                        onDone={afterSave}
                        onClose={() => setRoomEditing(null)}
                      />
                    ))}

                  {tab === "beds" && (
                    <>
                      {/* one bed at a time, or a numbered run 01–N */}
                      <div className="inline-flex rounded-lg border border-ink-200 bg-white p-0.5">
                        {(
                          [
                            { value: "single", label: "Single bed" },
                            { value: "bulk", label: "Generate range" },
                          ] as { value: "single" | "bulk"; label: string }[]
                        ).map((m) => (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => {
                              setBedMode(m.value);
                              setFormSeq((n) => n + 1);
                            }}
                            className={cn(
                              "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                              bedMode === m.value
                                ? "bg-brand-600 text-white"
                                : "text-ink-600 hover:text-brand-700",
                            )}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                      {bedMode === "single" ? (
                        <BedForm
                          key={`bed-${bedRoomId ?? "any"}-${formSeq}`}
                          rooms={rooms}
                          presetRoomId={bedRoomId}
                          onDone={afterSave}
                          onClose={() => setBedRoomId(null)}
                        />
                      ) : (
                        <BulkBedsForm
                          key={`bulk-${bedRoomId ?? "any"}-${formSeq}`}
                          rooms={rooms}
                          presetRoomId={bedRoomId}
                          onDone={afterSave}
                          onClose={() => setBedRoomId(null)}
                        />
                      )}
                    </>
                  )}

                  {tab === "amenities" && (
                    <AmenityForm
                      key={`amenity-${amenityEditing?.id ?? "new"}-${formSeq}`}
                      editing={amenityEditing}
                      onDone={afterSave}
                      onClose={() => setAmenityEditing(null)}
                    />
                  )}
                </div>
              )}

              {/* ----------------------------- room types ---------------------------- */}
              {tab === "types" && (
                <SectionPanel
                  title="Room types"
                  subtitle="The wards as they are billed — rates, flags and BOR inclusion"
                  icon={<Building2 className="size-4.5" />}
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<RefreshCw />}
                      loading={loading}
                      onClick={() => void load()}
                    >
                      Refresh
                    </Button>
                  }
                >
                  <DataTable
                    columns={typeColumns}
                    rows={roomTypes}
                    status={loading ? "loading" : "ready"}
                    rowKey={(t) => t.id}
                    clickRowHint={false}
                    emptyTitle="No room types yet"
                    emptyDescription="Start here: General Ward, ICU, Private, Daycare… Rooms and beds inherit the type's rates."
                    actions={(t) => (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Pencil />}
                          disabled={!canEditWards}
                          onClick={() => setTypeEditing(t)}
                          aria-label={`Edit ${t.name}`}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Trash2 />}
                          disabled={!canEditWards}
                          onClick={() => removeRoomType(t)}
                          aria-label={`Delete ${t.name}`}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  />
                </SectionPanel>
              )}

              {/* ------------------------------- rooms ------------------------------ */}
              {tab === "rooms" && (
                <SectionPanel
                  title="Rooms"
                  subtitle="One room = one ward type + one ward-gender rule"
                  icon={<Building2 className="size-4.5" />}
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<RefreshCw />}
                      loading={loading}
                      onClick={() => void load()}
                    >
                      Refresh
                    </Button>
                  }
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Select
                      size="sm"
                      className="w-[13rem]"
                      name="setupRoomType"
                      value={roomTypeFilter}
                      onChange={setRoomTypeFilter}
                      options={[
                        { value: "all", label: "All room types" },
                        ...roomTypes.map((t) => ({
                          value: t.id,
                          label: t.name,
                        })),
                      ]}
                    />
                    <Select
                      size="sm"
                      className="w-[11rem]"
                      name="setupRoomGender"
                      value={roomGenderFilter}
                      onChange={setRoomGenderFilter}
                      options={GENDER_FILTERS}
                    />
                    <div className="min-w-[12rem] flex-1">
                      <SearchInput
                        value={roomSearch}
                        onChange={setRoomSearch}
                        placeholder="Search room, floor, wing…"
                      />
                    </div>
                  </div>

                  <DataTable
                    columns={roomColumns}
                    rows={visibleRooms}
                    status={loading ? "loading" : "ready"}
                    rowKey={(r) => r.id}
                    clickRowHint={false}
                    emptyTitle={
                      rooms.length === 0
                        ? "No rooms yet"
                        : "No rooms match this filter"
                    }
                    emptyDescription={
                      rooms.length === 0
                        ? "Create the first room of a ward type, then generate its beds in one batch."
                        : undefined
                    }
                    actions={(r) => (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<BedDouble />}
                          disabled={!canCreateWards}
                          onClick={() => {
                            setTab("beds");
                            setBedMode("bulk");
                            setBedRoomId(r.id);
                          }}
                        >
                          Beds
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Sparkles />}
                          disabled={!canEditWards}
                          onClick={() => setAmenitiesRoom(r)}
                        >
                          Amenities
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Pencil />}
                          disabled={!canEditWards}
                          onClick={() => setRoomEditing(r)}
                          aria-label={`Edit ${r.roomNumber}`}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Trash2 />}
                          disabled={!canEditWards}
                          onClick={() => removeRoom(r)}
                          aria-label={`Delete ${r.roomNumber}`}
                        />
                      </div>
                    )}
                  />
                </SectionPanel>
              )}

              {/* -------------------------------- beds ------------------------------- */}
              {tab === "beds" && (
                <SectionPanel
                  title="Beds"
                  subtitle="Every bed starts AVAILABLE and follows the 7-state machine on the ward board"
                  icon={<BedDouble className="size-4.5" />}
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<RefreshCw />}
                      loading={loading}
                      onClick={() => void load()}
                    >
                      Refresh
                    </Button>
                  }
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Select
                      size="sm"
                      className="w-[13rem]"
                      name="setupBedRoomType"
                      value={bedRoomTypeFilter}
                      onChange={setBedRoomTypeFilter}
                      options={[
                        { value: "all", label: "All room types" },
                        ...roomTypes.map((t) => ({
                          value: t.id,
                          label: t.name,
                        })),
                      ]}
                    />
                    <Select
                      size="sm"
                      className="w-[12rem]"
                      name="setupBedStatus"
                      value={bedStatusFilter}
                      onChange={setBedStatusFilter}
                      options={[
                        { value: "all", label: "Any state" },
                        ...BED_STATUSES.map((s) => ({ value: s, label: s })),
                      ]}
                    />
                    <div className="min-w-[12rem] flex-1">
                      <SearchInput
                        value={bedSearch}
                        onChange={setBedSearch}
                        placeholder="Search bed or room…"
                      />
                    </div>
                  </div>

                  <DataTable
                    columns={bedColumns}
                    rows={visibleBeds}
                    status={loading ? "loading" : "ready"}
                    rowKey={(b) => b.id}
                    clickRowHint={false}
                    emptyTitle={
                      beds.length === 0
                        ? "No beds yet"
                        : "No beds match this filter"
                    }
                    emptyDescription={
                      beds.length === 0
                        ? "Pick a room and generate beds 01–20 in one call — duplicates are skipped, never overwritten."
                        : undefined
                    }
                    actions={(b) => (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 />}
                        disabled={!canEditWards}
                        onClick={() => removeBed(b)}
                        aria-label={`Delete ${b.bedIdentifier}`}
                      >
                        Delete
                      </Button>
                    )}
                  />
                </SectionPanel>
              )}

              {/* ------------------------------ amenities ---------------------------- */}
              {tab === "amenities" && (
                <SectionPanel
                  title="Amenities"
                  subtitle="Master list mapped to rooms — powers the by-amenity finder"
                  icon={<Sparkles className="size-4.5" />}
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<RefreshCw />}
                      loading={loading}
                      onClick={() => void load()}
                    >
                      Refresh
                    </Button>
                  }
                >
                  <DataTable
                    columns={amenityColumns}
                    rows={amenities}
                    status={loading ? "loading" : "ready"}
                    rowKey={(a) => a.id}
                    clickRowHint={false}
                    emptyTitle="No amenities yet"
                    emptyDescription={
                      amenities.length
                        ? undefined
                        : "Day-1 seeds usually create the common nine (AC, TV, oxygen point…); add any that are missing."
                    }
                    actions={(a) => (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Pencil />}
                          disabled={!canEditWards}
                          onClick={() => setAmenityEditing(a)}
                          aria-label={`Edit ${a.name}`}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Trash2 />}
                          disabled={!canEditWards}
                          onClick={() => removeAmenity(a)}
                          aria-label={`Delete ${a.name}`}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  />
                </SectionPanel>
              )}

              {!writable && (
                <div className="mt-4">
                  <EmptyState
                    title="Read-only for your role"
                    description="You can review the ward setup, but creating and editing needs the create/edit right on the Master Configuration module."
                  />
                </div>
              )}
            </section>
          </div>
        )}
      </Dialog>

      {confirmNode}
    </>
  );
}

export default WardSetupDialog;
