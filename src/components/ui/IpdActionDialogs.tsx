/**
 * Bed lifecycle dialogs — assign / transfer / cancel, all driven by the
 * existing admission endpoints:
 *
 *   POST /api/ipd/admissions/:id/assign-bed   { bedId }
 *   POST /api/ipd/admissions/:id/transfer-bed { newBedId, reason? }
 *   POST /api/ipd/admissions/:id/cancel       { reason? }
 *
 * ── EXPORTS (search "export function") ──────────────────────────────────────
 *   AssignBedDialog        → "Assign bed" (available/reserved, gender-safe)
 *   TransferBedDialog      → bed-to-bed move + reason
 *   CancelAdmissionDialog  → only for ADMITTED + no bed
 *   IpdBedDialogKind       → "assign" | "transfer" | "cancel"
 *
 *   import { AssignBedDialog } from "@/components/ui/IpdActionDialogs";
 *
 * Each dialog closes and calls `onDone()` after a successful write so the
 * owning page can refresh its list. Note: `AssignBedDialog` is a named export
 * of THIS file — there is no separate AssignBedDialog.tsx.
 *
 * ── NAMING ─────────────────────────────────────────────────────────────────
 * File ka canonical naam: IpdActionDialogs.tsx
 * Isi naam wali alias file bhi hai: IpdActionDialog.tsx (sirf re-export) —
 * jo import dono me se kisi bhi path se chalta hai.
 *
 * Location note: ye file shared UI kit (`src/components/ui/`) me rehti hai, par
 * IPD-specific hai — isliye ise `@/pages/ipd/*` ke service/types chahiye.
 * Non-IPD screen me reuse karne se pehle IPD dependency hata lena.
 */

import { useEffect, useState } from "react";
import { BedDouble, ArrowLeftRight, Ban } from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { toast } from "@/store/slices/uiSlice";
import { Button, Badge } from "./primitives";
import { Textarea } from "./fields";
import { Dialog } from "./overlays";
import { ipdService } from "@/pages/ipd/ipd.service";
import { BedPicker } from "./BedPicker";
import { bedLabel, IpdAdmission, patientName } from "@/types/ipdTypes";

/* -------------------------------- assign ---------------------------------- */

/** Assign / re-assign a bed to an admitted patient without one. */
export function AssignBedDialog({
  open,
  onOpenChange,
  admission,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admission: IpdAdmission | null;
  onDone?: () => void;
}) {
  const dispatch = useAppDispatch();
  const [bedId, setBedId] = useState("");
  const [saving, setSaving] = useState(false);

  // har open par saaf state — purana selection flash na ho
  useEffect(() => {
    if (open) setBedId("");
  }, [open]);

  const submit = async () => {
    if (!admission || !bedId || saving) return;
    setSaving(true);
    try {
      await ipdService.assignBed(admission.id, bedId);
      dispatch(
        toast.success(
          "Bed assigned",
          `${admission.admissionNo} → ${patientName(admission)}`,
        ),
      );
      onDone?.();
      onOpenChange(false);
    } catch (e: any) {
      dispatch(toast.error("Could not assign bed", e?.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Assign bed${admission ? ` · ${admission.admissionNo}` : ""}`}
      description={
        admission
          ? `${patientName(admission)} (${admission.patient?.uhid ?? "—"}) — ${admission.patient?.gender ?? "—"}. Only beds the server accepts (AVAILABLE / RESERVED, matching ward gender) should be picked.`
          : "Select an admitted patient without a bed to continue."
      }
      size="xl"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            icon={<BedDouble />}
            loading={saving}
            disabled={!admission || !bedId}
            onClick={() => void submit()}
          >
            Assign bed
          </Button>
        </>
      }
    >
      <BedPicker
        value={bedId}
        onChange={(id) => setBedId(id)}
        patientGender={admission?.patient?.gender ?? null}
        selectableStatuses={["AVAILABLE", "RESERVED"]}
        excludeBedId={admission?.bedId ?? null}
        compact
      />
    </Dialog>
  );
}

/* ------------------------------- transfer ---------------------------------- */

/** Move an occupied patient to another bed (old bed → housekeeping). */
export function TransferBedDialog({
  open,
  onOpenChange,
  admission,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admission: IpdAdmission | null;
  onDone?: () => void;
}) {
  const dispatch = useAppDispatch();
  const [bedId, setBedId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setBedId("");
      setReason("");
    }
  }, [open]);

  const submit = async () => {
    if (!admission || !bedId || saving) return;
    setSaving(true);
    try {
      await ipdService.transferBed(admission.id, bedId, reason);
      dispatch(
        toast.success(
          "Patient transferred",
          `${bedLabel(admission)} → new bed`,
        ),
      );
      onDone?.();
      onOpenChange(false);
    } catch (e: any) {
      dispatch(toast.error("Could not transfer bed", e?.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Transfer bed${admission ? ` · ${admission.admissionNo}` : ""}`}
      description={
        admission
          ? `${patientName(admission)} is currently in ${bedLabel(admission)}. The old bed moves to housekeeping through the legal state path (OCCUPIED → DISCHARGE_PENDING → HOUSEKEEPING); the new bed becomes OCCUPIED.`
          : "Select an admitted patient with a bed to continue."
      }
      size="xl"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            icon={<ArrowLeftRight />}
            loading={saving}
            disabled={!admission || !bedId}
            onClick={() => void submit()}
          >
            Transfer patient
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge tone="neutral">From</Badge>
          <span className="num text-[13px] font-semibold text-ink-800">
            {bedLabel(admission)}
          </span>
        </div>

        <BedPicker
          value={bedId}
          onChange={(id) => setBedId(id)}
          patientGender={admission?.patient?.gender ?? null}
          selectableStatuses={["AVAILABLE"]}
          excludeBedId={admission?.bedId ?? null}
          compact
        />

        <Textarea
          name="transferReason"
          label="Reason (optional)"
          rows={2}
          placeholder="e.g. ICU step-down, better monitoring, patient request"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Dialog>
  );
}

/* -------------------------------- cancel ----------------------------------- */

/** Cancel an admission that has no bed yet (ADMITTED + bedId null). */
export function CancelAdmissionDialog({
  open,
  onOpenChange,
  admission,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admission: IpdAdmission | null;
  onDone?: () => void;
}) {
  const dispatch = useAppDispatch();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const submit = async () => {
    if (!admission || saving) return;
    setSaving(true);
    try {
      await ipdService.cancelAdmission(admission.id, reason);
      dispatch(
        toast.info(
          "Admission cancelled",
          `${admission.admissionNo} is no longer active.`,
        ),
      );
      onDone?.();
      onOpenChange(false);
    } catch (e: any) {
      dispatch(toast.error("Could not cancel admission", e?.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Cancel admission${admission ? ` · ${admission.admissionNo}` : ""}`}
      description="Only an admission without a bed can be cancelled. If a bed is already assigned, use the discharge workflow so the bed history stays correct."
      size="md"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Keep admission
          </Button>
          <Button
            type="button"
            variant="danger"
            icon={<Ban />}
            loading={saving}
            disabled={!admission}
            onClick={() => void submit()}
          >
            Cancel admission
          </Button>
        </>
      }
    >
      <Textarea
        name="cancelReason"
        label="Reason (optional)"
        rows={2}
        placeholder="e.g. Patient shifted to another hospital before bed assignment"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
    </Dialog>
  );
}

/** Exported for callers that switch between the three dialogs. */
export type IpdBedDialogKind = "assign" | "transfer" | "cancel";
