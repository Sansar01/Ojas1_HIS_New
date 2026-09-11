import React, { useState, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Phone,
  AlertCircle,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { PageIntro } from "@/components/common";
import { Button } from "@/components/ui/primitives";

// Section Header matching your app theme (title + divider line)
const SectionHeader = ({ title }: { title: string }) => (
  <div className="flex items-center gap-4 mb-4">
    <h3 className="text-sm font-bold text-gray-900 whitespace-nowrap">{title}</h3>
    <div className="h-px bg-gray-200 w-full mt-1"></div>
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  if (status === "Waiting") {
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

// --- Dummy Data ---
const DUMMY_QUEUE = [
  {
    id: "PT-2026-000001",
    mrn: "A-1025",
    name: "Sunita Devi",
    age: "45Y",
    gender: "Female",
    complaint: "Fever, Body Ache",
    wait: "15 min",
    status: "Waiting",
    blood: "O+",
    mobile: "9876543210",
  },
  {
    id: "PT-2026-000004",
    mrn: "A-1026",
    name: "Samson Garcia",
    age: "32Y",
    gender: "Male",
    complaint: "Cough, Cold",
    wait: "20 min",
    status: "Waiting",
    blood: "B+",
    mobile: "9123456780",
  },
  {
    id: "PT-2026-000005",
    mrn: "A-1027",
    name: "Meena Kumari",
    age: "28Y",
    gender: "Female",
    complaint: "Back Pain",
    wait: "25 min",
    status: "Waiting",
    blood: "A-",
    mobile: "9988776655",
  },
];

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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"waiting" | "done">("waiting");
  const [selectedPatient, setSelectedPatient] = useState(DUMMY_QUEUE[0]);
  const [painScore, setPainScore] = useState<number | null>(6);
  const [chiefComplaint, setChiefComplaint] = useState(
    DUMMY_QUEUE[0].complaint + " since 2 days"
  );

  const [vitals, setVitals] = useState({
    bp: "140/90",
    pulse: "98",
    temp: "99.1",
    spo2: "98",
    respRate: "20",
    weight: "78",
    height: "172",
  });

  const heightM = Number(vitals.height) / 100;
  const bmi =
    heightM > 0 && Number(vitals.weight) > 0
      ? (Number(vitals.weight) / (heightM * heightM)).toFixed(1)
      : "";

  const handleVitalChange = (field: keyof typeof vitals, value: string) => {
    setVitals((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectPatient = (patient: (typeof DUMMY_QUEUE)[0]) => {
    setSelectedPatient(patient);
    setChiefComplaint(patient.complaint + " since 2 days");
    // reset dummy vitals when switching patient
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

  const handleMarkReady = () => {
    // Dummy action for now
    alert(
      `${selectedPatient.name} marked as Ready for Doctor\n` +
        `BP: ${vitals.bp} | Pulse: ${vitals.pulse} | Temp: ${vitals.temp} | Pain: ${painScore}`
    );
  };

  return (
    <div className="w-full">
      {/* Page Header — uses your existing PageIntro / layout style */}
      <div className="flex justify-between items-end mb-6">
        <PageIntro
          title="OPD Examination Room"
          description="Capture vitals and nursing assessment before consultation."
          back
        />
        <div className="flex items-center gap-3 pb-1">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-sm font-medium">
            <div className="w-2 h-2 rounded-full bg-teal-500" />
            Assessment in Progress
          </span>
          <div className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-sm shadow-sm font-medium">
            Avg time: 06:45 min
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Patients Queue */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <SectionHeader title="Patients Queue" />

            {/* Tabs */}
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
                Waiting (3)
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
                Vitals Done
              </button>
            </div>

            {/* Patient List */}
            <div className="space-y-3">
              {activeTab === "waiting" ? (
                DUMMY_QUEUE.map((patient) => {
                  const isActive = selectedPatient.id === patient.id;
                  return (
                    <div
                      key={patient.id}
                      onClick={() => handleSelectPatient(patient)}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        isActive
                          ? "border-teal-500 bg-teal-50/30 shadow-sm ring-1 ring-teal-500"
                          : "border-gray-200 bg-white hover:border-teal-300 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-xs font-mono text-gray-500">
                          {patient.mrn}
                        </div>
                        <StatusBadge status={patient.status} />
                      </div>
                      <div className="font-bold text-gray-900 text-base">
                        {patient.name}
                      </div>
                      <div className="text-sm text-gray-500 mb-2">
                        {patient.id} • {patient.age} {patient.gender}
                      </div>

                      <div className="bg-slate-50 border border-slate-100 rounded px-2 py-1.5 text-xs text-gray-700">
                        <span className="font-medium text-gray-500">
                          Complaint:
                        </span>{" "}
                        {patient.complaint}
                      </div>

                      {isActive && (
                        <div className="mt-3 pt-3 border-t border-teal-100 flex gap-2">
                          <button
                            type="button"
                            className="flex-1 py-1.5 text-xs bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              alert(`Calling ${patient.name}...`);
                            }}
                          >
                            <Phone size={14} /> Call
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-sm text-gray-400">
                  No patients with vitals done yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center Column: Assessment Form */}
        <div className="xl:col-span-6 flex flex-col gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Patient Profile Header */}
            <div className="p-6 border-b border-gray-200 bg-white flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xl font-bold border border-slate-200">
                  {selectedPatient.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    {selectedPatient.name}
                    <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                      {selectedPatient.mrn}
                    </span>
                  </h2>
                  <div className="text-sm text-gray-500 mt-1 flex items-center gap-3">
                    <span>
                      {selectedPatient.age}, {selectedPatient.gender}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                    <span>{selectedPatient.mobile}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                    <span className="font-medium text-red-600">
                      Blood: {selectedPatient.blood}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stepper */}
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs">
                    <CheckCircle2 size={14} />
                  </div>
                  <span className="text-[10px] text-teal-700 font-medium mt-1">
                    Reg
                  </span>
                </div>
                <div className="w-8 h-px bg-teal-600 mb-3"></div>
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold ring-2 ring-teal-100">
                    2
                  </div>
                  <span className="text-[10px] text-teal-700 font-bold mt-1">
                    Vitals
                  </span>
                </div>
                <div className="w-8 h-px bg-gray-200 mb-3"></div>
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 border border-gray-200 flex items-center justify-center text-xs font-bold">
                    3
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium mt-1">
                    Consult
                  </span>
                </div>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-8 bg-white">
              {/* Nursing Assessment */}
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
                        <span className="text-orange-500">
                          😐 Moderate Pain
                        </span>
                      ) : (
                        <span className="text-teal-600">🙂 Mild/No Pain</span>
                      )}
                    </p>
                  </div>
                </div>
              </section>

              {/* Vital Signs */}
              <section>
                <SectionHeader title="Vital Signs" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <VitalInput
                    label="Blood Pressure"
                    unit="mmHg"
                    value={vitals.bp}
                    onChange={(v) => handleVitalChange("bp", v)}
                    isAlert={vitals.bp === "140/90"}
                  />
                  <VitalInput
                    label="Pulse"
                    unit="bpm"
                    value={vitals.pulse}
                    onChange={(v) => handleVitalChange("pulse", v)}
                  />
                  <VitalInput
                    label="Temperature"
                    unit="°F"
                    value={vitals.temp}
                    onChange={(v) => handleVitalChange("temp", v)}
                  />
                  <VitalInput
                    label="SpO2"
                    unit="%"
                    value={vitals.spo2}
                    onChange={(v) => handleVitalChange("spo2", v)}
                  />
                  <VitalInput
                    label="Resp. Rate"
                    unit="/min"
                    value={vitals.respRate}
                    onChange={(v) => handleVitalChange("respRate", v)}
                  />
                  <VitalInput
                    label="Weight"
                    unit="kg"
                    value={vitals.weight}
                    onChange={(v) => handleVitalChange("weight", v)}
                  />
                  <VitalInput
                    label="Height"
                    unit="cm"
                    value={vitals.height}
                    onChange={(v) => handleVitalChange("height", v)}
                  />

                  {/* BMI */}
                  <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 flex flex-col justify-between">
                    <div className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">
                      BMI
                    </div>
                    <div className="flex items-baseline gap-1">
                      <div className="text-xl font-bold text-slate-900">
                        {bmi || "--"}
                      </div>
                      <span className="text-slate-500 text-xs font-medium">
                        kg/m²
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-200 bg-slate-50 flex justify-end gap-3">
              <Button variant="outline" onClick={handleClear}>
                Clear Form
              </Button>
              <Button onClick={handleMarkReady}>
                <CheckCircle2 size={16} className="mr-1.5" />
                Mark Ready for Doctor
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Alerts + History */}
        <div className="xl:col-span-3 flex flex-col gap-6">
          {/* Risk & Alerts */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <SectionHeader title="Risk & Alerts" />
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-800 font-bold text-sm mb-0.5">
                  <AlertCircle size={14} /> High Blood Pressure
                </div>
                <p className="text-xs text-red-600 font-medium ml-6">
                  {vitals.bp || "--"} mmHg
                </p>
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                <div className="flex items-center gap-2 text-orange-800 font-bold text-sm mb-0.5">
                  Low Grade Fever
                </div>
                <p className="text-xs text-orange-600 font-medium ml-6">
                  {vitals.temp || "--"} °F
                </p>
              </div>
            </div>
          </div>

          {/* Previous Visits */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <SectionHeader title="Previous Visits" />
            <div className="space-y-0">
              {DUMMY_HISTORY.map((visit) => (
                <div
                  key={visit.date}
                  className="py-3 border-b border-gray-100 last:border-0"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-sm text-gray-900">
                      {visit.date}
                    </span>
                    <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded font-medium border border-slate-200 uppercase tracking-wider">
                      {visit.type}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-teal-700 mb-1">
                    {visit.doctor} • {visit.dept}
                  </p>
                  <p className="text-xs text-gray-600">
                    <span className="text-gray-400 font-medium">Dx:</span>{" "}
                    {visit.dx}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      className="text-[11px] font-medium text-gray-500 hover:text-teal-700 border border-gray-200 rounded px-2 py-1 bg-white hover:bg-teal-50 flex items-center gap-1 transition-colors"
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

// Vital input matching your form field style
interface VitalInputProps {
  label: string;
  unit: string;
  value: string;
  onChange: (val: string) => void;
  isAlert?: boolean;
}

function VitalInput({
  label,
  unit,
  value,
  onChange,
  isAlert = false,
}: VitalInputProps) {
  return (
    <div className="flex flex-col">
      <label className="text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">
        {label}
      </label>
      <div
        className={`flex items-center border rounded-lg bg-white overflow-hidden transition-all focus-within:ring-1 focus-within:border-teal-500 focus-within:ring-teal-500 ${
          isAlert ? "border-red-300" : "border-gray-300"
        }`}
      >
        <input
          type="text"
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange(e.target.value)
          }
          className={`w-full px-3 py-2 text-sm font-medium outline-none ${
            isAlert ? "text-red-700" : "text-gray-900"
          }`}
          placeholder="0"
        />
        <div className="px-3 py-2 bg-slate-50 border-l border-gray-200 text-xs text-gray-500 font-medium">
          {unit}
        </div>
      </div>
    </div>
  );
}