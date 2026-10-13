/**
 * Ward-setup dialogs — room types, rooms, beds (one + bulk) and amenities.
 *
 * These are the write half of the ward & bed master (`hims-v2`,
 * `src/hospital/masters/ward-room`). Each dialog is a plain `<Dialog>` with
 * page-owned content and footer (the shell convention of this codebase): local
 * state, the service call in a `try…catch`, a toast on failure, and the owning
 * page's list refresh through `onDone()`.
 *
 * Field names mirror the backend DTOs 1:1 — see `src/types/ipdTypes.ts`
 * (`CreateRoomTypePayload` …). Writes raise the app-wide loader exactly like
 * every other write in the IPD module.
 *
 * Lives in the IPD feature folder (`src/pages/ipd/components/`).
 */

import { useEffect, useState } from "react";
import { BedDouble, Pencil } from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { hideLoader, showLoader, toast } from "@/store/slices/uiSlice";
import { Badge, Button } from "@/components/ui/primitives";
import {
  Checkbox,
  Input,
  NumberInput,
  Select,
  Switch,
  Textarea,
} from "@/components/ui/fields";
import { Dialog } from "@/components/ui/overlays";
import { ipdService } from "@/pages/ipd/ipd.service";
import { WARD_GENDER_LABEL } from "@/constants/ipd.constants";
import {
  type AmenityRow,
  type BulkBedsResult,
  type RoomRow,
  type RoomTypeRow,
  type WardGender,
} from "@/types/ipdTypes";

/* -------------------------------- helpers --------------------------------- */

/** 200 or 201 — writes answer CREATED, status moves answer OK. */
const isOk = (status: number) => status >= 200 && status < 300;

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

/** The little "required" dots — all of these masters validate server-side too. */
const err = (value: string, required = true) =>
  required && !value.trim() ? "Required" : undefined;

/* ------------------------------- room type -------------------------------- */

export function RoomTypeDialog({
  open,
  onOpenChange,
  editing,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null ⇒ create */
  editing: RoomTypeRow | null;
  onDone?: () => void;
}) {
  const dispatch = useAppDispatch();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [defaultRate, setDefaultRate] = useState(0);
  const [nursingCharge, setNursingCharge] = useState(0);
  const [sortOrder, setSortOrder] = useState(0);
  const [isCount, setIsCount] = useState(true);
  const [isEmergency, setIsEmergency] = useState(false);
  const [isDaycare, setIsDaycare] = useState(false);
  const [isDialysis, setIsDialysis] = useState(false);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setCode(editing?.code ?? "");
    setDescription("");
    setDefaultRate(Number(editing?.defaultRate ?? 0) || 0);
    setNursingCharge(Number(editing?.nursingCharge ?? 0) || 0);
    setSortOrder(Number(editing?.sortOrder ?? 0) || 0);
    setIsCount(editing?.isCount ?? true);
    setIsEmergency(editing?.isEmergency ?? false);
    setIsDaycare(editing?.isDaycare ?? false);
    setIsDialysis(editing?.isDialysis ?? false);
    setIsActive(editing?.isActive ?? true);
  }, [open, editing]);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    dispatch(showLoader(editing ? "Saving room type" : "Creating room type"));
    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
        defaultRate,
        nursingCharge,
        sortOrder,
        isCount,
        isEmergency,
        isDaycare,
        isDialysis,
        isActive,
      };
      const res = editing
        ? await ipdService.updateRoomType(editing.id, payload)
        : await ipdService.createRoomType(payload);
      if (isOk(res.status)) {
        dispatch(
          toast.success(
            editing ? "Room type updated" : "Room type created",
            `${payload.name} · ${payload.code}`,
          ),
        );
        onDone?.();
        onOpenChange(false);
      }
    } catch (e: any) {
      dispatch(toast.error("Could not save the room type", e?.message));
    } finally {
      setSaving(false);
      dispatch(hideLoader());
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Edit room type · ${editing.name}` : "New room type"}
      description="Room types are the wards the hospital is billed by — General Ward, ICU, Private, Daycare… Rates live here; rooms and beds inherit from them."
      size="lg"
      footer={
        <>
          <Button
            variant="ghost"
            type="button"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            loading={saving}
            disabled={!name.trim() || !code.trim()}
            onClick={() => void submit()}
          >
            {editing ? "Save changes" : "Create room type"}
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
            value={name}
            error={err(name)}
            onChange={(e) => setName(e.target.value)}
            placeholder="Intensive Care Unit"
          />
          <Input
            label="Code"
            required
            name="rtCode"
            value={code}
            error={err(code)}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ICU"
            hint="Letters, digits, underscore and hyphen only"
          />
        </Row>

        <Row>
          <NumberInput
            label="Default rate / day"
            value={defaultRate}
            onValueChange={setDefaultRate}
            suffix="₹"
          />
          <NumberInput
            label="Nursing charge / day"
            value={nursingCharge}
            onValueChange={setNursingCharge}
            suffix="₹"
          />
        </Row>

        <Row>
          <NumberInput
            label="Sort order"
            value={sortOrder}
            onValueChange={setSortOrder}
            hint="Report order of the wards"
          />
        </Row>

        <Row cols={2}>
          <Checkbox
            checked={isCount}
            onCheckedChange={setIsCount}
            label="Counts toward BOR"
            description="Recovery/porter beds stay uncounted"
          />
          <Checkbox
            checked={isEmergency}
            onCheckedChange={setIsEmergency}
            label="Emergency type"
            description="Admissions bypass the wizard"
          />
          <Checkbox
            checked={isDaycare}
            onCheckedChange={setIsDaycare}
            label="Daycare type"
            description="24-hour cap on the stay"
          />
          <Checkbox
            checked={isDialysis}
            onCheckedChange={setIsDialysis}
            label="Dialysis type"
            description="Session-based billing"
          />
        </Row>

        <Textarea
          label="Description"
          name="rtDescription"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <Switch
          checked={isActive}
          onCheckedChange={setIsActive}
          label={isActive ? "Active" : "Inactive"}
          description="Turn off to retire the type without deleting it."
        />
      </div>
    </Dialog>
  );
}

/* --------------------------------- room ----------------------------------- */

export function RoomDialog({
  open,
  onOpenChange,
  editing,
  roomTypes,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null ⇒ create */
  editing: RoomRow | null;
  roomTypes: RoomTypeRow[];
  onDone?: () => void;
}) {
  const dispatch = useAppDispatch();
  const [saving, setSaving] = useState(false);

  const [roomTypeId, setRoomTypeId] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [floor, setFloor] = useState("");
  const [wing, setWing] = useState("");
  const [gender, setGender] = useState<WardGender>("ANY");
  const [maxBeds, setMaxBeds] = useState(0);
  const [notes, setNotes] = useState("");
  const [hasAC, setHasAC] = useState(false);
  const [hasAttachedBath, setHasAttachedBath] = useState(false);
  const [hasTV, setHasTV] = useState(false);
  const [hasOxygen, setHasOxygen] = useState(false);
  const [hasMonitor, setHasMonitor] = useState(false);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setRoomTypeId(editing?.roomType?.id ?? "");
    setRoomNumber(editing?.roomNumber ?? "");
    setFloor(editing?.floor ?? "");
    setWing(editing?.wing ?? "");
    setGender(((editing?.gender ?? "ANY") as WardGender) || "ANY");
    setMaxBeds(0);
    setNotes("");
    setHasAC(false);
    setHasAttachedBath(false);
    setHasTV(false);
    setHasOxygen(false);
    setHasMonitor(false);
    setIsActive(editing?.isActive ?? true);
  }, [open, editing]);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    dispatch(showLoader(editing ? "Saving room" : "Creating room"));
    try {
      const payload = {
        roomTypeId,
        roomNumber: roomNumber.trim(),
        floor: floor.trim() || undefined,
        wing: wing.trim() || undefined,
        gender,
        ...(maxBeds > 0 ? { maxBeds } : {}),
        hasAC,
        hasAttachedBath,
        hasTV,
        hasOxygen,
        hasMonitor,
        notes: notes.trim() || undefined,
        isActive,
      };
      const res = editing
        ? await ipdService.updateRoom(editing.id, payload)
        : await ipdService.createRoom(payload);
      if (isOk(res.status)) {
        dispatch(
          toast.success(
            editing ? "Room updated" : "Room created",
            `${payload.roomNumber} · ${WARD_GENDER_LABEL[gender]}`,
          ),
        );
        onDone?.();
        onOpenChange(false);
      }
    } catch (e: any) {
      dispatch(toast.error("Could not save the room", e?.message));
    } finally {
      setSaving(false);
      dispatch(hideLoader());
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Edit room · ${editing.roomNumber}` : "New room"}
      description="A room belongs to one ward type and carries the gender rule the server enforces on bed assignment. Beds are added separately (one or 01–N in a batch)."
      size="lg"
      footer={
        <>
          <Button
            variant="ghost"
            type="button"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            loading={saving}
            disabled={!roomTypeId || !roomNumber.trim()}
            onClick={() => void submit()}
          >
            {editing ? "Save changes" : "Create room"}
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
            value={roomTypeId}
            onChange={setRoomTypeId}
            options={roomTypes.map((t) => ({ value: t.id, label: t.name }))}
            placeholder="Select the ward type…"
          />
          <Input
            label="Room number"
            required
            name="roomNumber"
            value={roomNumber}
            error={err(roomNumber)}
            onChange={(e) => setRoomNumber(e.target.value)}
            placeholder="GW-1"
            hint="Unique inside the hospital"
          />
        </Row>

        <Row cols={3}>
          <Input
            label="Floor"
            name="floor"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            placeholder="1st"
          />
          <Input
            label="Wing"
            name="wing"
            value={wing}
            onChange={(e) => setWing(e.target.value)}
            placeholder="East"
          />
          <Select
            label="Ward gender"
            name="gender"
            value={gender}
            onChange={(v) => setGender(v as WardGender)}
            options={GENDER_OPTIONS}
          />
        </Row>

        <NumberInput
          label="Max beds (optional)"
          value={maxBeds}
          onValueChange={setMaxBeds}
          min={0}
          max={500}
          hint="A planning cap; beds themselves are created one by one or in bulk"
        />

        <Row cols={2}>
          <Checkbox
            checked={hasAC}
            onCheckedChange={setHasAC}
            label="Air conditioned"
          />
          <Checkbox
            checked={hasAttachedBath}
            onCheckedChange={setHasAttachedBath}
            label="Attached bathroom"
          />
          <Checkbox checked={hasTV} onCheckedChange={setHasTV} label="Television" />
          <Checkbox
            checked={hasOxygen}
            onCheckedChange={setHasOxygen}
            label="Oxygen point"
          />
          <Checkbox
            checked={hasMonitor}
            onCheckedChange={setHasMonitor}
            label="Bedside monitor"
          />
        </Row>

        <Textarea
          label="Notes"
          name="roomNotes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <Switch
          checked={isActive}
          onCheckedChange={setIsActive}
          label={isActive ? "Active" : "Inactive"}
          description="Inactive rooms stay out of the bed picker."
        />
      </div>
    </Dialog>
  );
}

/* ----------------------------- beds: single -------------------------------- */

export function BedDialog({
  open,
  onOpenChange,
  rooms,
  presetRoomId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: RoomRow[];
  /** pre-selected room when opened from a room row */
  presetRoomId?: string | null;
  onDone?: () => void;
}) {
  const dispatch = useAppDispatch();
  const [saving, setSaving] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [bedNumber, setBedNumber] = useState("");

  useEffect(() => {
    if (!open) return;
    setRoomId(presetRoomId ?? "");
    setBedNumber("");
  }, [open, presetRoomId]);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    dispatch(showLoader("Creating bed"));
    try {
      const res = await ipdService.createBed({
        roomId,
        bedNumber: bedNumber.trim(),
      });
      if (isOk(res.status)) {
        dispatch(
          toast.success(
            "Bed created",
            `${(res.data as any)?.bedIdentifier ?? bedNumber} · initial state AVAILABLE`,
          ),
        );
        onDone?.();
        onOpenChange(false);
      }
    } catch (e: any) {
      dispatch(toast.error("Could not create the bed", e?.message));
    } finally {
      setSaving(false);
      dispatch(hideLoader());
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New bed"
      description="The bed identifier is generated by the server from the room number and the bed number (GW-1 + 01 → GW-1/01) and starts AVAILABLE."
      size="md"
      footer={
        <>
          <Button
            variant="ghost"
            type="button"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            loading={saving}
            disabled={!roomId || !bedNumber.trim()}
            onClick={() => void submit()}
          >
            Create bed
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Room"
          required
          name="bedRoomId"
          value={roomId}
          onChange={setRoomId}
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
          value={bedNumber}
          error={err(bedNumber)}
          onChange={(e) => setBedNumber(e.target.value)}
          placeholder="01"
          hint="Any short label — 01, 02, A, B…"
        />
      </div>
    </Dialog>
  );
}

/* ------------------------------- beds: bulk -------------------------------- */

export function BulkBedsDialog({
  open,
  onOpenChange,
  rooms,
  presetRoomId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: RoomRow[];
  presetRoomId?: string | null;
  onDone?: () => void;
}) {
  const dispatch = useAppDispatch();
  const [saving, setSaving] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [startNumber, setStartNumber] = useState(1);
  const [endNumber, setEndNumber] = useState(20);
  const [prefix, setPrefix] = useState("");
  const [result, setResult] = useState<BulkBedsResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setRoomId(presetRoomId ?? "");
    setStartNumber(1);
    setEndNumber(20);
    setPrefix("");
    setResult(null);
  }, [open, presetRoomId]);

  const planned = endNumber - startNumber + 1;
  const tooBig = planned > 500 || planned <= 0;

  const submit = async () => {
    if (saving || tooBig) return;
    setSaving(true);
    dispatch(showLoader("Generating beds"));
    try {
      const res = await ipdService.bulkCreateBeds({
        roomId,
        startNumber,
        endNumber,
        ...(prefix.trim() ? { prefix: prefix.trim() } : {}),
      });
      if (isOk(res.status)) {
        const body = res.data as BulkBedsResult;
        setResult(body);
        onDone?.();
      }
    } catch (e: any) {
      dispatch(toast.error("Could not generate the beds", e?.message));
    } finally {
      setSaving(false);
      dispatch(hideLoader());
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Generate beds"
      description="Creates a numbered run of beds in one call — re-running after adding five more creates the missing ones and reports the rest as skipped."
      size="md"
      footer={
        result ? (
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              icon={<BedDouble />}
              loading={saving}
              disabled={!roomId || tooBig}
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
            value={roomId}
            onChange={setRoomId}
            options={rooms.map((r) => ({
              value: r.id,
              label: `${r.roomNumber} · ${r.roomType?.name ?? ""}`,
            }))}
            placeholder="Select the room…"
          />
          <Row cols={3}>
            <NumberInput
              label="From"
              value={startNumber}
              onValueChange={setStartNumber}
              min={0}
              max={500}
            />
            <NumberInput
              label="To"
              value={endNumber}
              onValueChange={setEndNumber}
              min={0}
              max={500}
            />
            <Input
              label="Prefix (optional)"
              name="bulkPrefix"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
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
    </Dialog>
  );
}

/* ----------------------------- room amenities ------------------------------ */

export function RoomAmenitiesDialog({
  open,
  onOpenChange,
  room,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: RoomRow | null;
  onDone?: () => void;
}) {
  const dispatch = useAppDispatch();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amenities, setAmenities] = useState<AmenityRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !room) return;
    setSelected((room.amenities ?? []).map((a) => a.amenity?.id).filter(Boolean));
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await ipdService.fetchAmenities();
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
  }, [open, room, dispatch]);

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const submit = async () => {
    if (saving || !room) return;
    setSaving(true);
    dispatch(showLoader("Saving amenities"));
    try {
      const res = await ipdService.setRoomAmenities(room.id, selected);
      if (isOk(res.status)) {
        dispatch(
          toast.success(
            "Amenities updated",
            `${room.roomNumber} · ${selected.length} mapped`,
          ),
        );
        onDone?.();
        onOpenChange(false);
      }
    } catch (e: any) {
      dispatch(toast.error("Could not save the amenities", e?.message));
    } finally {
      setSaving(false);
      dispatch(hideLoader());
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Amenities · ${room?.roomNumber ?? ""}`}
      description="Replaces the room's amenity mapping atomically — a private room with AC can then be found by rooms/by-amenity during admission triage."
      size="md"
      footer={
        <>
          <Button
            variant="ghost"
            type="button"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            loading={saving}
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
              checked={selected.includes(a.id)}
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
    </Dialog>
  );
}

/* -------------------------------- amenity ---------------------------------- */

export function AmenityDialog({
  open,
  onOpenChange,
  editing,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null ⇒ create */
  editing: AmenityRow | null;
  onDone?: () => void;
}) {
  const dispatch = useAppDispatch();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [icon, setIcon] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setCode(editing?.code ?? "");
    setIcon(editing?.icon ?? "");
    setIsActive(editing?.isActive ?? true);
  }, [open, editing]);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    dispatch(showLoader(editing ? "Saving amenity" : "Creating amenity"));
    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        icon: icon.trim() || undefined,
        isActive,
      };
      const res = editing
        ? await ipdService.updateAmenity(editing.id, payload)
        : await ipdService.createAmenity(payload);
      if (isOk(res.status)) {
        dispatch(
          toast.success(
            editing ? "Amenity updated" : "Amenity created",
            `${payload.name} · ${payload.code}`,
          ),
        );
        onDone?.();
        onOpenChange(false);
      }
    } catch (e: any) {
      dispatch(toast.error("Could not save the amenity", e?.message));
    } finally {
      setSaving(false);
      dispatch(hideLoader());
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Edit amenity · ${editing.name}` : "New amenity"}
      description="Amenities are a master list mapped to rooms (oxygen point, AC, TV, intercom…). Retire one with the Active switch — deleting is blocked while rooms still use it."
      size="md"
      footer={
        <>
          <Button
            variant="ghost"
            type="button"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            loading={saving}
            disabled={!name.trim() || !code.trim()}
            onClick={() => void submit()}
          >
            {editing ? "Save changes" : "Create amenity"}
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
            value={name}
            error={err(name)}
            onChange={(e) => setName(e.target.value)}
            placeholder="Oxygen point"
          />
          <Input
            label="Code"
            required
            name="amCode"
            value={code}
            error={err(code)}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="OXYGEN"
            hint="Letters, digits, underscore and hyphen only"
          />
        </Row>
        <Input
          label="Icon (optional)"
          name="amIcon"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="snowflake"
          hint="Identifier for the UI icon, e.g. snowflake, tv"
        />
        <Switch
          checked={isActive}
          onCheckedChange={setIsActive}
          label={isActive ? "Active" : "Inactive"}
          description="Inactive amenities stay off the pickers but keep their mappings."
        />
      </div>
    </Dialog>
  );
}

/** Re-exported so the page can render an edit affordance consistently. */
export const WardSetupEditIcon = Pencil;
