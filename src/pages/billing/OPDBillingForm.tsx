import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  Printer,
  RefreshCw,
} from "lucide-react";
import { billingService } from "@/pages/billing/billing.service";
import { OpdReceiptSheet } from "@/pages/billing/OpdReceiptSheet";
import { Dialog } from "@/components/ui/overlays";
import { useAppDispatch } from "@/store/hooks";
import { toast } from "@/store/slices/uiSlice";
import { useDebouncedValue } from "@/hooks";
import { patientService } from "@/pages/patients/patient.service";
import { appointmentService } from "@/pages/appointments/appointment.service";
import { doctorService } from "@/pages/doctors/doctor.service";
import { masterService } from "@/pages/masterConfiguration/master.service";
import { formatMoney } from "@/utils";
import { cn } from "@/utils/cn";
import type {
  BillReceiptData,
  BillResponse,
  CreateBillItemPayload,
  CreateBillPayload,
} from "@/types/billingTypes";

/* ------------------------------- helpers ---------------------------------- */

const CATEGORIES = [
  "All",
  "Consultation",
  "Lab",
  "Radiology",
  "Procedure",
  "Pharmacy",
  "Others",
] as const;

/** Category-tab aliases — the master may store "LAB", "Pathology", "X-Ray"… */
const CATEGORY_ALIASES: Record<string, string[]> = {
  Consultation: ["CONSULTATION", "DOCTOR FEE", "OPD"],
  Lab: ["LAB", "LABORATORY", "PATHOLOGY", "DIAGNOSTIC", "INVESTIGATION"],
  Radiology: [
    "RADIOLOGY",
    "IMAGING",
    "SONOLOGY",
    "ULTRASOUND",
    "XRAY",
    "CT SCAN",
    "MRI",
    "ECHO",
  ],
  Procedure: ["PROCEDURE", "SURGERY", "OPERATION", "DRESSING"],
  Pharmacy: ["PHARMACY", "PHARMACOLOGY", "MEDICINE", "DRUG"],
};

const normText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

/** Which tab does a raw category / itemType belong to? (fallback: Others) */
const tabOfCategory = (raw: unknown): string => {
  const cat = normText(raw);
  if (!cat) return "Others";
  for (const [tab, keys] of Object.entries(CATEGORY_ALIASES)) {
    if (keys.some((k) => cat === k || cat.includes(k))) return tab;
  }
  return "Others";
};

/**
 * Backend rates travel as `number | string` ("₹1,200.00" in older rows) — every
 * amount goes through this before it reaches a calculation or the payload.
 */
const toNumber = (value: unknown): number => {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** Tolerant envelope reader — `{ data: [...] }`, `{ data: { rows } }` or array. */
const rowsOf = (res: any): any[] => {
  const body = res?.data ?? res;
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.data?.rows)) return body.data.rows;
  if (Array.isArray(body?.rows)) return body.rows;
  return [];
};

const calculateAge = (dob: string) => {
  if (!dob) return "N/A";
  const diff = Date.now() - new Date(dob).getTime();
  return Math.abs(new Date(diff).getUTCFullYear() - 1970);
};

const genderLabel = (gender?: string) => {
  switch (normText(gender)) {
    case "MALE":
      return "Male";
    case "FEMALE":
      return "Female";
    case "OTHER":
    case "OTHERS":
      return "Other";
    default:
      return gender || "N/A";
  }
};

/** DTO mirror — patientId/panelId/doctorProfileId/serviceId must be UUIDs. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUUID = (value: unknown) => UUID_RE.test(String(value ?? ""));

/** Service-item row → the flat row this screen renders/pills into the cart. */
const normaliseServiceItem = (item: any) => {
  const categoryLabel =
    item?.categoryRel?.name || item?.category || item?.itemType || "Others";
  const departmentLabel =
    item?.departmentRel?.name ||
    item?.departmentName ||
    item?.department?.name ||
    item?.deptName ||
    "—";
  return {
    ...item,
    id: item?.id ?? item?._id ?? item?.serviceId,
    serviceCode: item?.serviceCode ?? item?.code ?? "—",
    serviceName: item?.serviceName ?? item?.name ?? "Unnamed service",
    baseRate: toNumber(item?.baseRate ?? item?.rate),
    categoryLabel,
    departmentLabel,
  };
};

/* --------------------------- payment modes (spec) -------------------------- */

/**
 * Payment Mode select — spec list. CREDIT renders as "Credit / Pay Later"
 * and forces received = 0 (the amount stays due on the generated bill).
 */
const PAYMENT_MODES: { value: string; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "CREDIT", label: "Credit / Pay Later" },
];

/* ------------------------------ cart rows ---------------------------------- */

/**
 * One row of the Selected Services table — the spec state shape.
 * `discountPercent` / `discountAmount` are optional per-line discounts.
 */
interface CartRow {
  serviceId: string;
  serviceName: string;
  itemCode: string;
  category: string;
  quantity: number;
  unitRate: number;
  discountPercent?: number;
  discountAmount?: number;
}

const isConsultationCategory = (raw: unknown) =>
  tabOfCategory(raw) === "Consultation";

/** `Dr. First Last` — the selected-doctor display name. */
const doctorLabelOf = (doctor: any) =>
  `Dr. ${String(doctor?.firstName ?? "").trim()} ${String(
    doctor?.lastName ?? "",
  )
    .trim()}`.replace(/\s+/g, " ").trim();

/* ------------------------------ panel groups ------------------------------- */

type PanelGroup = "GENERAL" | "INSURANCE" | "CORPORATE";

/** Cascade helper — which Panel Group a panel master row belongs to. */
const groupOfPanel = (panel: any): PanelGroup => {
  const text = normText(
    `${panel?.groupType?.value ?? ""} ${panel?.panelType?.value ?? ""}`,
  );
  if (text.includes("INSUR") || text.includes("TPA")) return "INSURANCE";
  if (text.includes("GEN")) return "GENERAL";
  return "CORPORATE";
};

/* --------------------------------- drafts ---------------------------------- */

/**
 * Per-patient draft key — `opd-bill-draft:{patientId}:{panelId}`
 * ("null" = GENERAL / Cash). No server round-trip: save/restore/clear are
 * pure localStorage operations, and the draft is auto-cleared after a bill
 * is generated.
 */
const draftKeyOf = (patientId: unknown, panel: string) =>
  `opd-bill-draft:${patientId ?? "none"}:${panel || "null"}`;

/* --------------------------------- props ----------------------------------- */

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

/* ------------------------------ derived totals ----------------------------- */

interface BillingTotals {
  gross: number;
  lineDiscounts: number;
  discountAmount: number;
  netAmount: number;
  coPayPercent: number;
  coPayAmount: number;
  patientPayable: number;
  panelPayable: number;
  received: number;
  change: number;
  balance: number;
}

/** service-catalogue rows rendered at a time (grows by this much on "show more") */
const SERVICE_PAGE = 50;

export function OPDBillingForm({ onClose, onSuccess }: Props) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlAppointmentId = searchParams.get("appointment");
  const urlPatientId = searchParams.get("patient");

  /** Exactly-one-request-per-click guard (state alone can lag a double click). */
  const submitLock = useRef(false);
  /** Bumped per patient selection so stale async record fetches never patch
   *  the state of a patient selected afterwards. */
  const patientSeqRef = useRef(0);

  /* ---------------------------- patient search ---------------------------- */
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [serverPatients, setServerPatients] = useState<any[]>([]);
  const [patientSearching, setPatientSearching] = useState(false);
  /** bumped by the "Search" button so the query fires without the debounce */
  const [searchNonce, setSearchNonce] = useState(0);

  /* ------------------------------ appointments ---------------------------- */
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>(
    urlAppointmentId || "",
  );

  /**
   * The collections this counter screen needs: patient picker, visit
   * reference, doctor referral list (feature services) plus the hospital
   * masters this screen is wired to (service catalogue, panels).
   */
  const [allPatients, setAllPatients] = useState<any[]>([]);
  const [allDoctors, setAllDoctors] = useState<any[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [doctorsLoading, setDoctorsLoading] = useState(true);

  /** Service catalogue — GET /api/hospital/masters/service-items?isActive=true */
  const [serviceCatalog, setServiceCatalog] = useState<any[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  /** Panels — GET /api/hospital/masters/panels (GENERAL / Cash stays default). */
  const [panels, setPanels] = useState<any[]>([]);
  const [panelsLoading, setPanelsLoading] = useState(true);

  /* --------------------------- panel / insurance -------------------------- */
  const [panelGroup, setPanelGroup] = useState<PanelGroup>("GENERAL");
  /** "" = GENERAL / Cash (payload panelId null) */
  const [panelId, setPanelId] = useState<string>("");
  const [referralType, setReferralType] = useState("Walk-In");
  const [referralDoctor, setReferralDoctor] = useState("");
  const [department, setDepartment] = useState("");
  const [doctorId, setDoctorId] = useState("");

  /* -------------------------------- services ------------------------------ */
  const [activeCategory, setActiveCategory] = useState("All");
  const [serviceSearch, setServiceSearch] = useState("");
  // The catalogue can hold thousands of services; the table renders a page of
  // them and grows on demand, so the DOM (and every re-render of this large
  // form) stays small. A new search / category starts over.
  const [serviceLimit, setServiceLimit] = useState(SERVICE_PAGE);
  /** Spec state shape — see CartRow. */
  const [selectedServices, setSelectedServices] = useState<CartRow[]>([]);
  /** Rows to highlight after a line-level 400 (OPD_BIL_019 / validation). */
  const [rowError, setRowError] = useState<
    { all: boolean; serviceIds: string[] } | null
  >(null);

  /* -------------------------------- payment ------------------------------- */
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [receivedAmount, setReceivedAmount] = useState<number | "">("");
  const [paymentTransactionId, setPaymentTransactionId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"FLAT" | "PERCENT">("FLAT");
  const [coPayPercent, setCoPayPercent] = useState(0);

  /* ------------------------------- additional ----------------------------- */
  const [visitNo, setVisitNo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [currency, setCurrency] = useState("INR");

  /* -------------------------------- UI state ------------------------------ */
  const [submitting, setSubmitting] = useState(false);
  /** printable receipt payload — GET /api/opd/billing/:billId/receipt */
  const [receipt, setReceipt] = useState<BillReceiptData | null>(null);
  /** bill confirmed by the server — re-renders the summary + line rates */
  const [postedBill, setPostedBill] = useState<BillResponse | null>(null);
  /** subtle note shown when the server changed any line rate */
  const [ratesNote, setRatesNote] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  /** 409 OPD_BIL_003 — the appointment already has a bill */
  const [duplicateBill, setDuplicateBill] = useState<{
    billNo: string | null;
  } | null>(null);
  const [resolvingDuplicate, setResolvingDuplicate] = useState(false);
  /** booked consultation fee waiting for the catalogue to arrive */
  const [pendingConsultation, setPendingConsultation] = useState<{
    fee: number;
  } | null>(null);

  /* ------------------------------- loaders -------------------------------- */

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const res = await masterService.fetchServiceItems({ isActive: true });
      setServiceCatalog(rowsOf(res).map(normaliseServiceItem));
    } catch (e: any) {
      setCatalogError(e?.message || "Could not load the service catalogue");
      dispatch(
        toast.error("Could not load services", e?.message || "Please retry."),
      );
    } finally {
      setCatalogLoading(false);
    }
  }, [dispatch]);

  const loadPanels = useCallback(async () => {
    setPanelsLoading(true);
    try {
      const res = await masterService.fetchPanels({ limit: 100 });
      setPanels(rowsOf(res).filter((p: any) => p?.isActive !== false));
    } catch (e: any) {
      setPanels([]);
      dispatch(
        toast.error(
          "Could not load panels",
          e?.message || "Billing continues as GENERAL / Cash.",
        ),
      );
    } finally {
      setPanelsLoading(false);
    }
  }, [dispatch]);

  /** Patients and doctors — loaded once for the counter (appointment/patient
   *  deep-links fetch their own record by id, they never wait on a list). */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // the backend caps `limit` at 100 — the search box narrows further
        const response = await patientService.fetchPatients({ limit: 100 });
        if (active && response.status === 200) {
          setAllPatients(response.data?.data ?? []);
        }
      } catch (e: any) {
        dispatch(toast.error("Could not load patients", e?.message));
      } finally {
        if (active) setPatientsLoading(false);
      }
      try {
        const response = await doctorService.fetchDoctors({ limit: 100 });
        if (active && response.status === 200) {
          const rows: any[] = response.data?.data ?? [];
          // active doctors only — a disabled profile must not be billable
          setAllDoctors(rows.filter((d: any) => d?.isActive !== false));
        }
      } catch (e: any) {
        dispatch(toast.error("Could not load doctors", e?.message));
      } finally {
        if (active) setDoctorsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [dispatch]);

  useEffect(() => {
    loadCatalog();
    loadPanels();
  }, [loadCatalog, loadPanels]);

  /* ----------------------------- patient search --------------------------- */

  /**
   * Debounced server-side search (`GET /api/opd/patients?search=`) — the counter
   * never pulls the whole patient table, and the locally loaded page stays a
   * fallback so typing never blocks on the network. The "Search" button bumps
   * `searchNonce` to fire immediately.
   */
  const debouncedPatientQuery = useDebouncedValue(searchQuery.trim(), 300);

  useEffect(() => {
    let active = true;
    (async () => {
      const query = searchQuery.trim();
      if (!query) {
        setServerPatients([]);
        return;
      }
      try {
        setPatientSearching(true);
        const response = await patientService.fetchPatients({
          search: query,
          limit: 8,
        });
        if (active && response.status === 200) {
          setServerPatients(response.data?.data ?? []);
        }
      } catch (e: any) {
        if (active) {
          setServerPatients([]);
          dispatch(toast.error("Could not search patients", e?.message));
        }
      } finally {
        if (active) setPatientSearching(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedPatientQuery, searchNonce]);

  const filteredPatientResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    const local = allPatients.filter(
      (p) =>
        p.uhid?.toLowerCase().includes(q) ||
        p.firstName?.toLowerCase().includes(q) ||
        p.lastName?.toLowerCase().includes(q) ||
        p.mobile?.includes(q),
    );
    const seen = new Set<string>();
    return [...local, ...serverPatients]
      .filter((p) => {
        const key = String(p.id ?? p.uhid ?? "");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 8);
  }, [searchQuery, allPatients, serverPatients]);

  /* --------------------------------- lists -------------------------------- */

  /**
   * Panel cascading dropdown — Panel Group narrows the Panel list;
   * "GENERAL / Cash" (value "") maps to `panelId: null` in the payload.
   * The current selection is always kept visible even if its group drifts.
   */
  const panelOptions = useMemo(() => {
    const header =
      panelGroup === "GENERAL"
        ? { value: "", label: "GENERAL / Cash" }
        : {
            value: "",
            label: panelsLoading ? "Loading panels…" : "Select panel",
          };
    const matched = panels.filter((p: any) => groupOfPanel(p) === panelGroup);
    const current = panels.find((p: any) => String(p.id) === panelId);
    const options = [header, ...matched.map((p: any) => ({
      value: String(p.id),
      label: p.panelName || p.panelCode || p.id,
    }))];
    if (current && !matched.some((p: any) => String(p.id) === panelId)) {
      options.push({
        value: String(current.id),
        label: current.panelName || current.panelCode || current.id,
      });
    }
    return options;
  }, [panels, panelsLoading, panelGroup, panelId]);

  const doctorOptions = useMemo(
    () => [
      {
        value: "",
        label: doctorsLoading ? "Loading doctors…" : "Select",
      },
      ...allDoctors.map((d: any) => ({
        value: String(d.id),
        label: doctorLabelOf(d),
      })),
    ],
    [allDoctors, doctorsLoading],
  );

  const selectedDoctor = useMemo(
    () => allDoctors.find((d: any) => String(d.id) === String(doctorId)) ?? null,
    [allDoctors, doctorId],
  );

  // typing stays instant; the catalogue re-filters at lower priority
  const deferredServiceSearch = useDeferredValue(serviceSearch);
  const filteredServices = useMemo(() => {
    const q = deferredServiceSearch.trim().toLowerCase();
    return serviceCatalog.filter((s) => {
      const matchCat =
        activeCategory === "All" ||
        tabOfCategory(s.categoryLabel) === activeCategory;
      const matchSearch =
        !q ||
        String(s.serviceName).toLowerCase().includes(q) ||
        String(s.serviceCode).toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [serviceCatalog, activeCategory, deferredServiceSearch]);

  useEffect(() => {
    setServiceLimit(SERVICE_PAGE);
  }, [activeCategory, deferredServiceSearch]);

  /* -------------------------------- summary ------------------------------- */

  const isPanelBilling = Boolean(panelId);
  const isCredit = paymentMode === "CREDIT";

  /**
   * Derived, display-only totals (the backend recomputes and wins):
   *   gross          = Σ (quantity × unitRate)
   *   netAmount      = gross − lineDiscounts − billDiscount (+ tax, OPD = 0)
   *   patientPayable = net for cash · co-pay share for panel patients
   *   change         = max(0, received − net)
   */
  const summary: BillingTotals = useMemo(() => {
    const gross = round2(
      selectedServices.reduce(
        (sum, item) =>
          sum + toNumber(item.unitRate) * Math.max(1, Math.floor(toNumber(item.quantity) || 1)),
        0,
      ),
    );
    const lineDiscounts = round2(
      selectedServices.reduce(
        (sum, item) => sum + toNumber(item.discountAmount || 0),
        0,
      ),
    );
    const maxDiscount = Math.max(0, round2(gross - lineDiscounts));
    const rawDiscount =
      discountType === "PERCENT"
        ? (gross * clamp(discount, 0, 100)) / 100
        : clamp(discount, 0, maxDiscount);
    const discountAmount = round2(Math.min(rawDiscount, maxDiscount));
    const netAmount = round2(maxDiscount - discountAmount);

    // Co-pay applies only to panel patients; the patient owes the co-pay
    // share and the panel is billed the coverage portion.
    const coPayPct = isPanelBilling ? clamp(coPayPercent, 0, 100) : 0;
    const coPayAmount = isPanelBilling
      ? round2((netAmount * coPayPct) / 100)
      : 0;
    const patientPayable = isPanelBilling ? coPayAmount : netAmount;
    const panelPayable = isPanelBilling ? round2(netAmount - coPayAmount) : 0;

    const received =
      typeof receivedAmount === "number" ? round2(receivedAmount) : 0;
    const change = Math.max(0, round2(received - netAmount));
    const balance = Math.max(0, round2(netAmount - received));

    return {
      gross,
      lineDiscounts,
      discountAmount,
      netAmount,
      coPayPercent: coPayPct,
      coPayAmount,
      patientPayable,
      panelPayable,
      received,
      change,
      balance,
    };
  }, [
    selectedServices,
    discount,
    discountType,
    coPayPercent,
    isPanelBilling,
    receivedAmount,
  ]);

  /**
   * After a successful POST the response is the source of truth: totals and
   * line rates are replaced by the server's (panel tariff / doctor fee /
   * base-rate hierarchy) and the summary re-renders from the bill header —
   * including the server-derived patient/panel payable split.
   */
  const displayTotals: BillingTotals = useMemo(() => {
    if (!postedBill) return summary;
    const items = postedBill.items ?? [];
    return {
      gross: round2(toNumber(postedBill.grossAmount)),
      lineDiscounts: round2(
        items.reduce((sum, it) => sum + toNumber(it.discountAmount), 0),
      ),
      discountAmount: round2(toNumber(postedBill.discountAmount)),
      netAmount: round2(toNumber(postedBill.netAmount)),
      coPayPercent: round2(toNumber(postedBill.coPayPercent)),
      coPayAmount: round2(toNumber(postedBill.coPayAmount)),
      patientPayable: round2(
        toNumber(postedBill.patientPayable ?? postedBill.netAmount),
      ),
      panelPayable: round2(toNumber(postedBill.panelPayable ?? 0)),
      received: round2(toNumber(postedBill.paidAmount)),
      change: round2(toNumber(postedBill.changeAmount)),
      balance: round2(toNumber(postedBill.dueAmount)),
    };
  }, [postedBill, summary]);

  /**
   * Gate before enabling Generate Bill — CASH/UPI/CARD must tender at least
   * the patient payable (co-pay share for panel patients). CREDIT is exempt:
   * it forces received = 0 and leaves the amount due.
   */
  const paymentError = useMemo(() => {
    if (postedBill || isCredit) return null;
    const received = typeof receivedAmount === "number" ? receivedAmount : 0;
    if (received + 0.001 < summary.patientPayable) {
      return `Received amount must be at least the patient payable (${formatMoney(
        summary.patientPayable,
      )}).`;
    }
    return null;
  }, [postedBill, isCredit, receivedAmount, summary.patientPayable]);

  /* --------------------------- consultation lines -------------------------- */

  /** Catalogue row used as the consultation service (first match). */
  const consultationService = () =>
    serviceCatalog.find((s: any) =>
      isConsultationCategory(s.categoryLabel),
    ) ?? null;

  /**
   * Consultation row under the selected doctor:
   * `${serviceName} - ${selectedDoctorName}`, priced at the doctor's fee
   * when available (server-side hierarchy: panel tariff > doctor fee > base).
   */
  const buildConsultationRow = (
    service: any,
    doctor: any,
    feeOverride?: number,
  ): CartRow => {
    const fee =
      feeOverride !== undefined ? feeOverride : toNumber(doctor?.consultationFee);
    return {
      serviceId: String(service.id),
      serviceName: doctor
        ? `${service.serviceName} - ${doctorLabelOf(doctor)}`
        : service.serviceName,
      itemCode: service.serviceCode ?? "—",
      category: service.categoryLabel ?? "Consultation",
      quantity: 1,
      unitRate: Math.max(0, round2(fee > 0 ? fee : toNumber(service.baseRate))),
    };
  };

  /**
   * Keep the existing consultation cart line in step with the doctor
   * (rename + re-price). Adds the line only when `addWhenMissing` is set —
   * ticking the checkbox is what adds services for the counter flow, while
   * the appointment deep-link auto-books the consultation.
   */
  const syncConsultationLine = (
    doctor: any,
    opts: { addWhenMissing?: boolean; fee?: number; service?: any } = {},
  ): boolean => {
    const service = opts.service ?? consultationService();
    if (!service) return false; // catalogue still in flight
    const next = buildConsultationRow(service, doctor, opts.fee);
    setSelectedServices((prev) => {
      const idx = prev.findIndex((row) =>
        isConsultationCategory(row.category),
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          serviceName: next.serviceName,
          unitRate: next.unitRate,
        };
        return copy;
      }
      return opts.addWhenMissing ? [...prev, next] : prev;
    });
    return true;
  };

  /* ------------------------------- handlers ------------------------------- */

  const handleSelectPatient = (patient: any) => {
    patientSeqRef.current += 1; // invalidate any in-flight full-record fetch
    // Spec: changing the patient clears the selected panel, doctor, services,
    // discount and payment fields — nothing from the previous patient leaks.
    setSelectedServices([]);
    setDoctorId("");
    setDepartment("");
    setDiscount(0);
    setDiscountType("FLAT");
    setCoPayPercent(0);
    setPaymentMode("CASH");
    setReceivedAmount("");
    setPaymentTransactionId("");
    setRowError(null);
    setPostedBill(null);
    setRatesNote(null);
    setPendingConsultation(null);

    setSelectedPatient(patient);
    setShowSearchResults(false);
    setSearchQuery("");
    setServerPatients([]);

    // The patient's own panel is derived from the NEW record (embedded columns
    // first, full record below) — never carried over from the previous patient.
    const applyPanel = (panel: any) => {
      const id = panel?.id ?? panel?.panelId ?? null;
      if (id) {
        setPanelId(String(id));
        setPanelGroup(groupOfPanel(panel));
      } else {
        setPanelId("");
        setPanelGroup("GENERAL");
      }
    };
    applyPanel(patient?.panel ?? patient);

    // A patient embedded in an appointment carries only a few columns — fetch
    // the full record once so the details card (DOB, address, allergies,
    // chronic diseases) and the panel auto-fill are complete.
    if (patient?.id && !patient?.dateOfBirth && !patient?.address) {
      const seq = patientSeqRef.current; // the fetch only applies if still current
      patientService
        .fetchPatientById(patient.id)
        .then((res: any) => {
          const full = res.data?.data ?? res.data;
          if (!full?.id || patientSeqRef.current !== seq) return;
          setSelectedPatient(full);
          applyPanel(full.panel ?? full);
        })
        .catch(() => {
          /* the embedded record stays on screen — nothing else breaks */
        });
    }
  };

  /** Cascade: switching the group clears the panel ("GENERAL / Cash" → null). */
  const handlePanelGroupChange = (value: string) => {
    const group = (value === "INSURANCE" || value === "CORPORATE"
      ? value
      : "GENERAL") as PanelGroup;
    setPanelGroup(group);
    setPanelId("");
    setCoPayPercent(0);
  };

  const handlePanelChange = (value: string) => {
    setPanelId(value);
    const panel = panels.find((p: any) => String(p.id) === value);
    if (panel) {
      setPanelGroup(groupOfPanel(panel));
      // panel master carries the co-pay share — pre-fill it for the cashier
      setCoPayPercent(clamp(toNumber(panel?.coPaymentPercent), 0, 100));
    } else {
      setCoPayPercent(0);
    }
  };

  const selectAppointment = (apt: any) => {
    setSelectedAppointmentId(apt.id);
    setVisitNo(
      (prev) =>
        prev || apt.appointmentNo || apt.code || `APT-${String(apt.id).slice(0, 8)}`,
    );

    // Auto-select patient (the embedded record renders instantly; the full
    // record is loaded right after by handleSelectPatient)
    if (apt.patient) handleSelectPatient(apt.patient);

    // Auto-select doctor
    if (apt.doctor) {
      setDoctorId(String(apt.doctor.id));
      setDepartment(apt.doctor.specialization || "");
    }

    // "Collect Payment" — the booked fee wins over the catalogue base rate
    // (e.g. appointment ₹500 vs generic item ₹400). The catalogue may still be
    // loading, so the item is queued and added the moment it arrives.
    const fee =
      toNumber(apt.consultationFee) || toNumber(apt.doctor?.consultationFee);
    if (!syncConsultationLine(apt.doctor, {
      addWhenMissing: true,
      fee: fee || undefined,
    })) {
      setPendingConsultation({ fee });
    }
    setReceivedAmount(fee || "");
  };

  /**
   * Doctor dropdown — an already-added consultation line follows the selected
   * doctor (`${serviceName} - Dr. …`, priced at the doctor's fee). An empty
   * received amount is pre-filled so the counter can bill in one click.
   * The line is NOT auto-added here — ticking the checkbox adds it.
   */
  const handleDoctorChange = (value: string) => {
    setDoctorId(value);
    const doctor = allDoctors.find((d: any) => String(d.id) === String(value));
    syncConsultationLine(doctor, { addWhenMissing: false });
    const fee = toNumber(doctor?.consultationFee);
    if (doctor && fee > 0) {
      setReceivedAmount((prev) =>
        prev === "" || toNumber(prev) === 0 ? fee : prev,
      );
    }
  };

  /** Pending consultation auto-add while the catalogue is still in flight. */
  useEffect(() => {
    if (!pendingConsultation || !serviceCatalog.length) return;
    if (
      syncConsultationLine(selectedDoctor, {
        addWhenMissing: true,
        fee: pendingConsultation.fee,
      })
    ) {
      setPendingConsultation(null);
      return;
    }
    // Catalogue is present but has no consultation row — never resolvable.
    if (!consultationService()) setPendingConsultation(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceCatalog, pendingConsultation, selectedDoctor]);

  /**
   * Deep-link preselection (`/billing?new=1&appointment=…&patient=…` from the
   * appointments screen): the referenced record is fetched by id, so billing
   * opens pre-filled even when the rosters are still loading or the record is
   * not on the first page of the list.
   */
  useEffect(() => {
    if (urlAppointmentId) {
      let active = true;
      (async () => {
        try {
          const res: any =
            await appointmentService.fetchAppointmentById(urlAppointmentId);
          const apt = res.data?.data ?? res.data;
          if (active && apt?.id) selectAppointment(apt);
        } catch (e: any) {
          dispatch(toast.error("Could not load the appointment", e?.message));
        }
      })();
      return () => {
        active = false;
      };
    }
    if (urlPatientId) {
      const known = allPatients.find((p: any) => p.id === urlPatientId);
      if (known) {
        handleSelectPatient(known);
        return;
      }
      let active = true;
      (async () => {
        try {
          const res: any = await patientService.fetchPatientById(urlPatientId);
          const full = res.data?.data ?? res.data;
          if (active && full?.id) handleSelectPatient(full);
        } catch (e: any) {
          dispatch(toast.error("Could not load the patient", e?.message));
        }
      })();
      return () => {
        active = false;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlAppointmentId, urlPatientId]);

  const handleToggleService = (service: any, isSelected: boolean) => {
    setRowError(null);
    if (isSelected) {
      setSelectedServices((prev) =>
        prev.filter((row) => row.serviceId !== String(service.id)),
      );
      return;
    }
    // Ticking a Consultation-category row bills under the selected doctor:
    // "${serviceName} - ${selectedDoctorName}" at the doctor's fee.
    if (isConsultationCategory(service.categoryLabel)) {
      const row = buildConsultationRow(service, selectedDoctor);
      setSelectedServices((prev) =>
        prev.some((r) => r.serviceId === row.serviceId) ? prev : [...prev, row],
      );
      const fee = toNumber(selectedDoctor?.consultationFee);
      if (selectedDoctor && fee > 0) {
        // quick counter flow: the consultation fee is usually tendered right away
        setReceivedAmount((prev) =>
          prev === "" || toNumber(prev) === 0 ? fee : prev,
        );
      }
      return;
    }
    // Checkbox select adds a row with quantity = 1 (Rate column = indicative
    // base rate — the final rate is resolved server-side).
    const row: CartRow = {
      serviceId: String(service.id),
      serviceName: service.serviceName,
      itemCode: service.serviceCode ?? "—",
      category: service.categoryLabel ?? "Others",
      quantity: 1,
      unitRate: Math.max(0, round2(toNumber(service.baseRate))),
    };
    setSelectedServices((prev) =>
      prev.some((r) => r.serviceId === row.serviceId) ? prev : [...prev, row],
    );
  };

  /** Qty stepper — min 1, integers only. */
  const updateQty = (serviceId: string, delta: number) => {
    setRowError(null);
    setSelectedServices((prev) =>
      prev.map((row) =>
        row.serviceId === serviceId
          ? {
              ...row,
              quantity: Math.max(
                1,
                Math.floor(toNumber(row.quantity) + delta),
              ),
            }
          : row,
      ),
    );
  };

  const removeService = (serviceId: string) => {
    setRowError(null);
    setSelectedServices((prev) =>
      prev.filter((row) => row.serviceId !== serviceId),
    );
  };

  /* --------------------------------- draft -------------------------------- */

  /** Draft availability follows the `opd-bill-draft:{patientId}:{panelId}` key. */
  useEffect(() => {
    if (!selectedPatient) {
      setDraftSavedAt(null);
      return;
    }
    try {
      const draft = JSON.parse(
        localStorage.getItem(draftKeyOf(selectedPatient.id, panelId)) ||
          "null",
      );
      setDraftSavedAt(draft?.savedAt ?? null);
    } catch {
      setDraftSavedAt(null);
    }
  }, [selectedPatient, panelId]);

  const handleSaveDraft = () => {
    if (!selectedPatient) {
      dispatch(toast.error("Select a patient first", "A draft needs a patient."));
      return;
    }
    const savedAt = new Date().toISOString();
    const draft = {
      savedAt,
      patientId: selectedPatient.id,
      panelId: panelId || null,
      doctorId,
      paymentMode,
      discount,
      discountType,
      coPayPercent,
      receivedAmount,
      visitNo,
      remarks,
      items: selectedServices,
    };
    try {
      localStorage.setItem(
        draftKeyOf(selectedPatient.id, panelId),
        JSON.stringify(draft),
      );
      setDraftSavedAt(savedAt);
      dispatch(
        toast.success("Bill draft saved", "Restore it below after a reload."),
      );
    } catch {
      dispatch(toast.error("Could not save draft", "Storage unavailable."));
    }
  };

  /** Re-fetch the services master so restored rows show fresh indicative rates. */
  const refreshCartFromMaster = async (doctor: any) => {
    try {
      const res = await masterService.fetchServiceItems({ isActive: true });
      const fresh = rowsOf(res).map(normaliseServiceItem);
      setServiceCatalog(fresh);
      setSelectedServices((prev) =>
        prev.map((row) => {
          const service = fresh.find(
            (s: any) => String(s.id) === row.serviceId,
          );
          if (!service) return row;
          if (isConsultationCategory(row.category)) {
            const fee = toNumber(doctor?.consultationFee);
            return {
              ...row,
              serviceName: doctor
                ? `${service.serviceName} - ${doctorLabelOf(doctor)}`
                : service.serviceName,
              itemCode: service.serviceCode ?? row.itemCode,
              unitRate: Math.max(
                0,
                round2(fee > 0 ? fee : toNumber(service.baseRate)),
              ),
            };
          }
          return {
            ...row,
            serviceName: service.serviceName,
            itemCode: service.serviceCode ?? row.itemCode,
            unitRate: Math.max(0, round2(toNumber(service.baseRate))),
          };
        }),
      );
    } catch {
      /* keep the hydrated rates — the server re-resolves them on generation */
    }
  };

  const handleRestoreDraft = () => {
    if (!selectedPatient) {
      dispatch(
        toast.error(
          "Select a patient first",
          "Drafts are stored per patient & panel.",
        ),
      );
      return;
    }
    try {
      const raw = localStorage.getItem(
        draftKeyOf(selectedPatient.id, panelId),
      );
      const draft = JSON.parse(raw || "null");
      if (!draft) {
        dispatch(
          toast.info(
            "No saved draft",
            "Save a draft for this patient & panel first.",
          ),
        );
        return;
      }
      // 1) hydrate state
      const restored: CartRow[] = (draft.items || []).map((s: any) => ({
        serviceId: String(s.serviceId ?? s.id ?? ""),
        serviceName: String(s.serviceName ?? s.itemCode ?? "Service"),
        itemCode: String(s.itemCode ?? s.serviceCode ?? "—"),
        category: String(s.category ?? s.categoryLabel ?? "Others"),
        quantity: Math.max(1, Math.floor(toNumber(s.quantity ?? s.qty)) || 1),
        unitRate: Math.max(0, round2(toNumber(s.unitRate ?? s.baseRate))),
        ...(toNumber(s.discountPercent) > 0
          ? { discountPercent: round2(toNumber(s.discountPercent)) }
          : {}),
        ...(toNumber(s.discountAmount) > 0
          ? { discountAmount: round2(toNumber(s.discountAmount)) }
          : {}),
      })).filter((row: CartRow) => row.serviceId || row.serviceName !== "Service");

      setSelectedServices(restored);
      setDoctorId(draft.doctorId || "");
      setPaymentMode(draft.paymentMode || "CASH");
      setDiscount(toNumber(draft.discount));
      setDiscountType(draft.discountType === "PERCENT" ? "PERCENT" : "FLAT");
      setCoPayPercent(clamp(toNumber(draft.coPayPercent), 0, 100));
      setReceivedAmount(
        draft.receivedAmount === "" || draft.receivedAmount == null
          ? ""
          : toNumber(draft.receivedAmount),
      );
      setVisitNo(draft.visitNo || "");
      setRemarks(draft.remarks || "");
      setPaymentTransactionId("");
      setRowError(null);
      setPostedBill(null);
      setRatesNote(null);

      // 2) re-fetch the services master to refresh the indicative rates
      const doctor =
        allDoctors.find((d: any) => String(d.id) === String(draft.doctorId)) ??
        null;
      refreshCartFromMaster(doctor);

      dispatch(toast.success("Draft restored"));
    } catch {
      dispatch(toast.error("Could not restore draft", "The draft is corrupt."));
    }
  };

  /** Auto-clear the draft after a successful bill generation. */
  const clearDraft = () => {
    if (!selectedPatient) return;
    try {
      localStorage.removeItem(draftKeyOf(selectedPatient.id, panelId));
      setDraftSavedAt(null);
    } catch {
      /* storage unavailable — nothing to clear */
    }
  };

  /* --------------------------------- submit ------------------------------- */

  /** Response → local re-sync: line rates/qty + header totals become the
   *  server's (panel tariff > doctor fee > base). */
  const applyServerBill = (bill: BillResponse | any) => {
    if (!bill) return;
    let changed = false;
    setSelectedServices((prev) =>
      prev.map((row) => {
        const items = bill.items ?? [];
        const line =
          items.find((it: any) => it.serviceId && it.serviceId === row.serviceId) ??
          items.find((it: any) => it.itemName === row.serviceName);
        if (!line) return row;
        const unitRate = Math.max(0, round2(toNumber(line.unitPrice)));
        const quantity = Math.max(
          1,
          Math.floor(toNumber(line.quantity) || row.quantity),
        );
        const discountAmount = round2(toNumber(line.discountAmount));
        if (unitRate !== round2(toNumber(row.unitRate)) || quantity !== row.quantity) {
          changed = true;
        }
        return {
          ...row,
          quantity,
          unitRate,
          ...(discountAmount > 0 ? { discountAmount } : {}),
        };
      }),
    );
    setPostedBill(bill);
    if (changed) setRatesNote("Rates updated as per hospital tariff.");
  };

  /** Minimal receipt payload when GET …/receipt is unavailable — the modal
   *  still opens from the bill response alone. */
  const fallbackReceiptFromBill = (bill: any): BillReceiptData => {
    const panelRow = panels.find((p: any) => String(p.id) === String(bill?.panelId));
    const patientName =
      bill?.patient?.fullName ||
      [selectedPatient?.firstName, selectedPatient?.lastName]
        .filter(Boolean)
        .join(" ") ||
      "Patient";
    return {
      hospital: null,
      bill: {
        id: bill?.id ?? "",
        billNo: bill?.billNo ?? "—",
        visitNo: bill?.visitNo ?? null,
        billedAt: bill?.billedAt ?? new Date().toISOString(),
        paymentStatus: bill?.paymentStatus ?? "PENDING",
        billStatus: bill?.billStatus ?? "GENERATED",
        paymentMode: bill?.paymentMode ?? null,
        remarks: bill?.remarks ?? null,
        appointmentNo: bill?.appointmentNo ?? null,
      },
      patient: {
        id: bill?.patient?.id ?? selectedPatient?.id ?? "",
        uhid: bill?.patient?.uhid ?? selectedPatient?.uhid ?? "",
        name: patientName,
        mobile: bill?.patient?.mobile ?? selectedPatient?.mobile ?? null,
        gender: selectedPatient?.gender ?? null,
        dateOfBirth: selectedPatient?.dateOfBirth ?? null,
      },
      panel: panelRow
        ? {
            id: String(panelRow.id),
            name: panelRow.panelName || panelRow.panelCode || "Panel",
          }
        : null,
      doctor: bill?.doctor ??
        (doctorId
          ? {
              id: doctorId,
              name: selectedDoctor
                ? doctorLabelOf(selectedDoctor).replace(/^Dr\.\s*/, "")
                : "",
              specialization: selectedDoctor?.specialization ?? null,
            }
          : null),
      items: (bill?.items ?? []).map((it: any) => ({
        id: it.id ?? `line-${Math.random()}`,
        serviceCode: it.itemCode ?? null,
        itemName: it.itemName ?? "Service",
        category: it.category ?? "Others",
        quantity: toNumber(it.quantity) || 1,
        unitPrice: toNumber(it.unitPrice),
        discountPercent: toNumber(it.discountPercent),
        discountAmount: toNumber(it.discountAmount),
        taxPercent: toNumber(it.taxPercent),
        totalAmount: toNumber(it.totalAmount),
      })),
      totals: {
        grossAmount: toNumber(bill?.grossAmount ?? bill?.subtotal),
        discountAmount: toNumber(bill?.discountAmount),
        discountPercent: toNumber(bill?.discountPercent),
        discountReason: bill?.discountReason ?? null,
        taxAmount: toNumber(bill?.taxAmount),
        netAmount: toNumber(bill?.netAmount ?? bill?.totalAmount),
        coPayPercent: toNumber(bill?.coPayPercent),
        coPayAmount: toNumber(bill?.coPayAmount),
        patientPayable: bill?.patientPayable ?? null,
        panelPayable: bill?.panelPayable ?? null,
        paidAmount: toNumber(bill?.paidAmount),
        changeAmount: toNumber(bill?.changeAmount),
        dueAmount: toNumber(bill?.dueAmount),
      },
      payments: (bill?.payments ?? []).map((p: any) => ({
        id: p.id,
        receiptNo: p.receiptNo ?? "—",
        amount: toNumber(p.amount),
        paymentMode: p.paymentMode ?? "CASH",
        transactionId: p.transactionId ?? null,
        paidAt: p.paidAt ?? new Date().toISOString(),
      })),
      creditNotes: (bill?.creditNotes ?? []).map((cn: any) => ({
        id: cn.id,
        creditNoteNo: cn.creditNoteNo ?? "—",
        refundAmount: toNumber(cn.refundAmount),
        refundMode: cn.refundMode ?? "—",
        issuedAt: cn.issuedAt ?? new Date().toISOString(),
      })),
    };
  };

  const openReceiptFor = async (bill: any) => {
    try {
      const res: any = await billingService.fetchReceipt(bill.id);
      setReceipt((res?.data ?? fallbackReceiptFromBill(bill)) as BillReceiptData);
    } catch {
      setReceipt(fallbackReceiptFromBill(bill));
    }
  };

  /**
   * Server error branches — always show the SERVER's message through our
   * toast; business rules are never re-invented on the client.
   */
  const handleBillError = (e: any) => {
    const err = e?.data ?? {};
    const code = String(err.code ?? "");
    const message = String(
      err.message ?? e?.message ?? "Please try again.",
    );
    const details = err.details ?? {};

    // 409 OPD_BIL_003 — bill already exists for this appointment
    if (
      e?.status === 409 &&
      (code === "OPD_BIL_003" || /already generated/i.test(message))
    ) {
      dispatch(
        toast.warning(
          "Bill already exists",
          `${message}${details.billNo ? ` · ${details.billNo}` : ""}`,
        ),
      );
      setDuplicateBill({ billNo: details.billNo ?? null });
      return;
    }

    // Rate-locked service — re-sync that line from `details` and refresh the
    // indicative catalogue (fresh bill preview of the rate hierarchy).
    if (code === "RATE_NOT_EDITABLE" || /rate .*cannot be modified/i.test(message)) {
      dispatch(toast.error("Rate not editable", message));
      if (details.serviceId) {
        const synced = round2(
          toNumber(details.effectiveRate ?? details.attemptedRate),
        );
        setSelectedServices((prev) =>
          prev.map((row) =>
            row.serviceId === String(details.serviceId) && synced > 0
              ? { ...row, unitRate: synced }
              : row,
          ),
        );
        setRatesNote("Rates updated as per hospital tariff.");
      }
      loadCatalog();
      return;
    }

    // 400 OPD_BIL_019 (line missing name/price) or a validation error →
    // highlight the offending row (all rows when the server named none).
    if (code === "OPD_BIL_019" || Array.isArray(err.message)) {
      setRowError(
        details.serviceId
          ? { all: false, serviceIds: [String(details.serviceId)] }
          : { all: true, serviceIds: [] },
      );
      dispatch(toast.error("Could not generate bill", message));
      return;
    }

    dispatch(toast.error("Could not generate bill", message));
  };

  const handleGenerateBill = async () => {
    // exactly one request per click — ref + state + disabled button
    if (submitting || submitLock.current || postedBill) return;
    if (!selectedPatient) {
      dispatch(toast.error("Please select a patient", "Search & pick a patient."));
      return;
    }
    if (selectedServices.length === 0) {
      dispatch(
        toast.error(
          "Please select at least one service",
          "Tick at least one row from the catalogue.",
        ),
      );
      return;
    }
    if (paymentError) return; // inline error already explains the gap
    if (!isUUID(selectedPatient.id)) {
      dispatch(toast.error("Invalid patient", "The patient id is not a valid UUID."));
      return;
    }

    try {
      submitLock.current = true;
      setSubmitting(true);
      setRowError(null);

      /**
       * POST /api/opd/billing — spec payload. The backend recomputes every
       * total and wins; `discountPercent` XOR `discountAmount` (exactly one);
       * patientPayable / panelPayable are omitted so the server derives the
       * co-pay split from the panel config (cash → net / 0).
       */
      const paid = isCredit
        ? 0
        : round2(typeof receivedAmount === "number" ? receivedAmount : 0);
      const change = isCredit ? 0 : summary.change;

      const payload: CreateBillPayload = {
        patientId: String(selectedPatient.id),
        panelId: panelId || null,
        ...(doctorId && isUUID(doctorId) ? { doctorProfileId: doctorId } : {}),
        appointmentId: selectedAppointmentId || null,
        ...(visitNo.trim()
          ? { visitNo: visitNo.trim().slice(0, 50) }
          : {}),
        paymentMode: (
          PAYMENT_MODES.some((m) => m.value === paymentMode)
            ? paymentMode
            : "CASH"
        ) as CreateBillPayload["paymentMode"],
        grossAmount: summary.gross,
        ...(discount > 0
          ? discountType === "PERCENT"
            ? { discountPercent: round2(clamp(discount, 0, 100)) }
            : {
                discountAmount: round2(
                  clamp(discount, 0, summary.gross - summary.lineDiscounts),
                ),
              }
          : {}),
        ...(isPanelBilling ? { coPayPercent: summary.coPayPercent } : {}),
        netAmount: summary.netAmount,
        paidAmount: paid,
        changeAmount: change,
        ...(remarks.trim() ? { remarks: remarks.trim().slice(0, 500) } : {}),
        ...(paymentTransactionId.trim()
          ? { paymentTransactionId: paymentTransactionId.trim().slice(0, 100) }
          : {}),
        items: selectedServices.map((row): CreateBillItemPayload => {
          const quantity = Math.max(1, Math.floor(toNumber(row.quantity) || 1));
          const unitRate = Math.max(0, round2(toNumber(row.unitRate)));
          const lineDiscount = Math.max(0, round2(toNumber(row.discountAmount)));
          return {
            // non-UUID legacy ids fall back to a name-only line (serviceId?
            // is optional in the DTO; OPD_BIL_019 only requires name + price)
            ...(isUUID(row.serviceId) ? { serviceId: row.serviceId } : {}),
            serviceName: String(
              row.serviceName || row.itemCode || "Service",
            ).slice(0, 255),
            quantity,
            unitRate,
            ...(lineDiscount > 0 ? { discountAmount: lineDiscount } : {}),
            totalAmount: Math.max(0, round2(quantity * unitRate - lineDiscount)),
          };
        }),
      };

      const res: any = await billingService.createBill(payload);
      const created: any = res?.data?.data ?? res?.data ?? {};

      // Re-render local totals + line rates from the server response.
      applyServerBill(created);

      dispatch(
        toast.success(
          "Bill generated successfully",
          `Bill No: ${created.billNo ?? "—"}`,
        ),
      );

      // Receipt modal — GET /api/opd/billing/{billId}/receipt (fallback: bill)
      await openReceiptFor(created);

      // draft served its purpose
      clearDraft();
      // NOTE: the form intentionally stays rendered behind the modal so the
      // tariff-updated rates/summary remain visible; closing the receipt
      // returns to the refreshed bill list (onSuccess).
    } catch (e: any) {
      handleBillError(e);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  /** 409 follow-up — open the existing bill of this appointment. */
  const viewExistingBill = async () => {
    if (resolvingDuplicate) return;
    if (!selectedAppointmentId) {
      setDuplicateBill(null);
      return;
    }
    setResolvingDuplicate(true);
    try {
      const res: any = await billingService.fetchBillByAppointment(
        selectedAppointmentId,
      );
      const bill = res?.data?.data ?? res?.data;
      if (!bill?.id) throw new Error("No bill found for this appointment");
      setDuplicateBill(null);
      setPostedBill(bill);
      clearDraft();
      await openReceiptFor(bill);
    } catch (e: any) {
      dispatch(
        toast.error(
          "Could not load the bill",
          e?.data?.message || e?.message || "Please try again.",
        ),
      );
    } finally {
      setResolvingDuplicate(false);
    }
  };

  /** Closing the receipt returns the caller to the invoice list (reload). */
  const handleReceiptClose = () => {
    setReceipt(null);
    onSuccess();
  };

  const handleBack = () => {
    if (receipt) handleReceiptClose();
    else onClose();
  };

  const handlePaymentModeChange = (mode: string) => {
    setPaymentMode(mode);
    if (mode === "CREDIT") {
      // CREDIT forces received = 0 — the amount stays due on the bill.
      setReceivedAmount(0);
      setPaymentTransactionId("");
    }
  };

  const canGenerate =
    Boolean(selectedPatient) &&
    selectedServices.length > 0 &&
    !paymentError &&
    !submitting &&
    !postedBill;

  const loading = patientsLoading || doctorsLoading;

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
            onClick={handleBack}
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setSearchNonce((n) => n + 1);
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setShowSearchResults(false);
                      setServerPatients([]);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setSearchNonce((n) => n + 1)}
                disabled={patientSearching || !searchQuery.trim()}
                className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {patientSearching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                Search
              </button>

              {showSearchResults && patientSearching && (
                <div className="absolute top-full left-0 w-full mt-1 rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-lg z-20 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching
                  patients…
                </div>
              )}

              {showSearchResults &&
                !patientSearching &&
                filteredPatientResults.length === 0 && (
                  <div className="absolute top-full left-0 w-full mt-1 rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-lg z-20">
                    No patients matched “{searchQuery}”
                  </div>
                )}

              {showSearchResults &&
                !patientSearching &&
                filteredPatientResults.length > 0 && (
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
              <button
                onClick={() =>
                  selectedPatient &&
                  navigate(`/patients/${selectedPatient.id}/edit`)
                }
                disabled={!selectedPatient}
                className="flex items-center gap-1 text-slate-600 border border-slate-300 px-3 py-1 rounded text-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
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
                      {genderLabel(selectedPatient.gender)} |{" "}
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
                    <InfoRow
                      label="Allergies"
                      value={selectedPatient.allergies || "None recorded"}
                    />
                    <InfoRow
                      label="Chronic"
                      value={selectedPatient.chronicDiseases || "None recorded"}
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
              onChange={handlePanelGroupChange}
              options={["GENERAL", "INSURANCE", "CORPORATE"]}
            />
            <SelectField
              label="Panel *"
              value={panelId}
              onChange={handlePanelChange}
              loading={panelsLoading}
              loadingLabel="Loading panels…"
              options={panelOptions}
            />
            {/* UI-only for now — not sent to the billing API */}
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
              options={[
                "",
                ...allDoctors.map((d: any) => doctorLabelOf(d)),
              ]}
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
              onChange={handleDoctorChange}
              loading={doctorsLoading}
              loadingLabel="Loading doctors…"
              options={doctorOptions}
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
                <button
                  onClick={loadCatalog}
                  disabled={catalogLoading}
                  className="bg-brand-600 text-white px-4 py-1.5 rounded text-xs font-medium hover:bg-brand-700 flex items-center gap-1.5 disabled:opacity-50"
                  title="Reload catalogue"
                >
                  {catalogLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
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
                    <th
                      className="px-3 py-2 font-semibold text-slate-600 text-right"
                      title="Indicative base rate. The final rate is resolved server-side: panel tariff > doctor consultation fee (Consultation only) > base rate."
                    >
                      <span>Rate (₹)</span>
                      <span className="block text-[9px] font-normal uppercase tracking-wide text-slate-400">
                        indicative
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {catalogLoading && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-10 text-center text-slate-400"
                      >
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        Loading service catalogue…
                      </td>
                    </tr>
                  )}

                  {!catalogLoading && catalogError && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-10 text-center text-slate-500"
                      >
                        <p className="mb-2">{catalogError}</p>
                        <button
                          onClick={loadCatalog}
                          className="text-brand-600 font-medium hover:underline"
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  )}

                  {!catalogLoading && !catalogError && filteredServices.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-10 text-center text-slate-400"
                      >
                        No services found for this filter
                      </td>
                    </tr>
                  )}

                  {!catalogLoading &&
                    !catalogError &&
                    filteredServices.slice(0, serviceLimit).map((service) => {
                      const isSelected = selectedServices.some(
                        (row) => row.serviceId === String(service.id),
                      );
                      return (
                        <tr key={service.id} className="hover:bg-slate-50/50">
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
                            {service.serviceCode}
                          </td>
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {service.serviceName}
                          </td>
                          <td className="px-3 py-2 text-slate-500 hidden md:table-cell">
                            {service.categoryLabel}
                          </td>
                          <td className="px-3 py-2 text-slate-500 hidden xl:table-cell">
                            {service.departmentLabel}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            {toNumber(service.baseRate).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}

                  {!catalogLoading &&
                    !catalogError &&
                    filteredServices.length > serviceLimit && (
                      <tr>
                        <td colSpan={6} className="px-3 py-3 text-center">
                          <button
                            onClick={() =>
                              setServiceLimit((n) => n + SERVICE_PAGE)
                            }
                            className="text-brand-600 text-xs font-medium hover:underline"
                          >
                            Showing {serviceLimit} of {filteredServices.length}{" "}
                            · show more
                          </button>
                        </td>
                      </tr>
                    )}
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
                  onClick={() => {
                    setRowError(null);
                    setSelectedServices([]);
                  }}
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
                    {selectedServices.map((item, idx) => {
                      const highlighted =
                        rowError &&
                        (rowError.all ||
                          rowError.serviceIds.includes(item.serviceId));
                      const amount = round2(
                        Math.max(
                          0,
                          toNumber(item.quantity) * toNumber(item.unitRate) -
                            toNumber(item.discountAmount || 0),
                        ),
                      );
                      return (
                        <tr
                          key={item.serviceId}
                          className={cn(
                            highlighted &&
                              "bg-coral-50/70 ring-1 ring-inset ring-coral-300",
                          )}
                        >
                          <td className="px-3 py-3 text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-3 font-medium text-slate-800">
                            {item.serviceName}
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {item.itemCode} · {item.category}
                            </div>
                          </td>
                          <td className="px-2 py-3 text-right text-slate-600">
                            {toNumber(item.unitRate).toFixed(2)}
                          </td>
                          <td className="px-2 py-3 text-center">
                            <div className="flex items-center justify-center gap-1 border border-slate-200 rounded px-1 py-0.5">
                              <button
                                onClick={() => updateQty(item.serviceId, -1)}
                                disabled={item.quantity <= 1}
                                className="text-slate-400 hover:text-slate-700 p-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Minimum quantity is 1"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-4 text-center font-medium">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQty(item.serviceId, 1)}
                                className="text-slate-400 hover:text-slate-700 p-0.5"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right font-semibold text-slate-800">
                            {amount.toFixed(2)}
                          </td>
                          <td className="px-2 py-3 text-center">
                            <button
                              onClick={() => removeService(item.serviceId)}
                              className="text-slate-400 hover:text-red-500"
                              title="Remove service"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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
                  value={formatMoney(displayTotals.gross)}
                />
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Discount</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={discountType === "PERCENT" ? 100 : undefined}
                      value={discount}
                      disabled={!!postedBill}
                      onChange={(e) =>
                        setDiscount(
                          discountType === "PERCENT"
                            ? clamp(Number(e.target.value) || 0, 0, 100)
                            : Math.max(0, Number(e.target.value) || 0),
                        )
                      }
                      className="w-16 text-right text-sm font-semibold border border-slate-200 rounded px-2 py-0.5 disabled:opacity-50 disabled:bg-slate-50"
                    />
                    <select
                      value={discountType}
                      disabled={!!postedBill}
                      onChange={(e) =>
                        setDiscountType(
                          e.target.value === "PERCENT" ? "PERCENT" : "FLAT",
                        )
                      }
                      className="text-xs border border-slate-200 rounded px-1 py-1 bg-white disabled:opacity-50"
                      title="Flat amount (₹) or percentage (%) — sent as exactly one field"
                    >
                      <option value="FLAT">₹</option>
                      <option value="PERCENT">%</option>
                    </select>
                  </div>
                </div>
                <SummaryRow
                  label="Discount Amount"
                  value={formatMoney(displayTotals.discountAmount)}
                />
                {isPanelBilling && (
                  <>
                    {postedBill ? (
                      <SummaryRow
                        label="Co-Pay %"
                        value={`${displayTotals.coPayPercent}%`}
                      />
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Co-Pay %</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={coPayPercent}
                          onChange={(e) =>
                            setCoPayPercent(clamp(Number(e.target.value) || 0, 0, 100))
                          }
                          className="w-20 text-right text-sm font-semibold border border-slate-200 rounded px-2 py-0.5"
                        />
                      </div>
                    )}
                    <SummaryRow
                      label="Co-Pay Amount"
                      value={formatMoney(displayTotals.coPayAmount)}
                    />
                  </>
                )}
                <SummaryRow
                  label="Patient Payable"
                  value={formatMoney(displayTotals.patientPayable)}
                />
                <SummaryRow
                  label="Panel Payable"
                  value={formatMoney(displayTotals.panelPayable)}
                />
              </div>
              <div className="bg-emerald-50 px-4 py-3 flex justify-between items-center border-t border-emerald-100">
                <span className="font-bold text-emerald-800 text-sm">
                  Net Amount
                </span>
                <span className="font-bold text-emerald-700 text-lg">
                  {formatMoney(displayTotals.netAmount)}
                </span>
              </div>
              {ratesNote && (
                <p className="bg-amberly-50 border-t border-amberly-100 px-4 py-2 text-[10.5px] font-medium tracking-wide text-amberly-700">
                  {ratesNote}
                </p>
              )}
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => handlePaymentModeChange(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-500 bg-white"
                >
                  {PAYMENT_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  <span className="text-red-500">* </span>Received Amount
                </label>
                <input
                  type="number"
                  min={0}
                  value={receivedAmount}
                  onChange={(e) =>
                    setReceivedAmount(
                      e.target.value ? Math.max(0, Number(e.target.value)) : "",
                    )
                  }
                  disabled={isCredit}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-500 font-medium disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder={isCredit ? "0.00" : "0.00"}
                />
                {isCredit && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Credit bills collect nothing at generation — the amount
                    stays due.
                  </p>
                )}
                {paymentError && (
                  <p className="mt-1 text-[11.5px] font-medium text-coral-600">
                    {paymentError}
                  </p>
                )}
              </div>

              {(paymentMode === "UPI" || paymentMode === "CARD") && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Transaction Ref
                  </label>
                  <input
                    type="text"
                    value={paymentTransactionId}
                    onChange={(e) => setPaymentTransactionId(e.target.value)}
                    maxLength={100}
                    placeholder="UTR / reference (optional)"
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
              )}

              {!isCredit && (
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-slate-700">
                    Change Amount
                  </span>
                  <span className="font-bold text-slate-900">
                    {formatMoney(displayTotals.change)}
                  </span>
                </div>
              )}
              {displayTotals.balance > 0 && (
                <div className="flex justify-between items-center text-sm bg-coral-50 -mx-4 px-4 py-2">
                  <span className="font-medium text-coral-700">
                    Balance Due
                  </span>
                  <span className="font-bold text-coral-700">
                    {formatMoney(displayTotals.balance)}
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-2 mt-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleSaveDraft}
                    disabled={!selectedPatient || !!postedBill}
                    className="w-full bg-white border border-slate-300 text-slate-700 py-2 rounded text-sm font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Save Bill Draft
                  </button>
                  <button
                    onClick={handleRestoreDraft}
                    disabled={!draftSavedAt || !!postedBill}
                    title={
                      draftSavedAt
                        ? `Draft saved ${new Date(draftSavedAt).toLocaleString()}`
                        : selectedPatient
                          ? "No saved draft for this patient & panel"
                          : "Select a patient first"
                    }
                    className="w-full bg-white border border-slate-300 text-slate-700 py-2 rounded text-sm font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Restore Draft
                  </button>
                </div>
                <button
                  onClick={handleGenerateBill}
                  disabled={!canGenerate}
                  className="w-full bg-emerald-700 text-white py-2.5 rounded text-sm font-semibold shadow-sm hover:bg-emerald-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  {submitting
                    ? "Generating Bill…"
                    : isCredit
                      ? "Generate Bill (Credit)"
                      : "Generate Bill"}
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
                value={visitNo}
                onChange={(e) => setVisitNo(e.target.value)}
                readOnly={Boolean(selectedAppointmentId)}
                maxLength={50}
                placeholder={
                  selectedAppointmentId ? "From appointment" : "Auto-generated"
                }
                title={
                  selectedAppointmentId
                    ? "Linked to an appointment — read only"
                    : undefined
                }
                className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none read-only:bg-slate-50 read-only:text-slate-500"
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
                maxLength={500}
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

      {/* RECEIPT / PRINT PREVIEW */}
      <Dialog
        open={!!receipt}
        onOpenChange={(v) => !v && handleReceiptClose()}
        size="lg"
        title={
          <span className="flex items-center gap-2">
            <Printer className="size-4.5 text-brand-600" /> Bill Receipt
          </span>
        }
        description={receipt ? `Invoice # ${receipt.bill.billNo}` : ""}
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded text-sm font-semibold hover:bg-slate-50"
            >
              <Printer className="w-4 h-4" /> Print / PDF
            </button>
            <button
              onClick={handleReceiptClose}
              className="bg-emerald-700 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-emerald-800"
            >
              Done
            </button>
          </div>
        }
      >
        {receipt && <OpdReceiptSheet receipt={receipt} />}
      </Dialog>

      {/* 409 OPD_BIL_003 — a bill already exists for this appointment */}
      <Dialog
        open={!!duplicateBill}
        onOpenChange={(v) => !v && setDuplicateBill(null)}
        size="sm"
        title={
          <span className="flex items-center gap-2">
            <FileText className="size-4.5 text-amberly-600" /> Bill already
            exists
          </span>
        }
        description="A bill has already been generated for this appointment."
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <button
              onClick={() => setDuplicateBill(null)}
              className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded text-sm font-semibold hover:bg-slate-50"
            >
              Close
            </button>
            <button
              onClick={viewExistingBill}
              disabled={resolvingDuplicate}
              className="bg-brand-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-brand-700 flex items-center gap-1.5 disabled:opacity-50"
            >
              {resolvingDuplicate && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              View Bill
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          {duplicateBill?.billNo ? (
            <>
              Existing bill number:{" "}
              <span className="num font-bold text-slate-900">
                {duplicateBill.billNo}
              </span>
            </>
          ) : (
            "Open the existing bill to view or print it."
          )}
        </p>
      </Dialog>
    </div>
  );
}

// --- Micro Components ---
function SelectField({
  label,
  value,
  onChange,
  options,
  loading = false,
  loadingLabel = "Loading…",
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  options: (string | { value: string; label: string })[];
  /** option source still in flight — shown inside the select, not globally */
  loading?: boolean;
  loadingLabel?: string;
}) {
  return (
    <div className="flex flex-col">
      <label className="block text-xs font-semibold text-slate-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <select
          className="w-full border border-slate-300 rounded appearance-none focus:outline-none focus:border-brand-500 bg-white py-2 px-3 text-sm disabled:cursor-wait disabled:bg-slate-50 disabled:text-slate-400"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={loading}
        >
          {loading && <option value={value}>{loadingLabel}</option>}
          {!loading &&
            options.map((opt) => {
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
