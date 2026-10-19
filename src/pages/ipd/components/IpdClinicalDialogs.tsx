/**
 * Clinical + billing dialogs of the IPD chart (Phase 3.3 endpoints).
 *
 *   RecordVitalsDialog    POST /api/ipd/vitals
 *   AddRoundDialog        POST /api/ipd/rounds
 *   AddMedicationDialog   POST /api/ipd/medications
 *   ChangeDietDialog      POST /api/ipd/diet-orders
 *   AddChargeDialog       POST /api/ipd/billing/charges      (threshold-checked)
 *   RecordPaymentDialog   POST /api/ipd/admissions/:id/payments
 *
 * Same conventions as every other dialog in this module: plain `<Dialog>` with
 * page-owned content + footer, local state, service call in try…catch, toast on
 * failure, the button spinner for the write, `onDone()` so the owning panel
 * refreshes. Field names mirror the backend DTOs 1:1.
 *
 * Lives in the IPD feature folder (`src/pages/ipd/components/`).
 */

import { useEffect, useMemo, useState } from "react";
import { Badge, Button } from "@/components/ui/primitives";
import { Input, NumberInput, Select, Textarea } from "@/components/ui/fields";
import { Dialog } from "@/components/ui/overlays";
import { useAppDispatch } from "@/store/hooks";
import { toast } from "@/store/slices/uiSlice";
import { ipdService } from "@/pages/ipd/ipd.service";
import {
  CHARGE_CATEGORY_OPTIONS,
  DIET_TYPE_OPTIONS,
  MEDICATION_FREQUENCY_OPTIONS,
  MEDICATION_ROUTE_OPTIONS,
  PAYMENT_MODE_OPTIONS,
} from "@/constants/ipd.constants";
import type {
  ChargeCategory,
  DietType,
  MedicationFrequency,
  MedicationRoute,
  PaymentMode,
} from "@/types/ipdTypes";

const inr = (value: number) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** Small helper: trim -> undefined so optional fields stay out of the payload. */
const opt = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

/* --------------------------------- vitals ---------------------------------- */

export function RecordVitalsDialog({
  open,
  onOpenChange,
  admissionId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admissionId: string;
  onDone?: () => void;
}) {
  const dispatch = useAppDispatch();
  const [saving, setSaving] = useState(false);

  const [temperature, setTemperature] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [respiratoryRate, setRespiratoryRate] = useState(0);
  const [bpSystolic, setBpSystolic] = useState(0);
  const [bpDiastolic, setBpDiastolic] = useState(0);
  const [spo2, setSpo2] = useState(0);
  const [painScore, setPainScore] = useState(0);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTemperature(0);
    setPulse(0);
    setRespiratoryRate(0);
    setBpSystolic(0);
    setBpDiastolic(0);
    setSpo2(0);
    setPainScore(0);
    setNotes("");
  }, [open]);

  const hasMeasurement = [
    temperature,
    pulse,
    respiratoryRate,
    bpSystolic,
    bpDiastolic,
    spo2,
  ].some((v) => Number(v) > 0);

  const submit = async () => {
    if (saving || !hasMeasurement) return;
    setSaving(true);
    try {
      const res = await ipdService.recordIpdVitals({
        admissionId,
        ...(temperature > 0 ? { temperature } : {}),
        ...(pulse > 0 ? { pulse } : {}),
        ...(respiratoryRate > 0 ? { respiratoryRate } : {}),
        ...(bpSystolic > 0 ? { bpSystolic } : {}),
        ...(bpDiastolic > 0 ? { bpDiastolic } : {}),
        ...(spo2 > 0 ? { spo2 } : {}),
        ...(painScore > 0 ? { painScore } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      if (res.status >= 200 && res.status < 300) {
        dispatch(toast.success("Vitals recorded", "Added to the observation chart"));
        onDone?.();
        onOpenChange(false);
      }
    } catch (e: any) {
      dispatch(toast.error("Could not record vitals", e?.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record vitals"
      description="One observation set. Fill only what was measured — blank fields are simply not charted."
      size="lg"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={saving}
            disabled={!hasMeasurement}
            onClick={() => void submit()}
          >
            Save vitals
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberInput
            label="Temperature"
            value={temperature}
            onValueChange={setTemperature}
            min={20}
            max={50}
            step={1}
            suffix="°C"
          />
          <NumberInput
            label="Pulse"
            value={pulse}
            onValueChange={setPulse}
            min={10}
            max={300}
            suffix="/min"
          />
          <NumberInput
            label="Respiratory rate"
            value={respiratoryRate}
            onValueChange={setRespiratoryRate}
            min={4}
            max={80}
            suffix="/min"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <NumberInput
            label="BP systolic"
            value={bpSystolic}
            onValueChange={setBpSystolic}
            min={30}
            max={300}
            suffix="mmHg"
          />
          <NumberInput
            label="BP diastolic"
            value={bpDiastolic}
            onValueChange={setBpDiastolic}
            min={10}
            max={200}
            suffix="mmHg"
          />
          <NumberInput
            label="SpO₂"
            value={spo2}
            onValueChange={setSpo2}
            min={40}
            max={100}
            suffix="%"
          />
        </div>

        <NumberInput
          label="Pain score"
          value={painScore}
          onValueChange={setPainScore}
          min={0}
          max={10}
          hint="0 (none) – 10 (worst)"
        />

        <Textarea
          label="Notes"
          name="vitalNotes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any observation the numbers do not carry — sweating, post-op response, oral intake…"
        />
      </div>
    </Dialog>
  );
}

/* ---------------------------------- round ---------------------------------- */

export function AddRoundDialog({
  open,
  onOpenChange,
  admissionId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admissionId: string;
  onDone?: () => void;
}) {
  const dispatch = useAppDispatch();
  const [saving, setSaving] = useState(false);
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [nextRoundAt, setNextRoundAt] = useState("");

  useEffect(() => {
    if (!open) return;
    setSubjective("");
    setObjective("");
    setAssessment("");
    setPlan("");
    setNextRoundAt("");
  }, [open]);

  const hasContent = [subjective, objective, assessment, plan].some(
    (v) => v.trim().length > 0,
  );

  const submit = async () => {
    if (saving || !hasContent) return;
    setSaving(true);
    try {
      const res = await ipdService.recordIpdRound({
        admissionId,
        ...(opt(subjective) ? { subjective: subjective.trim() } : {}),
        ...(opt(objective) ? { objective: objective.trim() } : {}),
        ...(opt(assessment) ? { assessment: assessment.trim() } : {}),
        ...(opt(plan) ? { plan: plan.trim() } : {}),
        ...(nextRoundAt
          ? { nextRoundAt: new Date(nextRoundAt).toISOString() }
          : {}),
      });
      if (res.status >= 200 && res.status < 300) {
        dispatch(toast.success("Round recorded", "Added to the stay timeline"));
        onDone?.();
        onOpenChange(false);
      }
    } catch (e: any) {
      dispatch(toast.error("Could not save the round note", e?.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New round note"
      description="SOAP note for this round. Any one section is enough to save — partial rounds happen."
      size="xl"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={saving}
            disabled={!hasContent}
            onClick={() => void submit()}
          >
            Save round
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Textarea
          label="S — Subjective"
          name="roundSubjective"
          rows={2}
          value={subjective}
          onChange={(e) => setSubjective(e.target.value)}
          placeholder="What the patient reports — pain, appetite, sleep…"
        />
        <Textarea
          label="O — Objective"
          name="roundObjective"
          rows={2}
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder="Examination findings, vitals trend, reports…"
        />
        <Textarea
          label="A — Assessment"
          name="roundAssessment"
          rows={2}
          value={assessment}
          onChange={(e) => setAssessment(e.target.value)}
          placeholder="Working diagnosis / clinical impression"
        />
        <Textarea
          label="P — Plan"
          name="roundPlan"
          rows={2}
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          placeholder="Investigations, medication changes, expected discharge…"
        />
        <div className="max-w-xs">
          <Input
            label="Next round (optional)"
            name="nextRoundAt"
            type="datetime-local"
            value={nextRoundAt}
            onChange={(e) => setNextRoundAt(e.target.value)}
          />
        </div>
      </div>
    </Dialog>
  );
}

/* -------------------------------- medication -------------------------------- */

export function AddMedicationDialog({
  open,
  onOpenChange,
  admissionId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admissionId: string;
  onDone?: () => void;
}) {
  const dispatch = useAppDispatch();
  const [saving, setSaving] = useState(false);
  const [drugName, setDrugName] = useState("");
  const [dose, setDose] = useState("");
  const [route, setRoute] = useState<MedicationRoute>("ORAL");
  const [frequency, setFrequency] = useState<MedicationFrequency>("OD");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setDrugName("");
    setDose("");
    setRoute("ORAL");
    setFrequency("OD");
    setEndDate("");
    setNotes("");
  }, [open]);

  const submit = async () => {
    if (saving || !drugName.trim() || !dose.trim()) return;
    setSaving(true);
    try {
      const res = await ipdService.orderIpdMedication({
        admissionId,
        drugName: drugName.trim(),
        dose: dose.trim(),
        route,
        frequency,
        ...(endDate ? { endDate: new Date(endDate).toISOString() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      if (res.status >= 200 && res.status < 300) {
        dispatch(
          toast.success(
            "Medication ordered",
            `${drugName.trim()} ${dose.trim()} · ${route} ${frequency}`,
          ),
        );
        onDone?.();
        onOpenChange(false);
      }
    } catch (e: any) {
      dispatch(toast.error("Could not order the medication", e?.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Order medication"
      description="Adds a line to the stay's drug chart. Stopping it later keeps the row as history."
      size="lg"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={saving}
            disabled={!drugName.trim() || !dose.trim()}
            onClick={() => void submit()}
          >
            Order
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Drug"
            required
            name="drugName"
            value={drugName}
            onChange={(e) => setDrugName(e.target.value)}
            placeholder="Injection Ceftriaxone"
          />
          <Input
            label="Dose"
            required
            name="dose"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            placeholder="1 g"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Select
            label="Route"
            name="route"
            value={route}
            onChange={(v) => setRoute(v as MedicationRoute)}
            options={MEDICATION_ROUTE_OPTIONS}
          />
          <Select
            label="Frequency"
            name="frequency"
            value={frequency}
            onChange={(v) => setFrequency(v as MedicationFrequency)}
            options={MEDICATION_FREQUENCY_OPTIONS}
          />
          <Input
            label="Until (optional)"
            name="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <Textarea
          label="Notes"
          name="medNotes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Indication, dilution, monitoring…"
        />
      </div>
    </Dialog>
  );
}

/* ----------------------------------- diet ----------------------------------- */

export function ChangeDietDialog({
  open,
  onOpenChange,
  admissionId,
  currentType,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admissionId: string;
  /** pre-selects the live diet when one exists */
  currentType?: string | null;
  onDone?: () => void;
}) {
  const dispatch = useAppDispatch();
  const [saving, setSaving] = useState(false);
  const [dietType, setDietType] = useState<DietType>("NORMAL");
  const [details, setDetails] = useState("");

  useEffect(() => {
    if (!open) return;
    setDietType((currentType as DietType) ?? "NORMAL");
    setDetails("");
  }, [open, currentType]);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await ipdService.orderIpdDiet({
        admissionId,
        dietType,
        ...(details.trim() ? { details: details.trim() } : {}),
      });
      if (res.status >= 200 && res.status < 300) {
        dispatch(
          toast.success(
            "Diet updated",
            "The previous diet was closed — the kitchen sees one live order",
          ),
        );
        onDone?.();
        onOpenChange(false);
      }
    } catch (e: any) {
      dispatch(toast.error("Could not save the diet order", e?.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change diet"
      description="A stay has exactly one live diet — saving replaces the current order and keeps it as history."
      size="md"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={saving} onClick={() => void submit()}>
            Save diet
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Diet"
          name="dietType"
          value={dietType}
          onChange={(v) => setDietType(v as DietType)}
          options={DIET_TYPE_OPTIONS}
        />
        <Textarea
          label="Details"
          name="dietDetails"
          rows={2}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="2000 kcal, low salt, no added sugar…"
        />
      </div>
    </Dialog>
  );
}

/* ---------------------------------- charge ---------------------------------- */

export function AddChargeDialog({
  open,
  onOpenChange,
  admissionId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admissionId: string;
  onDone?: () => void;
}) {
  const dispatch = useAppDispatch();
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState<ChargeCategory>("SERVICE");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [chargeDate, setChargeDate] = useState("");
  const [notes, setNotes] = useState("");
  const [blocked, setBlocked] = useState<string | null>(null);

  const amount = useMemo(
    () => Math.round(quantity * unitPrice * 100) / 100,
    [quantity, unitPrice],
  );

  useEffect(() => {
    if (!open) return;
    setCategory("SERVICE");
    setDescription("");
    setQuantity(1);
    setUnitPrice(0);
    setChargeDate("");
    setNotes("");
    setBlocked(null);
  }, [open]);

  const submit = async () => {
    if (saving || !description.trim() || unitPrice <= 0) return;
    setSaving(true);
    try {
      const res = await ipdService.postIpdCharge({
        admissionId,
        category,
        description: description.trim(),
        quantity,
        unitPrice,
        ...(chargeDate
          ? { chargeDate: new Date(`${chargeDate}T00:00:00Z`).toISOString() }
          : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      if (res.status >= 200 && res.status < 300) {
        dispatch(
          toast.success(
            "Charge posted",
            `${inr(amount)} · ${res.data?.threshold?.status ?? "OK"}`,
          ),
        );
        onDone?.();
        onOpenChange(false);
      }
    } catch (e: any) {
      if (e?.code === "THRESHOLD_BLOCKED" || e?.data?.code === "THRESHOLD_BLOCKED") {
        const d = e?.data?.details ?? {};
        setBlocked(
          `${e?.message ?? "Panel threshold exceeded."}${
            d.maxAmount ? ` Cap ₹${Number(d.maxAmount).toLocaleString("en-IN")}.` : ""
          }`,
        );
      } else {
        dispatch(toast.error("Could not post the charge", e?.message));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Post a charge"
      description="Amount is computed by the server (quantity × rate). Panel thresholds are checked before the line is written."
      size="lg"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={saving}
            disabled={!description.trim() || unitPrice <= 0}
            onClick={() => void submit()}
          >
            Post {inr(amount)}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {blocked && (
          <div className="rounded-xl border border-coral-500/30 bg-coral-50/60 px-4 py-3">
            <p className="text-[13px] font-semibold text-coral-700">
              Blocked by the panel threshold
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-coral-700/90">
              {blocked}
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Category"
            name="chargeCategory"
            value={category}
            onChange={(v) => setCategory(v as ChargeCategory)}
            options={CHARGE_CATEGORY_OPTIONS}
          />
          <Input
            label="Date (optional)"
            name="chargeDate"
            type="date"
            value={chargeDate}
            onChange={(e) => setChargeDate(e.target.value)}
            hint="Defaults to today; back-date late entries"
          />
        </div>

        <Input
          label="Description"
          required
          name="chargeDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Dressing — large"
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <NumberInput
            label="Quantity"
            value={quantity}
            onValueChange={setQuantity}
            min={0.01}
            step={1}
          />
          <NumberInput
            label="Rate"
            value={unitPrice}
            onValueChange={setUnitPrice}
            min={0}
            step={50}
            suffix="₹"
          />
          <div>
            <p className="mb-1.5 text-[12px] font-medium text-ink-500">Amount</p>
            <p className="num text-[15px] font-semibold text-ink-900">
              {inr(amount)}
            </p>
          </div>
        </div>

        <Textarea
          label="Notes"
          name="chargeNotes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Dialog>
  );
}

/* --------------------------------- payment ---------------------------------- */

export function RecordPaymentDialog({
  open,
  onOpenChange,
  admissionId,
  balance,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admissionId: string;
  /** current bill balance — offered as a one-tap fill */
  balance?: number;
  onDone?: () => void;
}) {
  const dispatch = useAppDispatch();
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState<PaymentMode>("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmount(balance && balance > 0 ? balance : 0);
    setMode("CASH");
    setReference("");
    setNotes("");
  }, [open, balance]);

  const submit = async () => {
    if (saving || amount <= 0) return;
    setSaving(true);
    try {
      const res = await ipdService.recordIpdPayment(admissionId, {
        amount,
        mode,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      if (res.status >= 200 && res.status < 300) {
        dispatch(
          toast.success(
            "Payment received",
            `${inr(amount)} · deposit now ${inr(Number(res.data?.advancePaid ?? 0))}`,
          ),
        );
        onDone?.();
        onOpenChange(false);
      }
    } catch (e: any) {
      dispatch(toast.error("Could not record the payment", e?.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record payment"
      description="A receipt against this stay. The admission's advance-paid figure moves with it in the same transaction."
      size="md"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={saving}
            disabled={amount <= 0}
            onClick={() => void submit()}
          >
            Receive {inr(amount)}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {balance !== undefined && balance > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-ink-50/60 px-4 py-3">
            <div>
              <p className="text-[12px] font-medium text-ink-500">Balance due</p>
              <p className="num text-[14px] font-semibold text-ink-900">
                {inr(balance)}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => setAmount(balance)}
            >
              Use balance
            </Button>
          </div>
        )}

        <NumberInput
          label="Amount received"
          value={amount}
          onValueChange={setAmount}
          min={0.01}
          step={100}
          suffix="₹"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Mode"
            name="paymentMode"
            value={mode}
            onChange={(v) => setMode(v as PaymentMode)}
            options={PAYMENT_MODE_OPTIONS}
          />
          <Input
            label="Reference (optional)"
            name="paymentReference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="UPI / cheque no. / receipt"
          />
        </div>

        <Textarea
          label="Notes"
          name="paymentNotes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Dialog>
  );
}

/** Re-exported for panels that show the threshold state inline. */
export function ThresholdBadge({
  status,
  label,
}: {
  status?: string | null;
  label?: string;
}) {
  const tone =
    status === "OK"
      ? "mint"
      : status === "ALERT"
        ? "amber"
        : status
          ? "coral"
          : "neutral";
  return <Badge tone={tone}>{label ?? status ?? "—"}</Badge>;
}
