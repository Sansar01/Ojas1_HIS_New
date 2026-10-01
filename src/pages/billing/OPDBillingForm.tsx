import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Edit,
  Trash2,
  Plus,
  Minus,
  FileText,
  ChevronDown,
  X,
  User,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { billingService } from "@/features/billing/billingService";
import { formatMoney } from "@/utils";
import { cn } from "@/utils/cn";

// --- SERVICE MASTER (Replace with API later) ---
const SERVICE_MASTER = [
  {
    code: "CONS-001",
    name: "Consultation (General Physician)",
    category: "Consultation",
    dept: "Medicine",
    rate: 500,
  },
  {
    code: "CONS-002",
    name: "Consultation (Specialist)",
    category: "Consultation",
    dept: "Cardiology",
    rate: 1000,
  },
  {
    code: "LAB-001",
    name: "CBC (Complete Blood Count)",
    category: "Lab",
    dept: "Pathology",
    rate: 300,
  },
  {
    code: "LAB-002",
    name: "Lipid Profile",
    category: "Lab",
    dept: "Pathology",
    rate: 950,
  },
  {
    code: "RAD-001",
    name: "Chest X-Ray",
    category: "Radiology",
    dept: "Radiology",
    rate: 800,
  },
  {
    code: "RAD-002",
    name: "2D Echocardiography",
    category: "Radiology",
    dept: "Cardiology",
    rate: 2400,
  },
  {
    code: "PROC-001",
    name: "ECG",
    category: "Procedure",
    dept: "Cardiology",
    rate: 600,
  },
  {
    code: "PHAR-001",
    name: "Amoxicillin 500mg",
    category: "Pharmacy",
    dept: "Pharmacy",
    rate: 120,
  },
];

const CATEGORIES = [
  "All",
  "Consultation",
  "Lab",
  "Radiology",
  "Procedure",
  "Pharmacy",
  "Others",
];

const calculateAge = (dob: string) => {
  if (!dob) return "N/A";
  const diff = Date.now() - new Date(dob).getTime();
  return Math.abs(new Date(diff).getUTCFullYear() - 1970);
};

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function OPDBillingForm({ onClose, onSuccess }: Props) {
  const [searchParams] = useSearchParams();
  const urlAppointmentId = searchParams.get("appointment");
  const urlPatientId = searchParams.get("patient");

  // Patient Search
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [allPatients, setAllPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);

  // Appointments
  const [allAppointments, setAllAppointments] = useState<any[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>(
    urlAppointmentId || "",
  );

  // Doctors
  const [allDoctors, setAllDoctors] = useState<any[]>([]);

  // Panel / Insurance
  const [panelGroup, setPanelGroup] = useState("GENERAL");
  const [panelName, setPanelName] = useState("");
  const [referralType, setReferralType] = useState("Walk-In");
  const [referralDoctor, setReferralDoctor] = useState("");
  const [department, setDepartment] = useState("");
  const [doctorId, setDoctorId] = useState("");

  // Services
  const [activeCategory, setActiveCategory] = useState("All");
  const [serviceSearch, setServiceSearch] = useState("");
  const [selectedServices, setSelectedServices] = useState<any[]>([]);

  // Payment
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [receivedAmount, setReceivedAmount] = useState<number | "">("");
  const [discount, setDiscount] = useState(0);
  const [coPayPercent, setCoPayPercent] = useState(0);

  // Additional
  const [remarks, setRemarks] = useState("");
  const [tokenNo, setTokenNo] = useState("");
  const [currency, setCurrency] = useState("INR");

  // UI State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // --- Load Masters ---
  useEffect(() => {
    async function loadMasters() {
      try {
        setLoading(true);
        const [patRes, aptRes, docRes] = await Promise.all([
          billingService.getPatients({ limit: 100 }),
          billingService.getAppointments({}),
          billingService.getDoctors(),
        ]);

        const patients = patRes.data || patRes || [];
        const appointments = aptRes.data || aptRes || [];
        const doctors = docRes.data || docRes || [];

        setAllPatients(patients);
        setAllAppointments(appointments);
        setAllDoctors(doctors);

        // Preselect from URL
        if (urlAppointmentId) {
          const apt = appointments.find((a: any) => a.id === urlAppointmentId);
          if (apt) {
            selectAppointment(apt, patients);
          }
        } else if (urlPatientId) {
          const pat = patients.find((p: any) => p.id === urlPatientId);
          if (pat) handleSelectPatient(pat);
        }
      } catch (e) {
        console.error("Failed to load masters", e);
      } finally {
        setLoading(false);
      }
    }
    loadMasters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Handlers ---
  const handleSelectPatient = (patient: any) => {
    setSelectedPatient(patient);
    setShowSearchResults(false);
    setSearchQuery("");

    // Auto-fill Panel if patient belongs to one
    if (patient.panel) {
      setPanelGroup("CORPORATE");
      setPanelName(patient.panel.panelName);
    } else {
      setPanelGroup("GENERAL");
      setPanelName("");
    }
  };

  const selectAppointment = (apt: any, patients?: any[]) => {
    setSelectedAppointmentId(apt.id);

    // Auto-select patient
    if (apt.patient) {
      const patList = patients || allPatients;
      const fullPatient =
        patList.find((p) => p.id === apt.patient.id) || apt.patient;
      handleSelectPatient(fullPatient);
    }

    // Auto-select doctor
    if (apt.doctor) {
      setDoctorId(apt.doctor.id);
      setDepartment(apt.doctor.specialization || "");
    }

    // Auto-add consultation
    const fee = Number(apt.consultationFee || 500);
    const consultationItem = {
      ...SERVICE_MASTER[0],
      name: `Consultation - Dr. ${apt.doctor?.firstName || ""} ${apt.doctor?.lastName || ""}`.trim(),
      rate: fee,
      qty: 1,
      uid: Math.random().toString(36).substring(2, 9),
    };
    setSelectedServices([consultationItem]);
    setReceivedAmount(fee);
  };

  const filteredPatientResults = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return allPatients
      .filter(
        (p) =>
          p.uhid?.toLowerCase().includes(q) ||
          p.firstName?.toLowerCase().includes(q) ||
          p.lastName?.toLowerCase().includes(q) ||
          p.mobile?.includes(q),
      )
      .slice(0, 8);
  }, [searchQuery, allPatients]);

  const filteredServices = useMemo(() => {
    return SERVICE_MASTER.filter((s) => {
      const matchCat =
        activeCategory === "All" || s.category === activeCategory;
      const matchSearch =
        !serviceSearch ||
        s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
        s.code.toLowerCase().includes(serviceSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [activeCategory, serviceSearch]);

  const summary = useMemo(() => {
    const gross = selectedServices.reduce(
      (sum, item) => sum + item.rate * item.qty,
      0,
    );
    const coPayAmount = (gross * coPayPercent) / 100;
    const netAmount = gross - discount;
    const patientPayable = panelGroup === "GENERAL" ? netAmount : coPayAmount;
    const panelPayable = panelGroup === "GENERAL" ? 0 : netAmount - coPayAmount;
    const received = typeof receivedAmount === "number" ? receivedAmount : 0;
    const change = received > patientPayable ? received - patientPayable : 0;
    const balance =
      patientPayable - received > 0 ? patientPayable - received : 0;
    return {
      gross,
      discount,
      coPayAmount,
      netAmount,
      patientPayable,
      panelPayable,
      change,
      balance,
    };
  }, [selectedServices, discount, coPayPercent, panelGroup, receivedAmount]);

  const handleToggleService = (service: any, isSelected: boolean) => {
    if (isSelected) {
      setSelectedServices((prev) =>
        prev.filter((s) => s.code !== service.code),
      );
    } else {
      setSelectedServices((prev) => [
        ...prev,
        { ...service, qty: 1, uid: Math.random().toString(36).substring(2, 9) },
      ]);
    }
  };

  const updateQty = (uid: string, delta: number) => {
    setSelectedServices((prev) =>
      prev.map((s) =>
        s.uid === uid ? { ...s, qty: Math.max(1, s.qty + delta) } : s,
      ),
    );
  };

  const removeService = (uid: string) => {
    setSelectedServices((prev) => prev.filter((s) => s.uid !== uid));
  };

  // --- Submit ---
  // --- Submit Handler (Frontend Payload Cleaned) ---
  const handleGenerateBill = async () => {
    if (!selectedPatient) {
      alert("Please select a patient");
      return;
    }
    if (selectedServices.length === 0) {
      alert("Please select at least one service");
      return;
    }

    try {
      setSubmitting(true);

      // Clean payload without 'taxAmount' or extra keys

      const payload: any = {
        patientId: selectedPatient.id,
        appointmentId: selectedAppointmentId || undefined,
        items: selectedServices.map((s) => ({
          code: s.code || undefined,
          description: s.name,
          category: s.category || "Consultation",
          quantity: Number(s.qty) || 1,
          unitPrice: Number(s.rate) || 0,
        })),
        discountAmount: Number(discount) || 0,
        discountPercent: 0,
        isInsurance: panelGroup !== "GENERAL",
        insuranceProvider: panelName || undefined,
        notes: remarks || undefined,
      };

      if (typeof receivedAmount === "number" && receivedAmount > 0) {
        payload.paymentAmount = receivedAmount;
        payload.paymentMode = paymentMode;
      }

      await billingService.createBill(payload);
      onSuccess();
    } catch (e: any) {
      alert(e.message || "Failed to create bill");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 -mx-4 -my-4 p-4">
      {/* HEADER */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-start gap-3">
          <button
            onClick={onClose}
            className="mt-1 p-1.5 rounded-md hover:bg-slate-200 text-slate-600"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              OPD Service Booking & Billing
            </h1>
            <p className="text-sm text-slate-500">
              Search patient, select panel, add services and generate bill
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* ROW 1: PATIENT */}
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr_250px] gap-4">
          {/* Search Patient */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 mb-3">
              Search Patient
            </h2>
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="UHID, Name, Mobile..."
                  className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchResults(e.target.value.length > 0);
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setShowSearchResults(false);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                )}
              </div>
              <button className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded text-sm font-medium">
                Search
              </button>

              {showSearchResults && filteredPatientResults.length > 0 && (
                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded shadow-lg z-20 max-h-80 overflow-auto">
                  {filteredPatientResults.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 hover:bg-brand-50 cursor-pointer flex items-center gap-3 border-b border-slate-100 last:border-b-0"
                      onClick={() => handleSelectPatient(p)}
                    >
                      <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold">
                        {p.firstName?.[0]}
                        {p.lastName?.[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {p.firstName} {p.lastName}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {p.uhid} | {p.mobile}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Patient Details */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm relative">
            <div className="absolute top-4 right-4">
              <button className="flex items-center gap-1 text-slate-600 border border-slate-300 px-3 py-1 rounded text-xs hover:bg-slate-50">
                <Edit className="w-3 h-3" /> Edit
              </button>
            </div>
            <h2 className="text-sm font-bold text-slate-800 mb-4">
              Patient Details
            </h2>

            {selectedPatient ? (
              <div className="flex gap-6">
                <div className="w-16 h-16 rounded-full bg-brand-600 text-white flex items-center justify-center text-xl font-bold shrink-0 mt-1">
                  {selectedPatient.firstName?.[0]}
                  {selectedPatient.lastName?.[0]}
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm flex-1">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {selectedPatient.firstName} {selectedPatient.lastName}
                    </h3>
                    <p className="text-slate-500 text-xs mb-2">
                      {selectedPatient.uhid}
                    </p>
                    <div className="flex items-center gap-1 text-slate-600 text-xs">
                      <User className="w-3 h-3" />
                      {selectedPatient.gender === "MALE"
                        ? "Male"
                        : "Female"} |{" "}
                      {calculateAge(selectedPatient.dateOfBirth)} Yrs
                    </div>
                    <div className="flex items-center gap-1 text-slate-600 mt-1 text-xs">
                      📞 {selectedPatient.mobile}
                    </div>
                    {selectedPatient.email && (
                      <div className="flex items-center gap-1 text-slate-600 mt-1 text-xs">
                        ✉️ {selectedPatient.email}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <InfoRow
                      label="Address"
                      value={selectedPatient.address || "-"}
                    />
                    <InfoRow
                      label="National ID"
                      value={
                        selectedPatient.aadhaarNumber ||
                        selectedPatient.abhaId ||
                        "-"
                      }
                    />
                    <InfoRow label="UHID" value={selectedPatient.uhid} />
                    <InfoRow
                      label="Mobile"
                      value={selectedPatient.mobile || "-"}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-24 text-slate-400 text-sm">
                Please search and select a patient
              </div>
            )}
          </div>

          {/* Patient Image */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col items-center justify-center">
            <h2 className="text-sm font-bold text-slate-800 w-full text-left mb-2">
              Patient Image
            </h2>
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-400">
              <User className="w-8 h-8" />
            </div>
            <button className="text-brand-600 text-xs font-medium border border-brand-200 px-3 py-1.5 rounded bg-brand-50 hover:bg-brand-100">
              Change Image
            </button>
          </div>
        </div>

        {/* ROW 2: PANEL / INSURANCE */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 mb-3">
            Panel / Insurance Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4">
            <SelectField
              label="Panel Group *"
              value={panelGroup}
              onChange={setPanelGroup}
              options={["GENERAL", "INSURANCE", "CORPORATE"]}
            />
            <SelectField
              label="Panel *"
              value={panelName}
              onChange={setPanelName}
              options={[
                "",
                "Arogya Health Insurance",
                "TCS Corporate",
                "Star Health",
              ]}
            />
            <SelectField
              label="Referral Type *"
              value={referralType}
              onChange={setReferralType}
              options={["Walk-In", "Doctor Referral", "Hospital Referral"]}
            />
            <SelectField
              label="Referring Doctor"
              value={referralDoctor}
              onChange={setReferralDoctor}
              options={["", "Dr. Smith", "City Hospital"]}
            />
            <SelectField
              label="Clinic/Department *"
              value={department}
              onChange={setDepartment}
              options={["", "Medicine", "Cardiology", "Pathology", "Radiology"]}
            />
            <SelectField
              label="Doctor *"
              value={doctorId}
              onChange={setDoctorId}
              options={[
                { value: "", label: "Select" },
                ...allDoctors.map((d) => ({
                  value: d.id,
                  label: `Dr. ${d.firstName} ${d.lastName || ""}`.trim(),
                })),
              ]}
            />
          </div>
        </div>

        {/* ROW 3: SERVICES + CART + SUMMARY */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Services */}
          <div className="lg:col-span-5 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-[550px]">
            <div className="p-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800 mb-3">
                Search Items / Services
              </h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "px-3 py-1 rounded text-xs font-medium transition-colors border",
                      activeCategory === cat
                        ? "bg-emerald-700 text-white border-emerald-700"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search service / item / code..."
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:border-brand-500"
                  />
                </div>
                <button className="bg-brand-600 text-white px-4 py-1.5 rounded text-xs font-medium hover:bg-brand-700">
                  Search
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-slate-600 w-10 text-center">
                      Select
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-600">
                      Item Code
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-600">
                      Service Name
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-600 hidden md:table-cell">
                      Category
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-600 hidden xl:table-cell">
                      Department
                    </th>
                    <th className="px-3 py-2 font-semibold text-slate-600 text-right">
                      Rate (₹)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredServices.map((service) => {
                    const isSelected = selectedServices.some(
                      (s) => s.code === service.code,
                    );
                    return (
                      <tr key={service.code} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 rounded border-slate-300 text-brand-600 cursor-pointer"
                            checked={isSelected}
                            onChange={() =>
                              handleToggleService(service, isSelected)
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {service.code}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {service.name}
                        </td>
                        <td className="px-3 py-2 text-slate-500 hidden md:table-cell">
                          {service.category}
                        </td>
                        <td className="px-3 py-2 text-slate-500 hidden xl:table-cell">
                          {service.dept}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {service.rate.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cart */}
          <div className="lg:col-span-4 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-[550px]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-800">
                Selected Services ({selectedServices.length})
              </h2>
              {selectedServices.length > 0 && (
                <button
                  onClick={() => setSelectedServices([])}
                  className="text-brand-600 text-xs font-medium hover:underline"
                >
                  Remove All
                </button>
              )}
            </div>

            <div className="flex-1 overflow-auto bg-slate-50/30">
              {selectedServices.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <FileText className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">No services selected</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-slate-600 w-8">
                        #
                      </th>
                      <th className="px-3 py-2 font-semibold text-slate-600">
                        Service Name
                      </th>
                      <th className="px-2 py-2 font-semibold text-slate-600 text-right">
                        Rate
                      </th>
                      <th className="px-2 py-2 font-semibold text-slate-600 text-center w-24">
                        Qty
                      </th>
                      <th className="px-3 py-2 font-semibold text-slate-600 text-right">
                        Amount
                      </th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {selectedServices.map((item, idx) => (
                      <tr key={item.uid}>
                        <td className="px-3 py-3 text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-3 font-medium text-slate-800">
                          {item.name}
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {item.dept}
                          </div>
                        </td>
                        <td className="px-2 py-3 text-right text-slate-600">
                          {item.rate.toFixed(2)}
                        </td>
                        <td className="px-2 py-3 text-center">
                          <div className="flex items-center justify-center gap-1 border border-slate-200 rounded px-1 py-0.5">
                            <button
                              onClick={() => updateQty(item.uid, -1)}
                              className="text-slate-400 hover:text-slate-700 p-0.5"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-4 text-center font-medium">
                              {item.qty}
                            </span>
                            <button
                              onClick={() => updateQty(item.uid, 1)}
                              className="text-slate-400 hover:text-slate-700 p-0.5"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-800">
                          {(item.rate * item.qty).toFixed(2)}
                        </td>
                        <td className="px-2 py-3 text-center">
                          <button
                            onClick={() => removeService(item.uid)}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50 text-xs font-medium text-slate-600">
              Total Items : {selectedServices.length}
            </div>
          </div>

          {/* Summary */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="text-sm font-bold text-slate-800">
                  Billing Summary
                </h2>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </div>
              <div className="p-4 space-y-3 text-sm">
                <SummaryRow
                  label="Gross Amount"
                  value={formatMoney(summary.gross)}
                />
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Discount</span>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                    className="w-20 text-right text-sm font-semibold border border-slate-200 rounded px-2 py-0.5"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Co-Pay %</span>
                  <input
                    type="number"
                    value={coPayPercent}
                    onChange={(e) =>
                      setCoPayPercent(Number(e.target.value) || 0)
                    }
                    className="w-20 text-right text-sm font-semibold border border-slate-200 rounded px-2 py-0.5"
                  />
                </div>
                <SummaryRow
                  label="Co-Pay Amount"
                  value={formatMoney(summary.coPayAmount)}
                />
                <SummaryRow
                  label="Patient Payable"
                  value={formatMoney(summary.patientPayable)}
                />
                <SummaryRow
                  label="Panel Payable"
                  value={formatMoney(summary.panelPayable)}
                />
              </div>
              <div className="bg-emerald-50 px-4 py-3 flex justify-between items-center border-t border-emerald-100">
                <span className="font-bold text-emerald-800 text-sm">
                  Net Amount
                </span>
                <span className="font-bold text-emerald-700 text-lg">
                  {formatMoney(summary.netAmount)}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="UPI">UPI</option>
                  <option value="ONLINE">Online</option>
                  <option value="INSURANCE">Insurance</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  <span className="text-red-500">* </span>Received Amount
                </label>
                <input
                  type="number"
                  value={receivedAmount}
                  onChange={(e) =>
                    setReceivedAmount(
                      e.target.value ? Number(e.target.value) : "",
                    )
                  }
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-500 font-medium"
                  placeholder="0.00"
                />
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-slate-700">
                  Change Amount
                </span>
                <span className="font-bold text-slate-900">
                  {formatMoney(summary.change)}
                </span>
              </div>
              {summary.balance > 0 && (
                <div className="flex justify-between items-center text-sm bg-coral-50 -mx-4 px-4 py-2">
                  <span className="font-medium text-coral-700">
                    Balance Due
                  </span>
                  <span className="font-bold text-coral-700">
                    {formatMoney(summary.balance)}
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-2 mt-2">
                <button className="w-full bg-white border border-slate-300 text-slate-700 py-2 rounded text-sm font-semibold hover:bg-slate-50">
                  Save Bill Draft
                </button>
                <button
                  onClick={handleGenerateBill}
                  disabled={
                    submitting ||
                    !selectedPatient ||
                    selectedServices.length === 0
                  }
                  className="w-full bg-emerald-700 text-white py-2.5 rounded text-sm font-semibold shadow-sm hover:bg-emerald-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  Generate Bill
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 4: ADDITIONAL DETAILS */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3 text-slate-800">
            <ChevronDown className="w-4 h-4" />
            <h2 className="text-sm font-bold">Additional Details</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Visit No.
              </label>
              <input
                type="text"
                value={
                  selectedAppointmentId
                    ? `APT-${selectedAppointmentId.slice(0, 8)}`
                    : ""
                }
                readOnly
                placeholder="Auto-generated"
                className="w-full border border-slate-200 rounded px-3 py-1.5 text-sm bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Service Type
              </label>
              <input
                type="text"
                value="OPD"
                readOnly
                className="w-full border border-slate-200 rounded px-3 py-1.5 text-sm bg-slate-50"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-500 mb-1">
                Remarks
              </label>
              <input
                type="text"
                placeholder="Enter remarks..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
              >
                <option>INR</option>
                <option>USD</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Micro Components ---
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  options: (string | { value: string; label: string })[];
}) {
  return (
    <div className="flex flex-col">
      <label className="block text-xs font-semibold text-slate-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <select
          className="w-full border border-slate-300 rounded appearance-none focus:outline-none focus:border-brand-500 bg-white py-2 px-3 text-sm"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        >
          {options.map((opt) => {
            const o =
              typeof opt === "string"
                ? { value: opt, label: opt || "Select" }
                : opt;
            return (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            );
          })}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[90px_1fr] text-slate-600">
      <span className="font-medium">{label}</span>
      <span className="truncate" title={value}>
        {value}
      </span>
    </div>
  );
}
