/**
 * Clinical + billing panels of the IPD patient chart (Phase 3.3).
 *
 * Drop-in tab bodies for `IpdPatientChartPage`:
 *
 *   VitalsPanel       observation chart        GET/POST /api/ipd/vitals
 *   MedicationsPanel  drug chart               GET/POST /api/ipd/medications (+stop)
 *   RoundsPanel       SOAP round timeline      GET/POST /api/ipd/rounds
 *   BillingPanel      running bill + receipts  GET  /api/ipd/billing/provisional/:id
 *                                              POST /api/ipd/billing/charges
 *                                              POST /api/ipd/billing/daily-accrual
 *                                              POST /api/ipd/admissions/:id/payments
 *   DietCard          live diet (overview)     GET/POST /api/ipd/diet-orders
 *
 * Every panel owns its own load (skeleton while in flight, ErrorState with
 * retry on failure) and calls `onChanged()` after a write so the page can
 * refresh the admission record (advancePaid, provisionalTotal…).
 *
 * Lives in the IPD feature folder (`src/pages/ipd/components/`).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Ban,
  Pencil,
  Pill,
  Plus,
  ReceiptIndianRupee,
  RefreshCw,
  Stethoscope,
  UtensilsCrossed,
} from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/table";
import {
  EmptyState,
  ErrorState,
  Skeleton,
} from "@/components/ui/feedback";
import { useConfirmDialog } from "@/components/ui/overlays";
import { SectionPanel, StatStrip } from "@/components/common";
import { useAppDispatch } from "@/store/hooks";
import { hideLoader, showLoader, toast } from "@/store/slices/uiSlice";
import { formatDate, formatDateTime } from "@/utils";
import { ipdService } from "@/pages/ipd/ipd.service";
import { THRESHOLD_STATUS_META } from "@/constants/ipd.constants";
import {
  AddChargeDialog,
  AddMedicationDialog,
  AddRoundDialog,
  ChangeDietDialog,
  RecordPaymentDialog,
  RecordVitalsDialog,
} from "./IpdClinicalDialogs";
import type {
  IpdChargeRow,
  IpdDailyAccrualResult,
  IpdDietOrderRow,
  IpdMedicationRow,
  IpdPaymentRow,
  IpdProvisionalBill,
  IpdRoundRow,
  IpdVitalRow,
} from "@/types/ipdTypes";

/* --------------------------------- shared ---------------------------------- */

/**
 * A 404 here means the backend branch (`new_features/sansar`) is not deployed
 * on this server yet — say that instead of a bare "Request failed".
 */
const clinicalErrorCopy = (e: any, fallback: string) =>
  e?.status === 404
    ? "The IPD clinical endpoints are not deployed on this backend yet — they ship on the backend branch new_features/sansar. This section fills in the moment it is deployed."
    : (e?.message ?? fallback);

const inr = (value: unknown) =>
  `₹${Number(value ?? 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const num = (value: unknown) => Number(value ?? 0);

/** Load-once + manual reload, with the error copy of this module. */
function usePanelData<T>(
  key: string,
  load: () => Promise<{ status: number; data: T }>,
  fallbackError: string,
) {
  const loadRef = useRef(load);
  loadRef.current = load;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await loadRef.current();
      if (res.status === 200) setData(res.data);
    } catch (e: any) {
      setError(clinicalErrorCopy(e, fallbackError));
    } finally {
      setLoading(false);
    }
  }, [fallbackError]);

  useEffect(() => {
    void reload();
  }, [reload, key]);

  return { data, loading, error, reload };
}

const panelHeaderAction = (children: React.ReactNode) => children;

/* ---------------------------------- vitals --------------------------------- */

export function VitalsPanel({
  admissionId,
  canWrite,
  onChanged,
}: {
  admissionId: string;
  canWrite: boolean;
  onChanged?: () => void;
}) {
  const { data, loading, error, reload } = usePanelData<IpdVitalRow[]>(
    admissionId,
    () => ipdService.fetchIpdVitals(admissionId, 100),
    "Could not load the vitals chart",
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const rows = data ?? [];

  const columns: Column<IpdVitalRow>[] = [
    {
      key: "recordedAt",
      header: "Recorded",
      render: (v) => (
        <span className="num text-[12.5px] font-medium text-ink-800">
          {formatDateTime(v.recordedAt)}
        </span>
      ),
    },
    {
      key: "temperature",
      header: "Temp",
      render: (v) => (
        <span className="num text-[12.5px]">
          {v.temperature !== null ? `${num(v.temperature).toFixed(1)} °C` : "—"}
        </span>
      ),
    },
    {
      key: "pulse",
      header: "Pulse",
      render: (v) => <span className="num text-[12.5px]">{v.pulse ?? "—"}</span>,
    },
    {
      key: "bp",
      header: "BP",
      render: (v) => (
        <span className="num text-[12.5px]">
          {v.bpSystolic || v.bpDiastolic
            ? `${v.bpSystolic ?? "—"}/${v.bpDiastolic ?? "—"}`
            : "—"}
        </span>
      ),
    },
    {
      key: "rr",
      header: "RR",
      hideBelow: "md",
      render: (v) => (
        <span className="num text-[12.5px]">{v.respiratoryRate ?? "—"}</span>
      ),
    },
    {
      key: "spo2",
      header: "SpO₂",
      render: (v) => (
        <span className="num text-[12.5px]">
          {v.spo2 !== null ? `${v.spo2}%` : "—"}
        </span>
      ),
    },
    {
      key: "pain",
      header: "Pain",
      hideBelow: "lg",
      render: (v) => (
        <span className="num text-[12.5px]">{v.painScore ?? "—"}</span>
      ),
    },
    {
      key: "notes",
      header: "Notes",
      hideBelow: "xl",
      render: (v) => (
        <span className="text-[12px] text-ink-500">{v.notes || "—"}</span>
      ),
    },
  ];

  return (
    <SectionPanel
      title="Vitals chart"
      subtitle="Nursing observations, newest first — one row per set"
      icon={<Activity className="size-4.5" />}
      action={panelHeaderAction(
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw />}
            loading={loading}
            onClick={() => void reload()}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            icon={<Plus />}
            disabled={!canWrite}
            onClick={() => setDialogOpen(true)}
          >
            Record vitals
          </Button>
        </div>,
      )}
    >
      {error ? (
        <ErrorState message={error} onRetry={() => void reload()} compact />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          status={loading ? "loading" : "ready"}
          rowKey={(v) => v.id}
          clickRowHint={false}
          emptyTitle="No vitals charted yet"
          emptyDescription="Record the first observation set — temp, pulse, BP, SpO₂, pain."
        />
      )}

      <RecordVitalsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        admissionId={admissionId}
        onDone={() => {
          void reload();
          onChanged?.();
        }}
      />
    </SectionPanel>
  );
}

/* -------------------------------- medications ------------------------------- */

export function MedicationsPanel({
  admissionId,
  canWrite,
  onChanged,
}: {
  admissionId: string;
  canWrite: boolean;
  onChanged?: () => void;
}) {
  const dispatch = useAppDispatch();
  const { ask, confirmNode } = useConfirmDialog();
  const { data, loading, error, reload } = usePanelData<IpdMedicationRow[]>(
    admissionId,
    () => ipdService.fetchIpdMedications(admissionId),
    "Could not load the drug chart",
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showStopped, setShowStopped] = useState(false);

  const rows = (data ?? []).filter((m) =>
    showStopped ? true : m.status === "ACTIVE",
  );
  const activeCount = (data ?? []).filter((m) => m.status === "ACTIVE").length;
  const stoppedCount = (data ?? []).length - activeCount;

  const stop = (row: IpdMedicationRow) =>
    ask({
      title: `Stop ${row.drugName}?`,
      description: `${row.dose} · ${row.route} ${row.frequency}. The line stays on the chart as history, marked STOPPED.`,
      confirmLabel: "Stop medication",
      tone: "warn",
      action: async () => {
        dispatch(showLoader("Stopping medication"));
        try {
          const res = await ipdService.stopIpdMedication(row.id);
          if (isOk(res.status)) {
            dispatch(toast.success("Medication stopped", row.drugName));
            void reload();
            onChanged?.();
          }
        } catch (e: any) {
          dispatch(toast.error("Could not stop the medication", e?.message));
        } finally {
          dispatch(hideLoader());
        }
      },
    });

  const columns: Column<IpdMedicationRow>[] = [
    {
      key: "drug",
      header: "Drug",
      render: (m) => (
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold text-ink-900">
            {m.drugName}
          </p>
          <p className="nums mt-0.5 text-[11.5px] text-ink-400">{m.dose}</p>
        </div>
      ),
    },
    {
      key: "regime",
      header: "Route · frequency",
      render: (m) => (
        <span className="text-[12.5px] text-ink-600">
          {m.route} · {m.frequency}
        </span>
      ),
    },
    {
      key: "started",
      header: "Started",
      hideBelow: "md",
      render: (m) => (
        <span className="num text-[12.5px] text-ink-600">
          {formatDate(m.startDate)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (m) =>
        m.status === "ACTIVE" ? (
          <Badge tone="mint" dot>
            Active
          </Badge>
        ) : (
          <Badge tone="neutral">Stopped</Badge>
        ),
    },
    {
      key: "stopped",
      header: "Stopped",
      hideBelow: "lg",
      render: (m) => (
        <span className="text-[12px] text-ink-500">
          {m.status === "STOPPED"
            ? `${m.stoppedAt ? formatDate(m.stoppedAt) : "—"}${m.stopReason ? ` · ${m.stopReason}` : ""}`
            : "—"}
        </span>
      ),
    },
  ];

  return (
    <SectionPanel
      title="Drug chart"
      subtitle="Doctor's orders for this stay — stopping keeps the line as history"
      icon={<Pill className="size-4.5" />}
      action={panelHeaderAction(
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw />}
            loading={loading}
            onClick={() => void reload()}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            icon={<Plus />}
            disabled={!canWrite}
            onClick={() => setDialogOpen(true)}
          >
            Order medication
          </Button>
        </div>,
      )}
    >
      {error ? (
        <ErrorState message={error} onRetry={() => void reload()} compact />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="mint" dot>
              {activeCount} active
            </Badge>
            {stoppedCount > 0 && (
              <button
                type="button"
                onClick={() => setShowStopped((v) => !v)}
                className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-[11.5px] font-medium text-ink-600 transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                {showStopped ? "Hide" : "Show"} {stoppedCount} stopped
              </button>
            )}
          </div>

          <DataTable
            columns={columns}
            rows={rows}
            status={loading ? "loading" : "ready"}
            rowKey={(m) => m.id}
            clickRowHint={false}
            emptyTitle={
              showStopped
                ? "No medication orders yet"
                : "No active medications"
            }
            emptyDescription="Order the first drug — dose, route and frequency as prescribed."
            actions={(m) => (
              <Button
                size="sm"
                variant="ghost"
                icon={<Ban />}
                disabled={!canWrite || m.status !== "ACTIVE"}
                onClick={() => stop(m)}
              >
                Stop
              </Button>
            )}
          />
        </>
      )}

      <AddMedicationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        admissionId={admissionId}
        onDone={() => {
          void reload();
          onChanged?.();
        }}
      />

      {confirmNode}
    </SectionPanel>
  );
}

/* ---------------------------------- rounds ---------------------------------- */

export function RoundsPanel({
  admissionId,
  canWrite,
  onChanged,
}: {
  admissionId: string;
  canWrite: boolean;
  onChanged?: () => void;
}) {
  const { data, loading, error, reload } = usePanelData<IpdRoundRow[]>(
    admissionId,
    () => ipdService.fetchIpdRounds(admissionId, 100),
    "Could not load the round notes",
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const rows = data ?? [];

  return (
    <SectionPanel
      title="Doctor rounds & notes"
      subtitle="SOAP notes of this stay, newest first"
      icon={<Stethoscope className="size-4.5" />}
      action={panelHeaderAction(
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw />}
            loading={loading}
            onClick={() => void reload()}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            icon={<Plus />}
            disabled={!canWrite}
            onClick={() => setDialogOpen(true)}
          >
            New round
          </Button>
        </div>,
      )}
    >
      {error ? (
        <ErrorState message={error} onRetry={() => void reload()} compact />
      ) : loading ? (
        <div className="space-y-3" aria-hidden="true">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-ink-100 p-4">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No rounds recorded yet"
          description="Each round is one SOAP note — any single section is enough to save."
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-ink-100 bg-white p-4"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="num text-[13px] font-semibold text-ink-800">
                  {formatDateTime(r.roundAt)}
                </span>
                {r.nextRoundAt && (
                  <Badge tone="lagoon">
                    next round {formatDate(r.nextRoundAt)}
                  </Badge>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["S", r.subjective],
                    ["O", r.objective],
                    ["A", r.assessment],
                    ["P", r.plan],
                  ] as [string, string | null][]
                )
                  .filter(([, value]) => value)
                  .map(([letter, value]) => (
                    <div key={letter} className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase text-ink-400">
                        {letter}
                      </p>
                      <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-700">
                        {value}
                      </p>
                    </div>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddRoundDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        admissionId={admissionId}
        onDone={() => {
          void reload();
          onChanged?.();
        }}
      />
    </SectionPanel>
  );
}

/* --------------------------------- billing ---------------------------------- */

/**
 * The running bill is loaded through one hook so the chart's billing tab and
 * the discharge wizard's bill / settlement steps share a single loader and the
 * same presentational blocks (`BillTotalsBlock`, `BillChargesTable`) — the
 * endpoint is called in exactly one place per mount and the two screens cannot
 * drift apart.
 */
export function useProvisionalBill(admissionId: string) {
  return usePanelData<IpdProvisionalBill>(
    admissionId,
    () => ipdService.fetchProvisionalBill(admissionId),
    "Could not load the running bill",
  );
}

/** Charges received/settled/balance + day count + the panel threshold verdict. */
export function BillTotalsBlock({
  bill,
  loading,
}: {
  bill: IpdProvisionalBill | null;
  loading: boolean;
}) {
  const totals = bill?.totals;
  const threshold = bill?.threshold;
  const thresholdMeta = THRESHOLD_STATUS_META[threshold?.status ?? "OK"];

  if (loading || !bill) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <StatStrip
        items={[
          { label: "Charges to date", value: inr(totals?.chargesTotal) },
          { label: "Received", value: inr(totals?.paymentsTotal) },
          {
            label: "Balance",
            value: (
              <span
                className={
                  num(totals?.balance) > 0 ? "text-coral-600" : "text-mint-600"
                }
              >
                {inr(totals?.balance)}
              </span>
            ),
          },
          {
            label: `Day ${totals?.dayCount ?? 1} · per day`,
            value: inr(
              num(totals?.roomRatePerDay) + num(totals?.nursingChargePerDay),
            ),
          },
        ]}
      />

      {threshold && threshold.status !== "OK" && (
        <div className="rounded-xl border border-amberly-500/40 bg-amberly-50/50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={thresholdMeta?.tone ?? "amber"} dot>
              {thresholdMeta?.label ?? threshold.status}
            </Badge>
            {threshold.maxAmount !== undefined && (
              <span className="num text-[12px] text-ink-600">
                cap {inr(threshold.maxAmount)} · used {threshold.usagePercent ?? 0}%
              </span>
            )}
            {threshold.actionOnBreach && (
              <span className="text-[11.5px] uppercase text-ink-400">
                {threshold.actionOnBreach} breach
              </span>
            )}
          </div>
          {threshold.message && (
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-600">
              {threshold.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Day-wise ledger of the stay, newest day first (auto accrual rows are tagged). */
export function BillChargesTable({
  charges,
  loading,
}: {
  charges: IpdChargeRow[] | undefined;
  loading: boolean;
}) {
  const columns: Column<IpdChargeRow>[] = [
    {
      key: "date",
      header: "Date",
      render: (c) => (
        <span className="num text-[12.5px] text-ink-700">
          {formatDate(c.chargeDate)}
        </span>
      ),
    },
    {
      key: "category",
      header: "Category",
      hideBelow: "md",
      render: (c) => <Badge tone="neutral">{c.category}</Badge>,
    },
    {
      key: "description",
      header: "Description",
      render: (c) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-ink-800">
            {c.description}
          </p>
          {c.source === "DAILY_ACCRUAL" && (
            <p className="text-[11px] text-ink-400">auto · daily accrual</p>
          )}
        </div>
      ),
    },
    {
      key: "qty",
      header: "Qty",
      hideBelow: "lg",
      render: (c) => <span className="num text-[12.5px]">{num(c.quantity)}</span>,
    },
    {
      key: "rate",
      header: "Rate",
      hideBelow: "lg",
      render: (c) => (
        <span className="num text-[12.5px]">{inr(c.unitPrice)}</span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (c) => (
        <span className="num text-[12.5px] font-semibold text-ink-900">
          {inr(c.amount)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={charges ?? []}
      status={loading ? "loading" : "ready"}
      rowKey={(c) => c.id}
      clickRowHint={false}
      emptyTitle="No charges recorded yet"
      emptyDescription="Post the day charges or add a manual entry — the ledger starts here."
    />
  );
}

export function BillingPanel({
  admissionId,
  canWrite,
  onChanged,
}: {
  admissionId: string;
  canWrite: boolean;
  onChanged?: () => void;
}) {
  const dispatch = useAppDispatch();
  const { ask, confirmNode } = useConfirmDialog();
  const { data: bill, loading, error, reload } = useProvisionalBill(admissionId);

  const [chargeOpen, setChargeOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [accrual, setAccrual] = useState<IpdDailyAccrualResult | null>(null);

  const postAccrual = () =>
    ask({
      title: "Post today's room & nursing charges?",
      description:
        "Adds the room rent and nursing charge of every open stay (or just this one) for today, from the room type's configured rates. Safe to press twice — an already-accrued day is skipped, never duplicated.",
      confirmLabel: "Post day charges",
      tone: "brand",
      action: async () => {
        dispatch(showLoader("Posting day charges"));
        try {
          const res = await ipdService.runIpdDailyAccrual({ admissionId });
          if (res.status === 200) {
            setAccrual(res.data);
            dispatch(
              toast.success(
                "Day charges posted",
                `${res.data.posted} line(s) posted · ${res.data.skipped} skipped · ${res.data.blocked} blocked`,
              ),
            );
            void reload();
            onChanged?.();
          }
        } catch (e: any) {
          dispatch(toast.error("Could not post the day charges", e?.message));
        } finally {
          dispatch(hideLoader());
        }
      },
    });

  const paymentColumns: Column<IpdPaymentRow>[] = [
    {
      key: "receivedAt",
      header: "Received",
      render: (p) => (
        <span className="num text-[12.5px] text-ink-700">
          {formatDateTime(p.receivedAt)}
        </span>
      ),
    },
    {
      key: "mode",
      header: "Mode",
      render: (p) => <Badge tone="lagoon">{p.mode}</Badge>,
    },
    {
      key: "reference",
      header: "Reference",
      hideBelow: "md",
      render: (p) => (
        <span className="text-[12px] text-ink-500">{p.reference || "—"}</span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (p) => (
        <span className="num text-[12.5px] font-semibold text-mint-600">
          {inr(p.amount)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <SectionPanel
        title="Running bill"
        subtitle="Day-wise charges accumulated during the stay"
        icon={<ReceiptIndianRupee className="size-4.5" />}
        action={panelHeaderAction(
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              icon={<RefreshCw />}
              loading={loading}
              onClick={() => void reload()}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canWrite}
              onClick={postAccrual}
            >
              Post day charges
            </Button>
            <Button
              size="sm"
              icon={<Plus />}
              disabled={!canWrite}
              onClick={() => setChargeOpen(true)}
            >
              Add charge
            </Button>
          </div>,
        )}
      >
        {error ? (
          <ErrorState message={error} onRetry={() => void reload()} compact />
        ) : (
          <>
            <BillTotalsBlock bill={bill} loading={loading} />

            {accrual && (
              <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3">
                <p className="text-[13px] font-semibold text-ink-800">
                  Day charges for {accrual.date}: {accrual.posted} posted ·{" "}
                  {accrual.skipped} skipped · {accrual.blocked} blocked
                </p>
                {(accrual.blocked > 0 || accrual.skipped > 0) && (
                  <ul className="mt-1.5 space-y-0.5">
                    {accrual.admissions
                      .filter((a) => a.status !== "POSTED")
                      .slice(0, 4)
                      .map((a) => (
                        <li
                          key={a.admissionId}
                          className="text-[11.5px] text-ink-500"
                        >
                          <span className="num font-medium">{a.admissionNo}</span>
                          {" — "}
                          {a.reason}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-4">
              <BillChargesTable charges={bill?.charges} loading={loading} />
            </div>
          </>
        )}
      </SectionPanel>

      <SectionPanel
        title="Payments"
        subtitle="Advance top-ups & settlement receipts — the deposit figure on the admission follows this ledger"
        icon={<ReceiptIndianRupee className="size-4.5" />}
        action={panelHeaderAction(
          <Button
            size="sm"
            icon={<Plus />}
            disabled={!canWrite}
            onClick={() => setPaymentOpen(true)}
          >
            Record payment
          </Button>,
        )}
      >
        <DataTable
          columns={paymentColumns}
          rows={bill?.payments ?? []}
          status={loading ? "loading" : "ready"}
          rowKey={(p) => p.id}
          clickRowHint={false}
          emptyTitle="No receipts yet"
          emptyDescription="The advance entered at admission stays on the record; receipts arrive here."
        />
      </SectionPanel>

      <AddChargeDialog
        open={chargeOpen}
        onOpenChange={setChargeOpen}
        admissionId={admissionId}
        onDone={() => {
          void reload();
          onChanged?.();
        }}
      />

      <RecordPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        admissionId={admissionId}
        balance={bill?.totals?.balance}
        onDone={() => {
          void reload();
          onChanged?.();
        }}
      />

      {confirmNode}
    </div>
  );
}

/* ----------------------------------- diet ----------------------------------- */

export function DietCard({
  admissionId,
  canWrite,
  onChanged,
}: {
  admissionId: string;
  canWrite: boolean;
  onChanged?: () => void;
}) {
  const dispatch = useAppDispatch();
  const { ask, confirmNode } = useConfirmDialog();
  const { data, loading, error, reload } = usePanelData<IpdDietOrderRow[]>(
    admissionId,
    () => ipdService.fetchIpdDietOrders(admissionId),
    "Could not load the diet orders",
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const rows = data ?? [];
  const active = rows.find((d) => d.isActive) ?? null;
  const history = rows.filter((d) => !d.isActive).slice(0, 3);

  const stop = () =>
    ask({
      title: "Stop the diet order?",
      description:
        "No replacement order is created — the kitchen simply has nothing live for this stay until a diet is set again (NPO is a diet choice if that is the plan).",
      confirmLabel: "Stop diet",
      tone: "warn",
      action: async () => {
        if (!active) return;
        dispatch(showLoader("Stopping the diet"));
        try {
          const res = await ipdService.stopIpdDiet(active.id);
          if (isOk(res.status)) {
            dispatch(toast.success("Diet stopped", "The kitchen sees no live diet now"));
            void reload();
            onChanged?.();
          }
        } catch (e: any) {
          dispatch(toast.error("Could not stop the diet", e?.message));
        } finally {
          dispatch(hideLoader());
        }
      },
    });

  return (
    <SectionPanel
      title="Diet"
      subtitle="One live order per stay — the kitchen works from this"
      icon={<UtensilsCrossed className="size-4.5" />}
      action={panelHeaderAction(
        <div className="flex items-center gap-2">
          {active && canWrite && (
            <Button size="sm" variant="ghost" icon={<Ban />} onClick={stop}>
              Stop
            </Button>
          )}
          <Button
            size="sm"
            icon={active ? <Pencil /> : <Plus />}
            disabled={!canWrite}
            onClick={() => setDialogOpen(true)}
          >
            {active ? "Change diet" : "Set diet"}
          </Button>
        </div>,
      )}
    >
      {error ? (
        <ErrorState message={error} onRetry={() => void reload()} compact />
      ) : loading ? (
        <Skeleton className="h-12 rounded-xl" />
      ) : !active ? (
        <EmptyState
          title="No diet order"
          description="Set the diet so the ward kitchen and nursing know what to serve."
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" dot>
              {active.dietType.replace("_", " ")}
            </Badge>
            <span className="num text-[12px] text-ink-400">
              since {formatDateTime(active.effectiveFrom)}
            </span>
          </div>
          {active.details && (
            <p className="text-[12.5px] leading-relaxed text-ink-600">
              {active.details}
            </p>
          )}
          {history.length > 0 && (
            <div className="border-t border-ink-100 pt-2">
              <p className="mb-1 text-[11px] font-semibold uppercase text-ink-400">
                Previous
              </p>
              <ul className="space-y-1">
                {history.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-3 text-[12px] text-ink-500"
                  >
                    <span>{d.dietType.replace("_", " ")}</span>
                    <span className="num">{formatDate(d.effectiveFrom)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <ChangeDietDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        admissionId={admissionId}
        currentType={active?.dietType}
        onDone={() => {
          void reload();
          onChanged?.();
        }}
      />

      {confirmNode}
    </SectionPanel>
  );
}
