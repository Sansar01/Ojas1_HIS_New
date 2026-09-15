import React, { useState, useEffect, ChangeEvent } from "react";
import {
  Phone,
  AlertCircle,
  FileText,
  CheckCircle2,
  Calendar,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";
import { PageIntro } from "@/components/common";
import { Button } from "@/components/ui/primitives";
import { useAppDispatch } from "@/hooks";
import { toast } from "@/features/ui/uiSlice";
import { buildApiUrl } from "@/config/api";

// --- Types representing your API schema ---
interface Patient {
  id: string;
  uhid: string;
  firstName: string;
  lastName: string;
  fullName: string;
  mobile: string;
  age: number;
  ageUnit: string;
  gender: string;
  allergies: string | null;
  chronicDiseases: string | null;
}

interface QueueItem {
  id: string;
  tokenNumber: number;
  status: string;
  originalPosition: number;
  estimatedTime: string | null;
  calledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  roomNo: string | null;
  appointmentId: string;
  appointmentNo: string;
  appointmentType: string;
  visitType: string;
  priority: number;
  reasonForVisit: string | null;
  patient: Patient;
  vitalsRecorded: boolean;
  waitTimeMins: number | null;
}

interface QueueSummary {
  waitingCount: number;
  vitalsDoneCount: number;
}

interface QueueApiResponse {
  summary: QueueSummary;
  queue: QueueItem[];
}

// Section Header matching theme
const SectionHeader = ({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-4 w-full">
      <h3 className="text-sm font-bold text-gray-900 whitespace-nowrap">
        {title}
      </h3>
      <div className="h-px bg-gray-200 w-full mt-1"></div>
    </div>
    {action && <div className="ml-2">{action}</div>}
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const normalized = status.toUpperCase();
  if (normalized === "WAITING" || normalized === "PENDING") {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100 text-[11px] font-medium">
        <div className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Waiting
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100 text-[11px] font-medium">
      <div className="w-1.5 h-1.5 rounded-full bg-teal-500" /> Vitals Done
    </span>
  );
};

// Static History Data
const DUMMY_HISTORY = [
  {
    date: "12 May 2025",
    doctor: "Dr. Doris Barton",
    dept: "Gen. Med.",
    type: "WALK-IN",
    dx: "Viral Fever, Cough",
    action: "View Rx",
  },
  {
    date: "05 Apr 2025",
    doctor: "Dr. Rina Maxwell",
    dept: "Gen. Med.",
    type: "APPT",
    dx: "Routine Checkup",
    action: "View Report",
  },
];

export function OpdExaminationRoom() {
  const dispatch = useAppDispatch();

  // API State
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [summary, setSummary] = useState<QueueSummary>({
    waitingCount: 0,
    vitalsDoneCount: 0,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  });

  // UI State
  const [activeTab, setActiveTab] = useState<"waiting" | "done">("waiting");
  const [selectedPatient, setSelectedPatient] = useState<QueueItem | null>(null);
  const [painScore, setPainScore] = useState<number | null>(null);
  const [chiefComplaint, setChiefComplaint] = useState("");

  const [vitals, setVitals] = useState({
    bp: "",
    pulse: "",
    temp: "",
    spo2: "",
    respRate: "",
    weight: "",
    height: "",
  });

  const heightM = Number(vitals.height) / 100;
  const bmi =
    heightM > 0 && Number(vitals.weight) > 0
      ? (Number(vitals.weight) / (heightM * heightM)).toFixed(1)
      : "";

  // Helper to extract Auth Token safely from localStorage
  const getAuthHeaders = (): Record<string, string> => {
    try {
      const stored = JSON.parse(localStorage.getItem("authUserToken") || "null");
      const token = stored?.accessToken ?? stored?.token ?? null;
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  };

  // Fetch Queue from backend
  const fetchQueue = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const query = new URLSearchParams({
        date: selectedDate,
        tab: activeTab === "waiting" ? "waiting" : "done",
      }).toString();

      const url = `${buildApiUrl("/api/opd/queue/nurse")}?${query}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.message || `Server responded with status ${res.status}`);
      }

      const resData = await res.json();
      const payload: QueueApiResponse = resData.data ? resData.data : resData;

      setQueue(payload.queue || []);
      setSummary(
        payload.summary || {
          waitingCount: (payload.queue || []).length,
          vitalsDoneCount: 0,
        }
      );

      // Auto-select first patient if active selection is missing
      if (payload.queue && payload.queue.length > 0) {
        const stillInList = payload.queue.find(
          (item) => item.id === selectedPatient?.id
        );
        if (!stillInList) {
          handleSelectPatient(payload.queue[0]);
        }
      } else {
        setSelectedPatient(null);
        clearFormState();
      }
    } catch (err: any) {
      console.error("Queue Fetch Error:", err);
      dispatch(
        toast.error(
          "Error loading patient queue",
          err.message || "Failed to communicate with API server."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [selectedDate, activeTab]);

  const handleVitalChange = (field: keyof typeof vitals, value: string) => {
    setVitals((prev) => ({ ...prev, [field]: value }));
  };

  const clearFormState = () => {
    setChiefComplaint("");
    setPainScore(null);
    setVitals({
      bp: "",
      pulse: "",
      temp: "",
      spo2: "",
      respRate: "",
      weight: "",
      height: "",
    });
  };

  const handleSelectPatient = (queueItem: QueueItem) => {
    setSelectedPatient(queueItem);
    setChiefComplaint(queueItem.reasonForVisit || "");
    setVitals({
      bp: "120/80",
      pulse: "78",
      temp: "98.6",
      spo2: "99",
      respRate: "16",
      weight: "65",
      height: "165",
    });
    setPainScore(3);
  };

  const handleClear = () => {
    clearFormState();
    dispatch(toast.info("Form cleared"));
  };

  // --- Mark Ready for Doctor Sequential Handler (Form Submit) ---
  const handleMarkReady = async () => {
    if (!selectedPatient) return;

    // Field Validations
    if (!chiefComplaint.trim()) {
      dispatch(
        toast.warning(
          "Chief complaint is required",
          "Please enter the patient's chief complaint before marking ready."
        )
      );
      return;
    }

    // BP Splitting Validation & Check
    let bpSys: number | null = null;
    let bpDia: number | null = null;

    if (vitals.bp.trim()) {
      const bpParts = vitals.bp.split("/");
      if (bpParts.length !== 2) {
        dispatch(
          toast.warning(
            "Invalid BP Format",
            "Please enter blood pressure in Sys/Dia format (e.g. 120/80)."
          )
        );
        return;
      }
      bpSys = parseInt(bpParts[0].trim(), 10);
      bpDia = parseInt(bpParts[1].trim(), 10);

      if (isNaN(bpSys) || isNaN(bpDia)) {
        dispatch(
          toast.warning(
            "Invalid BP Numbers",
            "Please make sure Blood Pressure contains valid integers."
          )
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      // ==========================================
      // STEP A: Save Vitals (POST /api/opd/vitals)
      // ==========================================
      const vitalsPayload = {
        patientId: selectedPatient.patient.id,
        appointmentId: selectedPatient.appointmentId,
        chiefComplaints: chiefComplaint.trim(),
        painScore: painScore !== null ? Number(painScore) : null,
        bloodPressureSys: bpSys,
        bloodPressureDia: bpDia,
        pulseRate: vitals.pulse ? parseInt(vitals.pulse, 10) : null,
        temperatureF: vitals.temp ? parseFloat(vitals.temp) : null,
        spo2: vitals.spo2 ? parseInt(vitals.spo2, 10) : null,
        respiratoryRate: vitals.respRate ? parseInt(vitals.respRate, 10) : null,
        weightKg: vitals.weight ? parseFloat(vitals.weight) : null,
        heightCm: vitals.height ? parseFloat(vitals.height) : null,
      };

      const vitalsUrl = buildApiUrl("/api/opd/vitals");
      const vitalsRes = await fetch(vitalsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(vitalsPayload),
        credentials: "include",
      });

      if (!vitalsRes.ok) {
        const errData = await vitalsRes.json().catch(() => ({}));
        throw new Error(errData?.message || "Failed to save patient vitals.");
      }

      // =========================================================================
      // STEP B: Check-In Patient (PATCH /api/opd/appointments/:id/check-in)
      // =========================================================================
      const checkInUrl = buildApiUrl(`/api/opd/appointments/${selectedPatient.appointmentId}/check-in`);
      const checkInRes = await fetch(checkInUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
      });

      if (!checkInRes.ok) {
        const errData = await checkInRes.json().catch(() => ({}));
        throw new Error(errData?.message || "Vitals saved, but check-in failed.");
      }

      // Success Flows
      dispatch(
        toast.success(
          "Patient Marked Ready",
          `${selectedPatient.patient.fullName} successfully processed & queued for Doctor.`
        )
      );

      // Clean form states & sync queue
      clearFormState();
      await fetchQueue(true); // Quiet reload
    } catch (err: any) {
      console.error("Workflow Error:", err);
      dispatch(
        toast.error(
          "Operation Failed",
          err.message || "Something went wrong while marking patient ready."
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCallPatient = (patientName: string) => {
    dispatch(toast.info(`Calling ${patientName}...`));
  };

  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
        <PageIntro
          title="OPD Examination Room"
          description="Capture vitals and nursing assessment before consultation."
          back
        />
        <div className="flex flex-wrap items-center gap-3 pb-1">
          {/* Date Selector */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-sm shadow-sm font-medium">
            <Calendar size={15} className="text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="outline-none border-none text-xs text-gray-800 bg-transparent font-bold cursor-pointer"
            />
          </div>

          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-sm font-medium">
            <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            Assessment in Progress
          </span>

          <button
            onClick={() => fetchQueue(false)}
            className="p-2 text-gray-500 hover:text-teal-700 hover:bg-teal-50 border border-gray-200 bg-white rounded-lg transition-colors shadow-sm"
            title="Refresh queue"
            disabled={loading}
          >
            <RefreshCw size={14} className={`${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Patients Queue */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <SectionHeader title="Patients Queue" />

            <div className="flex bg-slate-100 p-1 rounded-lg mb-5 text-sm font-medium text-center">
              <button
                type="button"
                onClick={() => setActiveTab("waiting")}
                className={`flex-1 py-1.5 rounded-md transition-all ${
                  activeTab === "waiting"
                    ? "bg-white shadow border border-gray-200 text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Waiting ({summary.waitingCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("done")}
                className={`flex-1 py-1.5 rounded-md transition-all ${
                  activeTab === "done"
                    ? "bg-white shadow border border-gray-200 text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Vitals Done ({summary.vitalsDoneCount})
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Loader2 size={24} className="animate-spin text-teal-600 mb-2" />
                <span className="text-xs font-medium">Loading patients...</span>
              </div>
            ) : queue.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-400 flex flex-col items-center justify-center">
                <Users size={32} className="text-gray-300 mb-2" />
                No patients found in queue.
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {queue.map((item) => {
                  const isActive = selectedPatient?.id === item.id;
                  const patientAge = `${item.patient.age} ${
                    item.patient.ageUnit === "years" ? "Y" : item.patient.ageUnit[0]?.toUpperCase() || "Y"
                  }`;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectPatient(item)}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        isActive
                          ? "border-teal-500 bg-teal-50/30 shadow-sm ring-1 ring-teal-500"
                          : "border-gray-200 bg-white hover:border-teal-300 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-[11px] font-mono font-bold text-gray-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                          Token #{item.tokenNumber}
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                      <div className="font-bold text-gray-900 text-base">
                        {item.patient.fullName}
                      </div>
                      <div className="text-sm text-gray-500 mb-2">
                        {item.patient.uhid} • {patientAge} • {item.patient.gender}
                      </div>

                      {item.reasonForVisit && (
                        <div className="bg-slate-50 border border-slate-100 rounded px-2 py-1.5 text-xs text-gray-700">
                          <span className="font-medium text-gray-500">Complaint:</span>{" "}
                          {item.reasonForVisit}
                        </div>
                      )}

                      {isActive && (
                        <div className="mt-3 pt-3 border-t border-teal-100 flex gap-2">
                          <button
                            type="button"
                            className="flex-1 py-1.5 text-xs bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCallPatient(item.patient.fullName);
                            }}
                          >
                            <Phone size={14} /> Call Patient
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Center Column: Assessment Form */}
        <div className="xl:col-span-6 flex flex-col gap-4">
          {selectedPatient ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xl font-bold border border-slate-200">
                    {selectedPatient.patient.fullName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      {selectedPatient.patient.fullName}
                      <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                        {selectedPatient.patient.uhid}
                      </span>
                    </h2>
                    <div className="text-sm text-gray-500 mt-1 flex items-center flex-wrap gap-3">
                      <span>
                        {selectedPatient.patient.age} {selectedPatient.patient.ageUnit},{" "}
                        {selectedPatient.patient.gender}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-gray-300 hidden sm:inline-block"></span>
                      <span>{selectedPatient.patient.mobile}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-300 hidden sm:inline-block"></span>
                      <span className="font-mono text-xs bg-teal-50 text-teal-800 border border-teal-100 px-1.5 py-0.5 rounded">
                        {selectedPatient.appointmentType}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs">
                      <CheckCircle2 size={14} />
                    </div>
                    <span className="text-[10px] text-teal-700 font-medium mt-1">Reg</span>
                  </div>
                  <div className="w-8 h-px bg-teal-600 mb-3"></div>
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold ring-2 ring-teal-100">
                      2
                    </div>
                    <span className="text-[10px] text-teal-700 font-bold mt-1">Vitals</span>
                  </div>
                  <div className="w-8 h-px bg-gray-200 mb-3"></div>
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 border border-gray-200 flex items-center justify-center text-xs font-bold">
                      3
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium mt-1">Consult</span>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-8 bg-white">
                <section>
                  <SectionHeader title="Nursing Assessment" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Chief Complaint <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none text-gray-900 min-h-[110px] shadow-sm placeholder-gray-400"
                        placeholder="Enter primary complaints and duration..."
                        value={chiefComplaint}
                        onChange={(e) => setChiefComplaint(e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Pain Score (0-10)
                      </label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setPainScore(num)}
                            disabled={submitting}
                            className={`w-9 h-9 flex items-center justify-center rounded-md border text-sm font-medium transition-all ${
                              painScore === num
                                ? "bg-teal-700 text-white border-teal-700 shadow-inner"
                                : "bg-white text-gray-700 border-gray-300 hover:bg-slate-50"
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                      <p className="mt-3 text-sm font-medium">
                        {painScore !== null && painScore > 6 ? (
                          <span className="text-red-600">😫 Severe Pain</span>
                        ) : painScore !== null && painScore > 3 ? (
                          <span className="text-orange-500">😐 Moderate Pain</span>
                        ) : painScore !== null ? (
                          <span className="text-teal-600">🙂 Mild/No Pain</span>
                        ) : (
                          <span className="text-gray-400">Not Assessed</span>
                        )}
                      </p>
                    </div>
                  </div>
                </section>

                <section>
                  <SectionHeader title="Vital Signs" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <VitalInput
                      label="Blood Pressure"
                      unit="mmHg"
                      value={vitals.bp}
                      onChange={(v) => handleVitalChange("bp", v)}
                      isAlert={vitals.bp === "140/90"}
                      disabled={submitting}
                    />
                    <VitalInput
                      label="Pulse"
                      unit="bpm"
                      value={vitals.pulse}
                      onChange={(v) => handleVitalChange("pulse", v)}
                      disabled={submitting}
                    />
                    <VitalInput
                      label="Temperature"
                      unit="°F"
                      value={vitals.temp}
                      onChange={(v) => handleVitalChange("temp", v)}
                      disabled={submitting}
                    />
                    <VitalInput
                      label="SpO2"
                      unit="%"
                      value={vitals.spo2}
                      onChange={(v) => handleVitalChange("spo2", v)}
                      disabled={submitting}
                    />
                    <VitalInput
                      label="Resp. Rate"
                      unit="/min"
                      value={vitals.respRate}
                      onChange={(v) => handleVitalChange("respRate", v)}
                      disabled={submitting}
                    />
                    <VitalInput
                      label="Weight"
                      unit="kg"
                      value={vitals.weight}
                      onChange={(v) => handleVitalChange("weight", v)}
                      disabled={submitting}
                    />
                    <VitalInput
                      label="Height"
                      unit="cm"
                      value={vitals.height}
                      onChange={(v) => handleVitalChange("height", v)}
                      disabled={submitting}
                    />

                    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 flex flex-col justify-between">
                      <div className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">
                        BMI
                      </div>
                      <div className="flex items-baseline gap-1">
                        <div className="text-xl font-bold text-slate-900">{bmi || "--"}</div>
                        <span className="text-slate-500 text-xs font-medium">kg/m²</span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div className="p-4 border-t border-gray-200 bg-slate-50 flex justify-end gap-3">
                <Button variant="outline" onClick={handleClear} disabled={submitting}>
                  Clear Form
                </Button>
                <Button onClick={handleMarkReady} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="mr-1.5 animate-spin" />
                      Saving & Checking In...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} className="mr-1.5" />
                      Mark Ready for Doctor
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
              <Users size={48} className="text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-800 mb-1">No Patient Selected</h3>
              <p className="text-sm text-gray-500 max-w-sm">
                Select a patient from the queue column on the left to start recording vitals and nursing assessments.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Risks & History */}
        <div className="xl:col-span-3 flex flex-col gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <SectionHeader title="Risk & Alerts" />
            <div className="space-y-3">
              {/* Dynamic Allergies */}
              {selectedPatient?.patient.allergies ? (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-red-800 font-bold text-xs uppercase tracking-wider mb-1">
                    <AlertCircle size={14} className="shrink-0" /> Drug / Allergy Alert
                  </div>
                  <p className="text-xs text-red-700 font-medium pl-5">
                    {selectedPatient.patient.allergies}
                  </p>
                </div>
              ) : null}

              {/* Dynamic Chronic Conditions */}
              {selectedPatient?.patient.chronicDiseases ? (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider mb-1">
                    <AlertCircle size={14} className="shrink-0" /> Chronic Conditions
                  </div>
                  <p className="text-xs text-amber-700 font-medium pl-5">
                    {selectedPatient.patient.chronicDiseases}
                  </p>
                </div>
              ) : null}

              {/* Dynamic Vital Alerts */}
              {vitals.bp === "140/90" && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-red-800 font-bold text-sm mb-0.5">
                    <AlertCircle size={14} /> High Blood Pressure
                  </div>
                  <p className="text-xs text-red-600 font-medium ml-6">{vitals.bp} mmHg</p>
                </div>
              )}

              {vitals.temp && Number(vitals.temp) > 99.0 && (
                <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-orange-800 font-bold text-sm mb-0.5">
                    Low Grade Fever
                  </div>
                  <p className="text-xs text-orange-600 font-medium ml-6">{vitals.temp} °F</p>
                </div>
              )}

              {!selectedPatient?.patient.allergies &&
                !selectedPatient?.patient.chronicDiseases &&
                !vitals.bp && (
                  <div className="text-center py-6 text-xs text-gray-400 font-medium">
                    No immediate alerts flagged.
                  </div>
                )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <SectionHeader title="Previous Visits" />
            <div className="space-y-0">
              {DUMMY_HISTORY.map((visit) => (
                <div key={visit.date} className="py-3 border-b border-gray-100 last:border-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-sm text-gray-900">{visit.date}</span>
                    <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded font-medium border border-slate-200 uppercase tracking-wider">
                      {visit.type}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-teal-700 mb-1">
                    {visit.doctor} • {visit.dept}
                  </p>
                  <p className="text-xs text-gray-600">
                    <span className="text-gray-400 font-medium">Dx:</span> {visit.dx}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      className="text-[11px] font-medium text-gray-500 hover:text-teal-700 border border-gray-200 rounded px-2 py-1 bg-white hover:bg-teal-50 flex items-center gap-1 transition-colors"
                      onClick={() =>
                        dispatch(
                          toast.info(
                            visit.action,
                            `${visit.date} · ${selectedPatient?.patient.fullName || "Patient"}`
                          )
                        )
                      }
                    >
                      <FileText size={10} /> {visit.action}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface VitalInputProps {
  label: string;
  unit: string;
  value: string;
  onChange: (val: string) => void;
  isAlert?: boolean;
  disabled?: boolean;
}

function VitalInput({ label, unit, value, onChange, isAlert = false, disabled = false }: VitalInputProps) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">
        {label}
      </label>
      <div
        className={`flex items-center border rounded-lg bg-white overflow-hidden transition-all focus-within:ring-1 focus-within:border-teal-500 focus-within:ring-teal-500 ${
          isAlert ? "border-red-300 bg-red-50/10" : "border-gray-300"
        } ${disabled ? "opacity-60 bg-gray-50 cursor-not-allowed" : ""}`}
      >
        <input
          type="text"
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full px-3 py-2 text-sm font-medium outline-none bg-transparent ${
            isAlert ? "text-red-700" : "text-gray-900"
          } ${disabled ? "cursor-not-allowed" : ""}`}
          placeholder="0"
        />
        <div className="px-3 py-2 bg-slate-50 border-l border-gray-200 text-xs text-gray-500 font-medium">
          {unit}
        </div>
      </div>
    </div>
  );
}