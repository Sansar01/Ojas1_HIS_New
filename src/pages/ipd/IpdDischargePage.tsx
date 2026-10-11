/**
 * Discharge wizard — `/ipd/admissions/:id/discharge`.
 *
 * The four steps of the real discharge process, mapped onto what the backend
 * can do today:
 *
 *   1. Discharge order   → POST /api/ipd/admissions/:id/initiate-discharge ✅
 *   2. Final bill review → needs the IPD ledger / finalize endpoints        ⏳
 *   3. Settlement        → needs the IPD payments endpoint                  ⏳
 *   4. Bed release       → POST /api/ipd/admissions/:id/complete-discharge  ✅
 *
 * Steps 2 and 3 are shown, not faked: they name the endpoints they will call
 * and display the live facts that exist (advance paid, configured rates, bed
 * status). The wizard state is derived from `admission.status`, so it survives a
 * refresh and matches what every other IPD screen shows.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  BedDouble,
  CheckCircle2,
  HandCoins,
  LogOut,
  ReceiptIndianRupee,
  SprayCan,
  Stethoscope,
} from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { usePermission } from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { toast } from "@/store/slices/uiSlice";
import { Button, Badge } from "@/components/ui/primitives";
import { Select, Textarea } from "@/components/ui/fields";
import { Stepper } from "@/components/ui/Stepper";
import { ErrorState } from "@/components/ui/feedback";
import { IpdDischargeSkeleton } from "@/components/ui/IpdSkeletons";
import { PageIntro, SectionPanel } from "@/components/common";
import { formatDate, formatDateTime } from "@/utils";
import { ipdService } from "./ipd.service";
import type { IpdAdmission, IpdDischargeType } from "./ipdTypes";
import { bedLabel, num, patientName } from "./ipdTypes";
import { DISCHARGE_TYPE_OPTIONS } from "./ipd.constants";
import { AdmissionStatusBadge, InfoRow, PendingBackendNote } from "@/components/ui/IpdBits";

const STEPS = [
  {
    id: 1,
    label: "Discharge order",
    hint: "Type & summary by the doctor",
    icon: Stethoscope,
  },
  {
    id: 2,
    label: "Bill review",
    hint: "Day-wise charges & panel split",
    icon: ReceiptIndianRupee,
  },
  {
    id: 3,
    label: "Settlement",
    hint: "Advance adjustment & payment",
    icon: HandCoins,
  },
  {
    id: 4,
    label: "Bed release",
    hint: "Housekeeping & bed free",
    icon: BedDouble,
  },
] as const;

export function IpdDischargePage() {
  const { id = "" } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { canEdit } = usePermission();

  const [admission, setAdmission] = useState<IpdAdmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await ipdService.fetchAdmissionById(id);
      if (res.status === 200) {
        const body: any = res.data ?? {};
        setAdmission(body.data ?? body);
      }
    } catch (e: any) {
      setError(e?.message ?? "Could not load the admission");
      dispatch(toast.error("Could not load the admission", e?.message));
    } finally {
      setLoading(false);
    }
  }, [dispatch, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const status = admission?.status ?? "ADMITTED";
  const ordered = status === "DISCHARGE_ORDERED";
  const discharged = status === "DISCHARGED";
  const cancelled = status === "CANCELLED";

  /** Steps the workflow has already completed, derived from the server state. */
  const completed = useMemo(() => {
    if (discharged) return [1, 2, 3, 4];
    if (ordered) return [1];
    return [];
  }, [ordered, discharged]);

  const isLocked = useCallback(
    (stepId: number) => {
      if (cancelled) return true;
      if (stepId === 1) return ordered || discharged;
      return !(ordered || discharged);
    },
    [cancelled, ordered, discharged],
  );

  /**
   * First load picks the step the workflow is actually at: an admission that
   * already has a discharge order opens on bed release (the next actionable
   * step); everything else opens on the doctor's order form. Later refreshes
   * never move the user off the step they are reading.
   */
  const stepInitialised = useRef(false);
  useEffect(() => {
    if (!admission || stepInitialised.current) return;
    stepInitialised.current = true;
    if (admission.status === "DISCHARGED" || admission.status === "DISCHARGE_ORDERED")
      setStep(4);
  }, [admission]);

  /* ------------------------------ step 1 form ------------------------------ */

  const form = useForm({
    initialValues: {
      dischargeType: "NORMAL",
      dischargeSummary: "",
    },
    schema: {
      dischargeType: [{ required: "Select the discharge type" }],
    },
    labels: { dischargeType: "Discharge type" },
  });

  const submitOrder = form.handleSubmit(async (values) => {
    if (!admission) return;
    try {
      await ipdService.initiateDischarge(admission.id, {
        dischargeType: values.dischargeType as IpdDischargeType,
        ...(values.dischargeSummary?.trim()
          ? { dischargeSummary: values.dischargeSummary.trim() }
          : {}),
      });
      dispatch(
        toast.success(
          "Discharge ordered",
          "The bed is now DISCHARGE_PENDING on the ward board — the patient is still in it until the discharge is completed.",
        ),
      );
      await load();
      setStep(2);
    } catch (e: any) {
      dispatch(toast.error("Could not order discharge", e?.message));
    }
  });

  /* ---------------------------- step 4: release ---------------------------- */

  const completeDischarge = useCallback(async () => {
    if (!admission) return;
    setCompleting(true);
    try {
      await ipdService.completeDischarge(admission.id);
      dispatch(
        toast.success(
          "Discharge completed",
          "The bed moved to housekeeping and appears in the cleaning queue.",
        ),
      );
      await load();
    } catch (e: any) {
      dispatch(toast.error("Could not complete discharge", e?.message));
    } finally {
      setCompleting(false);
    }
  }, [admission, dispatch, load]);

  if (loading && !admission) {
    return <IpdDischargeSkeleton />;
  }

  if (error && !admission) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  if (!admission) return null;

  const roomType = admission.bed?.room?.roomType;
  const isDaycare = roomType?.isDaycare;
  const bedStatusNow = discharged ? "HOUSEKEEPING" : ordered ? "DISCHARGE_PENDING" : "OCCUPIED";

  return (
    <>
      <PageIntro
        title={`Discharge · ${patientName(admission)}`}
        description={`${admission.admissionNo} · ${bedLabel(admission)} · ${admission.panel?.panelName ?? "Self pay"}`}
        module="ipd"
        back
        meta={
          <>
            <AdmissionStatusBadge status={admission.status} />
            <Badge tone="brand" dot>
              {bedLabel(admission)}
            </Badge>
          </>
        }
      />

      <Stepper
        STEPS={STEPS}
        current={step}
        completed={completed}
        isLocked={isLocked}
        onSelect={(s) => setStep(s.id)}
      />

      <div className="mt-4 space-y-4">
        {/* ----------------------------- step 1 ----------------------------- */}
        {step === 1 && (
          <SectionPanel
            title="Step 1 · Doctor discharge order"
            subtitle="Writes the discharge type and summary, and moves the bed to DISCHARGE_PENDING"
            icon={<Stethoscope className="size-4.5" />}
          >
            {ordered || discharged ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg bg-mint-50/60 px-3 py-2.5">
                  <CheckCircle2 className="size-4 text-mint-600" />
                  <span className="text-[12.5px] font-medium text-mint-700">
                    Discharge already ordered{" "}
                    {admission.dischargeDate
                      ? `on ${formatDateTime(admission.dischargeDate)}`
                      : ""}
                    .
                  </span>
                </div>
                <InfoRow label="Type" value={admission.dischargeType ?? "—"} />
                <InfoRow
                  label="Summary"
                  value={admission.dischargeSummary ?? "—"}
                />
              </div>
            ) : cancelled ? (
              <p className="text-[12.5px] text-ink-500">
                This admission was cancelled — no discharge is required.
              </p>
            ) : (
              <form onSubmit={submitOrder} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    name="dischargeType"
                    label="Discharge type"
                    required
                    value={form.values.dischargeType}
                    onChange={(v) => form.setValue("dischargeType", v)}
                    error={form.errorFor("dischargeType")}
                    options={DISCHARGE_TYPE_OPTIONS}
                  />
                  <div className="flex items-end">
                    <p className="text-[11.5px] leading-relaxed text-ink-400">
                      LAMA / transferred / expired cases follow the same bed
                      path; the type is stored on the admission for audit and
                      (later) billing rules.
                    </p>
                  </div>
                </div>

                <Textarea
                  name="dischargeSummary"
                  label="Discharge summary"
                  rows={6}
                  placeholder="Course in hospital, treatment given, condition at discharge, advice…"
                  value={form.values.dischargeSummary}
                  onChange={(e) =>
                    form.setValue("dischargeSummary", e.target.value)
                  }
                />

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => navigate(`/ipd/admissions/${admission.id}`)}
                  >
                    Back to chart
                  </Button>
                  <Button
                    type="submit"
                    icon={<LogOut />}
                    loading={form.submitting}
                    disabled={!canEdit("ipd")}
                  >
                    Order discharge
                  </Button>
                </div>
              </form>
            )}
          </SectionPanel>
        )}

        {/* ----------------------------- step 2 ----------------------------- */}
        {step === 2 && (
          <SectionPanel
            title="Step 2 · Final bill review"
            subtitle="Day-wise charges, package adjustments and the panel split"
            icon={<ReceiptIndianRupee className="size-4.5" />}
          >
            <PendingBackendNote
              title="Final bill needs the IPD billing endpoints"
              endpoints={[
                "GET /api/ipd/billing/provisional/:admissionId",
                "POST /api/ipd/billing/finalize",
              ]}
            >
              With the ledger live, this step shows every bed-rent / nursing /
              round / lab / medicine / OT line of the stay, package-covered lines
              at ₹0, excluded implants at full price, and the panel co-pay split.
            </PendingBackendNote>

            <div className="mt-4">
              <InfoRow
                label="Stay so far"
                value={`Admitted ${formatDate(admission.admissionDate)}${isDaycare ? " · confirmed daycare" : ""}`}
              />
              <InfoRow
                label="Configured bed rate"
                value={
                  roomType
                    ? `₹${num(roomType.defaultRate).toLocaleString("en-IN")}/day`
                    : "—"
                }
              />
              <InfoRow
                label="Configured nursing charge"
                value={
                  roomType
                    ? `₹${num(roomType.nursingCharge).toLocaleString("en-IN")}/day`
                    : "—"
                }
              />
              <InfoRow
                label="Charges recorded by the system"
                value={
                  <span className="text-ink-400">
                    None yet — ledger endpoint pending
                  </span>
                }
              />
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="button" variant="outline" onClick={() => setStep(3)}>
                Continue to settlement
              </Button>
            </div>
          </SectionPanel>
        )}

        {/* ----------------------------- step 3 ----------------------------- */}
        {step === 3 && (
          <SectionPanel
            title="Step 3 · Payment settlement"
            subtitle="Advance adjustment, panel share and the patient receipt"
            icon={<HandCoins className="size-4.5" />}
          >
            <PendingBackendNote
              title="Settlement endpoints not shipped yet"
              endpoints={[
                "POST /api/ipd/billing/finalize",
                "POST /api/ipd/billing/settle",
                "POST /api/ipd/admissions/:id/payments",
              ]}
            >
              The receipt number series, co-pay split and cash/card/UPI capture
              arrive with the settlement sprint. The advance already recorded is
              shown below and will be adjusted automatically.
            </PendingBackendNote>

            <div className="mt-4">
              <InfoRow
                label="Advance collected"
                value={`₹${num(admission.advancePaid).toLocaleString("en-IN")}`}
              />
              <InfoRow
                label="Panel"
                value={admission.panel?.panelName ?? "Self pay"}
              />
              <InfoRow
                label="Amount due"
                value={<span className="text-ink-400">Pending final bill</span>}
              />
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="button" variant="outline" onClick={() => setStep(4)}>
                Continue to bed release
              </Button>
            </div>
          </SectionPanel>
        )}

        {/* ----------------------------- step 4 ----------------------------- */}
        {step === 4 && (
          <SectionPanel
            title="Step 4 · Bed release"
            subtitle="Complete the discharge — the bed goes to housekeeping"
            icon={<BedDouble className="size-4.5" />}
          >
            {cancelled ? (
              <p className="text-[12.5px] text-ink-500">
                This admission was cancelled; there is no bed to release.
              </p>
            ) : discharged ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-lg bg-mint-50/60 px-3 py-2.5">
                  <CheckCircle2 className="size-4 text-mint-600" />
                  <span className="text-[12.5px] font-medium text-mint-700">
                    Discharge completed — the patient is off the census.
                  </span>
                </div>
                <InfoRow
                  label="Bed"
                  value={`${bedLabel(admission)} → HOUSEKEEPING`}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<SprayCan />}
                    onClick={() => navigate("/ipd")}
                  >
                    Open housekeeping queue
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/ipd/admissions/${admission.id}`)}
                  >
                    View chart
                  </Button>
                </div>
              </div>
            ) : ordered ? (
              <div className="space-y-4">
                <InfoRow
                  label="Bed status now"
                  value={
                    <Badge tone="amber" dot>
                      DISCHARGE_PENDING
                    </Badge>
                  }
                />
                <InfoRow
                  label="After completion"
                  value={
                    <Badge tone="neutral" dot>
                      HOUSEKEEPING → cleaning queue
                    </Badge>
                  }
                />
                <p className="text-[12px] leading-relaxed text-ink-500">
                  Once the patient physically leaves, complete the discharge. The
                  bed instantly appears in the housekeeping queue and a
                  housekeeping staff member marks it AVAILABLE after cleaning.
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => navigate(`/ipd/admissions/${admission.id}`)}
                  >
                    Back to chart
                  </Button>
                  <Button
                    type="button"
                    icon={<BedDouble />}
                    loading={completing}
                    disabled={!canEdit("ipd")}
                    onClick={() => void completeDischarge()}
                  >
                    Complete discharge & release bed
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <InfoRow
                  label="Bed status now"
                  value={
                    <Badge tone="coral" dot>
                      {bedStatusNow}
                    </Badge>
                  }
                />
                <p className="text-[12.5px] text-ink-500">
                  Order the discharge first (step 1). The bed only becomes
                  releasable once the admission is in DISCHARGE_ORDERED.
                </p>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                  >
                    Go to step 1
                  </Button>
                </div>
              </div>
            )}
          </SectionPanel>
        )}
      </div>
    </>
  );
}

export default IpdDischargePage;
