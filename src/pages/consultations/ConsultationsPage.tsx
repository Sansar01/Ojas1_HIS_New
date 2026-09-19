import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity,
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
} from "lucide-react";
import { CONSULTATION_STATUSES } from "@/constants";
import { idGen } from "@/data/db";
import { useAppDispatch, usePermission, useRootSelector } from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { formatDate, formatTime } from "@/utils";
import { cn } from "@/utils/cn";
import {
  Avatar,
  Badge,
  Button,
  StatusBadge,
  Panel,
} from "@/components/ui/primitives";
import {
  DataTable,
  Pagination,
  RowActions,
  TableToolbar,
} from "@/components/ui/table";
import { PageIntro, PrescriptionPrintPreview } from "@/components/common";
import { EmptyState } from "@/components/ui/feedback";
import { hospitalSeed } from "@/data/db";
import { buildApiUrl } from "@/config/api";

import { Input, Select, Textarea } from "@/components/ui/fields";

/* ==========================================================================
   1. AUTH & API HELPERS
   ========================================================================== */
const getAuthHeaders = (): Record<string, string> => {
  try {
    const stored = JSON.parse(localStorage.getItem("authUserToken") || "null");
    const token = stored?.accessToken ?? stored?.token ?? null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
};

const apiHeaders = () => ({
  "Content-Type": "application/json",
  ...getAuthHeaders(),
});

async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T; error?: string }> {
  try {
    const res = await fetch(buildApiUrl(path), {
      ...options,
      headers: { ...apiHeaders(), ...(options.headers as any) },
    });
    const json = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      status: res.status,
      data: json.data ?? json,
      error: json.message || json.error,
    };
  } catch (err: any) {
    return { ok: false, status: 0, data: null as any, error: err.message };
  }
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
    case "CANCELLED":
      return "Cancelled";
    case "WAITING":
      return "Waiting";
    case "SKIPPED":
      return "Skipped";
    default:
      return status;
  }
};

const toApiStatus = (uiStatus: string) => {
  if (uiStatus === "In Progress") return "IN_PROGRESS";
  if (uiStatus === "Completed") return "COMPLETED";
  return uiStatus.toUpperCase();
};

const fahrenheitToCelsius = (f: number | null | undefined): string => {
  if (f == null) return "";
  return ((f - 32) * (5 / 9)).toFixed(1);
};

const celsiusToFahrenheit = (c: string): number | null => {
  const n = parseFloat(c);
  if (isNaN(n)) return null;
  return Math.round(n * (9 / 5) + 32);
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
  const { canCreate, canEdit, canDelete } = usePermission();

  const activeDoctorId =
    JSON.parse(localStorage.getItem("authUserToken") || "{}")?.user
      ?.doctorProfileId || null;

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
  const [filters, setFilters] = useState({
    doctor: "all",
    status: "all",
    from: "",
    to: "",
  });

  const currentToken = queueData?.currentToken ?? null;
  const waitingTokens =
    queueData?.queue?.filter((t: any) => t.status === TOKEN_STATUSES.WAITING) ??
    [];
  const skippedTokens =
    queueData?.queue?.filter((t: any) => t.status === TOKEN_STATUSES.SKIPPED) ??
    [];

  const fetchConsultations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search.trim()) params.set("search", search.trim());
      if (filters.status !== "all")
        params.set("status", toApiStatus(filters.status));
      if (filters.doctor !== "all") params.set("doctorId", filters.doctor);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);

      const res = await api(`/api/opd/consultations?${params}`);
      if (res.ok) {
        setConsultations(res.data || []);
        setTotalItems(res.data?.meta?.total ?? 0);
        setTotalPages(res.data?.meta?.totalPages ?? 1);
      }
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, filters]);

  const fetchDoctorQueue = useCallback(async () => {
    if (!activeDoctorId) return;
    setLoadingQueue(true);
    try {
      const res = await api(
        `/api/opd/queue/doctor/${activeDoctorId}?date=${queueDate}`,
      );
      if (res.ok) setQueueData(res.data);
    } finally {
      setLoadingQueue(false);
    }
  }, [activeDoctorId, queueDate]);

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
        const callRes = await api(`/api/opd/queue/${tokenId}/call`, {
          method: "PATCH",
        });
        if (!callRes.ok) {
          setActiveError({
            patientName,
            message: "TV display par call nahi ho paaya. Network check karein.",
          });
          setActionLoadingId(null);
          return;
        }
      }

      let consultationId: string | null = null;
      const postRes = await api("/api/opd/consultations", {
        method: "POST",
        body: JSON.stringify({ appointmentId }),
      });
      if (postRes.ok && postRes.data?.id) consultationId = postRes.data.id;
      if (!consultationId) consultationId = token.consultationId;
      if (!consultationId)
        consultationId = getConsultationIdFromMap(appointmentId);

      if (consultationId) {
        saveConsultationMapping(appointmentId, consultationId);
        navigate(`/consultation/${consultationId}`);
      } else {
        setActiveError({
          patientName,
          message: `${patientName} call ho gaye, lekin workspace nahi khula. Sync karein.`,
        });
        fetchDoctorQueue();
      }
    } catch (err: any) {
      setActiveError({
        patientName,
        message: `Technical error: ${err.message}`,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCallNext = async () => {
    if (!activeDoctorId) return;
    setActionLoadingId("call-next");
    setActiveError(null);
    try {
      const res = await api(
        `/api/opd/queue/call-next/${activeDoctorId}?date=${queueDate}`,
        { method: "PATCH" },
      );

      if (res.ok && res.data?.appointmentId) {
        const calledToken = res.data;
        const postRes = await api("/api/opd/consultations", {
          method: "POST",
          body: JSON.stringify({ appointmentId: calledToken.appointmentId }),
        });
        if (postRes.ok && postRes.data?.id) {
          saveConsultationMapping(calledToken.appointmentId, postRes.data.id);
          navigate(`/consultation/${postRes.data.id}`);
        } else {
          setActiveError({
            patientName: calledToken.patient?.fullName || "Patient",
            message: "Call successful, par record open nahi hua.",
          });
          fetchDoctorQueue();
        }
      } else {
        setActiveError({
          patientName: "—",
          message: "Is date par koi patient queue me waiting nahi hai.",
        });
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSkip = async (tokenId: string) => {
    setActionLoadingId(tokenId);
    const res = await api(`/api/opd/queue/${tokenId}/skip`, {
      method: "PATCH",
    });
    if (res.ok) fetchDoctorQueue();
    setActionLoadingId(null);
  };

  const handleRequeue = async (tokenId: string) => {
    setActionLoadingId(tokenId);
    const res = await api(`/api/opd/queue/${tokenId}/requeue`, {
      method: "PATCH",
    });
    if (res.ok) fetchDoctorQueue();
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

      {queueData && canCreate("consultations") && (
        <Panel className="mb-4 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-4 border-b border-ink-100 pb-3">
            <div className="flex items-center gap-4">
              <p className="flex items-center gap-2 text-[14px] font-semibold text-ink-900">
                <CircleDot className="size-4 animate-pulse text-amberly-500" />
                OPD Queue
              </p>

              <div className="flex items-center gap-2 bg-ink-50 px-2 py-1 rounded-lg border border-ink-200 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 transition-all">
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

          {waitingTokens.length === 0 &&
            skippedTokens.length === 0 &&
            !currentToken && (
              <div className="text-center py-8">
                <p className="text-[13px] text-ink-400 font-medium">
                  No queue found for {formatDate(queueDate)}
                </p>
              </div>
            )}
        </Panel>
      )}

      <Panel>
        <TableToolbar
          search={search}
          onSearch={(val) => {
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
                      const res = await api(`/api/opd/consultations/${c.id}`, {
                        method: "DELETE",
                      });
                      if (res.ok) fetchConsultations();
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

// Helper component for Section Dividers
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
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { canEdit } = usePermission();

  const [record, setRecord] = useState<any>(null);
  const [loadingRecord, setLoadingRecord] = useState(true);
  const [vitalsId, setVitalsId] = useState<string | null>(null);
  const [rx, setRx] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [cardTab, setCardTab] = useState<"details" | "history">("details");
  const hospital =
    useRootSelector((state) => state.hospital.data) || hospitalSeed;

  const isCompleted = record?.status === CONSULT_STATUSES.COMPLETED;
  const readOnly = !canEdit("consultations") || isCompleted;

  const form = useForm({
    initialValues: {
      chiefComplaint: "",
      history: "",
      examination: "",
      diagnosis: "",
      advice: "",
      internalNotes: "",
      followUpDate: "",
      bp: "",
      pulse: "",
      temp: "",
      weight: "",
      spo2: "",
    },
    schema: {
      chiefComplaint: [{ required: "Required", min: 3 }],
      diagnosis: [{ required: "Required", min: 3 }],
    },
  });

  const fetchConsultationById = useCallback(async () => {
    if (!id) return;
    setLoadingRecord(true);
    try {
      const res = await api(`/api/opd/consultations/${id}`);
      if (!res.ok) throw new Error("Failed");
      const d = res.data;
      setRecord(d);

      form.setValues({
        chiefComplaint: d.chiefComplaints || "",
        history: d.history || "", // Mapping assumption
        examination: d.examination || "", // Mapping assumption
        diagnosis: d.provisionalDiagnosis || d.finalDiagnosis || "",
        advice: d.specialInstructions || "",
        internalNotes: d.internalNotes || "", // Mapping assumption
        followUpDate: d.followUpDate ? String(d.followUpDate).slice(0, 10) : "",
        bp: "",
        pulse: "",
        temp: "",
        weight: "",
        spo2: "",
      });

      const lines = (d.prescriptions || []).map((p: any) => ({
        id: p.id || idGen("rx"),
        medicine: p.medicineName || "",
        dosage: p.dosage || "",
        frequency: p.frequency || "",
        duration: p.durationDays ? `${p.durationDays} days` : p.duration || "",
        instructions: p.instructions || p.mealRelation || "",
      }));
      setRx(lines);
    } finally {
      setLoadingRecord(false);
    }
  }, [id]);

  const fetchVitals = useCallback(async (appointmentId: string) => {
    try {
      const res = await api(`/api/opd/vitals/appointment/${appointmentId}`);
      if (!res.ok || !res.data) return;
      setVitalsId(res.data.id || null);
      form.setValues((prev) => ({
        ...prev,
        bp: formatBpFromApi(
          res.data.bloodPressureSys,
          res.data.bloodPressureDia,
        ),
        pulse: res.data.pulseRate != null ? String(res.data.pulseRate) : "",
        temp: fahrenheitToCelsius(res.data.temperatureF),
        weight: res.data.weightKg != null ? String(res.data.weightKg) : "",
        spo2: res.data.spO2 != null ? String(res.data.spO2) : "",
      }));
    } catch {}
  }, []);

  useEffect(() => {
    fetchConsultationById();
  }, [fetchConsultationById]);
  useEffect(() => {
    if (record?.appointmentId) fetchVitals(record.appointmentId);
  }, [record?.appointmentId, fetchVitals]);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSoapChange = (field: string, value: string) => {
    form.setValue(field as any, value);
    if (readOnly || !record?.id) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      await api(`/api/opd/consultations/${record.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          chiefComplaints: form.values.chiefComplaint,
          history: form.values.history,
          examination: form.values.examination,
          provisionalDiagnosis: form.values.diagnosis,
          specialInstructions: form.values.advice,
          internalNotes: form.values.internalNotes,
          followUpDate: form.values.followUpDate || null,
        }),
      });
    }, 1500);
  };

  const handleSaveNote = async () => {
    if (!record?.id) return;
    setSaving(true);
    try {
      await api(`/api/opd/consultations/${record.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          chiefComplaints: form.values.chiefComplaint,
          history: form.values.history, // Assuming backend supports this, otherwise will be ignored
          examination: form.values.examination,
          provisionalDiagnosis: form.values.diagnosis,
          specialInstructions: form.values.advice,
          internalNotes: form.values.internalNotes,
          followUpDate: form.values.followUpDate || null,
        }),
      });

      if (record.appointmentId) {
        const { sys, dia } = parseBpString(form.values.bp);
        const payload = {
          appointmentId: record.appointmentId,
          patientId: record.patient?.id,
          bloodPressureSys: sys,
          bloodPressureDia: dia,
          pulseRate: parseInt(form.values.pulse) || null,
          temperatureF: celsiusToFahrenheit(form.values.temp),
          weightKg: parseFloat(form.values.weight) || null,
          spO2: parseInt(form.values.spo2) || null,
        };
        if (vitalsId)
          await api(`/api/opd/vitals/${vitalsId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
        else
          await api("/api/opd/vitals", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      }

      for (const line of rx.filter((r) => r.medicine.trim())) {
        const py = {
          medicineName: line.medicine,
          dosage: line.dosage,
          frequency: line.frequency,
          durationDays: parseInt(line.duration) || 3,
          mealRelation: line.instructions || "AFTER_FOOD",
        };
        if (!line.id.startsWith("rx_"))
          await api(
            `/api/opd/consultations/${record.id}/prescriptions/${line.id}`,
            { method: "PATCH", body: JSON.stringify(py) },
          );
        else
          await api(`/api/opd/consultations/${record.id}/prescriptions`, {
            method: "POST",
            body: JSON.stringify(py),
          });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteConsultation = async () => {
    const errs = form.validate();
    if (Object.keys(errs).length > 0 || !record?.id) return;
    setCompleting(true);
    try {
      await handleSaveNote();
      const res = await api(`/api/opd/consultations/${record.id}/complete`, {
        method: "PATCH",
      });
      if (res.ok) navigate("/consultations");
    } finally {
      setCompleting(false);
    }
  };

  if (loadingRecord)
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <p className="text-[13px] text-ink-400">
          Loading consultation workspace...
        </p>
      </div>
    );
  if (!record)
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Button onClick={() => navigate("/consultations")}>Back to list</Button>
      </div>
    );

  const patient = record.patient || {};
  const doctor = record.doctor || {};

  // Mocks for visual completeness based on screenshot
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
            onClick={() => navigate("/consultations")}
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
              Complete consultation
            </Button>
          )}
        </div>
      </div>

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

            {/* Tab strip — Patient details / Patient history */}
            <div className="flex gap-1 rounded-lg bg-ink-100 p-1">
              {([
                { key: "details", label: "Patient details" },
                { key: "history", label: "Patient history" },
              ] as const).map((t) => (
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

            {/* Tab body — renders inline, no modal or drawer */}
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
                value={form.values.history}
                onChange={(e) => handleSoapChange("history", e.target.value)}
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
              value={form.values.examination}
              onChange={(e) => handleSoapChange("examination", e.target.value)}
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
              Add medicines with dosage, frequency and duration
            </p>

            {rx.length === 0 ? (
              <div className="border border-dashed border-ink-300 rounded-lg py-6 text-center text-[12px] text-ink-400 font-medium bg-ink-50/50">
                No medicines added yet.
              </div>
            ) : (
              <div className="space-y-3">
                {rx.map((line, index) => (
                  <div
                    key={line.id}
                    className="flex gap-3 items-start p-3 border border-ink-100 rounded-lg bg-ink-50/30 relative group"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1">
                      <div className="md:col-span-5">
                        <input
                          className="w-full bg-white border border-ink-200 rounded-md px-3 py-1.5 text-[13px] font-semibold text-ink-900 focus:outline-none focus:border-[#1D6C63]"
                          placeholder="Medicine Name & Strength"
                          value={line.medicine}
                          disabled={readOnly}
                          onChange={(e) =>
                            setRx((p) =>
                              p.map((r) =>
                                r.id === line.id
                                  ? { ...r, medicine: e.target.value }
                                  : r,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <input
                          className="w-full bg-white border border-ink-200 rounded-md px-3 py-1.5 text-[13px] focus:outline-none focus:border-[#1D6C63]"
                          placeholder="Dosage (e.g. 1 tab)"
                          value={line.dosage}
                          disabled={readOnly}
                          onChange={(e) =>
                            setRx((p) =>
                              p.map((r) =>
                                r.id === line.id
                                  ? { ...r, dosage: e.target.value }
                                  : r,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <input
                          className="w-full bg-white border border-ink-200 rounded-md px-3 py-1.5 text-[13px] focus:outline-none focus:border-[#1D6C63]"
                          placeholder="Frequency (e.g. 1-0-1)"
                          value={line.frequency}
                          disabled={readOnly}
                          onChange={(e) =>
                            setRx((p) =>
                              p.map((r) =>
                                r.id === line.id
                                  ? { ...r, frequency: e.target.value }
                                  : r,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="md:col-span-1">
                        <input
                          className="w-full bg-white border border-ink-200 rounded-md px-3 py-1.5 text-[13px] focus:outline-none focus:border-[#1D6C63]"
                          placeholder="Days"
                          value={line.duration}
                          disabled={readOnly}
                          onChange={(e) =>
                            setRx((p) =>
                              p.map((r) =>
                                r.id === line.id
                                  ? { ...r, duration: e.target.value }
                                  : r,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <input
                          className="w-full bg-white border border-ink-200 rounded-md px-3 py-1.5 text-[13px] italic focus:outline-none focus:border-[#1D6C63]"
                          placeholder="Instructions"
                          value={line.instructions}
                          disabled={readOnly}
                          onChange={(e) =>
                            setRx((p) =>
                              p.map((r) =>
                                r.id === line.id
                                  ? { ...r, instructions: e.target.value }
                                  : r,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                    {!readOnly && (
                      <button
                        onClick={() =>
                          setRx((p) => p.filter((r) => r.id !== line.id))
                        }
                        className="text-coral-400 hover:text-coral-600 p-1.5 bg-white border border-transparent hover:border-coral-200 rounded-md transition-colors print:hidden"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!readOnly && (
              <button
                onClick={() =>
                  setRx((p) => [
                    ...p,
                    {
                      id: idGen("rx"),
                      medicine: "",
                      dosage: "",
                      frequency: "",
                      duration: "",
                      instructions: "",
                    },
                  ])
                }
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
                  value={form.values.internalNotes}
                  onChange={(e) =>
                    handleSoapChange("internalNotes", e.target.value)
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
                  className="w-full border border-ink-200 rounded-lg pl-9 pr-3 py-2 text-[13px] text-ink-900 focus:outline-none focus:border-[#1D6C63] focus:ring-1 focus:ring-[#1D6C63]"
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
      <PrescriptionPrintPreview
        open={printPreviewOpen}
        onOpenChange={setPrintPreviewOpen}
        hospital={hospital}
        patient={patient}
        doctor={doctor}
        consultation={record}
        lines={rx}
        advice={form.values.advice}
        followUpDate={form.values.followUpDate}
      />
    </div>
  );
}

/* ==========================================================================
   Patient history — past consultations, rendered inline inside the patient
   card's "Patient history" tab. No modal, no drawer.
   ========================================================================== */

function PatientHistoryPanel({
  patientKey,
  currentId,
}: {
  patientKey?: string;
  currentId?: string;
}) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!patientKey) {
      setStatus("ready");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    (async () => {
      const res = await api(`/api/opd/consultations?patientId=${patientKey}`);
      if (cancelled) return;
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const list = Array.isArray(res.data) ? res.data : ((res.data as any)?.data ?? []);
      setRows(
        list
          .filter((c: any) => String(c.id) !== String(currentId))
          .sort(
            (a: any, b: any) =>
              new Date(b.consultationDate || b.createdAt || 0).getTime() -
              new Date(a.consultationDate || a.createdAt || 0).getTime(),
          ),
      );
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [patientKey, currentId]);

  if (status === "loading")
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-ink-100" />
        ))}
      </div>
    );

  if (status === "error")
    return (
      <EmptyState
        compact
        icon={<AlertTriangle className="size-4" />}
        title="Could not load history"
      />
    );

  if (rows.length === 0)
    return (
      <EmptyState
        compact
        icon={<History className="size-4" />}
        title="No previous visits"
        description="This is the patient's first consultation."
      />
    );

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
              isOpen ? "border-[#1D6C63]/30 bg-teal-50/30" : "border-ink-200 bg-white",
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
                {meds.length > 0 && ` · ${meds.length} med${meds.length > 1 ? "s" : ""}`}
              </p>
            </button>

            {isOpen && (
              <div className="border-t border-ink-200/70 p-3 space-y-2.5 text-[11.5px]">
                <HistoryField label="Chief complaint" value={c.chiefComplaints} />
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
                          <p className="font-medium text-ink-900">{m.medicineName}</p>
                          <p className="text-[10.5px] text-ink-500">
                            {[m.dosage, m.frequency, m.durationDays && `${m.durationDays} days`]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => navigate(`/consultations/${c.id}`)}
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
