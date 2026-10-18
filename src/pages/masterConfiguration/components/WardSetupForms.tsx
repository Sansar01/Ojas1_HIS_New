/**
 * Ward-setup forms — room types, rooms, beds (one + bulk) and amenities.
 *
 * These are the write half of the ward & bed master (`hims-v2`,
 * `src/hospital/masters/ward-room`), rendered as inline panels INSIDE the
 * ward-setup dialog (no second modal pops over it). Each form owns its local
 * state, calls the service in a `try…catch`, toasts on failure and refreshes
 * the console through `onDone()`; `onClose()` collapses the panel, on cancel
 * or after a successful save.
 *
 * The panel is mounted fresh for every open and keys off the row being edited,
 * so the state initialisers seed the fields (no reset effects, no flash).
 *
 * Field names mirror the backend DTOs 1:1 — see `src/types/ipdTypes.ts`
 * (`CreateRoomTypePayload` …).
 */

import { useEffect, useState } from "react";
import { useForm } from "@/hooks/useForm";
import {
  roomTypeSchema,
  ROOM_TYPE_LABELS,
  roomSchema,
  ROOM_LABELS,
  bedSchema,
  BED_LABELS,
  bulkBedsSchema,
  BULK_BEDS_LABELS,
  amenitySchema,
  AMENITY_LABELS,
} from "@/pages/masterConfiguration/ward.schema";
import { BedDouble, Plus } from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { toast } from "@/store/slices/uiSlice";
import { Badge, Button } from "@/components/ui/primitives";
import {
  Checkbox,
  Input,
  NumberInput,
  Select,
  Switch,
  Textarea,
} from "@/components/ui/fields";
import { wardMasterService } from "@/pages/masterConfiguration/wardMaster.service";
import { WARD_GENDER_LABEL } from "@/constants/ipd.constants";
import {
  type AmenityRow,
  type BulkBedsResult,
  type RoomRow,
  type RoomTypeRow,
  type WardGender,
} from "@/types/ipdTypes";

/* -------------------------------- helpers --------------------------------- */

const GENDER_OPTIONS = (
  Object.keys(WARD_GENDER_LABEL) as WardGender[]
).map((value) => ({ value, label: WARD_GENDER_LABEL[value] }));

/** Two-column form grid used by every dialog below. */
function Row({
  children,
  cols = 2,
}: {
  children: React.ReactNode;
  cols?: 1 | 2 | 3;
}) {
  return (
    <div
      className={
        cols === 1
          ? "space-y-3"
          : cols === 3
            ? "grid gap-3 sm:grid-cols-3"
            : "grid gap-3 sm:grid-cols-2"
      }
    >
      {children}
    </div>
  );
}

/**
 * The surface every ward-setup form renders in — the same design language as
 * the Global Master Configuration "add a …" row: a plain heading with a
 * one-line description, then ONE tinted surface that holds the fields and the
 * action button inline (no header strip, no footer bar, no second panel).
 */
function FormPanel({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div>
        <h3 className="text-[15px] font-semibold text-ink-900">{title}</h3>
        <p className="text-[12.5px] text-ink-400">{description}</p>
      </div>
      <div className="rounded-xl border border-ink-100 bg-ink-25/40 p-3">
        <div className="space-y-3">{children}</div>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {footer}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- room type -------------------------------- */

export function RoomTypeForm({
  editing,
  onDone,
  onClose,
}: {
  /** null ⇒ create */
  editing: RoomTypeRow | null;
  onDone?: () => void;
  /** Collapse the panel — cancel, or after a successful save. */
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  /**
   * The shared form hook owns values, validation and the touched rule: a field
   * only reports its error once it has been edited (or a submit was attempted),
   * which is exactly what the always-visible panel needs. `editing` seeds the
   * values and the panel remounts per open, so no reset effect is required.
   */
  const form = useForm({
    initialValues: {
      name: editing?.name ?? "",
      code: editing?.code ?? "",
      description: "",
      defaultRate: Number(editing?.defaultRate ?? 0) || 0,
      nursingCharge: Number(editing?.nursingCharge ?? 0) || 0,
      sortOrder: Number(editing?.sortOrder ?? 0) || 0,
      isCount: editing?.isCount ?? true,
      isEmergency: editing?.isEmergency ?? false,
      isDaycare: editing?.isDaycare ?? false,
      isDialysis: editing?.isDialysis ?? false,
      isActive: editing?.isActive ?? true,
    },
    schema: roomTypeSchema,
    labels: ROOM_TYPE_LABELS,
  });

  const submit = form.handleSubmit(async (v) => {
    const payload = {
      name: v.name.trim(),
      code: v.code.trim().toUpperCase(),
      description: v.description.trim() || undefined,
      defaultRate: v.defaultRate,
      nursingCharge: v.nursingCharge,
      sortOrder: v.sortOrder,
      isCount: v.isCount,
      isEmergency: v.isEmergency,
      isDaycare: v.isDaycare,
      isDialysis: v.isDialysis,
      isActive: v.isActive,
    };
    try {
      const res = editing
        ? await wardMasterService.updateRoomType(editing.id, payload)
        : await wardMasterService.createRoomType(payload);
      if (res.status >= 200 && res.status < 300) {
        dispatch(
          toast.success(
            editing ? "Room type updated" : "Room type created",
            `${payload.name} · ${payload.code}`,
          ),
        );
        onDone?.();
        onClose();
      }
    } catch (e: any) {
      dispatch(toast.error("Could not save the room type", e?.message));
    }
  });

  return (
    <FormPanel
      title={editing ? `Edit room type · ${editing.name}` : "Add a room type"}
      description="Room types are the wards the hospital is billed by — General Ward, ICU, Private, Daycare… Rates live here; rooms and beds inherit from them."
      footer={
        <>
          {editing && (
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button
            type="button"
            icon={editing ? undefined : <Plus />}
            loading={form.submitting}
            disabled={!form.values.name.trim() || !form.values.code.trim()}
            onClick={() => void submit()}
          >
            {editing ? "Save changes" : "Add room type"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Row>
          <Input
            label="Name"
            required
            name="rtName"
            value={form.values.name}
            error={form.errorFor("name")}
            onChange={(e) => {
              form.setValue("name", e.target.value);
              form.touch("name");
            }}
            placeholder="Intensive Care Unit"
          />
          <Input
            label="Code"
            required
            name="rtCode"
            value={form.values.code}
            error={form.errorFor("code")}
            onChange={(e) => {
              form.setValue("code", e.target.value.toUpperCase());
              form.touch("code");
            }}
            placeholder="ICU"
            hint="Letters, digits, underscore and hyphen only"
          />
        </Row>

        <Row>
          <NumberInput
            label="Default rate / day"
            value={form.values.defaultRate}
            onValueChange={(n) => form.setValue("defaultRate", n)}
            suffix="₹"
          />
          <NumberInput
            label="Nursing charge / day"
            value={form.values.nursingCharge}
            onValueChange={(n) => form.setValue("nursingCharge", n)}
            suffix="₹"
          />
        </Row>

        <Row>
          <NumberInput
            label="Sort order"
            value={form.values.sortOrder}
            onValueChange={(n) => form.setValue("sortOrder", n)}
            hint="Report order of the wards"
          />
        </Row>

        <Row cols={2}>
          <Checkbox
            checked={form.values.isCount}
            onCheckedChange={(b) => form.setValue("isCount", b)}
            label="Counts toward BOR"
            description="Recovery/porter beds stay uncounted"
          />
          <Checkbox
            checked={form.values.isEmergency}
            onCheckedChange={(b) => form.setValue("isEmergency", b)}
            label="Emergency type"
            description="Admissions bypass the wizard"
          />
          <Checkbox
            checked={form.values.isDaycare}
            onCheckedChange={(b) => form.setValue("isDaycare", b)}
            label="Daycare type"
            description="24-hour cap on the stay"
          />
          <Checkbox
            checked={form.values.isDialysis}
            onCheckedChange={(b) => form.setValue("isDialysis", b)}
            label="Dialysis type"
            description="Session-based billing"
          />
        </Row>

        <Textarea
          label="Description"
          name="rtDescription"
          rows={2}
          value={form.values.description}
          onChange={(e) => form.setValue("description", e.target.value)}
        />

        <Switch
          checked={form.values.isActive}
          onCheckedChange={(b) => form.setValue("isActive", b)}
          label={form.values.isActive ? "Active" : "Inactive"}
          description="Turn off to retire the type without deleting it."
        />
      </div>
    </FormPanel>
  );
}

/* --------------------------------- room ----------------------------------- */

export function RoomForm({
  editing,
  roomTypes,
  onDone,
  onClose,
}: {
  /** null ⇒ create */
  editing: RoomRow | null;
  roomTypes: RoomTypeRow[];
  onDone?: () => void;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  /* Values, validation and touched state live in the shared form hook. */
  const form = useForm({
    initialValues: {
      roomTypeId: editing?.roomType?.id ?? "",
      roomNumber: editing?.roomNumber ?? "",
      floor: editing?.floor ?? "",
      wing: editing?.wing ?? "",
      gender: (((editing?.gender ?? "ANY") as WardGender) || "ANY") as WardGender,
      maxBeds: 0,
      notes: "",
      hasAC: false,
      hasAttachedBath: false,
      hasTV: false,
      hasOxygen: false,
      hasMonitor: false,
      isActive: editing?.isActive ?? true,
    },
    schema: roomSchema,
    labels: ROOM_LABELS,
  });

  const submit = form.handleSubmit(async (v) => {
    const payload = {
      roomTypeId: v.roomTypeId,
      roomNumber: v.roomNumber.trim(),
      floor: v.floor.trim() || undefined,
      wing: v.wing.trim() || undefined,
      gender: v.gender,
      ...(v.maxBeds > 0 ? { maxBeds: v.maxBeds } : {}),
      hasAC: v.hasAC,
      hasAttachedBath: v.hasAttachedBath,
      hasTV: v.hasTV,
      hasOxygen: v.hasOxygen,
      hasMonitor: v.hasMonitor,
      notes: v.notes.trim() || undefined,
      isActive: v.isActive,
    };
    try {
      const res = editing
        ? await wardMasterService.updateRoom(editing.id, payload)
        : await wardMasterService.createRoom(payload);
      if (res.status >= 200 && res.status < 300) {
        dispatch(
          toast.success(
            editing ? "Room updated" : "Room created",
            `${payload.roomNumber} · ${WARD_GENDER_LABEL[payload.gender]}`,
          ),
        );
        onDone?.();
        onClose();
      }
    } catch (e: any) {
      dispatch(toast.error("Could not save the room", e?.message));
    }
  });

  return (
    <FormPanel
      title={editing ? `Edit room · ${editing.roomNumber}` : "Add a room"}
      description="A room belongs to one ward type and carries the gender rule the server enforces on bed assignment. Beds are added separately (one or 01–N in a batch)."
      footer={
        <>
          {editing && (
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button
            type="button"
            icon={editing ? undefined : <Plus />}
            loading={form.submitting}
            disabled={!form.values.roomTypeId || !form.values.roomNumber.trim()}
            onClick={() => void submit()}
          >
            {editing ? "Save changes" : "Add room"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Row>
          <Select
            label="Room type"
            required
            name="roomTypeId"
            value={form.values.roomTypeId}
            onChange={(v) => {
              form.setValue("roomTypeId", v);
              form.touch("roomTypeId");
            }}
            options={roomTypes.map((t) => ({ value: t.id, label: t.name }))}
            placeholder="Select the ward type…"
          />
          <Input
            label="Room number"
            required
            name="roomNumber"
            value={form.values.roomNumber}
            error={form.errorFor("roomNumber")}
            onChange={(e) => {
              form.setValue("roomNumber", e.target.value);
              form.touch("roomNumber");
            }}
            placeholder="GW-1"
            hint="Unique inside the hospital"
          />
        </Row>

        <Row cols={3}>
          <Input
            label="Floor"
            name="floor"
            value={form.values.floor}
            onChange={(e) => form.setValue("floor", e.target.value)}
            placeholder="1st"
          />
          <Input
            label="Wing"
            name="wing"
            value={form.values.wing}
            onChange={(e) => form.setValue("wing", e.target.value)}
            placeholder="East"
          />
          <Select
            label="Ward gender"
            name="gender"
            value={form.values.gender}
            onChange={(v) => form.setValue("gender", v as WardGender)}
            options={GENDER_OPTIONS}
          />
        </Row>

        <NumberInput
          label="Max beds (optional)"
          value={form.values.maxBeds}
          onValueChange={(n) => form.setValue("maxBeds", n)}
          min={0}
          max={500}
          hint="A planning cap; beds themselves are created one by one or in bulk"
        />

        <Row cols={2}>
          <Checkbox
            checked={form.values.hasAC}
            onCheckedChange={(b) => form.setValue("hasAC", b)}
            label="Air conditioned"
          />
          <Checkbox
            checked={form.values.hasAttachedBath}
            onCheckedChange={(b) => form.setValue("hasAttachedBath", b)}
            label="Attached bathroom"
          />
          <Checkbox checked={form.values.hasTV} onCheckedChange={(b) => form.setValue("hasTV", b)} label="Television" />
          <Checkbox
            checked={form.values.hasOxygen}
            onCheckedChange={(b) => form.setValue("hasOxygen", b)}
            label="Oxygen point"
          />
          <Checkbox
            checked={form.values.hasMonitor}
            onCheckedChange={(b) => form.setValue("hasMonitor", b)}
            label="Bedside monitor"
          />
        </Row>

        <Textarea
          label="Notes"
          name="roomNotes"
          rows={2}
          value={form.values.notes}
          onChange={(e) => form.setValue("notes", e.target.value)}
        />

        <Switch
          checked={form.values.isActive}
          onCheckedChange={(b) => form.setValue("isActive", b)}
          label={form.values.isActive ? "Active" : "Inactive"}
          description="Inactive rooms stay out of the bed picker."
        />
      </div>
    </FormPanel>
  );
}

/* ----------------------------- beds: single -------------------------------- */

export function BedForm({
  rooms,
  presetRoomId,
  onDone,
  onClose,
}: {
  rooms: RoomRow[];
  /** pre-selected room when opened from a room row */
  presetRoomId?: string | null;
  onDone?: () => void;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  /* Values, validation and touched state live in the shared form hook. */
  const form = useForm({
    initialValues: { roomId: presetRoomId ?? "", bedNumber: "" },
    schema: bedSchema,
    labels: BED_LABELS,
  });

  const submit = form.handleSubmit(async (v) => {
    try {
      const res = await wardMasterService.createBed({
        roomId: v.roomId,
        bedNumber: v.bedNumber.trim(),
      });
      if (res.status >= 200 && res.status < 300) {
        dispatch(
          toast.success(
            "Bed created",
            `${(res.data as any)?.bedIdentifier ?? v.bedNumber} · initial state AVAILABLE`,
          ),
        );
        onDone?.();
        onClose();
      }
    } catch (e: any) {
      dispatch(toast.error("Could not create the bed", e?.message));
    }
  });

  return (
    <FormPanel
      title="Add a bed"
      description="The bed identifier is generated by the server from the room number and the bed number (GW-1 + 01 → GW-1/01) and starts AVAILABLE."
      footer={
        <>
          <Button
            type="button"
            icon={<Plus />}
            loading={form.submitting}
            disabled={!form.values.roomId || !form.values.bedNumber.trim()}
            onClick={() => void submit()}
          >
            Add bed
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Room"
          required
          name="bedRoomId"
          value={form.values.roomId}
          onChange={(v) => {
            form.setValue("roomId", v);
            form.touch("roomId");
          }}
          options={rooms.map((r) => ({
            value: r.id,
            label: `${r.roomNumber} · ${r.roomType?.name ?? ""}`,
          }))}
          placeholder="Select the room…"
        />
        <Input
          label="Bed number"
          required
          name="bedNumber"
          value={form.values.bedNumber}
          error={form.errorFor("bedNumber")}
          onChange={(e) => {
            form.setValue("bedNumber", e.target.value);
            form.touch("bedNumber");
          }}
          placeholder="01"
          hint="Any short label — 01, 02, A, B…"
        />
      </div>
    </FormPanel>
  );
}

/* ------------------------------- beds: bulk -------------------------------- */

export function BulkBedsForm({
  rooms,
  presetRoomId,
  onDone,
  onClose,
}: {
  rooms: RoomRow[];
  presetRoomId?: string | null;
  onDone?: () => void;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const form = useForm({
    initialValues: {
      roomId: presetRoomId ?? "",
      startNumber: 1,
      endNumber: 20,
      prefix: "",
    },
    schema: bulkBedsSchema,
    labels: BULK_BEDS_LABELS,
  });
  /* The per-run result is page state, not a form field. */
  const [result, setResult] = useState<BulkBedsResult | null>(null);

  const planned = form.values.endNumber - form.values.startNumber + 1;
  const tooBig = planned > 500 || planned <= 0;

  const submit = form.handleSubmit(async (v) => {
    if (tooBig) return;
    try {
      const res = await wardMasterService.bulkCreateBeds({
        roomId: v.roomId,
        startNumber: v.startNumber,
        endNumber: v.endNumber,
        ...(v.prefix.trim() ? { prefix: v.prefix.trim() } : {}),
      });
      if (res.status >= 200 && res.status < 300) {
        setResult(res.data as BulkBedsResult);
        onDone?.();
      }
    } catch (e: any) {
      dispatch(toast.error("Could not generate the beds", e?.message));
    }
  });

  return (
    <FormPanel
      title="Generate beds"
      description="Creates a numbered run of beds in one call — re-running after adding five more creates the missing ones and reports the rest as skipped."
      footer={
        result ? (
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              type="button"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              icon={<BedDouble />}
              loading={form.submitting}
              disabled={!form.values.roomId || tooBig}
              onClick={() => void submit()}
            >
              Generate {planned > 0 && !tooBig ? planned : ""} beds
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-mint-500/30 bg-mint-50/50 px-4 py-3">
            <p className="text-[13.5px] font-semibold text-ink-800">
              {result.created} bed(s) created · {result.skipped} skipped
            </p>
            <p className="mt-1 text-[12.5px] text-ink-500">
              Skipped means the bed number already existed — not a failure.
              Every new bed starts AVAILABLE.
            </p>
          </div>
          {result.errors?.length > 0 && (
            <ul className="space-y-1">
              {result.errors.slice(0, 5).map((e, i) => (
                <li
                  key={i}
                  className="rounded-md bg-coral-50 px-2 py-1 text-[11.5px] text-coral-700"
                >
                  {e.bedNumber ? `${e.bedNumber}: ` : ""}
                  {e.message ?? "Could not be created"}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <Select
            label="Room"
            required
            name="bulkRoomId"
            value={form.values.roomId}
            onChange={(v) => {
              form.setValue("roomId", v);
              form.touch("roomId");
            }}
            options={rooms.map((r) => ({
              value: r.id,
              label: `${r.roomNumber} · ${r.roomType?.name ?? ""}`,
            }))}
            placeholder="Select the room…"
          />
          <Row cols={3}>
            <NumberInput
              label="From"
              value={form.values.startNumber}
              onValueChange={(n) => form.setValue("startNumber", n)}
              min={0}
              max={500}
            />
            <NumberInput
              label="To"
              value={form.values.endNumber}
              onValueChange={(n) => form.setValue("endNumber", n)}
              min={0}
              max={500}
            />
            <Input
              label="Prefix (optional)"
              name="bulkPrefix"
              value={form.values.prefix}
              onChange={(e) => form.setValue("prefix", e.target.value.toUpperCase())}
              placeholder="A"
              hint="A → A01, A02…"
            />
          </Row>
          <p className="text-[12.5px] text-ink-500">
            {tooBig
              ? "Pick a range of 1–500 beds."
              : `${planned} bed(s) will be created in the selected room.`}
          </p>
        </div>
      )}
    </FormPanel>
  );
}

/* ----------------------------- room amenities ------------------------------ */

export function RoomAmenitiesForm({
  room,
  onDone,
  onClose,
}: {
  /** the panel only mounts with a room — the row action passes it */
  room: RoomRow;
  onDone?: () => void;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  /**
   * The mapping is the form value — it seeds from the room row the panel
   * opened with. The amenity LIST is remote data for the checkboxes, and its
   * loading flag stays local (it is not a submit).
   */
  const form = useForm({
    initialValues: {
      selected: (room.amenities ?? []).map((a) => a.amenity?.id).filter(Boolean),
    },
  });
  const [loading, setLoading] = useState(false);
  const [amenities, setAmenities] = useState<AmenityRow[]>([]);

  /* The amenity master list loads once, when the panel opens. */
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await wardMasterService.fetchAmenities();
        if (active) setAmenities((res.data as AmenityRow[]) ?? []);
      } catch (e: any) {
        dispatch(toast.error("Could not load amenities", e?.message));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [dispatch, room]);

  const toggle = (id: string) =>
    form.setValue(
      "selected",
      form.values.selected.includes(id)
        ? form.values.selected.filter((x) => x !== id)
        : [...form.values.selected, id],
    );

  const submit = form.handleSubmit(async (v) => {
    if (!room) return;
    try {
      const res = await wardMasterService.setRoomAmenities(room.id, v.selected);
      if (res.status >= 200 && res.status < 300) {
        dispatch(
          toast.success(
            "Amenities updated",
            `${room.roomNumber} · ${v.selected.length} mapped`,
          ),
        );
        onDone?.();
        onClose();
      }
    } catch (e: any) {
      dispatch(toast.error("Could not save the amenities", e?.message));
    }
  });

  return (
    <FormPanel
      title={`Amenities · ${room.roomNumber}`}
      description="Replaces the room's amenity mapping atomically — a private room with AC can then be found by rooms/by-amenity during admission triage."
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Back
          </Button>
          <Button
            type="button"
            loading={form.submitting}
            disabled={loading}
            onClick={() => void submit()}
          >
            Save amenities
          </Button>
        </>
      }
    >
      {loading ? (
        <p className="text-[12.5px] text-ink-500">Loading amenities…</p>
      ) : amenities.length === 0 ? (
        <p className="text-[12.5px] text-ink-500">
          No amenities exist yet — create them under the Amenities tab first.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {amenities.map((a) => (
            <Checkbox
              key={a.id}
              checked={form.values.selected.includes(a.id)}
              onCheckedChange={() => toggle(a.id)}
              label={
                <span className="inline-flex items-center gap-2">
                  {a.name}
                  {!a.isActive && <Badge tone="neutral">inactive</Badge>}
                </span>
              }
              description={a.code}
            />
          ))}
        </div>
      )}
    </FormPanel>
  );
}

/* -------------------------------- amenity ---------------------------------- */

export function AmenityForm({
  editing,
  onDone,
  onClose,
}: {
  /** null ⇒ create */
  editing: AmenityRow | null;
  onDone?: () => void;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  /* Values, validation and touched state live in the shared form hook. */
  const form = useForm({
    initialValues: {
      name: editing?.name ?? "",
      code: editing?.code ?? "",
      icon: editing?.icon ?? "",
      isActive: editing?.isActive ?? true,
    },
    schema: amenitySchema,
    labels: AMENITY_LABELS,
  });

  const submit = form.handleSubmit(async (v) => {
    const payload = {
      name: v.name.trim(),
      code: v.code.trim().toUpperCase(),
      icon: v.icon.trim() || undefined,
      isActive: v.isActive,
    };
    try {
      const res = editing
        ? await wardMasterService.updateAmenity(editing.id, payload)
        : await wardMasterService.createAmenity(payload);
      if (res.status >= 200 && res.status < 300) {
        dispatch(
          toast.success(
            editing ? "Amenity updated" : "Amenity created",
            `${payload.name} · ${payload.code}`,
          ),
        );
        onDone?.();
        onClose();
      }
    } catch (e: any) {
      dispatch(toast.error("Could not save the amenity", e?.message));
    }
  });

  return (
    <FormPanel
      title={editing ? `Edit amenity · ${editing.name}` : "Add an amenity"}
      description="Amenities are a master list mapped to rooms (oxygen point, AC, TV, intercom…). Retire one with the Active switch — deleting is blocked while rooms still use it."
      footer={
        <>
          {editing && (
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button
            type="button"
            icon={editing ? undefined : <Plus />}
            loading={form.submitting}
            disabled={!form.values.name.trim() || !form.values.code.trim()}
            onClick={() => void submit()}
          >
            {editing ? "Save changes" : "Add amenity"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Row>
          <Input
            label="Name"
            required
            name="amName"
            value={form.values.name}
            error={form.errorFor("name")}
            onChange={(e) => {
              form.setValue("name", e.target.value);
              form.touch("name");
            }}
            placeholder="Oxygen point"
          />
          <Input
            label="Code"
            required
            name="amCode"
            value={form.values.code}
            error={form.errorFor("code")}
            onChange={(e) => {
              form.setValue("code", e.target.value.toUpperCase());
              form.touch("code");
            }}
            placeholder="OXYGEN"
            hint="Letters, digits, underscore and hyphen only"
          />
        </Row>
        <Input
          label="Icon (optional)"
          name="amIcon"
          value={form.values.icon}
          onChange={(e) => form.setValue("icon", e.target.value)}
          placeholder="snowflake"
          hint="Identifier for the UI icon, e.g. snowflake, tv"
        />
        <Switch
          checked={form.values.isActive}
          onCheckedChange={(b) => form.setValue("isActive", b)}
          label={form.values.isActive ? "Active" : "Inactive"}
          description="Inactive amenities stay off the pickers but keep their mappings."
        />
      </div>
    </FormPanel>
  );
}
