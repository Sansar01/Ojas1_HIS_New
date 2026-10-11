/**
 * IPD patient chart — `/ipd/admissions/:id`.
 *
 * The single patient screen of the IPD stay. It shows everything today's
 * backend actually stores (admission, patient, bed, doctor, panel, advance,
 * discharge block) and reserves the four clinical tabs whose endpoints are
 * still to be written (vitals · medicines · rounds · billing) so the layout is
 * already agreed when they ship.
 *
 * Reads:  GET /api/ipd/admissions/:id
 * Writes: assign-bed · transfer-bed · initiate-discharge (via the discharge
 *         wizard page) · complete-discharge · cancel
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeftRight,
  BedDouble,
  ClipboardList,
  LogOut,
  ReceiptIndianRupee,
  RefreshCw,
  Stethoscope,
  XCircle,
} from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { usePermission } from "@/hooks";
import { toast } from "@/store/slices/uiSlice";
import { Avatar, Badge, Button, Panel } from "@/components/ui/primitives";
import { Tabs, useConfirmDialog } from "@/components/ui/overlays";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { IpdChartSkeleton } from "@/components/ui/IpdSkeletons";
import {
  DetailGrid,
  PageIntro,
  SectionPanel,
  StatStrip,
} from "@/components/common";
import { calcAge, formatDate, formatDateTime } from "@/utils";
import { ipdService } from "./ipd.service";
import type { IpdAdmission } from "./ipdTypes";
import {
  bedLabel,
  doctorName,
  num,
  patientName,
  stayDays,
} from "./ipdTypes";
import {
  ADMISSION_TYPE_LABEL,
  DISCHARGE_TYPE_LABEL,
  admissionStatusMeta,
} from "./ipd.constants";
import {
  AssignBedDialog,
  CancelAdmissionDialog,
  TransferBedDialog,
} from "@/components/ui/IpdActionDialogs";
import {
  AdmissionStatusBadge,
  Chip,
  InfoRow,
  PendingBackendNote,
} from "@/components/ui/IpdBits";
import { BedSummaryCard } from "@/components/ui/BedPicker";

type DialogKind = "assign" | "transfer" | "cancel" | null;
type TabValue = "overview" | "vitals" | "medicines" | "notes" | "billing";

export function IpdPatientChartPage() {
  const { id = "" } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { canEdit } = usePermission();
  const { ask, confirmNode } = useConfirmDialog();

  const [admission, setAdmission] = useState<IpdAdmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabValue>("overview");
  const [dialog, setDialog] = useState<DialogKind>(null);

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

  const roomType = admission?.bed?.room?.roomType;
  const dailyEstimate = useMemo(
    () => num(roomType?.defaultRate) + num(roomType?.nursingCharge),
    [roomType],
  );

  const completeDischarge = useCallback(async () => {
    if (!admission) return;
    try {
      await ipdService.completeDischarge(admission.id);
      dispatch(
        toast.success(
          "Discharge completed",
          "Bed moved to housekeeping; the chart is now read-only.",
        ),
      );
      void load();
    } catch (e: any) {
      dispatch(toast.error("Could not complete discharge", e?.message));
    }
  }, [admission, dispatch, load]);

  if (loading && !admission) {
    return <IpdChartSkeleton />;
  }

  if (error && !admission) {
    return (
      <ErrorState
        message={error}
        onRetry={() => void load()}
      />
    );
  }

  if (!admission) {
    return (
      <EmptyState
        title="Admission not found"
        description="It may belong to another hospital, or it never existed."
        action={
          <Button size="sm" onClick={() => navigate("/ipd/admissions")}>
            Back to census
          </Button>
        }
      />
    );
  }

  const admitted = admission.status === "ADMITTED";
  const ordered = admission.status === "DISCHARGE_ORDERED";
  const closed =
    admission.status === "DISCHARGED" || admission.status === "CANCELLED";
  const statusMeta = admissionStatusMeta(admission.status);

  return (
    <>
      <PageIntro
        title={`${patientName(admission)} · ${admission.admissionNo}`}
        description={`${admission.patient?.uhid ?? "—"} · ${bedLabel(admission)} · Day ${stayDays(admission)} of the stay`}
        module="ipd"
        back
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              icon={<ClipboardList />}
              onClick={() => navigate("/ipd/admissions")}
            >
              Census
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={<RefreshCw />}
              onClick={() => void load()}
            >
              Refresh
            </Button>
          </>
        }
        meta={
          <>
            <AdmissionStatusBadge status={admission.status} />
            <Badge tone="brand" dot>
              {bedLabel(admission)}
            </Badge>
            <Badge tone="neutral">
              {ADMISSION_TYPE_LABEL[admission.admissionType] ??
                admission.admissionType}
            </Badge>
            {admission.panel ? (
              <Badge tone="lagoon">{admission.panel.panelName}</Badge>
            ) : (
              <Badge tone="neutral">Self pay</Badge>
            )}
          </>
        }
      />

      {/* --------------------------- action + stat row --------------------------- */}
      <div className="mb-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Panel className="p-4">
          <StatStrip
            items={[
              { label: "Admitted", value: formatDate(admission.admissionDate) },
              {
                label: "Expected discharge",
                value: admission.expectedDischargeDate
                  ? formatDate(admission.expectedDischargeDate)
                  : "—",
              },
              { label: "Day of stay", value: `Day ${stayDays(admission)}` },
              {
                label: "Advance paid",
                value: `₹${num(admission.advancePaid).toLocaleString("en-IN")}`,
              },
            ]}
          />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              icon={<BedDouble />}
              disabled={!admitted || !!admission.bedId || !canEdit("ipd")}
              onClick={() => setDialog("assign")}
            >
              Assign bed
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={<ArrowLeftRight />}
              disabled={
                !(admitted || ordered) || !admission.bedId || !canEdit("ipd")
              }
              onClick={() => setDialog("transfer")}
            >
              Transfer bed
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={<LogOut />}
              disabled={!admitted || !canEdit("ipd")}
              onClick={() =>
                navigate(`/ipd/admissions/${admission.id}/discharge`)
              }
            >
              Order discharge
            </Button>
            <Button
              size="sm"
              icon={<LogOut />}
              disabled={!ordered || !canEdit("ipd")}
              onClick={() =>
                ask({
                  title: `Complete discharge for ${patientName(admission)}?`,
                  description:
                    "The patient leaves the census and the bed moves to housekeeping. Run this once the bill is settled.",
                  confirmLabel: "Complete discharge",
                  tone: "brand",
                  action: () => completeDischarge(),
                })
              }
            >
              Complete discharge
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<XCircle />}
              disabled={!admitted || !!admission.bedId || !canEdit("ipd")}
              onClick={() => setDialog("cancel")}
            >
              Cancel admission
            </Button>
          </div>

          {closed && (
            <p className="mt-3 rounded-lg bg-ink-25 px-3 py-2 text-[12px] text-ink-500">
              This admission is {statusMeta.label.toLowerCase()} — the chart is
              read-only.
            </p>
          )}
        </Panel>

        <div className="space-y-3">
          <BedSummaryCard
            bedIdentifier={admission.bed?.bedIdentifier ?? null}
            roomType={roomType?.name ?? null}
            ward={
              admission.bed
                ? [
                    admission.bed.room.roomNumber,
                    admission.bed.room.floor
                      ? `Floor ${admission.bed.room.floor}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : null
            }
          />
          {roomType && (
            <Panel className="p-4">
              <InfoRow
                label="Configured bed rate"
                value={`₹${num(roomType.defaultRate).toLocaleString("en-IN")}/day`}
              />
              <InfoRow
                label="Configured nursing charge"
                value={`₹${num(roomType.nursingCharge).toLocaleString("en-IN")}/day`}
              />
              <InfoRow
                label="Rate build-up (config only)"
                value={
                  <span className="font-semibold">
                    ₹{dailyEstimate.toLocaleString("en-IN")}/day
                  </span>
                }
              />
              <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
                These are the room-type rates from the ward master — not a bill.
                Actual accrual starts when the IPD daily-charge endpoint ships.
              </p>
            </Panel>
          )}
        </div>
      </div>

      {/* --------------------------------- tabs --------------------------------- */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabValue)}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "vitals", label: "Vitals" },
          { value: "medicines", label: "Medicines" },
          { value: "notes", label: "Rounds & notes" },
          { value: "billing", label: "Billing" },
        ]}
      />

      <div className="mt-4 space-y-4">
        {tab === "overview" && (
          <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
            <SectionPanel
              title="Admission details"
              subtitle="Exactly as stored on the admission record"
              icon={<ClipboardList className="size-4.5" />}
            >
              <DetailGrid
                columns={2}
                items={[
                  {
                    label: "Admission no",
                    value: (
                      <span className="num">{admission.admissionNo}</span>
                    ),
                  },
                  {
                    label: "Admission type",
                    value:
                      ADMISSION_TYPE_LABEL[admission.admissionType] ??
                      admission.admissionType,
                  },
                  {
                    label: "Admitted on",
                    value: formatDateTime(admission.admissionDate),
                  },
                  {
                    label: "Expected discharge",
                    value: admission.expectedDischargeDate
                      ? formatDate(admission.expectedDischargeDate)
                      : "—",
                  },
                  {
                    label: "Provisional diagnosis",
                    value: admission.provisionalDiagnosis ?? "—",
                    span: 2,
                  },
                  {
                    label: "Reason for admission",
                    value: admission.reasonForAdmission ?? "—",
                    span: 2,
                  },
                ]}
              />
            </SectionPanel>

            <div className="space-y-4">
              <SectionPanel
                title="Patient"
                icon={<Stethoscope className="size-4.5" />}
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    name={patientName(admission)}
                    size="lg"
                    color={
                      admission.patient?.gender === "FEMALE"
                        ? "bg-lagoon-500"
                        : "bg-brand-500"
                    }
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-ink-900">
                      {patientName(admission)}
                    </p>
                    <p className="num truncate text-[12px] text-ink-400">
                      {admission.patient?.uhid ?? "—"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Chip>{admission.patient?.gender ?? "—"}</Chip>
                      <Chip>
                        {admission.patient?.dateOfBirth
                          ? calcAge(
                              admission.patient.dateOfBirth,
                              (admission.patient.ageUnit as any) ?? "Years",
                            )
                          : admission.patient?.ageAtRegistration
                            ? `${admission.patient.ageAtRegistration} ${admission.patient.ageUnit ?? ""}`
                            : "—"}
                      </Chip>
                      {admission.patient?.mobile && (
                        <Chip tone="lagoon">
                          {admission.patient.mobile}
                        </Chip>
                      )}
                    </div>
                  </div>
                </div>
              </SectionPanel>

              <SectionPanel
                title="Care team & billing"
                icon={<ReceiptIndianRupee className="size-4.5" />}
              >
                <InfoRow label="Admitting doctor" value={doctorName(admission)} />
                <InfoRow
                  label="Department"
                  value={
                    admission.doctorProfile?.clinicalDepartment?.name ?? "—"
                  }
                />
                <InfoRow
                  label="Specialisation"
                  value={admission.doctorProfile?.specialization ?? "—"}
                />
                <InfoRow
                  label="Panel"
                  value={admission.panel?.panelName ?? "Self pay"}
                />
                <InfoRow
                  label="Advance paid"
                  value={`₹${num(admission.advancePaid).toLocaleString("en-IN")}`}
                />
              </SectionPanel>

              {(admission.dischargeDate || admission.dischargeSummary) && (
                <SectionPanel
                  title="Discharge"
                  icon={<LogOut className="size-4.5" />}
                >
                  <InfoRow
                    label="Discharge date"
                    value={
                      admission.dischargeDate
                        ? formatDateTime(admission.dischargeDate)
                        : "—"
                    }
                  />
                  <InfoRow
                    label="Type"
                    value={
                      admission.dischargeType
                        ? (DISCHARGE_TYPE_LABEL[admission.dischargeType] ??
                          admission.dischargeType)
                        : "—"
                    }
                  />
                  {admission.dischargeSummary && (
                    <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-600">
                      {admission.dischargeSummary}
                    </p>
                  )}
                </SectionPanel>
              )}
            </div>
          </div>
        )}

        {tab === "vitals" && (
          <SectionPanel
            title="Vitals chart"
            subtitle="4-hourly nursing vitals for this admission"
          >
            <PendingBackendNote
              title="IPD vitals endpoint not shipped yet"
              endpoints={[
                "POST /api/ipd/vitals",
                "GET /api/ipd/vitals?admissionId=&date=",
              ]}
            >
              Nurse BP / pulse / SpO2 / temperature / urine output will be
              recorded here and trended against the admission. The OPD vitals
              table is consultation-bound, so IPD vitals need their own
              endpoint (it is item #1 of the backend Sprint 1 plan).
            </PendingBackendNote>
          </SectionPanel>
        )}

        {tab === "medicines" && (
          <SectionPanel
            title="Medication administration record"
            subtitle="Doctor's orders · nurse administration ticks"
          >
            <PendingBackendNote
              title="MAR endpoint not shipped yet"
              endpoints={[
                "POST /api/ipd/medications",
                "GET /api/ipd/medications?admissionId=",
              ]}
            >
              Prescription lines, dose times and the nurse's administered /
              withheld ticks will live here, with due-dose reminders on the
              nursing station.
            </PendingBackendNote>
          </SectionPanel>
        )}

        {tab === "notes" && (
          <SectionPanel
            title="Doctor rounds & nursing notes"
            subtitle="Daily clinical notes for this stay"
          >
            <PendingBackendNote
              title="Rounds / nursing-notes endpoints not shipped yet"
              endpoints={[
                "POST /api/ipd/rounds",
                "POST /api/ipd/nursing-notes",
              ]}
            >
              Each doctor round (subjective / objective / assessment / plan)
              and nursing hand-over note will be appended here — and the
              round will post its own doctor-visit charge automatically.
            </PendingBackendNote>
          </SectionPanel>
        )}

        {tab === "billing" && (
          <div className="space-y-4">
            <SectionPanel
              title="Running bill"
              subtitle="Day-wise charges accumulated during the stay"
            >
              <PendingBackendNote
                title="IPD charge ledger not shipped yet"
                endpoints={[
                  "POST /api/ipd/billing/charges",
                  "POST /api/ipd/billing/daily-accrual",
                  "GET /api/ipd/billing/provisional/:admissionId",
                ]}
              >
                Until the ledger ships, no daily charge is being recorded by
                the system. What is live today is shown below: the advance
                collected at admission and the configured room-type rates.
              </PendingBackendNote>

              <div className="mt-4">
                <InfoRow
                  label="Advance paid"
                  value={`₹${num(admission.advancePaid).toLocaleString("en-IN")}`}
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
                  label="Recorded charges to date"
                  value={
                    <span className="text-ink-400">
                      Not tracked yet (ledger pending)
                    </span>
                  }
                />
              </div>
            </SectionPanel>

            <SectionPanel
              title="Payments"
              subtitle="Advance & final settlement receipts"
            >
              <PendingBackendNote
                title="IPD payments endpoint not shipped yet"
                endpoints={["POST /api/ipd/admissions/:id/payments"]}
              >
                Multiple advances and the final settlement receipt (with the
                panel co-pay split) will be recorded here. Today only the
                advance entered on the admission form exists.
              </PendingBackendNote>
            </SectionPanel>
          </div>
        )}
      </div>

      <AssignBedDialog
        open={dialog === "assign"}
        onOpenChange={(v) => !v && setDialog(null)}
        admission={admission}
        onDone={() => void load()}
      />
      <TransferBedDialog
        open={dialog === "transfer"}
        onOpenChange={(v) => !v && setDialog(null)}
        admission={admission}
        onDone={() => void load()}
      />
      <CancelAdmissionDialog
        open={dialog === "cancel"}
        onOpenChange={(v) => !v && setDialog(null)}
        admission={admission}
        onDone={() => void load()}
      />

      {confirmNode}
    </>
  );
}

export default IpdPatientChartPage;
