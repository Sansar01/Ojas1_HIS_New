import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  CheckCheck,
  CircleDot,
  Heart,
  Plus,
  Printer,
  Save,
  ScrollText,
  Stethoscope,
  Trash2,
  RefreshCw,
  AlertTriangle,
  PhoneCall,
  Phone,
  Globe,
  MapPin,
  CalendarDays // <-- Added Calendar Icon
} from "lucide-react";
import { CONSULTATION_STATUSES } from "@/constants";
import { addDays, idGen } from "@/data/db";
import { useAppDispatch, usePermission, useRootSelector } from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { consultationsApi } from "@/features/slices";
import { formatDate, formatTime } from "@/utils";
import { cn } from "@/utils/cn";
import {
  Avatar,
  Badge,
  Button,
  StatusBadge,
  Panel,
} from "@/components/ui/primitives";
import { DataTable, Pagination, RowActions, TableToolbar } from "@/components/ui/table";
import { PageIntro } from "@/components/common";
import { buildApiUrl } from "@/config/api";

import { Input, Select, DatePicker, Textarea } from "@/components/ui/fields";

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
  options: RequestInit = {}
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
    case "COMPLETED": return "Completed";
    case "IN_PROGRESS":
    case "IN_CONSULTATION": return "In Progress";
    case "CANCELLED": return "Cancelled";
    case "WAITING": return "Waiting";
    case "SKIPPED": return "Skipped";
    default: return status;
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

const parseBpString = (bp: string): { sys: number | null; dia: number | null } => {
  if (!bp) return { sys: null, dia: null };
  const parts = bp.split("/").map((s) => parseInt(s.trim(), 10));
  return {
    sys: isNaN(parts[0]) ? null : parts[0],
    dia: isNaN(parts[1]) ? null : parts[1],
  };
};

const formatBpFromApi = (sys: number | null | undefined, dia: number | null | undefined): string => {
  if (sys == null && dia == null) return "";
  return `${sys ?? "—"}/${dia ?? "—"}`;
};

const CONSULT_MAP_KEY = "opd_consultation_map";
const saveConsultationMapping = (appointmentId: string, consultationId: string) => {
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
  } catch { return null; }
};

/* ==========================================================================
   3. SCREEN 1: DOCTOR QUEUE & CONSULTATIONS LIST
   ========================================================================== */
export function ConsultationsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const doctors = useRootSelector((s) => s.doctors.items);
  const { canCreate, canEdit, canDelete } = usePermission();

  const activeDoctorId = JSON.parse(localStorage.getItem("authUserToken") || "{}")?.user?.doctorProfileId || null;

  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [totalPages, setTotalPages] = useState(1);
  
  const [queueData, setQueueData] = useState<any>(null);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [activeError, setActiveError] = useState<{ patientName: string; message: string } | null>(null);

  // ---> NEW: State for Queue Date (Defaults to Today) <---
  const [queueDate, setQueueDate] = useState<string>(new Date().toLocaleDateString("en-CA"));

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ doctor: "all", status: "all", from: "", to: "" });

  const currentToken = queueData?.currentToken ?? null;
  const waitingTokens = queueData?.queue?.filter((t: any) => t.status === TOKEN_STATUSES.WAITING) ?? [];
  const skippedTokens = queueData?.queue?.filter((t: any) => t.status === TOKEN_STATUSES.SKIPPED) ?? [];

  const fetchConsultations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search.trim()) params.set("search", search.trim());
      if (filters.status !== "all") params.set("status", toApiStatus(filters.status));
      if (filters.doctor !== "all") params.set("doctorId", filters.doctor);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);

      const res = await api(`/api/opd/consultations?${params}`);
      if (res.ok) {
        setConsultations(res.data || []);
        setTotalItems(res.data?.meta?.total ?? 0);
        setTotalPages(res.data?.meta?.totalPages ?? 1);
      }
    } finally { setLoading(false); }
  }, [page, limit, search, filters]);

  // ---> UPDATED: Uses `queueDate` state instead of hardcoded today <---
  const fetchDoctorQueue = useCallback(async () => {
    if (!activeDoctorId) return;
    setLoadingQueue(true);
    try {
      const res = await api(`/api/opd/queue/doctor/${activeDoctorId}?date=${queueDate}`);
      if (res.ok) setQueueData(res.data);
    } finally { setLoadingQueue(false); }
  }, [activeDoctorId, queueDate]);

  useEffect(() => { fetchConsultations(); }, [fetchConsultations]);
  useEffect(() => { fetchDoctorQueue(); }, [fetchDoctorQueue]);

  const callAndOpenConsultation = async (token: any) => {
    const { id: tokenId, appointmentId, patient } = token;
    const patientName = patient?.fullName || "Patient";
    setActionLoadingId(tokenId);
    setActiveError(null);

    try {
      if (token.status === TOKEN_STATUSES.WAITING) {
        const callRes = await api(`/api/opd/queue/${tokenId}/call`, { method: "PATCH" });
        if (!callRes.ok) {
          setActiveError({ patientName, message: "TV display par call nahi ho paaya. Network check karein." });
          setActionLoadingId(null);
          return;
        }
      }

      let consultationId: string | null = null;
      const postRes = await api("/api/opd/consultations", { method: "POST", body: JSON.stringify({ appointmentId }) });
      if (postRes.ok && postRes.data?.id) consultationId = postRes.data.id;
      if (!consultationId) consultationId = token.consultationId;
      if (!consultationId) consultationId = getConsultationIdFromMap(appointmentId);

      if (consultationId) {
        saveConsultationMapping(appointmentId, consultationId);
        navigate(`/consultation/${consultationId}`);
      } else {
        setActiveError({ patientName, message: `${patientName} call ho gaye, lekin workspace nahi khula. Sync karein.` });
        fetchDoctorQueue();
      }
    } catch (err: any) {
      setActiveError({ patientName, message: `Technical error: ${err.message}` });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCallNext = async () => {
    if (!activeDoctorId) return;
    setActionLoadingId("call-next");
    setActiveError(null);
    try {
      // ---> UPDATED: Passing the selected queueDate here as well <---
      const res = await api(`/api/opd/queue/call-next/${activeDoctorId}?date=${queueDate}`, { method: "PATCH" });

      if (res.ok && res.data?.appointmentId) {
        const calledToken = res.data;
        const postRes = await api("/api/opd/consultations", { method: "POST", body: JSON.stringify({ appointmentId: calledToken.appointmentId }) });
        if (postRes.ok && postRes.data?.id) {
          saveConsultationMapping(calledToken.appointmentId, postRes.data.id);
          navigate(`/consultation/${postRes.data.id}`);
        } else {
          setActiveError({ patientName: calledToken.patient?.fullName || "Patient", message: "Call successful, par record open nahi hua." });
          fetchDoctorQueue();
        }
      } else {
        setActiveError({ patientName: "—", message: "Is date par koi patient queue me waiting nahi hai." });
      }
    } finally { setActionLoadingId(null); }
  };

  const handleSkip = async (tokenId: string) => {
    setActionLoadingId(tokenId);
    const res = await api(`/api/opd/queue/${tokenId}/skip`, { method: "PATCH" });
    if (res.ok) fetchDoctorQueue();
    setActionLoadingId(null);
  };

  const handleRequeue = async (tokenId: string) => {
    setActionLoadingId(tokenId);
    const res = await api(`/api/opd/queue/${tokenId}/requeue`, { method: "PATCH" });
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
        title="Consultations" description="Manage OPD queue and clinical records." module="consultations"
        meta={
          <>
            {queueData?.stats && (
              <>
                <Badge tone="amber" dot>{queueData.stats.inProgress} in progress</Badge>
                <Badge tone="mint">{queueData.stats.completed} completed</Badge>
                <Badge tone="lagoon">{queueData.stats.waiting} waiting</Badge>
              </>
            )}
            <Button size="xs" variant="outline" className="ml-1 h-7" onClick={() => { fetchDoctorQueue(); fetchConsultations(); }} icon={<RefreshCw className={cn("size-3.5", (loading || loadingQueue) && "animate-spin")} />}>Sync</Button>
          </>
        }
      />

      {activeError && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-amberly-300 bg-amberly-50/90 p-3.5 text-ink-900 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amberly-600" />
            <div><p className="text-[13px] font-semibold text-amberly-950">Action Alert — {activeError.patientName}</p><p className="mt-0.5 text-[12px] text-amberly-800">{activeError.message}</p></div>
          </div>
          <button onClick={() => setActiveError(null)} className="text-[12px] font-medium text-amberly-700">Dismiss</button>
        </div>
      )}

      {queueData && canCreate("consultations") && (
        <Panel className="mb-4 p-4">
          
          {/* ---> UPDATED: Header With Date Picker <--- */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-4 border-b border-ink-100 pb-3">
            <div className="flex items-center gap-4">
              <p className="flex items-center gap-2 text-[14px] font-semibold text-ink-900">
                <CircleDot className="size-4 animate-pulse text-amberly-500" /> 
                OPD Queue
              </p>
              
              {/* Native sleek Date Picker */}
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
              disabled={actionLoadingId === "call-next" || queueData.stats.waiting === 0} 
              icon={<PhoneCall className={cn("size-3.5", actionLoadingId === "call-next" && "animate-pulse")} />}
            >
              {actionLoadingId === "call-next" ? "Calling…" : "Call Next"}
            </Button>
          </div>

          {currentToken && currentToken.status === TOKEN_STATUSES.IN_PROGRESS && (
            <div className="mb-3 flex items-center gap-3 rounded-xl border-2 border-brand-300 bg-brand-50/50 p-3">
              <Avatar name={currentToken.patient?.fullName} size="sm" color="bg-brand-600" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="text-[13px] font-bold text-brand-900">[{currentToken.tokenNumber}] {currentToken.patient?.fullName}</span><Badge tone="amber" size="xs" dot>In Consultation</Badge></div>
              </div>
              <button onClick={() => callAndOpenConsultation(currentToken)} disabled={actionLoadingId === currentToken.id} className="rounded-lg bg-brand-600 px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-700">Open Workspace</button>
            </div>
          )}

          {waitingTokens.length > 0 && (
            <div className="mb-2 mt-4">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Waiting ({waitingTokens.length})</p>
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {waitingTokens.map((token: any) => (
                  <div key={token.id} className="group flex min-w-[17rem] shrink-0 flex-col gap-2 rounded-xl border border-ink-100 bg-white p-3 shadow-sm hover:border-brand-300 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={token.patient?.fullName} size="sm" color="bg-lagoon-500" />
                      <div className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-semibold text-ink-900">[{token.tokenNumber}] {token.patient?.fullName}</span></div>
                    </div>
                    <div className="flex items-center gap-1.5 border-t border-ink-50 pt-2">
                      <button onClick={() => callAndOpenConsultation(token)} disabled={actionLoadingId === token.id} className="flex-1 rounded-md bg-brand-600 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-700">Call & Start</button>
                      <button onClick={() => handleSkip(token.id)} disabled={actionLoadingId === token.id} className="rounded-md border border-ink-200 px-3 py-1.5 text-[11px] font-medium text-ink-600 hover:bg-ink-50">Skip</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {skippedTokens.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-coral-500">Skipped ({skippedTokens.length})</p>
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {skippedTokens.map((token: any) => (
                  <div key={token.id} className="flex min-w-[15rem] shrink-0 items-center gap-2.5 rounded-xl border border-coral-200 bg-coral-50/40 p-2.5">
                    <Avatar name={token.patient?.fullName} size="xs" color="bg-coral-400" />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink-700">[{token.tokenNumber}] {token.patient?.fullName}</span>
                    <button onClick={() => handleRequeue(token.id)} disabled={actionLoadingId === token.id} className="rounded-md bg-white border border-coral-200 px-2.5 py-1 text-[10px] font-semibold text-coral-700 hover:bg-coral-100 shadow-sm">Re-queue</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {waitingTokens.length === 0 && skippedTokens.length === 0 && !currentToken && (
             <div className="text-center py-8">
               <p className="text-[13px] text-ink-400 font-medium">No queue found for {formatDate(queueDate)}</p>
             </div>
          )}
        </Panel>
      )}

      <Panel>
        <TableToolbar
          search={search} onSearch={(val) => { setSearch(val); setPage(1); }} searchPlaceholder="Search records..."
          filters={
            <Select size="sm" className="w-[10rem]" name="status" value={filters.status} onChange={(v) => { setFilters((f) => ({ ...f, status: v })); setPage(1); }} options={[{ value: "all", label: "Any status" }, ...CONSULTATION_STATUSES.map((s) => ({ value: s, label: s }))]} />
          }
        />
        <DataTable
          columns={[
            { key: "consultationNo", header: "RECORD", render: (c) => <span className="text-[12.5px] font-semibold text-ink-800">{c.consultationNo || "—"}</span> },
            { key: "patient", header: "PATIENT", render: (c) => <span className="text-[13px] font-semibold">{c.patient?.fullName || "—"}</span> },
            { key: "provisionalDiagnosis", header: "DIAGNOSIS", render: (c) => <span className="text-[12.5px]">{c.provisionalDiagnosis || c.finalDiagnosis || "—"}</span> },
            { key: "status", header: "STATUS", align: "center", render: (c) => <StatusBadge status={formatStatusForUI(c.status)} /> },
          ]}
          rows={consultations} status={loading ? "loading" : "ready"} onRetry={fetchConsultations} onRowClick={openWorkspace}
          actions={(c) => (
            <RowActions
              items={[
                { label: "Open workspace", icon: <Stethoscope />, onClick: () => openWorkspace(c) },
                { label: "Delete", icon: <Trash2 />, tone: "danger", hidden: !canDelete("consultations"), onClick: async () => { if (confirm("Delete this record?")) { const res = await api(`/api/opd/consultations/${c.id}`, { method: "DELETE" }); if (res.ok) fetchConsultations(); } } }
              ]}
            />
          )}
          emptyTitle="No consultations found"
          footer={<Pagination page={page} pageCount={totalPages} total={totalItems} pageSize={limit} onPage={setPage} onPageSize={(s) => { setLimit(s); setPage(1); }} label="consultations" />}
        />
      </Panel>
    </>
  );
}

/* ==========================================================================
   4. SCREEN 2: PRESCRIPTION WORKSPACE (A4 PAPER UI)
   ========================================================================== */
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

  const isCompleted = record?.status === CONSULT_STATUSES.COMPLETED;
  const readOnly = !canEdit("consultations") || isCompleted;

  const form = useForm({
    initialValues: { chiefComplaint: "", diagnosis: "", advice: "", followUpDate: "", bp: "", pulse: "", temp: "", weight: "" },
    schema: { chiefComplaint: [{ required: "Required", min: 3 }], diagnosis: [{ required: "Required", min: 3 }] },
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
        diagnosis: d.provisionalDiagnosis || d.finalDiagnosis || "",
        advice: d.specialInstructions || "",
        followUpDate: d.followUpDate ? String(d.followUpDate).slice(0, 10) : "",
        bp: "", pulse: "", temp: "", weight: "",
      });
      const lines = (d.prescriptions || []).map((p: any) => ({
        id: p.id || idGen("rx"), medicine: p.medicineName || "", dosage: p.dosage || "",
        frequency: p.frequency || "", duration: p.durationDays ? `${p.durationDays} days` : p.duration || "",
        instructions: p.instructions || p.mealRelation || "",
      }));
      setRx(lines);
    } finally { setLoadingRecord(false); }
  }, [id]);

  const fetchVitals = useCallback(async (appointmentId: string) => {
    try {
      const res = await api(`/api/opd/vitals/appointment/${appointmentId}`);
      if (!res.ok || !res.data) return;
      setVitalsId(res.data.id || null);
      form.setValues((prev) => ({
        ...prev,
        bp: formatBpFromApi(res.data.bloodPressureSys, res.data.bloodPressureDia),
        pulse: res.data.pulseRate != null ? String(res.data.pulseRate) : "",
        temp: fahrenheitToCelsius(res.data.temperatureF),
        weight: res.data.weightKg != null ? String(res.data.weightKg) : "",
      }));
    } catch {}
  }, []);

  useEffect(() => { fetchConsultationById(); }, [fetchConsultationById]);
  useEffect(() => { if (record?.appointmentId) fetchVitals(record.appointmentId); }, [record?.appointmentId, fetchVitals]);

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
          provisionalDiagnosis: form.values.diagnosis,
          specialInstructions: form.values.advice,
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
          provisionalDiagnosis: form.values.diagnosis,
          specialInstructions: form.values.advice,
          followUpDate: form.values.followUpDate || null,
        }),
      });

      if (record.appointmentId) {
        const { sys, dia } = parseBpString(form.values.bp);
        const payload = {
          appointmentId: record.appointmentId, patientId: record.patient?.id,
          bloodPressureSys: sys, bloodPressureDia: dia,
          pulseRate: parseInt(form.values.pulse) || null,
          temperatureF: celsiusToFahrenheit(form.values.temp),
          weightKg: parseFloat(form.values.weight) || null,
        };
        if (vitalsId) await api(`/api/opd/vitals/${vitalsId}`, { method: "PATCH", body: JSON.stringify(payload) });
        else await api("/api/opd/vitals", { method: "POST", body: JSON.stringify(payload) });
      }

      for (const line of rx.filter(r => r.medicine.trim())) {
        const py = { medicineName: line.medicine, dosage: line.dosage, frequency: line.frequency, durationDays: parseInt(line.duration) || 3, mealRelation: line.instructions || "AFTER_FOOD" };
        if (!line.id.startsWith("rx_")) await api(`/api/opd/consultations/${record.id}/prescriptions/${line.id}`, { method: "PATCH", body: JSON.stringify(py) });
        else await api(`/api/opd/consultations/${record.id}/prescriptions`, { method: "POST", body: JSON.stringify(py) });
      }
    } finally { setSaving(false); }
  };

  const handleCompleteConsultation = async () => {
    const errs = form.validate();
    if (Object.keys(errs).length > 0 || !record?.id) return;
    setCompleting(true);
    try {
      await handleSaveNote();
      const res = await api(`/api/opd/consultations/${record.id}/complete`, { method: "PATCH" });
      if (res.ok) navigate("/consultation");
    } finally { setCompleting(false); }
  };

  if (loadingRecord) return <div className="flex h-[60vh] items-center justify-center"><p className="text-[13px] text-ink-400">Loading prescription pad...</p></div>;
  if (!record) return <div className="flex h-[60vh] items-center justify-center"><Button onClick={() => navigate("/consultation")}>Back to list</Button></div>;

  const patient = record.patient || {};
  const doctor = record.doctor || {};
  const patientName = patient.fullName || "Patient";

  return (
    <div className="space-y-4 pb-10 bg-ink-50 min-h-screen">
      
      {/* APP TOP BAR (Hidden during Print) */}
      <div className="print:hidden max-w-[210mm] mx-auto pt-4">
        <PageIntro
          back title="Prescription Editor"
          description={record.startedAt ? `Started at ${formatTime(record.startedAt)}` : "In Progress"}
          meta={<StatusBadge status={formatStatusForUI(record.status)} />}
          actions={
            <>
              <Button variant="outline" icon={<Printer />} onClick={() => window.print()}>Print A4</Button>
              {!readOnly && <Button variant="outline" icon={<Save />} disabled={saving} onClick={handleSaveNote}>{saving ? "Saving…" : "Save Draft"}</Button>}
              {!readOnly && <Button icon={<CheckCheck />} disabled={completing} onClick={handleCompleteConsultation} className="bg-sky-600 text-white hover:bg-sky-700 border-transparent">Complete Session</Button>}
            </>
          }
        />
      </div>

      {/* =========================================================
          THE A4 PAPER CANVAS (MATCHING THE IMAGE EXACTLY)
          ========================================================= */}
      <div className="relative mx-auto min-h-[297mm] w-[210mm] bg-white shadow-xl print:m-0 print:min-h-0 print:w-full print:max-w-none print:shadow-none font-sans overflow-hidden flex flex-col">
        
        {/* --- DECORATIVE SHAPES --- */}
        {/* Top Left Blue Polygon */}
        <div className="absolute top-0 left-0 w-[45%] h-32 bg-[#00b0f0] z-0 print:bg-[#00b0f0]" style={{ clipPath: 'polygon(0 0, 100% 0, 15% 100%, 0 100%)' }} />
        
        {/* Dot Grids (Subtle pattern) */}
        <div className="absolute top-48 right-6 w-12 h-24 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#00b0f0 2px, transparent 2px)', backgroundSize: '8px 8px' }} />
        <div className="absolute bottom-48 left-10 w-12 h-24 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#00b0f0 2px, transparent 2px)', backgroundSize: '8px 8px' }} />
        
        {/* Center Stethoscope Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 z-0">
          <Stethoscope className="w-[350px] h-[350px] text-[#00b0f0]" />
        </div>

        {/* --- HEADER --- */}
        <div className="pt-10 px-12 flex justify-between items-start relative z-10">
          <div className="mt-2 pl-4">
            <h1 className="text-3xl text-[#1e1e4a] font-semibold tracking-tight">
              Dr. {doctor.firstName || "Alex"} {doctor.lastName || "Justin"}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium tracking-wide mt-1 uppercase">
              {doctor.specialization || "Specialist Doctor For Medicine"}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Registration No-{doctor.regNo || "4573847"}
            </p>
          </div>
          <div className="flex flex-col items-center mr-4">
            <div className="w-12 h-12 bg-white flex items-center justify-center border-2 border-[#00b0f0] rounded-tl-xl rounded-tr-xl rounded-bl-sm rounded-br-sm relative mb-1">
              <span className="text-[#1e1e4a] font-bold text-2xl">H</span>
              <span className="absolute top-1 right-1 text-[#00b0f0] text-lg leading-none">+</span>
            </div>
            <h2 className="text-[#00b0f0] font-bold text-[15px] tracking-wide">Healthcare</h2>
            <p className="text-[8px] text-[#1e1e4a] tracking-widest font-medium uppercase border-t border-[#1e1e4a] pt-0.5 mt-0.5">Medical Clinic</p>
          </div>
        </div>

        {/* --- PATIENT INFO (Dotted Lines) --- */}
        <div className="px-12 mt-10 grid grid-cols-[1fr_200px] gap-x-12 gap-y-4 relative z-10">
          <DottedInput label="Patient Name:" value={patientName} disabled />
          <DottedInput label="Age/Sex:" value={`${patient.age || "-"} ${patient.ageUnit || "Y"} / ${patient.gender || "-"}`} disabled />
          <DottedInput label="Address:" value={patient.address || "-"} disabled />
          <DottedInput label="Date:" value={formatDate(record.startedAt || new Date())} disabled />
        </div>

        {/* --- BODY (Rx and Clinical Data) --- */}
        <div className="px-12 mt-10 flex flex-1 gap-6 relative z-10 pb-32">
          
          {/* Left Column (Rx Logo + Vitals/Symptoms) */}
          <div className="w-[30%] flex flex-col gap-6">
            <div className="text-[4rem] leading-none font-serif font-bold text-[#1e1e4a] tracking-tighter">
              R<span className="text-[2.5rem] align-bottom">x</span>
            </div>
            
            <div className="space-y-4 mt-2 pr-4">
              <div className="space-y-2">
                <DottedInput label="BP" value={form.values.bp} onChange={(e) => form.setValue("bp", e.target.value)} disabled={readOnly} placeholder="___ / ___" small />
                <DottedInput label="Pulse" value={form.values.pulse} onChange={(e) => form.setValue("pulse", e.target.value)} disabled={readOnly} placeholder="______" small />
                <DottedInput label="Temp" value={form.values.temp} onChange={(e) => form.setValue("temp", e.target.value)} disabled={readOnly} placeholder="______" small />
                <DottedInput label="Weight" value={form.values.weight} onChange={(e) => form.setValue("weight", e.target.value)} disabled={readOnly} placeholder="______" small />
              </div>
              
              <div className="pt-4">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Symptoms</span>
                <textarea 
                  className="w-full mt-1 bg-transparent border-b-2 border-dotted border-gray-300 text-[12px] text-[#1e1e4a] font-medium resize-none focus:outline-none focus:border-[#00b0f0]"
                  rows={2} value={form.values.chiefComplaint} onChange={(e) => handleSoapChange("chiefComplaint", e.target.value)} disabled={readOnly}
                />
              </div>

              <div className="pt-2">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Diagnosis</span>
                <textarea 
                  className="w-full mt-1 bg-transparent border-b-2 border-dotted border-gray-300 text-[12px] text-[#1e1e4a] font-medium resize-none focus:outline-none focus:border-[#00b0f0]"
                  rows={2} value={form.values.diagnosis} onChange={(e) => handleSoapChange("diagnosis", e.target.value)} disabled={readOnly}
                />
              </div>
            </div>
          </div>

          {/* Right Column (Medicines & Advice) */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 space-y-4 pt-12">
              {rx.map((line, index) => (
                <div key={line.id} className="relative group flex gap-3 pb-2 border-b border-dotted border-gray-200">
                  <span className="text-[14px] font-bold text-gray-400 mt-0.5">{index + 1}.</span>
                  <div className="flex-1">
                    <input
                      className="w-full bg-transparent text-[15px] font-bold text-[#1e1e4a] placeholder:font-normal placeholder:text-gray-300 focus:outline-none"
                      placeholder="Medicine Name & Strength"
                      value={line.medicine} disabled={readOnly}
                      onChange={(e) => setRx(p => p.map(r => r.id === line.id ? { ...r, medicine: e.target.value } : r))}
                    />
                    <div className="flex flex-wrap items-center gap-x-3 text-[12px] text-gray-500 mt-1">
                      <input className="w-14 bg-transparent focus:outline-none placeholder:text-gray-300" placeholder="Dosage" value={line.dosage} disabled={readOnly} onChange={(e) => setRx(p => p.map(r => r.id === line.id ? { ...r, dosage: e.target.value } : r))} />
                      <span>|</span>
                      <input className="w-20 bg-transparent focus:outline-none placeholder:text-gray-300" placeholder="Frequency" value={line.frequency} disabled={readOnly} onChange={(e) => setRx(p => p.map(r => r.id === line.id ? { ...r, frequency: e.target.value } : r))} />
                      <span>|</span>
                      <input className="w-16 bg-transparent focus:outline-none placeholder:text-gray-300" placeholder="Duration" value={line.duration} disabled={readOnly} onChange={(e) => setRx(p => p.map(r => r.id === line.id ? { ...r, duration: e.target.value } : r))} />
                      <input className="flex-1 min-w-[120px] bg-transparent italic focus:outline-none placeholder:text-gray-300" placeholder="(Instructions)" value={line.instructions} disabled={readOnly} onChange={(e) => setRx(p => p.map(r => r.id === line.id ? { ...r, instructions: e.target.value } : r))} />
                    </div>
                  </div>
                  {!readOnly && <button onClick={() => setRx(p => p.filter(r => r.id !== line.id))} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"><Trash2 className="size-4" /></button>}
                </div>
              ))}
              {!readOnly && <button onClick={() => setRx(p => [...p, { id: idGen("rx"), medicine: "", dosage: "", frequency: "", duration: "", instructions: "" }])} className="text-[12px] font-semibold text-[#00b0f0] hover:text-blue-700 flex items-center gap-1 print:hidden"><Plus className="size-3" /> Add Medicine</button>}
            </div>

            <div className="mt-8 pt-4">
               <div className="flex gap-2 items-end border-b-2 border-dotted border-gray-300 pb-1">
                 <span className="text-[12px] text-gray-600 font-medium whitespace-nowrap">Advice:</span>
                 <input className="flex-1 bg-transparent text-[13px] text-[#1e1e4a] font-medium focus:outline-none" value={form.values.advice} disabled={readOnly} onChange={(e) => handleSoapChange("advice", e.target.value)} />
               </div>
               <div className="flex gap-2 items-end border-b-2 border-dotted border-gray-300 pb-1 mt-4 w-1/2">
                 <span className="text-[12px] text-gray-600 font-medium whitespace-nowrap">Follow-up:</span>
                 <input type="date" className="flex-1 bg-transparent text-[13px] text-[#1e1e4a] font-medium focus:outline-none" value={form.values.followUpDate} disabled={readOnly} onChange={(e) => handleSoapChange("followUpDate", e.target.value)} />
               </div>
            </div>
          </div>
        </div>

        {/* --- FOOTER --- */}
        <div className="mt-auto relative z-10 w-full">
          {/* Bottom Right Blue Polygon */}
          <div className="absolute bottom-0 right-0 w-[50%] h-24 bg-[#00b0f0] z-0 print:bg-[#00b0f0]" style={{ clipPath: 'polygon(15% 35%, 100% 0, 100% 100%, 0 100%)' }} />
          
          <div className="px-12 pb-8 flex items-center gap-6 relative z-10">
             {/* Phone */}
             <div className="flex items-center gap-2 pr-6 border-r border-gray-300">
               <div className="bg-[#1e1e4a] p-1.5 rounded-sm print:bg-[#1e1e4a]"><Phone className="size-3 text-white" /></div>
               <div className="text-[8px] leading-tight text-gray-500 font-medium">
                 <p>123 456 789</p>
                 <p>123 456 789</p>
               </div>
             </div>
             {/* Web/Mail */}
             <div className="flex items-center gap-2 pr-6 border-r border-gray-300">
               <div className="bg-[#1e1e4a] p-1.5 rounded-sm print:bg-[#1e1e4a]"><Globe className="size-3 text-white" /></div>
               <div className="text-[8px] leading-tight text-gray-500 font-medium">
                 <p>yourmail@here</p>
                 <p>yourwebsite.name</p>
               </div>
             </div>
             {/* Location */}
             <div className="flex items-center gap-2">
               <div className="bg-[#1e1e4a] p-1.5 rounded-sm print:bg-[#1e1e4a]"><MapPin className="size-3 text-white" /></div>
               <div className="text-[8px] leading-tight text-gray-500 font-medium">
                 <p>Road 7 Hill</p>
                 <p>By house, Austria</p>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   5. UI HELPER COMPONENTS (The Dotted Line Inputs)
   ========================================================================== */
interface DottedInputProps {
  label: string;
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  placeholder?: string;
  small?: boolean;
}

function DottedInput({ label, value, onChange, disabled, placeholder, small }: DottedInputProps) {
  return (
    <div className="flex items-end gap-2 w-full">
      <span className={cn("text-gray-600 font-medium whitespace-nowrap", small ? "text-[11px] w-12" : "text-[12px]")}>{label}</span>
      <div className="flex-1 relative">
        <input
          className={cn(
            "w-full bg-transparent border-b-2 border-dotted border-gray-300 focus:outline-none focus:border-[#00b0f0] text-[#1e1e4a] font-medium px-1",
            small ? "text-[12px] pb-0.5" : "text-[13px] pb-1"
          )}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}