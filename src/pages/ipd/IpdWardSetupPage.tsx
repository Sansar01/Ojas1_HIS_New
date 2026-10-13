/**
 * IPD ward setup — `/ipd/setup`.
 *
 * The configuration console of the ward & bed master (backend branch
 * `hims-v2`, `src/hospital/masters/ward-room`): create the room types, lay out
 * rooms, generate beds (one at a time or 01–N in a batch) and maintain the
 * amenity list + the per-room amenity mapping. This is the write half of the
 * module the ward board reads.
 *
 * Reads:  GET   /api/hospital/masters/room-types · /rooms · /beds · /bed-amenities
 * Writes: POST/PATCH/DELETE on the same three masters + PUT /rooms/:id/amenities
 *         (all through `ipdService` — the only place endpoints are known)
 *
 * Deliberately additive: the ward board only ever *reads*; everything here is
 * gated on `canCreate("ipd")` / `canEdit("ipd")`. Deletes follow the server
 * guards (room type with rooms, room with beds and mapped amenities answer 400;
 * an occupied/reserved bed answers 409 BED_DELETE_BLOCKED) — the toast shows
 * the server's own message.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BedDouble,
  Building2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { usePermission } from "@/hooks";
import { hideLoader, showLoader, toast } from "@/store/slices/uiSlice";
import { Badge, Button, Panel } from "@/components/ui/primitives";
import { Select, SearchInput } from "@/components/ui/fields";
import { DataTable, type Column } from "@/components/ui/table";
import { ErrorState, EmptyState } from "@/components/ui/feedback";
import { useConfirmDialog } from "@/components/ui/overlays";
import { PageIntro, SectionPanel } from "@/components/common";
import { BED_STATUSES } from "@/types/ipdTypes";
import { WARD_GENDER_LABEL, wardGenderLabel } from "@/constants/ipd.constants";
import { ipdService } from "./ipd.service";
import type {
  AmenityRow,
  BedRow,
  RoomRow,
  RoomTypeRow,
} from "@/types/ipdTypes";
import {
  AmenityDialog,
  BedDialog,
  BedStatusBadge,
  BulkBedsDialog,
  RoomAmenitiesDialog,
  RoomDialog,
  RoomTypeDialog,
} from "./components";

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

export function IpdWardSetupPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { canCreate, canEdit } = usePermission();
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

  /* dialogs */
  const [typeDialog, setTypeDialog] = useState<{
    open: boolean;
    editing: RoomTypeRow | null;
  }>({ open: false, editing: null });
  const [roomDialog, setRoomDialog] = useState<{
    open: boolean;
    editing: RoomRow | null;
  }>({ open: false, editing: null });
  const [bedDialog, setBedDialog] = useState<{
    open: boolean;
    roomId: string | null;
  }>({ open: false, roomId: null });
  const [bulkOpen, setBulkOpen] = useState<{
    open: boolean;
    roomId: string | null;
  }>({ open: false, roomId: null });
  const [amenitiesRoom, setAmenitiesRoom] = useState<RoomRow | null>(null);
  const [amenityDialog, setAmenityDialog] = useState<{
    open: boolean;
    editing: AmenityRow | null;
  }>({ open: false, editing: null });

  /* -------------------------------- loading -------------------------------- */

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [typesRes, roomsRes, bedsRes, amenitiesRes] = await Promise.all([
        ipdService.fetchRoomTypes(),
        ipdService.fetchRooms(),
        ipdService.fetchBeds({}),
        ipdService.fetchAmenities(),
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

  useEffect(() => {
    void load();
  }, [load]);

  /* -------------------------------- deletes -------------------------------- */

  const removeRoomType = (t: RoomTypeRow) =>
    ask({
      title: `Delete room type ${t.name}?`,
      description:
        "Only possible while no rooms are linked to it — otherwise the server refuses and keeps the ward intact.",
      confirmLabel: "Delete room type",
      action: async () => {
        dispatch(showLoader("Deleting room type"));
        try {
          const res = await ipdService.deleteRoomType(t.id);
          if (res.status >= 200 && res.status < 300) {
            dispatch(toast.success("Room type deleted", t.name));
            void load();
          }
        } catch (e: any) {
          dispatch(toast.error("Could not delete the room type", e?.message));
        } finally {
          dispatch(hideLoader());
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
        dispatch(showLoader("Deleting room"));
        try {
          const res = await ipdService.deleteRoom(r.id);
          if (res.status >= 200 && res.status < 300) {
            dispatch(toast.success("Room deleted", r.roomNumber));
            void load();
          }
        } catch (e: any) {
          dispatch(toast.error("Could not delete the room", e?.message));
        } finally {
          dispatch(hideLoader());
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
        dispatch(showLoader("Deleting bed"));
        try {
          const res = await ipdService.deleteBed(b.id);
          if (res.status >= 200 && res.status < 300) {
            dispatch(toast.success("Bed deleted", b.bedIdentifier));
            void load();
          }
        } catch (e: any) {
          dispatch(toast.error("Could not delete the bed", e?.message));
        } finally {
          dispatch(hideLoader());
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
        dispatch(showLoader("Deleting amenity"));
        try {
          const res = await ipdService.deleteAmenity(a.id);
          if (res.status >= 200 && res.status < 300) {
            dispatch(toast.success("Amenity deleted", a.name));
            void load();
          }
        } catch (e: any) {
          dispatch(toast.error("Could not delete the amenity", e?.message));
        } finally {
          dispatch(hideLoader());
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
      header: "Location",
      hideBelow: "md",
      render: (r) => (
        <span className="text-[12.5px] text-ink-600">
          {[r.floor, r.wing].filter(Boolean).join(" · ") || "—"}
        </span>
      ),
    },
    {
      key: "gender",
      header: "Ward",
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

  const writable = canCreate("ipd") || canEdit("ipd");

  return (
    <>
      <PageIntro
        title="Ward setup"
        description="The configuration console of the ward & bed master: room types, rooms, beds and amenities. Everything the ward board reads is created here — a new hospital goes from zero to a full ward in four steps."
        module="ipd"
        back
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              icon={<Building2 />}
              onClick={() => navigate("/ipd")}
            >
              Ward board
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={<RefreshCw />}
              loading={loading}
              onClick={() => void load()}
            >
              Refresh
            </Button>
          </>
        }
        meta={
          <>
            <Badge tone="neutral">{roomTypes.length} room types</Badge>
            <Badge tone="brand">{rooms.length} rooms</Badge>
            <Badge tone="mint">{beds.length} beds</Badge>
            <Badge tone="lagoon">{amenities.length} amenities</Badge>
          </>
        }
      />

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <Panel className="p-4">
          {/* ------------------------------- tabs ------------------------------- */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {(
              [
                {
                  value: "types",
                  label: "Room types",
                  count: roomTypes.length,
                },
                { value: "rooms", label: "Rooms", count: rooms.length },
                { value: "beds", label: "Beds", count: beds.length },
                {
                  value: "amenities",
                  label: "Amenities",
                  count: amenities.length,
                },
              ] as { value: TabValue; label: string; count: number }[]
            ).map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={
                  tab === t.value
                    ? "rounded-lg bg-brand-600 px-3 py-1.5 text-[12.5px] font-semibold text-white"
                    : "rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink-600 transition-colors hover:border-brand-300 hover:text-brand-700"
                }
              >
                {t.label}
                <span className="num ml-1.5 opacity-70">{t.count}</span>
              </button>
            ))}
          </div>

          {/* ----------------------------- room types ---------------------------- */}
          {tab === "types" && (
            <SectionPanel
              title="Room types"
              subtitle="The wards as they are billed — rates, flags and BOR inclusion"
              icon={<Building2 className="size-4.5" />}
              action={
                <Button
                  size="sm"
                  icon={<Plus />}
                  disabled={!canCreate("ipd")}
                  onClick={() => setTypeDialog({ open: true, editing: null })}
                >
                  New room type
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
                      disabled={!canEdit("ipd")}
                      onClick={() => setTypeDialog({ open: true, editing: t })}
                      aria-label={`Edit ${t.name}`}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 />}
                      disabled={!canEdit("ipd")}
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
                  icon={<Plus />}
                  disabled={!canCreate("ipd") || roomTypes.length === 0}
                  onClick={() => setRoomDialog({ open: true, editing: null })}
                >
                  New room
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
                    ...roomTypes.map((t) => ({ value: t.id, label: t.name })),
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
                      disabled={!canCreate("ipd")}
                      onClick={() => setBulkOpen({ open: true, roomId: r.id })}
                    >
                      Beds
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Sparkles />}
                      disabled={!canEdit("ipd")}
                      onClick={() => setAmenitiesRoom(r)}
                    >
                      Amenities
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Pencil />}
                      disabled={!canEdit("ipd")}
                      onClick={() => setRoomDialog({ open: true, editing: r })}
                      aria-label={`Edit ${r.roomNumber}`}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 />}
                      disabled={!canEdit("ipd")}
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
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Plus />}
                    disabled={!canCreate("ipd") || rooms.length === 0}
                    onClick={() => setBedDialog({ open: true, roomId: null })}
                  >
                    New bed
                  </Button>
                  <Button
                    size="sm"
                    icon={<BedDouble />}
                    disabled={!canCreate("ipd") || rooms.length === 0}
                    onClick={() => setBulkOpen({ open: true, roomId: null })}
                  >
                    Generate beds
                  </Button>
                </div>
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
                    ...roomTypes.map((t) => ({ value: t.id, label: t.name })),
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
                    disabled={!canEdit("ipd")}
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
                  icon={<Plus />}
                  disabled={!canCreate("ipd")}
                  onClick={() =>
                    setAmenityDialog({ open: true, editing: null })
                  }
                >
                  New amenity
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
                      disabled={!canEdit("ipd")}
                      onClick={() =>
                        setAmenityDialog({ open: true, editing: a })
                      }
                      aria-label={`Edit ${a.name}`}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 />}
                      disabled={!canEdit("ipd")}
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
                description="You can review the ward setup, but creating and editing needs the create/edit right on the IPD module."
              />
            </div>
          )}
        </Panel>
      )}

      {/* -------------------------------- dialogs ------------------------------- */}
      <RoomTypeDialog
        open={typeDialog.open}
        onOpenChange={(v) =>
          !v && setTypeDialog({ open: false, editing: null })
        }
        editing={typeDialog.editing}
        onDone={() => void load()}
      />

      <RoomDialog
        open={roomDialog.open}
        onOpenChange={(v) =>
          !v && setRoomDialog({ open: false, editing: null })
        }
        editing={roomDialog.editing}
        roomTypes={roomTypes}
        onDone={() => void load()}
      />

      <BedDialog
        open={bedDialog.open}
        onOpenChange={(v) => !v && setBedDialog({ open: false, roomId: null })}
        rooms={rooms}
        presetRoomId={bedDialog.roomId}
        onDone={() => void load()}
      />

      <BulkBedsDialog
        open={bulkOpen.open}
        onOpenChange={(v) => !v && setBulkOpen({ open: false, roomId: null })}
        rooms={rooms}
        presetRoomId={bulkOpen.roomId}
        onDone={() => void load()}
      />

      <RoomAmenitiesDialog
        open={!!amenitiesRoom}
        onOpenChange={(v) => !v && setAmenitiesRoom(null)}
        room={amenitiesRoom}
        onDone={() => void load()}
      />

      <AmenityDialog
        open={amenityDialog.open}
        onOpenChange={(v) =>
          !v && setAmenityDialog({ open: false, editing: null })
        }
        editing={amenityDialog.editing}
        onDone={() => void load()}
      />

      {confirmNode}
    </>
  );
}

export default IpdWardSetupPage;
