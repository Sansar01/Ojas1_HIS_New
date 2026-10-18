import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CheckCheck,
  CircleDot,
  Plus,
  Printer,
  Save,
  Stethoscope,
  Trash2,
  RefreshCw,
  AlertTriangle,
  PhoneCall,
  CalendarDays,
  ArrowLeft,
  ClipboardList,
  HeartPulse,
  History,
  Pencil,
} from "lucide-react";
import { CONSULTATION_STATUSES } from "@/constants";
import { consultationService } from "@/pages/consultations/consultation.service";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { toast } from "@/store/slices/uiSlice";
import {
  useDebouncedValue,
  usePermission,
} from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { consultationSchema } from "@/pages/consultations/consultation.schema";
import { formatDate, formatTime } from "@/utils";
import { cn } from "@/utils/cn";
import {
  Avatar,
  Badge,
  Button,
  StatusBadge,
  Panel,
} from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/overlays";
import {
  DataTable,
  Pagination,
  RowActions,
  TableToolbar,
} from "@/components/ui/table";
import { PageIntro, PrescriptionPrintPreview } from "@/components/common";
import { EmptyState, ListSkeleton, Skeleton } from "@/components/ui/feedback";

import { Select } from "@/components/ui/fields";

/* ==========================================================================
   1. UI UTILITIES
   ========================================================================== */
/** Standard debounce — keeps auto-save from firing on every keystroke. */
function debounce<T extends (...args: any[]) => void>(func: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/* ==========================================================================
   2. CONSTANTS & FORMAT HELPERS
   ========================================================================== */
const TOKEN_STATUSES = {
  WAITING: "WAITING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  SKIPPED: "SKIPPED",
  CANCELLED: "CANCELLED",
} as const;

const CONSULT_STATUSES = {
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
} as const;

const formatStatusForUI = (status?: string) => {
  if (!status) return "In Progress";
  switch (status.toUpperCase()) {
    case "COMPLETED":
      return "Completed";
    case "IN_PROGRESS":
    case "IN_CONSULTATION":
      return "In Progress";
    default:
      return "In Progress";
  }
};

const toApiStatus = (uiStatus: string) => {
  return uiStatus === "Completed" ? "COMPLETED" : "IN_PROGRESS";
};

const fahrenheitToCelsius = (f: number | null | undefined): string => {
  if (f == null) return "";
  return ((f - 32) * (5 / 9)).toFixed(1);
};

const celsiusToFahrenheit = (c: string): number | null => {
  const n = parseFloat(c);
  return isNaN(n) ? null : Math.round(n * (9 / 5) + 32);
};

const parseBpString = (
  bp: string,
): { sys: number | null; dia: number | null } => {
  if (!bp) return { sys: null, dia: null };
  const parts = bp.split("/").map((s) => parseInt(s.trim(), 10));
  return {
    sys: isNaN(parts[0]) ? null : parts[0],
    dia: isNaN(parts[1]) ? null : parts[1],
  };
};

const formatBpFromApi = (
  sys: number | null | undefined,
  dia: number | null | undefined,
): string => {
  if (sys == null && dia == null) return "";
  return `${sys ?? "—"}/${dia ?? "—"}`;
};

/* --------------------------- prescription drafts --------------------------- */
/** One medicine line as the doctor edits it before/after saving to the API. */
export interface RxLine {
  /** undefined/null while the row is not yet persisted — otherwise the row id. */
  id?: string | null;
  medicineName: string;
  medicineType: string;
  doseAmount: number;
  doseUnit: string;
  frequency: string;
  route: string;
  mealRelation: string;
  durationDays: number;
  instructions: string;
}

const RX_OPTIONS = {
  medicineType: [
    "Tablet",
    "Capsule",
    "Syrup",
    "Suspension",
    "Injection",
    "Drops",
    "Ointment",
    "Cream",
    "Inhaler",
    "Spray",
    "Sachet",
  ],
  doseUnit: [
    "tablet",
    "capsule",
    "ml",
    "mg",
    "drop",
    "puff",
    "sachet",
    "teaspoon",
    "unit",
  ],
  frequency: [
    { value: "OD", label: "OD · Once daily" },
    { value: "BID", label: "BID · Twice a day" },
    { value: "TID", label: "TID · Three times a day" },
    { value: "QID", label: "QID · Four times a day" },
    { value: "QHS", label: "QHS · At bedtime" },
    { value: "SOS", label: "SOS · As needed" },
  ],
  route: [
    "ORAL",
    "IV",
    "IM",
    "SC",
    "SUBLINGUAL",
    "TOPICAL",
    "INHALATION",
    "NASAL",
    "OPHTHALMIC",
    "OTIC",
    "RECTAL",
  ],
  mealRelation: ["BEFORE_MEAL", "AFTER_MEAL", "WITH_MEAL", "EMPTY_STOMACH"],
};

/** A fresh, unsaved medicine row with sensible OPD defaults. */
const newRxLine = (): RxLine => ({
  id: null,
  medicineName: "",
  medicineType: "Tablet",
  doseAmount: 1,
  doseUnit: "tablet",
  frequency: "BID",
  route: "ORAL",
  mealRelation: "AFTER_MEAL",
  durationDays: 5,
  instructions: "",
});

/** Backend prescription row → editable draft (tolerant of older field shapes). */
const mapRxLine = (p: any): RxLine => ({
  id: p?.id ?? null,
  medicineName: p?.medicineName || "",
  medicineType: p?.medicineType || "Tablet",
  doseAmount:
    p?.doseAmount != null
      ? Number(p.doseAmount) || 1
      : parseFloat(p?.dosage) || 1,
  doseUnit: p?.doseUnit || "tablet",
  frequency: p?.frequency || "BID",
  route: p?.route || "ORAL",
  mealRelation: p?.mealRelation || "AFTER_MEAL",
  durationDays: p?.durationDays != null ? Number(p.durationDays) : 5,
  instructions: p?.instructions || "",
});

/** Editable draft → the exact `POST/PATCH /prescriptions` DTO. */
/** Option lists ({value, label}) → the human label of a raw enum value. */
const labelOf = (
  list: { value: string; label: string }[],
  value: string,
): string => list.find((o) => o.value === value)?.label ?? value;

const rxLineToBody = (l: RxLine) => ({
  medicineName: l.medicineName,
  medicineType: l.medicineType,
  doseAmount: Number(l.doseAmount) || 1,
  doseUnit: l.doseUnit,
  frequency: l.frequency,
  route: l.route,
  mealRelation: l.mealRelation,
  durationDays: Number(l.durationDays) || 5,
  instructions: l.instructions,
});

/**
 * UI form → the `PATCH /api/opd/consultations/:id` note DTO.
 * Dates travel as real ISO timestamps, never the raw `<input type="date">`.
 */
const buildNotePayload = (v: any) => ({
  chiefComplaints: v.chiefComplaint || "",
  historyOfIllness: v.historyOfIllness || "",
  generalExamination: v.systemicExamination || "",
  provisionalDiagnosis: v.diagnosis || "",
  specialInstructions: v.advice || "",
  clinicalNotes: v.followUpNotes || "",
  followUpDate: v.followUpDate
    ? new Date(v.followUpDate).toISOString()
    : null,
});

const CONSULT_MAP_KEY = "opd_consultation_map";
const saveConsultationMapping = (
  appointmentId: string,
  consultationId: string,
) => {
  try {
    const map = JSON.parse(localStorage.getItem(CONSULT_MAP_KEY) || "{}");
    map[appointmentId] = consultationId;
    localStorage.setItem(CONSULT_MAP_KEY, JSON.stringify(map));
  } catch {}
};

const getConsultationIdFromMap = (appointmentId: string): string | null => {
  try {
    const map = JSON.parse(localStorage.getItem(CONSULT_MAP_KEY) || "{}");
    return map[appointmentId] || null;
  } catch {
    return null;
  }
};

/* ==========================================================================
   3. SCREEN 1: DOCTOR QUEUE & CONSULTATIONS LIST
   ========================================================================== */
export function ConsultationsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { canCreate, canDelete } = usePermission();

  const sessionUser =
    useAppSelector((s: any) => s.auth?.session?.user) || null;

  // The doctor whose queue this screen drives. The backend login payload keeps
  // it under `doctorProfileId` on some accounts and as a nested profile on
  // others — accept the common variants before giving up.
  const activeDoctorId =
    sessionUser?.doctorProfileId ??
    sessionUser?.doctorProfile?.id ??
    sessionUser?.doctor?.id ??
    null;

  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [totalPages, setTotalPages] = useState(1);

  const [queueData, setQueueData] = useState<any>(null);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [activeError, setActiveError] = useState<{
    patientName: string;
    message: string;
  } | null>(null);
  const [queueDate, setQueueDate] = useState<string>(
    new Date().toLocaleDateString("en-CA"),
  );

  const [search, setSearch] = useState("");
  /**
   * The list query is server-side, so the search box must not drive a
   * request per keystroke: the input keeps instant local state (`search`,
   * what the box shows) while the fetch reads this debounced echo.
   */
  const debouncedSearch = useDebouncedValue(search, 350);
  const [filters, setFilters] = useState({
    doctor: "all",
    status: "all",
    from: "",
    to: "",
  });

  /**
   * Monotonic sequence for the list fetch — `fetchConsultations` tags each
   * call and discards any response that is no longer the newest (search
   * terms settle while earlier in-flight requests are still coming back).
   */
  const fetchSequence = useRef(0);

  const currentToken = queueData?.currentToken ?? null;
  const waitingTokens =
    queueData?.queue?.filter((t: any) => t.status === TOKEN_STATUSES.WAITING) ??
    [];
  const skippedTokens =
    queueData?.queue?.filter((t: any) => t.status === TOKEN_STATUSES.SKIPPED) ??
    [];

  const fetchConsultations = useCallback(async () => {
    /**
     * Newest-call-wins bookkeeping (hooks doc §24): a settled search term
     * can start a new request while a slow older answer is still in flight,
     * and answers can arrive out of order. The sequence check below makes a
     * superseded response a no-op — stale rows never overwrite fresher ones,
     * and neither does a superseded error toast.
     */
    const seq = ++fetchSequence.current;
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(limit),
      };
      if (debouncedSearch.trim())
        params.search = debouncedSearch.trim();
      if (filters.status !== "all") params.status = toApiStatus(filters.status);
      if (filters.doctor !== "all") params.doctorId = filters.doctor;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;

      const response = await consultationService.fetchConsultations(params);
      if (seq !== fetchSequence.current) return;
      if (response.status === 200) {
        const body = response.data ?? {};
        setConsultations(body.data ?? []);
        setTotalItems(body.meta?.total ?? 0);
        setTotalPages(body.meta?.totalPages ?? 1);
      }
    } catch (err: any) {
      if (seq !== fetchSequence.current) return;
      console.error("Consultations fetch failed:", err);
      dispatch(
        toast.error(
          "Could not load consultations",
          err?.message || "The list request did not succeed.",
        ),
      );
    } finally {
      // Only the latest call owns the loading flag — an older call finishing
      // late must not clear the newer call's spinner.
      if (seq === fetchSequence.current) setLoading(false);
    }
  }, [page, limit, debouncedSearch, filters, dispatch]);

  const fetchDoctorQueue = useCallback(async () => {
    if (!activeDoctorId) return;
    setLoadingQueue(true);
    try {
      const response = await consultationService.fetchDoctorQueue(
        activeDoctorId,
        queueDate,
      );
      if (response.status === 200)
        setQueueData(response.data?.data ?? response.data ?? null);
    } catch (err: any) {
      // Never swallow queue failures — a hidden panel without a reason is
      // indistinguishable from "no patients today".
      console.error("Doctor queue fetch failed:", err);
      dispatch(
        toast.error(
          "Could not load the OPD queue",
          err?.message || "The queue request did not succeed.",
        ),
      );
    } finally {
      setLoadingQueue(false);
    }
  }, [activeDoctorId, queueDate, dispatch]);

  useEffect(() => {
    fetchConsultations();
  }, [fetchConsultations]);

  useEffect(() => {
    fetchDoctorQueue();
  }, [fetchDoctorQueue]);

  const callAndOpenConsultation = async (token: any) => {
    const { id: tokenId, appointmentId, patient } = token;
    const patientName = patient?.fullName || "Patient";
    setActionLoadingId(tokenId);
    setActiveError(null);

    try {
      if (token.status === TOKEN_STATUSES.WAITING) {
        const callRes = await consultationService.callToken(tokenId);
        if (callRes.status !== 200) {
          setActiveError({
            patientName,
            message:
              "Call alert could not be broadcasted on TV display. Please check connection.",
          });
          setActionLoadingId(null);
          return;
        }
      }

      let consultationId: string | null = null;
      const postRes = await consultationService.createConsultation({
        appointmentId,
      });
      // Creates return 201 with the raw record (or a `{ data }` envelope) —
      // accept both, like the vitals create does.
      if (postRes.status >= 200 && postRes.status < 300) {
        consultationId = postRes.data?.data?.id ?? postRes.data?.id ?? null;
      }
      if (!consultationId) consultationId = token.consultationId;
      if (!consultationId)
        consultationId = getConsultationIdFromMap(appointmentId);

      if (consultationId) {
        saveConsultationMapping(appointmentId, consultationId);
        navigate(`/consultation/${consultationId}`);
      } else {
        setActiveError({
          patientName,
          message:
            "Patient called successfully, but workspace session creation failed.",
        });
        fetchDoctorQueue();
      }
    } catch (err: any) {
      setActiveError({ patientName, message: err.message });
      dispatch(toast.error("Could not start the consultation", err?.message));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCallNext = async () => {
    if (!activeDoctorId) return;
    setActionLoadingId("call-next");
    setActiveError(null);
    try {
      const response = await consultationService.callNextToken(
        activeDoctorId,
        queueDate,
      );
      const calledToken = response.data?.data ?? response.data;
      if (calledToken?.appointmentId) {
        const postRes = await consultationService.createConsultation({
          appointmentId: calledToken.appointmentId,
        });
        // Creates return 201 with the raw record (or an envelope) — accept both.
        const createdId = postRes.data?.data?.id ?? postRes.data?.id ?? null;
        if (createdId) {
          saveConsultationMapping(calledToken.appointmentId, createdId);
          navigate(`/consultation/${createdId}`);
        } else {
          fetchDoctorQueue();
        }
      } else {
        setActiveError({
          patientName: "—",
          message: "No patients currently waiting in queue.",
        });
      }
    } catch (err: any) {
      setActiveError({
        patientName: "—",
        message: err?.message || "Could not call the next patient.",
      });
      dispatch(toast.error("Could not call next patient", err?.message));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSkip = async (tokenId: string) => {
    setActionLoadingId(tokenId);
    const response = await consultationService.skipToken(tokenId);
    // Success can be 200 or 204 — accept the whole 2xx range.
    if (response.status >= 200 && response.status < 300) fetchDoctorQueue();
    setActionLoadingId(null);
  };

  const handleRequeue = async (tokenId: string) => {
    setActionLoadingId(tokenId);
    const response = await consultationService.requeueToken(tokenId);
    // Success can be 200 or 204 — accept the whole 2xx range.
    if (response.status >= 200 && response.status < 300) fetchDoctorQueue();
    setActionLoadingId(null);
  };

  const openWorkspace = (c: any) => {
    if (c.appointmentId && c.id) saveConsultationMapping(c.appointmentId, c.id);
    navigate(`/consultation/${c.id}`);
  };

  return (
    <>
      <PageIntro
        title="Consultations"
        description="Manage OPD queue and clinical records."
        module="consultations"
        meta={
          <>
            {queueData?.stats && (
              <>
                <Badge tone="amber" dot>
                  {queueData.stats.inProgress} in progress
                </Badge>
                <Badge tone="mint">{queueData.stats.completed} completed</Badge>
                <Badge tone="lagoon">{queueData.stats.waiting} waiting</Badge>
              </>
            )}
            <Button
              size="xs"
              variant="outline"
              className="ml-1 h-7"
              onClick={() => {
                fetchDoctorQueue();
                fetchConsultations();
              }}
              icon={
                <RefreshCw
                  className={cn(
                    "size-3.5",
                    (loading || loadingQueue) && "animate-spin",
                  )}
                />
              }
            >
              Sync
            </Button>
          </>
        }
      />

      {activeError && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-amberly-300 bg-amberly-50/90 p-3.5 text-ink-900 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amberly-600" />
            <div>
              <p className="text-[13px] font-semibold text-amberly-950">
                Action Alert — {activeError.patientName}
              </p>
              <p className="mt-0.5 text-[12px] text-amberly-800">
                {activeError.message}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveError(null)}
            className="text-[12px] font-medium text-amberly-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Explain why the queue panel is missing when no doctor is linked */}
      {!activeDoctorId && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-ink-200 bg-white p-3.5 shadow-sm">
          <div className="flex items-start gap-3">
            <CircleDot className="mt-0.5 size-5 shrink-0 text-ink-400" />
            <div>
              <p className="text-[13px] font-semibold text-ink-900">
                OPD queue unavailable for this account
              </p>
              <p className="mt-0.5 text-[12px] text-ink-600">
                The signed-in user has no linked doctor profile
                (&quot;doctorProfileId&quot;), so the doctor queue and
                &quot;Call &amp; Start&quot; actions are hidden. Sign in with a
                doctor account, or link a doctor profile to this user.
              </p>
            </div>
          </div>
        </div>
      )}

      {queueData && canCreate("consultations") && (
        <Panel className="mb-4 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-4 border-b border-ink-100 pb-3">
            <div className="flex items-center gap-4">
              <p className="flex items-center gap-2 text-[14px] font-semibold text-ink-900">
                <CircleDot className="size-4 animate-pulse text-amberly-500" />
                OPD Queue
              </p>
              <div className="flex items-center gap-2 bg-ink-50 px-2 py-1 rounded-lg border border-ink-200">
                <CalendarDays className="size-3.5 text-ink-500" />
                <input
                  type="date"
                  className="bg-transparent text-[12.5px] font-medium text-ink-700 outline-none cursor-pointer"
                  value={queueDate}
                  onChange={(e) => setQueueDate(e.target.value)}
                />
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleCallNext}
              disabled={
                actionLoadingId === "call-next" || queueData.stats.waiting === 0
              }
              icon={
                <PhoneCall
                  className={cn(
                    "size-3.5",
                    actionLoadingId === "call-next" && "animate-pulse",
                  )}
                />
              }
            >
              {actionLoadingId === "call-next" ? "Calling…" : "Call Next"}
            </Button>
          </div>

          {currentToken &&
            currentToken.status === TOKEN_STATUSES.IN_PROGRESS && (
              <div className="mb-3 flex items-center gap-3 rounded-xl border-2 border-brand-300 bg-brand-50/50 p-3">
                <Avatar
                  name={currentToken.patient?.fullName}
                  size="sm"
                  color="bg-brand-600"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-brand-900">
                      [{currentToken.tokenNumber}]{" "}
                      {currentToken.patient?.fullName}
                    </span>
                    <Badge tone="amber" size="xs" dot>
                      In Consultation
                    </Badge>
                  </div>
                </div>
                <button
                  onClick={() => callAndOpenConsultation(currentToken)}
                  disabled={actionLoadingId === currentToken.id}
                  className="rounded-lg bg-brand-600 px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-700"
                >
                  Open Workspace
                </button>
              </div>
            )}

          {waitingTokens.length > 0 && (
            <div className="mb-2 mt-4">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                Waiting ({waitingTokens.length})
              </p>
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {waitingTokens.map((token: any) => (
                  <div
                    key={token.id}
                    className="group flex min-w-[17rem] shrink-0 flex-col gap-2 rounded-xl border border-ink-100 bg-white p-3 shadow-sm hover:border-brand-300 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        name={token.patient?.fullName}
                        size="sm"
                        color="bg-lagoon-500"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold text-ink-900">
                          [{token.tokenNumber}] {token.patient?.fullName}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 border-t border-ink-50 pt-2">
                      <button
                        onClick={() => callAndOpenConsultation(token)}
                        disabled={actionLoadingId === token.id}
                        className="flex-1 rounded-md bg-brand-600 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-700"
                      >
                        Call & Start
                      </button>
                      <button
                        onClick={() => handleSkip(token.id)}
                        disabled={actionLoadingId === token.id}
                        className="rounded-md border border-ink-200 px-3 py-1.5 text-[11px] font-medium text-ink-600 hover:bg-ink-50"
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {skippedTokens.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-coral-500">
                Skipped ({skippedTokens.length})
              </p>
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {skippedTokens.map((token: any) => (
                  <div
                    key={token.id}
                    className="flex min-w-[15rem] shrink-0 items-center gap-2.5 rounded-xl border border-coral-200 bg-coral-50/40 p-2.5"
                  >
                    <Avatar
                      name={token.patient?.fullName}
                      size="xs"
                      color="bg-coral-400"
                    />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink-700">
                      [{token.tokenNumber}] {token.patient?.fullName}
                    </span>
                    <button
                      onClick={() => handleRequeue(token.id)}
                      disabled={actionLoadingId === token.id}
                      className="rounded-md bg-white border border-coral-200 px-2.5 py-1 text-[10px] font-semibold text-coral-700 hover:bg-coral-100 shadow-sm"
                    >
                      Re-queue
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </Panel>
      )}

      <Panel>
        <TableToolbar
          search={search}
          onSearch={(val) => {
            // Page reset is synchronous (and free when already on page 1, so
            // it does not re-render) — by the time the debounced term starts
            // a request, `page` is guaranteed to be 1: exactly one fetch per
            // settled search term, never one per keystroke and never a
            // stale-page request first.
            setSearch(val);
            setPage(1);
          }}
          searchPlaceholder="Search records..."
          filters={
            <Select
              size="sm"
              className="w-[10rem]"
              name="status"
              value={filters.status}
              onChange={(v) => {
                setFilters((f) => ({ ...f, status: v }));
                setPage(1);
              }}
              options={[
                { value: "all", label: "Any status" },
                ...CONSULTATION_STATUSES.map((s) => ({ value: s, label: s })),
              ]}
            />
          }
        />
        <DataTable
          columns={[
            {
              key: "consultationNo",
              header: "RECORD",
              render: (c) => (
                <span className="text-[12.5px] font-semibold text-ink-800">
                  {c.consultationNo || "—"}
                </span>
              ),
            },
            {
              key: "patient",
              header: "PATIENT",
              render: (c) => (
                <span className="text-[13px] font-semibold">
                  {c.patient?.fullName || "—"}
                </span>
              ),
            },
            {
              key: "provisionalDiagnosis",
              header: "DIAGNOSIS",
              render: (c) => (
                <span className="text-[12.5px]">
                  {c.provisionalDiagnosis || c.finalDiagnosis || "—"}
                </span>
              ),
            },
            {
              key: "status",
              header: "STATUS",
              align: "center",
              render: (c) => (
                <StatusBadge status={formatStatusForUI(c.status)} />
              ),
            },
          ]}
          rows={consultations}
          status={loading ? "loading" : "ready"}
          onRetry={fetchConsultations}
          onRowClick={openWorkspace}
          actions={(c) => (
            <RowActions
              items={[
                {
                  label: "Open workspace",
                  icon: <Stethoscope />,
                  onClick: () => openWorkspace(c),
                },
                {
                  label: "Delete",
                  icon: <Trash2 />,
                  tone: "danger",
                  hidden: !canDelete("consultations"),
                  onClick: async () => {
                    if (confirm("Delete this record?")) {
                      const response =
                        await consultationService.deleteConsultation(c.id);
                      // DELETE can answer 200 or 204.
                      if (response.status >= 200 && response.status < 300)
                        fetchConsultations();
                    }
                  },
                },
              ]}
            />
          )}
          emptyTitle="No consultations found"
          footer={
            <Pagination
              page={page}
              pageCount={totalPages}
              total={totalItems}
              pageSize={limit}
              onPage={setPage}
              onPageSize={(s) => {
                setLimit(s);
                setPage(1);
              }}
              label="consultations"
            />
          }
        />
      </Panel>
    </>
  );
}

/* ==========================================================================
   4. SCREEN 2: PRESCRIPTION WORKSPACE (CLINICAL DASHBOARD UI)
   ========================================================================== */
const SectionDivider = ({ title }: { title: string }) => (
  <div className="relative flex items-center py-2">
    <div className="flex-grow border-t border-ink-200"></div>
    <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-ink-400 uppercase tracking-widest">
      {title}
    </span>
    <div className="flex-grow border-t border-ink-200"></div>
  </div>
);

export function ConsultationWorkspacePage() {
  const dispatch = useAppDispatch();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { canEdit } = usePermission();

  const [record, setRecord] = useState<any>(null);
  const [loadingRecord, setLoadingRecord] = useState(true);
  const [vitalsId, setVitalsId] = useState<string | null>(null);
  const [rx, setRx] = useState<RxLine[]>([]);
  // Medicine add/edit modal — `editing` null means "add a new medicine".
  const [rxModal, setRxModal] = useState<{
    open: boolean;
    editing: RxLine | null;
  }>({ open: false, editing: null });
  const [rxSaving, setRxSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [cardTab, setCardTab] = useState<"details" | "history">("details");
  // The facility-profile endpoint is not part of this backend build, so the
  // print sheet renders with its generic header.
  const hospital: any = null;

  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const isCompleted = record?.status === CONSULT_STATUSES.COMPLETED;
  const readOnly = !canEdit("consultations") || isCompleted;

  const form = useForm({
    initialValues: {
      chiefComplaint: "",
      historyOfIllness: "",
      systemicExamination: "",
      diagnosis: "",
      advice: "",
      followUpNotes: "",
      followUpDate: "",
      bp: "",
      pulse: "",
      temp: "",
      weight: "",
      spo2: "",
    },
    schema: consultationSchema,
  });

  // Fetch Core consultation on mount
  const fetchConsultationById = useCallback(async () => {
    if (!id) return;
    setLoadingRecord(true);
    try {
      const response = await consultationService.fetchConsultationById(id);
      if (response.status < 200 || response.status >= 300)
        throw new Error("Failed");
      // The backend may answer with the record itself or an `{ data }` envelope.
      const d = response?.data?.data ?? response?.data;
      setRecord(d);

      form.setValues({
        chiefComplaint: d.chiefComplaints || "",
        historyOfIllness: d.historyOfIllness || d.history || "",
        systemicExamination: d.generalExamination || d.examination || "",
        diagnosis: d.provisionalDiagnosis || d.finalDiagnosis || "",
        advice: d.specialInstructions || "",
        followUpNotes: d.clinicalNotes || d.internalNotes || "",
        followUpDate: d.followUpDate ? String(d.followUpDate).slice(0, 10) : "",
        bp: "",
        pulse: "",
        temp: "",
        weight: "",
        spo2: "",
      });

      setRx((d.prescriptions || []).map(mapRxLine));
    } finally {
      setLoadingRecord(false);
    }
  }, [id]);

  // Fetch Vitals data separately
  const loadVitals = useCallback(
    async (appointmentId: string) => {
      try {
        const response =
          await consultationService.fetchVitalsByAppointment(appointmentId);
        // The backend may answer with the vitals itself or an `{ data }` envelope.
        const vitals = response.data?.data ?? response.data;
        if (response.status < 200 || response.status >= 300 || !vitals) return;
        setVitalsId(vitals.id || null);
        form.setValues((prev) => ({
          ...prev,
          bp: formatBpFromApi(vitals.bloodPressureSys, vitals.bloodPressureDia),
          pulse: vitals.pulseRate != null ? String(vitals.pulseRate) : "",
          temp: fahrenheitToCelsius(vitals.temperatureF),
          weight: vitals.weightKg != null ? String(vitals.weightKg) : "",
          spo2:
            vitals.spo2 != null
              ? String(vitals.spo2)
              : vitals.spO2 != null
                ? String(vitals.spO2)
                : "",
        }));
      } catch (e: any) {
        dispatch(toast.error("Could not load consultation", e?.message));
      }
    },
    [dispatch],
  );

  useEffect(() => {
    fetchConsultationById();
  }, [fetchConsultationById]);

  useEffect(() => {
    if (record?.appointmentId) loadVitals(record.appointmentId);
  }, [record?.appointmentId, loadVitals]);

  /* ==========================================================================
     DEBUNCED AUTO-SAVE LOGIC (Best Practice)
     ========================================================================== */
  const runAutoSave = useCallback(
    debounce(async (consultationId: string, values: any) => {
      // The exact note DTO the backend PATCH validation accepts.
      const payload = buildNotePayload(values);

      const res = await consultationService
        .updateConsultationNote(consultationId, payload)
        .catch(() => null);
      // Subtle confirmation on the debounced path; failures only surface on
      // the explicit "Save note" (banner + toast) to avoid toast spam.
      if (res && res.status >= 200 && res.status < 300)
        dispatch(toast.success("Saved successfully", "Consultation updated."));
    }, 1500),
    [dispatch],
  );

  const handleSoapChange = (field: string, value: string) => {
    form.setValue(field as any, value);
    if (readOnly || !record?.id) return;

    // ONE auto-save path (debounced). The previous duplicate timer issued a
    // second PATCH for the same edit — exactly the duplicate-request pattern
    // the architecture standard forbids (Rule 8).
    // Trigger debounced save with updated snapshot
    const updatedValues = { ...form.values, [field]: value };
    runAutoSave(record.id, updatedValues);
  };

  /* ==========================================================================
     MANUAL SAVE & FINAL STATUS SUBMISSION
     ========================================================================== */
  const handleSaveNote = async () => {
    if (!record?.id) return false;
    setSaving(true);
    setErrorBanner(null);

    try {
      // 1. Save consultation note — the full note DTO.
      const consultRes = await consultationService.updateConsultationNote(
        record.id,
        buildNotePayload(form.values),
      );

      if (consultRes.status < 200 || consultRes.status >= 300) {
        setErrorBanner(
          consultRes.data?.message || "Failed to update consultation.",
        );
        return false;
      }

      // 2. Save vitals (lowercase 'spo2', 'patientId' intentionally omitted)
      if (record.appointmentId) {
        const { sys, dia } = parseBpString(form.values.bp);
        const pulse = parseInt(form.values.pulse);
        const tempF = celsiusToFahrenheit(form.values.temp);
        const weight = parseFloat(form.values.weight);
        const spo2 = parseInt(form.values.spo2);

        const vitalsPayload: Record<string, any> = {
          appointmentId: record.appointmentId,
        };

        if (sys !== null && !isNaN(sys)) vitalsPayload.bloodPressureSys = sys;
        if (dia !== null && !isNaN(dia)) vitalsPayload.bloodPressureDia = dia;
        if (!isNaN(pulse)) vitalsPayload.pulseRate = pulse;
        if (tempF !== null) vitalsPayload.temperatureF = tempF;
        if (!isNaN(weight)) vitalsPayload.weightKg = weight;
        if (!isNaN(spo2)) vitalsPayload.spo2 = spo2;

        const vitalsRes = await consultationService.saveVitals(
          vitalsPayload,
          vitalsId,
        );

        // Creates return 201 with the raw record (or an envelope) — accept both.
        const savedVitalsId = vitalsRes.data?.data?.id ?? vitalsRes.data?.id;
        if (vitalsRes.status >= 200 && vitalsRes.status < 300) {
          if (savedVitalsId) setVitalsId(String(savedVitalsId));
        }
      }

      dispatch(toast.success("Saved successfully", "Consultation updated."));
      return true;
    } catch (err: any) {
      setErrorBanner(err.message || "Something went wrong during save.");
      dispatch(toast.error("Could not save consultation", err?.message));
      return false;
    } finally {
      setSaving(false);
    }
  };

  /* ==========================================================================
     MEDICINE MODAL — POST/PATCH one prescription line, then refresh
     ========================================================================== */
  /** Refetch just the prescriptions of this consultation (list refresh). */
  const refreshPrescriptions = useCallback(async () => {
    if (!id) return;
    const res = await consultationService.fetchConsultationById(id);
    const d = res?.data?.data ?? res?.data;
    if (d) {
      if (record)
        setRecord((prev: any) => ({
          ...prev,
          prescriptions: d.prescriptions ?? [],
        }));
      setRx((d.prescriptions || []).map(mapRxLine));
    }
    // Intentionally only rx/prescriptions — the open form must keep its text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSaveMedicine = async () => {
    const editing = rxModal.editing;
    if (!editing) return;

    if (!editing.medicineName.trim()) {
      dispatch(
        toast.warning(
          "Medicine name is required",
          "Enter the medicine name and strength before saving.",
        ),
      );
      return;
    }

    setRxSaving(true);
    try {
      const body = rxLineToBody(editing);
      const res = editing.id
        ? await consultationService.updatePrescriptionLine(
            id,
            editing.id,
            body,
          )
        : await consultationService.addPrescriptionLine(id, body);

      if (res.status < 200 || res.status >= 300)
        throw new Error(res.data?.message || "Could not save the medicine.");

      // Success: refresh the prescription list from the source of truth.
      await refreshPrescriptions();
      dispatch(
        toast.success(
          editing.id ? "Medicine updated" : "Medicine added",
          `${body.medicineName} saved to the prescription.`,
        ),
      );
      setRxModal({ open: false, editing: null });
    } catch (e: any) {
      setErrorBanner(e?.message || "Could not save the medicine.");
      dispatch(toast.error("Could not save medicine", e?.message));
    } finally {
      setRxSaving(false);
    }
  };

  const handleCompleteConsultation = async () => {
    setErrorBanner(null);

    // Validation — the backend requires both to complete a consultation.
    if (!form.values.chiefComplaint?.trim()) {
      dispatch(
        toast.warning(
          "Chief complaint required",
          "Fill in the chief complaint before completing the consultation.",
        ),
      );
      return;
    }
    if (!form.values.diagnosis?.trim()) {
      dispatch(
        toast.warning(
          "Diagnosis required",
          "Diagnosis is required to complete consultation.",
        ),
      );
      return;
    }

    const errs = form.validate();
    if (Object.keys(errs).length > 0 || !record?.id) return;

    setCompleting(true);
    try {
      // Persist the latest note (and vitals) before closing the visit; if the
      // save fails, do NOT complete — the banner already shows the reason.
      const saved = await handleSaveNote();
      if (!saved) return;

      try {
        const response = await consultationService.completeConsultation(
          record.id,
        );
        if (response.status >= 200 && response.status < 300) {
          // Optional PDF/print view if the completion response carries one.
          const printUrl: string | undefined =
            response.data?.data?.printUrl ??
            response.data?.data?.pdfUrl ??
            response.data?.printUrl ??
            response.data?.pdfUrl;
          if (printUrl) window.open(printUrl, "_blank");
          dispatch(
            toast.success(
              "Consultation completed",
              "The visit has been closed.",
            ),
          );
          navigate("/consultations");
        }
      } catch (e: any) {
        // 400s land here (e.g. "Diagnosis is required to complete consultation").
        dispatch(
          toast.error(
            "Could not complete consultation",
            e?.message || "The completion request was rejected.",
          ),
        );
      }
    } finally {
      setCompleting(false);
    }
  };

  if (loadingRecord) {
    // The workspace is this page's own data: a layout-shaped skeleton, never
    // the global loader (the rest of the shell stays interactive).
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-2.5 w-72" />
          </div>
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-ink-100 bg-white p-4"
              >
                <Skeleton className="h-3 w-36" />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {[0, 1, 2, 3].map((f) => (
                    <div key={f} className="space-y-2">
                      <Skeleton className="h-2.5 w-24" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-ink-100 bg-white p-4">
            <Skeleton className="h-3 w-28" />
            <ListSkeleton rows={5} className="mt-3" />
          </div>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Button onClick={() => navigate("/consultation")}>Back to list</Button>
      </div>
    );
  }

  const patient = record.patient || {};
  const doctor = record.doctor || {};
  const patientId = patient.uhid || "MHN-2481216";
  const bloodType = patient.bloodGroup || "O-";
  const allergies = patient.allergies || "Peanuts";
  const chronic = patient.chronic || "Hypertension";
  const emergencyContact =
    patient.emergencyContact || "Mariam Kimura - +91 977453 56829";

  return (
    <div className="min-h-screen bg-[#F4F8F9] font-sans text-ink-900 pb-12 print:bg-white print:pb-0">
      {/* HEADER */}
      <div className="max-w-[1400px] mx-auto px-6 pt-6 pb-4 flex items-start justify-between print:hidden">
        <div>
          <button
            onClick={() => navigate("/consultation")}
            className="flex items-center gap-1 text-[12px] font-medium text-ink-500 hover:text-ink-700 mb-4 transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Back
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink-950">
              Consultation{" "}
              {record.consultationNo ||
                `CNS-${record.id?.slice(0, 4).toUpperCase()}`}
            </h1>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[13px] font-medium text-ink-500">
              {formatDate(record.startedAt || new Date())} -{" "}
              {formatTime(record.startedAt || new Date())}
            </span>
            <span className="text-ink-300">•</span>
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              {formatStatusForUI(record.status)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-8">
          <Button
            variant="outline"
            className="bg-white"
            icon={<Printer className="size-4" />}
            onClick={() => setPrintPreviewOpen(true)}
          >
            Print
          </Button>
          {!readOnly && (
            <Button
              variant="outline"
              className="bg-white"
              icon={<Save className="size-4" />}
              disabled={saving}
              onClick={handleSaveNote}
            >
              {saving ? "Saving…" : "Save note"}
            </Button>
          )}
          {!readOnly && (
            <Button
              icon={<CheckCheck className="size-4" />}
              disabled={completing}
              onClick={handleCompleteConsultation}
              className="bg-[#1D6C63] text-white hover:bg-[#15544d] border-transparent shadow-sm"
            >
              {completing ? "Completing…" : "Complete consultation"}
            </Button>
          )}
        </div>
      </div>

      {errorBanner && (
        <div className="max-w-[1400px] mx-auto px-6 mb-4 print:hidden">
          <div className="flex items-start justify-between gap-3 rounded-xl border border-coral-300 bg-coral-50 p-3.5 text-coral-900 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-coral-600" />
              <div>
                <p className="text-[13px] font-bold">Action Blocked</p>
                <p className="mt-0.5 text-[12px] font-medium text-coral-800">
                  {errorBanner}
                </p>
              </div>
            </div>
            <button
              onClick={() => setErrorBanner(null)}
              className="text-[12px] font-semibold text-coral-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* MAIN GRID */}
      <div className="max-w-[1400px] mx-auto px-6 flex flex-col lg:flex-row gap-6 print:block print:p-0">
        {/* LEFT SIDEBAR */}
        <div className="w-full lg:w-[320px] shrink-0 flex flex-col gap-5 print:hidden">
          {/* Patient Card */}
          <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <Avatar
                name={patient.fullName || "Patient"}
                size="lg"
                className="h-12 w-12 rounded-lg bg-[#1D6C63] text-white font-bold text-lg"
              />
              <div>
                <h2 className="text-base font-bold text-ink-900 leading-tight">
                  {patient.fullName || "Unknown Patient"}
                </h2>
                <p className="text-[11px] text-ink-500 font-medium mt-0.5">
                  {patientId}
                </p>
                <div className="flex gap-1.5 mt-1.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-ink-200 text-ink-600 bg-ink-50">
                    {bloodType}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-ink-200 text-ink-600 bg-ink-50">
                    {patient.gender || "U"}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-ink-200 text-ink-600 bg-ink-50">
                    {patient.age || "-"} yrs
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-1 rounded-lg bg-ink-100 p-1">
              {(
                [
                  { key: "details", label: "Patient details" },
                  { key: "history", label: "Patient history" },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setCardTab(t.key)}
                  className={cn(
                    "flex-1 rounded-md py-1.5 text-[11.5px] font-semibold transition-colors",
                    cardTab === t.key
                      ? "bg-white text-[#1D6C63] shadow-sm"
                      : "text-ink-500 hover:text-ink-800",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {cardTab === "details" ? (
                <div className="space-y-3 text-[12px]">
                  <div className="grid grid-cols-[80px_1fr] gap-2 items-start">
                    <span className="text-ink-500 font-medium">Allergies</span>
                    <span className="text-coral-600 font-semibold text-right">
                      {allergies}
                    </span>
                  </div>
                  <div className="grid grid-cols-[80px_1fr] gap-2 items-start">
                    <span className="text-ink-500 font-medium">Chronic</span>
                    <span className="text-ink-900 font-medium text-right">
                      {chronic}
                    </span>
                  </div>
                  <div className="grid grid-cols-[80px_1fr] gap-2 items-start">
                    <span className="text-ink-500 font-medium">Emergency</span>
                    <span className="text-ink-900 font-medium text-right text-[11px] whitespace-pre-line">
                      {emergencyContact}
                    </span>
                  </div>
                  <div className="grid grid-cols-[80px_1fr] gap-2 items-start">
                    <span className="text-ink-500 font-medium">Contact</span>
                    <span className="text-ink-900 font-medium text-right">
                      {patient.phone || "+91 982708 66766"}
                    </span>
                  </div>
                  <button className="w-full mt-2 py-2 border border-ink-200 rounded-lg text-[12px] font-semibold text-ink-700 hover:bg-ink-50 transition-colors">
                    Open full chart
                  </button>
                </div>
              ) : (
                <PatientHistoryPanel
                  patientKey={patient.id}
                  currentId={record?.id}
                />
              )}
            </div>
          </div>

          {/* Visit Context */}
          <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-md bg-teal-50 text-[#1D6C63]">
                <ClipboardList className="size-4" />
              </div>
              <h3 className="text-[13px] font-bold text-ink-900">
                Visit context
              </h3>
            </div>
            <div className="space-y-4 text-[12px]">
              <div>
                <p className="text-[10px] font-bold text-ink-400 uppercase tracking-wide mb-0.5">
                  Doctor
                </p>
                <p className="font-medium text-ink-900">
                  Dr. {doctor.firstName || ""} {doctor.lastName || ""}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-ink-400 uppercase tracking-wide mb-0.5">
                  Fee
                </p>
                <p className="font-medium text-ink-900">
                  ₹{record.fee || "1,200"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-ink-400 uppercase tracking-wide mb-0.5">
                  Appointment
                </p>
                <p className="font-medium text-ink-900">
                  APT-{record.appointmentId?.slice(0, 4) || "9076"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-ink-400 uppercase tracking-wide mb-0.5">
                  Type
                </p>
                <p className="font-medium text-ink-900">In-Person</p>
              </div>
            </div>
          </div>

          {/* Vitals */}
          <div className="bg-white rounded-xl border border-ink-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-md bg-teal-50 text-[#1D6C63]">
                <HeartPulse className="size-4" />
              </div>
              <h3 className="text-[13px] font-bold text-ink-900">Vitals</h3>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-ink-500 mb-1">
                  Blood pressure
                </label>
                <input
                  className="w-full border border-ink-200 rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-[#1D6C63]"
                  placeholder="120/80"
                  value={form.values.bp}
                  onChange={(e) => handleSoapChange("bp", e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-ink-500 mb-1">
                  Pulse <span className="text-[10px] font-normal">/min</span>
                </label>
                <input
                  className="w-full border border-ink-200 rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-[#1D6C63]"
                  placeholder="72"
                  value={form.values.pulse}
                  onChange={(e) => handleSoapChange("pulse", e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-ink-500 mb-1">
                  Temp <span className="text-[10px] font-normal">°C</span>
                </label>
                <input
                  className="w-full border border-ink-200 rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-[#1D6C63]"
                  placeholder="36.8"
                  value={form.values.temp}
                  onChange={(e) => handleSoapChange("temp", e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-ink-500 mb-1">
                  SpO₂ <span className="text-[10px] font-normal">%</span>
                </label>
                <input
                  className="w-full border border-ink-200 rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-[#1D6C63]"
                  placeholder="98"
                  value={form.values.spo2}
                  onChange={(e) => handleSoapChange("spo2", e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-ink-500 mb-1">
                  Weight <span className="text-[10px] font-normal">kg</span>
                </label>
                <input
                  className="w-full border border-ink-200 rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-[#1D6C63]"
                  placeholder="64"
                  value={form.values.weight}
                  onChange={(e) => handleSoapChange("weight", e.target.value)}
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT MAIN AREA (FORM) */}
        <div className="flex-1 bg-white rounded-xl border border-ink-200 shadow-sm p-6 print:border-none print:shadow-none print:p-0">
          <SectionDivider title="Subjective" />

          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-bold text-ink-700 mb-1.5">
                Chief complaint <span className="text-coral-500">*</span>
              </label>
              <textarea
                className="w-full border border-ink-200 rounded-lg p-3 text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-[#1D6C63] focus:ring-1 focus:ring-[#1D6C63] resize-y min-h-[80px]"
                placeholder="Presenting concern, duration, severity..."
                value={form.values.chiefComplaint}
                onChange={(e) =>
                  handleSoapChange("chiefComplaint", e.target.value)
                }
                disabled={readOnly}
              />
            </div>

            <div>
              <label className="block text-[12px] font-bold text-ink-700 mb-1.5">
                Symptoms & history
              </label>
              <textarea
                className="w-full border border-ink-200 rounded-lg p-3 text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-[#1D6C63] focus:ring-1 focus:ring-[#1D6C63] resize-y min-h-[80px]"
                placeholder="Onset, aggravating factors, prior treatment, medications..."
                value={form.values.historyOfIllness}
                onChange={(e) =>
                  handleSoapChange("historyOfIllness", e.target.value)
                }
                disabled={readOnly}
              />
            </div>
          </div>

          <SectionDivider title="Objective" />

          <div>
            <label className="block text-[12px] font-bold text-ink-700 mb-1.5">
              Physical examination
            </label>
            <textarea
              className="w-full border border-ink-200 rounded-lg p-3 text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-[#1D6C63] focus:ring-1 focus:ring-[#1D6C63] resize-y min-h-[80px]"
              placeholder="Systemic examination, findings, investigations reviewed..."
              value={form.values.systemicExamination}
              onChange={(e) =>
                handleSoapChange("systemicExamination", e.target.value)
              }
              disabled={readOnly}
            />
          </div>

          <div className="mt-4">
            <label className="block text-[12px] font-bold text-ink-700 mb-1.5">
              Diagnosis / impression <span className="text-coral-500">*</span>
            </label>
            <textarea
              className="w-full border border-ink-200 rounded-lg p-3 text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-[#1D6C63] focus:ring-1 focus:ring-[#1D6C63] resize-y min-h-[60px]"
              placeholder="Provisional or confirmed diagnosis"
              value={form.values.diagnosis}
              onChange={(e) => handleSoapChange("diagnosis", e.target.value)}
              disabled={readOnly}
            />
          </div>

          <SectionDivider title="Prescription" />

          <div className="mb-2">
            <p className="text-[12px] text-ink-500 text-center mb-4">
              Add medicines with dose, frequency, route and duration
            </p>

            {rx.length === 0 ? (
              <div className="border border-dashed border-ink-300 rounded-lg py-6 text-center text-[12px] text-ink-400 font-medium bg-ink-50/50">
                No medicines added yet.
              </div>
            ) : (
              <div className="space-y-2">
                {rx.map((line, i) => (
                  <div
                    key={line.id ?? `unsaved-${i}`}
                    className="flex items-start gap-3 p-3 border border-ink-100 rounded-lg bg-ink-50/30 group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold text-ink-900">
                          {line.medicineName}
                        </span>
                        <span className="rounded border border-ink-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-ink-600">
                          {line.medicineType}
                        </span>
                      </div>
                      <p className="mt-1 text-[11.5px] text-ink-600">
                        {[
                          `${line.doseAmount} ${line.doseUnit}`,
                          labelOf(RX_OPTIONS.frequency, line.frequency),
                          line.route,
                          line.mealRelation.split("_").join(" "),
                          `${line.durationDays} days`,
                        ].join(" · ")}
                      </p>
                      {line.instructions && (
                        <p className="mt-0.5 text-[11.5px] italic text-ink-500">
                          {line.instructions}
                        </p>
                      )}
                    </div>
                    {!readOnly && (
                      <button
                        onClick={() =>
                          setRxModal({ open: true, editing: { ...line } })
                        }
                        className="shrink-0 flex items-center gap-1.5 rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-ink-600 hover:text-[#1D6C63] hover:border-[#1D6C63]/40 transition-colors print:hidden"
                      >
                        <Pencil className="size-3.5" /> Edit
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!readOnly && (
              <button
                onClick={() => setRxModal({ open: true, editing: newRxLine() })}
                className="mt-3 text-[12px] font-semibold text-ink-600 hover:text-[#1D6C63] flex items-center gap-1.5 py-1.5 px-3 border border-ink-200 rounded-md bg-white hover:bg-teal-50 transition-colors print:hidden"
              >
                <Plus className="size-3.5" /> Add medicine
              </button>
            )}
          </div>

          <SectionDivider title="Plan & Advice" />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-3 space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-ink-700 mb-1.5">
                  Advice & lifestyle guidance
                </label>
                <textarea
                  className="w-full border border-ink-200 rounded-lg p-3 text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-[#1D6C63] focus:ring-1 focus:ring-[#1D6C63] resize-y min-h-[80px]"
                  placeholder="Diet, activity, red-flag symptoms, investigations advised..."
                  value={form.values.advice}
                  onChange={(e) => handleSoapChange("advice", e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="print:hidden">
                <label className="block text-[12px] font-bold text-ink-700 mb-1.5">
                  Internal notes{" "}
                  <span className="text-[10px] font-normal text-ink-400">
                    (not printed)
                  </span>
                </label>
                <textarea
                  className="w-full border border-ink-200 rounded-lg p-3 text-[13px] text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-[#1D6C63] focus:ring-1 focus:ring-[#1D6C63] resize-y min-h-[60px] bg-amber-50/30"
                  placeholder="Referrals, coding notes, insurance remarks..."
                  value={form.values.followUpNotes}
                  onChange={(e) =>
                    handleSoapChange("followUpNotes", e.target.value)
                  }
                  disabled={readOnly}
                />
              </div>
            </div>

            <div className="md:col-span-1">
              <label className="block text-[12px] font-bold text-ink-700 mb-1.5">
                Follow-up date
              </label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-400" />
                <input
                  type="date"
                  className="w-full border border-ink-200 rounded-lg pl-9 pr-3 py-2 text-[13px] text-ink-900 focus:outline-none focus:border-[#1D6C63]"
                  value={form.values.followUpDate}
                  onChange={(e) =>
                    handleSoapChange("followUpDate", e.target.value)
                  }
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* ADD / EDIT MEDICINE MODAL */}
      <Dialog
        open={rxModal.open}
        onOpenChange={(open) => setRxModal((m) => ({ ...m, open }))}
        title={rxModal.editing?.id ? "Edit medicine" : "Add medicine"}
        description="Dose, frequency, route and duration are sent with the prescription line."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              disabled={rxSaving}
              onClick={() => setRxModal({ open: false, editing: null })}
            >
              Cancel
            </Button>
            <Button disabled={rxSaving} onClick={handleSaveMedicine}>
              {rxSaving ? "Saving…" : "Save medicine"}
            </Button>
          </div>
        }
      >
        {rxModal.editing && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[12px] font-bold text-ink-700 mb-1.5">
                Medicine name &amp; strength{" "}
                <span className="text-coral-500">*</span>
              </label>
              <input
                className="w-full border border-ink-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#1D6C63]"
                placeholder="Paracetamol 500mg"
                value={rxModal.editing.medicineName}
                onChange={(e) =>
                  setRxModal((m) => ({
                    ...m,
                    editing: { ...m.editing!, medicineName: e.target.value },
                  }))
                }
              />
            </div>

            <Select
              size="md"
              label="Medicine type"
              value={rxModal.editing.medicineType}
              onChange={(v) =>
                setRxModal((m) => ({
                  ...m,
                  editing: { ...m.editing!, medicineType: v },
                }))
              }
              options={RX_OPTIONS.medicineType.map((v) => ({
                value: v,
                label: v,
              }))}
            />

            <div>
              <label className="block text-[12px] font-bold text-ink-700 mb-1.5">
                Dose
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  step="any"
                  className="w-[45%] border border-ink-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#1D6C63]"
                  value={rxModal.editing.doseAmount}
                  onChange={(e) =>
                    setRxModal((m) => ({
                      ...m,
                      editing: {
                        ...m.editing!,
                        doseAmount: Number(e.target.value),
                      },
                    }))
                  }
                />
                <div className="flex-1">
                  <Select
                    size="md"
                    value={rxModal.editing.doseUnit}
                    onChange={(v) =>
                      setRxModal((m) => ({
                        ...m,
                        editing: { ...m.editing!, doseUnit: v },
                      }))
                    }
                    options={RX_OPTIONS.doseUnit.map((v) => ({
                      value: v,
                      label: v,
                    }))}
                  />
                </div>
              </div>
            </div>

            <Select
              size="md"
              label="Frequency"
              value={rxModal.editing.frequency}
              onChange={(v) =>
                setRxModal((m) => ({
                  ...m,
                  editing: { ...m.editing!, frequency: v },
                }))
              }
              options={RX_OPTIONS.frequency}
            />

            <Select
              size="md"
              label="Route"
              value={rxModal.editing.route}
              onChange={(v) =>
                setRxModal((m) => ({
                  ...m,
                  editing: { ...m.editing!, route: v },
                }))
              }
              options={RX_OPTIONS.route.map((v) => ({ value: v, label: v }))}
            />

            <Select
              size="md"
              label="Meal relation"
              value={rxModal.editing.mealRelation}
              onChange={(v) =>
                setRxModal((m) => ({
                  ...m,
                  editing: { ...m.editing!, mealRelation: v },
                }))
              }
              options={RX_OPTIONS.mealRelation.map((v) => ({
                value: v,
                label: v.split("_").join(" "),
              }))}
            />

            <div>
              <label className="block text-[12px] font-bold text-ink-700 mb-1.5">
                Duration (days)
              </label>
              <input
                type="number"
                min={1}
                className="w-full border border-ink-200 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#1D6C63]"
                value={rxModal.editing.durationDays}
                onChange={(e) =>
                  setRxModal((m) => ({
                    ...m,
                    editing: {
                      ...m.editing!,
                      durationDays: Number(e.target.value),
                    },
                  }))
                }
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[12px] font-bold text-ink-700 mb-1.5">
                Instructions
              </label>
              <input
                className="w-full border border-ink-200 rounded-lg px-3 py-2 text-[13px] italic focus:outline-none focus:border-[#1D6C63]"
                placeholder="Take after food"
                value={rxModal.editing.instructions}
                onChange={(e) =>
                  setRxModal((m) => ({
                    ...m,
                    editing: { ...m.editing!, instructions: e.target.value },
                  }))
                }
              />
            </div>
          </div>
        )}
      </Dialog>

      <PrescriptionPrintPreview
        open={printPreviewOpen}
        onOpenChange={setPrintPreviewOpen}
        hospital={hospital}
        patient={patient}
        doctor={doctor}
        consultation={record}
        lines={rx.map((l) => ({
          id: l.id ?? `unsaved`,
          medicine: l.medicineName,
          dosage: `${l.doseAmount} ${l.doseUnit}`,
          frequency: l.frequency,
          duration: l.durationDays ? `${l.durationDays} days` : "",
          instructions: l.instructions,
        }))}
        vitals={{
          bp: form.values.bp,
          pulse: form.values.pulse,
          temp: form.values.temp,
          spo2: form.values.spo2,
          weight: form.values.weight,
        }}
        chiefComplaint={form.values.chiefComplaint}
        history={form.values.historyOfIllness}
        examination={form.values.systemicExamination}
        diagnosis={form.values.diagnosis}
        advice={form.values.advice}
        followUpDate={form.values.followUpDate}
      />
    </div>
  );
}

/* ==========================================================================
   Patient history panel
   ========================================================================== */
function PatientHistoryPanel({
  patientKey,
  currentId,
}: {
  patientKey?: string;
  currentId?: string;
}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>(null);

  /** previous visits of this patient — page data, loaded when the tab opens */
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientKey) return;
    let active = true;
    (async () => {
      try {
        setHistoryLoading(true);
        setHistoryError(null);
        const response =
          await consultationService.fetchPatientHistory(patientKey);
        if (active && response.status >= 200 && response.status < 300) {
          setHistory(response.data?.data ?? response.data ?? []);
        }
      } catch (e: any) {
        if (active) {
          setHistoryError(e?.message ?? "Could not load history");
          dispatch(toast.error("Could not load history", e?.message));
        }
      } finally {
        if (active) setHistoryLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [patientKey]);

  const rows = history
    .filter((c: any) => String(c.id) !== String(currentId))
    .sort(
      (a: any, b: any) =>
        new Date(b.consultationDate || b.createdAt || 0).getTime() -
        new Date(a.consultationDate || a.createdAt || 0).getTime(),
    );
  const status = historyLoading ? "loading" : historyError ? "error" : "ready";

  if (status === "loading") {
    return <ListSkeleton rows={3} withMeta={false} />;
  }

  if (status === "error") {
    return (
      <EmptyState
        compact
        icon={<AlertTriangle className="size-4" />}
        title="Could not load history"
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        compact
        icon={<History className="size-4" />}
        title="No previous visits"
        description="This is the patient's first consultation."
      />
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((c: any) => {
        const isOpen = expanded === String(c.id);
        const meds = c.prescriptions || [];
        return (
          <div
            key={c.id}
            className={cn(
              "rounded-lg border transition-colors",
              isOpen
                ? "border-[#1D6C63]/30 bg-teal-50/30"
                : "border-ink-200 bg-white",
            )}
          >
            <button
              onClick={() => setExpanded(isOpen ? null : String(c.id))}
              className="w-full p-3 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11.5px] font-bold text-ink-900">
                  {formatDate(c.consultationDate || c.createdAt)}
                </span>
                <span className="text-[10px] font-semibold text-[#1D6C63]">
                  {isOpen ? "Hide" : "View"}
                </span>
              </div>
              <p className="mt-1 text-[12px] font-medium text-ink-900 leading-snug">
                {c.provisionalDiagnosis || c.finalDiagnosis || "—"}
              </p>
              <p className="mt-0.5 text-[10.5px] text-ink-500">
                Dr. {c.doctor?.firstName || ""} {c.doctor?.lastName || ""}
                {meds.length > 0 &&
                  ` · ${meds.length} med${meds.length > 1 ? "s" : ""}`}
              </p>
            </button>

            {isOpen && (
              <div className="border-t border-ink-200/70 p-3 space-y-2.5 text-[11.5px]">
                <HistoryField
                  label="Chief complaint"
                  value={c.chiefComplaints}
                />
                <HistoryField label="History" value={c.history} />
                <HistoryField label="Examination" value={c.examination} />
                <HistoryField label="Advice" value={c.specialInstructions} />

                {meds.length > 0 && (
                  <div>
                    <p className="text-[9.5px] font-bold uppercase tracking-wide text-ink-400 mb-1">
                      Prescription
                    </p>
                    <div className="space-y-1">
                      {meds.map((m: any, i: number) => (
                        <div
                          key={m.id ?? i}
                          className="rounded-md border border-ink-100 bg-white px-2 py-1.5"
                        >
                          <p className="font-medium text-ink-900">
                            {m.medicineName}
                          </p>
                          <p className="text-[10.5px] text-ink-500">
                            {[
                              m.dosage,
                              m.frequency,
                              m.durationDays && `${m.durationDays} days`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => navigate(`/consultation/${c.id}`)}
                  className="w-full py-1.5 border border-ink-200 rounded-md text-[11px] font-semibold text-ink-700 hover:bg-white transition-colors"
                >
                  Open this consultation
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HistoryField({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[9.5px] font-bold uppercase tracking-wide text-ink-400 mb-0.5">
        {label}
      </p>
      <p className="text-ink-800 leading-snug whitespace-pre-line">{value}</p>
    </div>
  );
}
