import { forwardRef, useEffect, useState, type ComponentProps } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check } from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { useForm, type Rule } from "@/hooks/useForm";
import { departmentService } from "@/pages/Departments/department.service";
import { patientService } from "@/pages/patients/patient.service";
import { masterService } from "@/pages/masterConfiguration/master.service";
import { hideLoader, showLoader, toast } from "@/store/slices/uiSlice";
import type { Department } from "@/types";
import {
  Emptyish,
  FormRow,
  FormSection,
  PageIntro,
  SectionPanel,
} from "@/components/common";
import {
  Input as FieldsInput,
  Select as FieldsSelect,
  DatePicker as FieldsDatePicker,
  Textarea as FieldsTextarea,
  Checkbox,
  Input,
  Select,
  DatePicker,
  Textarea,
} from "@/components/ui/fields";
import { Button } from "@/components/ui/primitives";
import { FormSkeleton } from "@/components/ui/feedback";
import {
  GENDERS,
  BLOOD_GROUPS,
  MARITAL_STATUS,
  guardianRelations,
  TITLES,
  ID_PROOF_NAMES,
  RELIGIONS,
  PATIENT_TYPES,
  PATIENT_SOURCES,
  REFERENCE_TYPES,
  MLC_TYPES,
} from "@/constants";
import type { Patient } from "@/types";
import { toBackendBloodGroup, toDisplayBloodGroup } from "@/utils/bloodGroup";

/* ── HELPERS ────────────────────────────────────────────────── */

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** Mobile optionally prefixed with a country code:
 *   9845011223, 09845011223, 919845011223, "+91 9845 011 223", "+855 12 345 6789"
 *   Spaces, dashes and parentheses are ignored. */
const isMobile = (v: string) => {
  const s = String(v ?? "")
    .trim()
    .replace(/[\s()-]/g, "");
  if (s.startsWith("+")) {
    const d = s.slice(1);
    if (!/^\d{7,15}$/.test(d)) return false;
    if (d.startsWith("91") && d.length === 12) return /^91[6-9]\d{9}$/.test(d);
    return true;
  }
  const d = digits(s);
  return (
    /^[6-9]\d{9}$/.test(d) ||
    /^0[6-9]\d{9}$/.test(d) ||
    /^91[6-9]\d{9}$/.test(d)
  );
};

/** Optional-field validators — they run ONLY when the user typed something. */
const isAlnumId = (min: number, max: number) => (v: string) =>
  new RegExp(`^[A-Za-z0-9-]{${min},${max}}$`).test(v.trim());
const isPassport = (v: string) => /^[A-Za-z][0-9]{7}$/.test(v.trim());
const isKraPin = (v: string) => /^[A-Za-z][0-9]{9}[A-Za-z]$/.test(v.trim());
const isPersonName = (v: string) =>
  /^[A-Za-z][A-Za-z.' ]{1,49}$/.test(v.trim());
const isPositiveAmount = (v: string) => /^\d+(\.\d{1,2})?$/.test(v.trim());
const isPregnancyDays = (v: string) =>
  /^\d+$/.test(v.trim()) && Number(v) >= 1 && Number(v) <= 310;
const isIntlNo = (v: string) => {
  const s = v.trim().replace(/[\s()-]/g, "");
  return /^\+?\d{6,15}$/.test(s);
};
const isPincode = (v: string) => /^[1-9]\d{5}$/.test(digits(v));
const isAadhaar = (v: string) =>
  /^\d{12}$/.test(digits(v)) && !/^0+$/.test(digits(v));
const isAbha = (v: string) => /^\d{14}$/.test(digits(v));
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const isPolicyNo = (v: string) => /^[A-Za-z0-9-]{6,}$/.test(v.trim());

const DIGIT_FIELDS = new Set([
  "mobile",
  "alternateMobile",
  "pincode",
  "aadhaarNumber",
  "abhaId",
  "guardianMobile",
]);

/** ⚡ Clean 6-line Typed DOB Parser (Handles 15/05/1990, 15-05-1990, 15051990, 1990-05-15) */
function parseDobInput(raw: string): string {
  if (!raw) return "";
  const clean = raw.trim().replace(/[^\d-/.]/g, "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean; // YYYY-MM-DD
  const dmy = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy)
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`; // DD/MM/YYYY
  if (/^\d{8}$/.test(clean)) {
    return `${clean.slice(4, 8)}-${clean.slice(2, 4)}-${clean.slice(0, 2)}`; // 15051990
  }
  return clean;
}

/** Local calendar date (YYYY-MM-DD). `toISOString()` is UTC-based, so in
 *  IST it still says yesterday between 00:00 and 05:29 — a newborn's date of
 *  birth would then read as "in the future". */
function localISO(date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/** DOB (YYYY-MM-DD) → Age + Unit (years / months / days) */
function calcAgeFromDob(
  dobStr: string,
): { age: number; unit: "years" | "months" | "days" } | null {
  const parsedIso = parseDobInput(dobStr);
  if (!parsedIso) return null;

  const dob = new Date(`${parsedIso}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();
  if (dob > now) return null;

  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  let days = now.getDate() - dob.getDate();

  if (days < 0) {
    months -= 1;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years === 0 && months === 0) {
    const diffDays = Math.max(
      0,
      Math.floor((now.getTime() - dob.getTime()) / 86400000),
    );
    return { age: diffDays, unit: "days" };
  }
  if (years === 0) return { age: months, unit: "months" };
  return { age: years, unit: "years" };
}

function titleCase(s?: string) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/* ── PAGE SHELL ────────────────────────────────────────────── */

export function PatientsFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  /**
   * The record of this route is loaded from `patient.service` into local state.
   * No slice is involved: the form is the only owner of this data, and when the
   * route changes the value is fetched again.
   */
  const [patient, setPatient] = useState<Patient | undefined>(undefined);
  const [loadingPatient, setLoadingPatient] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      // blocking initialization of the edit route → global loader
      setLoadingPatient(true);
      dispatch(showLoader("Loading patient record"));
      try {
        const response = await patientService.fetchPatientById(id);
        const body: any = response.data ?? {};
        if (active && response.status === 200) {
          setPatient((body.data ?? body) as Patient);
        }
      } catch (e: any) {
        if (active) dispatch(toast.error("Could not load patient", e?.message));
      }
      if (active) setLoadingPatient(false);
      dispatch(hideLoader());
    })();
    return () => {
      active = false;
      dispatch(hideLoader());
    };
  }, [id, dispatch]);

  if (loadingPatient) {
    return (
      <div className="space-y-4">
        <PageIntro
          title={id ? "Edit patient" : "Register patient"}
          description="Loading registration form…"
        />
        <FormSkeleton fields={10} columns={3} />
      </div>
    );
  }

  if (id && !patient) {
    return (
      <SectionPanel title="Patient not found">
        <Emptyish onBack={() => navigate("/patients")} />
      </SectionPanel>
    );
  }

  return <PatientsFormContent patient={patient} />;
}

/* ── FORM CONTENT ─────────────────────────────────────────── */

function PatientsFormContent({ patient }: { patient?: Patient }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isEdit = Boolean(patient?.id);

  /** Department + panel dropdowns — each loaded by this form, when it needs them. */
  const [departments, setDepartments] = useState<Department[]>([]);

  /**
   * The registration form cannot be filled without its department list, so this
   * load is the page's blocking initialization → global loader while it runs
   * (the panels list below is optional and gets no global UI).
   */
  useEffect(() => {
    let active = true;
    (async () => {
      dispatch(showLoader("Loading"));
      try {
        const response = await departmentService.fetchDepartments();
        if (active && response.status === 200) {
          setDepartments(
            (response.data?.data ?? []).filter(
              (row: Department) => row.isActive === true,
            ),
          );
        }
      } catch (e: any) {
        if (active)
          dispatch(toast.error("Could not load departments", e?.message));
      }
      dispatch(hideLoader());
    })();
    return () => {
      active = false;
      dispatch(hideLoader());
    };
  }, [dispatch]);

  const [panels, setPanels] = useState<{ value: any; label: string }[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await masterService.fetchPanelDropdown();
        if (active && response.status === 200) {
          setPanels(
            (response.data?.data ?? []).map((p: any) => ({
              value: p.id,
              label: p.panelName,
            })),
          );
        }
      } catch (e: any) {
        if (active) dispatch(toast.error("Could not load panels", e?.message));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const p = patient as any;

  /** Country / State options come from the hospital's global master
      (admin-maintained) — no hard-coded lists are shipped with the form. */
  const [geoOptions, setGeoOptions] = useState<{
    country: { value: string; label: string }[];
    state: { value: string; label: string }[];
  }>({ country: [], state: [] });

  useEffect(() => {
    let active = true;
    const toOpts = (res: any) => {
      const body = res?.data ?? res;
      const arr = Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
          ? body.data
          : [];
      return arr
        .map((r: any) =>
          String(r?.label ?? r?.name ?? r?.value ?? r?.code ?? "").trim(),
        )
        .filter(Boolean)
        .map((label: string) => ({ value: label, label }));
    };
    (async () => {
      try {
        const [cRes, sRes] = await Promise.all([
          masterService.fetchGlobalDropdown("COUNTRY"),
          masterService.fetchGlobalDropdown("STATE"),
        ]);
        if (active)
          setGeoOptions({ country: toOpts(cRes), state: toOpts(sRes) });
      } catch {
        /* global masters not configured yet → dropdowns stay empty
           (never a hard-coded fallback list) */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const initialValues = {
    firstName: patient?.firstName ?? "",
    lastName: patient?.lastName ?? "",
    gender: patient?.gender ? titleCase(patient.gender) : "Male",
    dateOfBirth: patient?.dateOfBirth?.slice(0, 10) ?? "",
    age: Number(p?.ageAtRegistration ?? p?.age ?? 0),
    ageUnit: p?.ageUnit ?? "years",
    bloodGroup: toDisplayBloodGroup(patient?.bloodGroup ?? "O+"),
    maritalStatus: patient?.maritalStatus
      ? titleCase(patient.maritalStatus)
      : "Single",
    mobile: patient?.mobile ?? "",
    alternateMobile: p?.alternateMobile ?? p?.altMobile ?? "",
    email: patient?.email ?? "",
    address: patient?.address ?? "",
    city: patient?.city ?? "",
    district: p?.district ?? "",
    state: p?.state ?? "",
    pincode: p?.pincode ?? "",
    aadhaarNumber: p?.aadhaarNumber ?? "",
    abhaId: p?.abhaId ?? "",
    guardianName: p?.guardianName ?? "",
    guardianRelation: p?.guardianRelation
      ? titleCase(String(p.guardianRelation))
      : "",
    guardianMobile: p?.guardianMobile ?? "",
    panelId: p?.panelId ?? "",
    panelPolicyNo: p?.panelPolicyNo ?? p?.insurancePolicyNo ?? "",
    panelValidTill:
      p?.panelValidTill?.slice?.(0, 10) ??
      p?.insuranceValidTill?.slice?.(0, 10) ??
      "",
    allergies: patient?.allergies ?? "",
    chronicDiseases: p?.chronicDiseases ?? "",
    country: p?.country ?? "India",
    department: String(p?.department ?? p?.departmentId ?? ""),
    consentToShare: p?.consentToShare ?? true,
    /* ── Extended registration fields (Hospedia-style, all optional) ── */
    title: p?.title ?? "",
    middleName: p?.middleName ?? "",
    barcode: p?.barcode ?? "",
    permanentAddress: p?.permanentAddress ?? "",
    sameAsLocalAddress: Boolean(
      p?.permanentAddress && p?.permanentAddress === p?.address,
    ),
    idProofName: p?.idProofName ?? "",
    idProofNo: p?.idProofNo ?? "",
    nationalId: p?.nationalId ?? "",
    passportNo: p?.passportNo ?? "",
    kraPin: p?.kraPin ?? "",
    familyNumber: p?.familyNumber ?? "",
    staffId: p?.staffId ?? "",
    dependentId: p?.dependentId ?? "",
    pregnancyDays: p?.pregnancyDays ?? "",
    occupation: p?.occupation ?? "",
    birthPlace: p?.birthPlace ?? "",
    religion: p?.religion ?? "",
    locality: p?.locality ?? "",
    membershipNo: p?.membershipNo ?? "",
    patientType: p?.patientType ? titleCase(String(p.patientType)) : "",
    source: p?.source ?? "",
    employeeReferenceId: p?.employeeReferenceId ?? "",
    identityMark1: p?.identityMark1 ?? "",
    identityMark2: p?.identityMark2 ?? "",
    referenceType: p?.referenceType ?? "",
    mlcType: p?.mlcType ?? "",
    mlcNo: p?.mlcNo ?? "",
    isInternational: p?.isInternational ?? false,
    internationalNo: p?.internationalNo ?? "",
    emergencyFirstName: p?.emergencyFirstName ?? "",
    emergencyLastName: p?.emergencyLastName ?? "",
    emergencyRelation: p?.emergencyRelation
      ? titleCase(String(p.emergencyRelation))
      : "",
    emergencyMobile: p?.emergencyMobile ?? "",
    emergencyResidentNo: p?.emergencyResidentNo ?? "",
    emergencyAddress: p?.emergencyAddress ?? "",
    insuranceGroup: p?.insuranceGroup ?? "",
    insurance: p?.insurance ?? "",
    policyCardNo: p?.policyCardNo ?? "",
    nameOnCard: p?.nameOnCard ?? "",
    cardHolder: p?.cardHolder ?? "",
    approvalAmount: p?.approvalAmount ?? "",
    approvalRemark: p?.approvalRemark ?? "",
  };

  const registered = (key: keyof typeof initialValues) =>
    String(initialValues[key] ?? "");

  const optional = (
    key: keyof typeof initialValues,
    test: (v: string) => boolean,
    message: string,
  ): Rule => ({
    message,
    validate: (value: any) => {
      const raw = String(value ?? "").trim();
      if (!raw) return true;
      const current = DIGIT_FIELDS.has(String(key))
        ? digits(raw)
        : raw.toLowerCase();
      const existing = DIGIT_FIELDS.has(String(key))
        ? digits(registered(key))
        : registered(key).toLowerCase();
      if (isEdit && existing && current === existing) return true;
      return test(raw) ? true : message;
    },
  });

  const todayISO = localISO();

  const form = useForm({
    initialValues,
    labels: {
      firstName: "First name",
      lastName: "Last name",
      gender: "Gender",
      mobile: "Mobile number",
      dateOfBirth: "Date of birth",
      age: "Age",
      panelPolicyNo: "Policy / Emp No",
    },
    validateOnChange: false,
    validateOnBlur: true,
    schema: {
      firstName: [
        { required: "First name is required" },
        { min: 2, message: "Use at least 2 characters" },
      ],
      lastName: [
        { required: "Last name is required" },
        { min: 2, message: "Use at least 2 characters" },
      ],
      gender: [{ required: "Select a gender" }],
      mobile: [
        ...(isEdit ? [] : [{ required: "Mobile number is required" } as Rule]),
        optional("mobile", isMobile, "Enter a valid 10-digit mobile number"),
      ],
      alternateMobile: [
        optional("alternateMobile", isMobile, "Invalid 10-digit number"),
      ],
      email: [optional("email", isEmail, "Invalid email address")],
      pincode: [optional("pincode", isPincode, "Invalid 6-digit pincode")],
      aadhaarNumber: [
        optional("aadhaarNumber", isAadhaar, "Aadhaar must be 12 digits"),
      ],
      abhaId: [optional("abhaId", isAbha, "ABHA ID must be 14 digits")],
      guardianMobile: [
        optional("guardianMobile", isMobile, "Invalid mobile number"),
      ],
      pregnancyDays: [
        optional(
          "pregnancyDays",
          isPregnancyDays,
          "Enter days between 1 and 310",
        ),
      ],
      staffId: [optional("staffId", isAlnumId(2, 30), "Invalid staff ID")],
      dependentId: [
        optional("dependentId", isAlnumId(2, 30), "Invalid dependent ID"),
      ],
      familyNumber: [
        optional("familyNumber", isAlnumId(3, 30), "Invalid family number"),
      ],
      idProofNo: [
        optional("idProofNo", isAlnumId(5, 20), "Invalid ID proof number"),
      ],
      nationalId: [
        optional("nationalId", isAlnumId(4, 25), "Invalid National ID"),
      ],
      passportNo: [
        optional(
          "passportNo",
          isPassport,
          "Format: 1 letter + 7 digits (e.g. P1234567)",
        ),
      ],
      kraPin: [optional("kraPin", isKraPin, "KRA PIN format: A123456789B")],
      membershipNo: [
        optional("membershipNo", isAlnumId(4, 30), "Invalid membership number"),
      ],
      employeeReferenceId: [
        optional(
          "employeeReferenceId",
          isAlnumId(3, 30),
          "Invalid employee reference id",
        ),
      ],
      mlcNo: [optional("mlcNo", isAlnumId(3, 30), "Invalid MLC number")],
      internationalNo: [
        optional("internationalNo", isIntlNo, "Invalid international number"),
      ],
      emergencyMobile: [
        optional("emergencyMobile", isMobile, "Invalid mobile number"),
      ],
      emergencyResidentNo: [
        optional("emergencyResidentNo", isIntlNo, "Invalid resident number"),
      ],
      policyCardNo: [
        optional(
          "policyCardNo",
          isAlnumId(4, 20),
          "Invalid policy card number",
        ),
      ],
      nameOnCard: [optional("nameOnCard", isPersonName, "Letters only")],
      cardHolder: [optional("cardHolder", isPersonName, "Letters only")],
      approvalAmount: [
        optional("approvalAmount", isPositiveAmount, "Enter a valid amount"),
      ],
      panelPolicyNo: [
        optional(
          "panelPolicyNo",
          isPolicyNo,
          "Policy number must be at least 6 characters",
        ),
      ],
      dateOfBirth: [
        {
          message: "Date of birth cannot be in the future",
          validate: (value: any) => {
            const parsed = parseDobInput(value);
            return !parsed || parsed <= todayISO
              ? true
              : "Date of birth cannot be in the future";
          },
        },
      ],
      age: [
        {
          message: "Enter an age between 0 and 129",
          validate: (value: any) => {
            if (value === "" || value === null || value === undefined)
              return true;
            const n = Number(value);
            if (Number.isNaN(n)) return "Enter a valid age";
            return n >= 0 && n <= 129 ? true : "Enter an age between 0 and 129";
          },
        },
      ],
    },
  });

  /** "+91 9845 011 223" → "+919845011223" (backend validators reject spaces) */
  const normPhone = (v?: string) => (v ? v.replace(/[\s()-]/g, "") : undefined);

  const toISO = (date: string) => {
    const parsed = parseDobInput(date);
    return parsed
      ? new Date(`${parsed}T00:00:00.000Z`).toISOString()
      : undefined;
  };

  const handleDobChange = (rawInput: string) => {
    form.setValue("dateOfBirth", rawInput);
    const parsedIso = parseDobInput(rawInput);
    const ageResult = calcAgeFromDob(parsedIso);

    if (ageResult) {
      form.setValue("age", ageResult.age);
      form.setValue("ageUnit", ageResult.unit);
    } else if (!rawInput) {
      form.setValue("age", 0);
      form.setValue("ageUnit", "years");
    }
  };

  const save = async (values: typeof initialValues) => {
    const payload: Record<string, unknown> = {
      firstName: values.firstName,
      lastName: values.lastName,
      gender: values.gender.toUpperCase(),
      bloodGroup: toBackendBloodGroup(values.bloodGroup),
      maritalStatus: values.maritalStatus.toUpperCase(),
      ageAtRegistration: Number(values.age) || 0,
      ageUnit: values.ageUnit || "years",
      alternateMobile: values.alternateMobile
        ? normPhone(values.alternateMobile)
        : undefined,
      email: values.email || undefined,
      address: values.address || undefined,
      city: values.city || undefined,
      district: values.district || undefined,
      state: values.state || undefined,
      pincode: values.pincode || undefined,
      country: values.country || "India",
      aadhaarNumber: values.aadhaarNumber || undefined,
      abhaId: values.abhaId || undefined,
      guardianName: values.guardianName || undefined,
      guardianMobile: values.guardianMobile
        ? normPhone(values.guardianMobile)
        : undefined,
      panelId: values.panelId || undefined,
      panelPolicyNo: values.panelPolicyNo || undefined,
      allergies: values.allergies || undefined,
      chronicDiseases: values.chronicDiseases || undefined,
      department: values.department || undefined,
      consentToShare: values.consentToShare,
      /* ── Extended registration fields (optional) ── */
      title: values.title || undefined,
      middleName: values.middleName || undefined,
      barcode: values.barcode || undefined,
      permanentAddress: values.permanentAddress || undefined,
      idProofName: values.idProofName || undefined,
      idProofNo: values.idProofNo || undefined,
      nationalId: values.nationalId || undefined,
      passportNo: values.passportNo || undefined,
      kraPin: values.kraPin || undefined,
      familyNumber: values.familyNumber || undefined,
      staffId: values.staffId || undefined,
      dependentId: values.dependentId || undefined,
      pregnancyDays: values.pregnancyDays
        ? Number(values.pregnancyDays)
        : undefined,
      occupation: values.occupation || undefined,
      birthPlace: values.birthPlace || undefined,
      religion: values.religion || undefined,
      locality: values.locality || undefined,
      membershipNo: values.membershipNo || undefined,
      patientType: values.patientType
        ? values.patientType.toUpperCase()
        : undefined,
      source: values.source || undefined,
      employeeReferenceId: values.employeeReferenceId || undefined,
      identityMark1: values.identityMark1 || undefined,
      identityMark2: values.identityMark2 || undefined,
      referenceType: values.referenceType || undefined,
      mlcType: values.mlcType || undefined,
      mlcNo: values.mlcNo || undefined,
      isInternational: values.isInternational,
      internationalNo: values.internationalNo
        ? normPhone(values.internationalNo)
        : undefined,
      emergencyFirstName: values.emergencyFirstName || undefined,
      emergencyLastName: values.emergencyLastName || undefined,
      emergencyMobile: values.emergencyMobile
        ? normPhone(values.emergencyMobile)
        : undefined,
      emergencyResidentNo: values.emergencyResidentNo || undefined,
      emergencyAddress: values.emergencyAddress || undefined,
      insuranceGroup: values.insuranceGroup || undefined,
      insurance: values.insurance || undefined,
      policyCardNo: values.policyCardNo || undefined,
      nameOnCard: values.nameOnCard || undefined,
      cardHolder: values.cardHolder || undefined,
      approvalAmount: values.approvalAmount
        ? Number(values.approvalAmount)
        : undefined,
      approvalRemark: values.approvalRemark || undefined,
      dateOfBirth: toISO(values.dateOfBirth),
      panelValidTill: toISO(values.panelValidTill),
    };

    if (!isEdit) payload.mobile = normPhone(values.mobile);

    if (values.guardianRelation) {
      payload.guardianRelation =
        guardianRelations[
          values.guardianRelation as keyof typeof guardianRelations
        ] ?? values.guardianRelation.toUpperCase();
    }

    if (values.emergencyRelation) {
      payload.emergencyRelation =
        guardianRelations[
          values.emergencyRelation as keyof typeof guardianRelations
        ] ?? values.emergencyRelation.toUpperCase();
    }

    Object.keys(payload).forEach((k) => {
      if (payload[k] === "" || payload[k] === undefined) delete payload[k];
    });

    try {
      if (isEdit) {
        await patientService.updatePatient(String(patient!.id), payload);
        dispatch(toast.success("Patient updated successfully"));
      } else {
        await patientService.createPatient(payload);
        dispatch(toast.success("Patient registered successfully"));
      }
    } catch (e: any) {
      dispatch(
        toast.error(isEdit ? "Update failed" : "Creation failed", e?.message),
      );
      return;
    }
    navigate("/patients");
  };

  const handleSubmit = form.handleSubmit(save as any);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault?.();
    if (form.submitting) return;
    form.revealErrors(Object.keys(form.schema));
    await handleSubmit(e);
  };

  const validTick = (name: keyof typeof initialValues) =>
    form.values[name] && form.isValid([String(name)]) ? (
      <Check className="size-4 text-mint-500" />
    ) : undefined;

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <PageIntro
        title={isEdit ? "Edit Patient" : "Register New Patient"}
        description="Fields marked with * are required; the rest are optional."
        back
      />

      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <form onSubmit={submit} className="space-y-8" noValidate>
          {/* Personal */}
          <FormSection title="Personal Details">
            <FormRow className="lg:grid-cols-4">
              <Select
                name="title"
                label="Title"
                placeholder="Select title"
                value={form.values.title}
                onChange={(v) => form.setValue("title", v)}
                options={TITLES.map((t) => ({ value: t, label: t }))}
              />
              <Input
                ref={form.registerRef("firstName")}
                name="firstName"
                label="First Name"
                required
                placeholder="Enter first name"
                value={form.values.firstName}
                onChange={(e) => form.setValue("firstName", e.target.value)}
                error={form.errorFor("firstName")}
              />
              <Input
                name="middleName"
                label="Middle Name"
                placeholder="Enter middle name"
                value={form.values.middleName}
                onChange={(e) => form.setValue("middleName", e.target.value)}
              />
              <Input
                ref={form.registerRef("lastName")}
                name="lastName"
                label="Last Name"
                required
                placeholder="Enter last name"
                value={form.values.lastName}
                onChange={(e) => form.setValue("lastName", e.target.value)}
                error={form.errorFor("lastName")}
              />
            </FormRow>

            <FormRow className="lg:grid-cols-4">
              <Select
                name="gender"
                label="Gender"
                required
                placeholder="Select gender"
                value={form.values.gender}
                onChange={(v) => form.setValue("gender", v)}
                options={GENDERS.map((g) => ({ value: g, label: g }))}
                error={form.errorFor("gender")}
              />

              {/* ⚡ DOB: calendar picker (typing is gone — the calendar hands
                  over ISO, which fills the age fields below) */}
              <DatePicker
                name="dateOfBirth"
                label="Date of Birth"
                placeholder="Select date of birth"
                value={form.values.dateOfBirth}
                onChange={handleDobChange}
                max={todayISO}
                error={form.errorFor("dateOfBirth")}
              />
              <Input
                name="age"
                label="Age"
                type="number"
                inputMode="numeric"
                placeholder="Auto from DOB"
                value={String(form.values.age)}
                onChange={(e) => form.setValue("age", Number(e.target.value))}
                error={form.errorFor("age")}
                hint={
                  form.values.dateOfBirth
                    ? "Filled from Date of Birth (editable)"
                    : "Or pick DOB above"
                }
              />
              <Select
                name="ageUnit"
                label="Age Unit"
                value={form.values.ageUnit}
                onChange={(v) => form.setValue("ageUnit", v)}
                options={["years", "months", "days"].map((u) => ({
                  value: u,
                  label: u,
                }))}
              />
            </FormRow>

            <FormRow className="lg:grid-cols-4">
              <Select
                name="bloodGroup"
                label="Blood Group"
                placeholder="Select blood group"
                value={form.values.bloodGroup}
                onChange={(v) => form.setValue("bloodGroup", v)}
                options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))}
              />
              <Select
                name="maritalStatus"
                label="Marital Status"
                placeholder="Select marital status"
                value={form.values.maritalStatus}
                onChange={(v) => form.setValue("maritalStatus", v)}
                options={MARITAL_STATUS.map((m) => ({ value: m, label: m }))}
              />
              <Input
                name="birthPlace"
                label="Birth Place"
                placeholder="Place of birth"
                value={form.values.birthPlace}
                onChange={(e) => form.setValue("birthPlace", e.target.value)}
              />
              <Input
                name="barcode"
                label="Barcode"
                placeholder="Scan / enter barcode"
                value={form.values.barcode}
                onChange={(e) => form.setValue("barcode", e.target.value)}
              />
            </FormRow>

            <FormRow className="lg:grid-cols-4">
              <Input
                ref={form.registerRef("pregnancyDays")}
                name="pregnancyDays"
                label="Pregnancy Days"
                type="number"
                inputMode="numeric"
                placeholder="If applicable"
                value={String(form.values.pregnancyDays ?? "")}
                onChange={(e) => form.setValue("pregnancyDays", e.target.value)}
                error={form.errorFor("pregnancyDays")}
                hint="1–310 days"
                trailingIcon={validTick("pregnancyDays")}
              />
              <Input
                ref={form.registerRef("staffId")}
                name="staffId"
                label="Staff ID"
                placeholder="If hospital staff"
                value={form.values.staffId}
                onChange={(e) => form.setValue("staffId", e.target.value)}
                error={form.errorFor("staffId")}
                trailingIcon={validTick("staffId")}
              />
              <Input
                ref={form.registerRef("dependentId")}
                name="dependentId"
                label="Dependent ID"
                placeholder="If staff dependent"
                value={form.values.dependentId}
                onChange={(e) => form.setValue("dependentId", e.target.value)}
                error={form.errorFor("dependentId")}
                trailingIcon={validTick("dependentId")}
              />
              <Input
                ref={form.registerRef("familyNumber")}
                name="familyNumber"
                label="Family Number"
                placeholder="Family record number"
                value={form.values.familyNumber}
                onChange={(e) => form.setValue("familyNumber", e.target.value)}
                error={form.errorFor("familyNumber")}
                trailingIcon={validTick("familyNumber")}
              />
            </FormRow>
          </FormSection>

          {/* Contact */}
          <FormSection title="Contact Information">
            <FormRow className="lg:grid-cols-3">
              <Input
                ref={form.registerRef("mobile")}
                name="mobile"
                label="Mobile Number"
                required={!isEdit}
                type="tel"
                placeholder="9845011223"
                value={form.values.mobile}
                onChange={(e) => form.setValue("mobile", e.target.value)}
                error={form.errorFor("mobile")}
                hint={
                  isEdit
                    ? "Not editable here"
                    : "10-digit, or start with + country code (e.g. +91 9845011223)"
                }
                disabled={isEdit}
              />
              <Input
                ref={form.registerRef("alternateMobile")}
                name="alternateMobile"
                label="Alternate Mobile"
                type="tel"
                placeholder="+91 9845011223"
                value={form.values.alternateMobile}
                onChange={(e) =>
                  form.setValue("alternateMobile", e.target.value)
                }
                error={form.errorFor("alternateMobile")}
                hint="Country code allowed (e.g. +91 …)"
                trailingIcon={validTick("alternateMobile")}
              />
              <Input
                ref={form.registerRef("email")}
                name="email"
                label="Email Address"
                type="email"
                placeholder="name@example.com"
                value={form.values.email}
                onChange={(e) => form.setValue("email", e.target.value)}
                error={form.errorFor("email")}
                trailingIcon={validTick("email")}
              />
            </FormRow>

            <FormRow className="lg:grid-cols-3">
              <Input
                name="address"
                label="Local Address"
                placeholder="House / street / locality"
                value={form.values.address}
                onChange={(e) => form.setValue("address", e.target.value)}
              />
              <Input
                name="city"
                label="City"
                placeholder="Enter city"
                value={form.values.city}
                onChange={(e) => form.setValue("city", e.target.value)}
              />
              <Input
                name="permanentAddress"
                label="Permanent Address"
                placeholder="Enter permanent address"
                value={form.values.permanentAddress}
                onChange={(e) =>
                  form.setValue("permanentAddress", e.target.value)
                }
              />
            </FormRow>

            <div className="pt-1">
              <Checkbox
                checked={form.values.sameAsLocalAddress}
                onCheckedChange={(v) => {
                  const same = Boolean(v);
                  form.setValue("sameAsLocalAddress", same);
                  if (same)
                    form.setValue("permanentAddress", form.values.address);
                }}
                label="Permanent address is same as local address"
              />
            </div>

            <FormRow className="lg:grid-cols-4">
              <Input
                name="district"
                label="District"
                value={form.values.district}
                onChange={(e) => form.setValue("district", e.target.value)}
              />
              <Select
                searchable
                searchPlaceholder="Search state…"
                name="state"
                label="State"
                placeholder="Select state"
                options={geoOptions.state}
                value={form.values.state}
                onChange={(v) => form.setValue("state", v)}
              />
              <Select
                searchable
                searchPlaceholder="Search country…"
                name="country"
                label="Country"
                placeholder="Select country"
                options={geoOptions.country}
                value={form.values.country}
                onChange={(v) => form.setValue("country", v)}
              />
              <Input
                ref={form.registerRef("pincode")}
                name="pincode"
                label="Pincode"
                type="tel"
                maxLength={6}
                placeholder="6-digit"
                value={form.values.pincode}
                onChange={(e) =>
                  form.setValue("pincode", digits(e.target.value).slice(0, 6))
                }
                error={form.errorFor("pincode")}
                trailingIcon={validTick("pincode")}
              />
            </FormRow>
          </FormSection>

          {/* Identity */}
          <FormSection
            title="Identity Documents"
            description="Optional — only when provided"
          >
            <FormRow className="lg:grid-cols-2">
              <Input
                ref={form.registerRef("aadhaarNumber")}
                name="aadhaarNumber"
                label="Aadhaar Number"
                type="tel"
                maxLength={12}
                placeholder="12-digit Aadhaar"
                value={form.values.aadhaarNumber}
                onChange={(e) =>
                  form.setValue(
                    "aadhaarNumber",
                    digits(e.target.value).slice(0, 12),
                  )
                }
                error={form.errorFor("aadhaarNumber")}
                trailingIcon={validTick("aadhaarNumber")}
              />
              <Input
                ref={form.registerRef("abhaId")}
                name="abhaId"
                label="ABHA ID"
                type="tel"
                maxLength={14}
                placeholder="14-digit ABHA"
                value={form.values.abhaId}
                onChange={(e) =>
                  form.setValue("abhaId", digits(e.target.value).slice(0, 14))
                }
                error={form.errorFor("abhaId")}
                trailingIcon={validTick("abhaId")}
              />
            </FormRow>

            <FormRow className="lg:grid-cols-3">
              <Select
                name="idProofName"
                label="ID Proof Name"
                placeholder="Select ID proof"
                value={form.values.idProofName}
                onChange={(v) => form.setValue("idProofName", v)}
                options={ID_PROOF_NAMES.map((i) => ({ value: i, label: i }))}
              />
              <Input
                ref={form.registerRef("idProofNo")}
                name="idProofNo"
                label="ID Proof No"
                placeholder="ID proof number"
                value={form.values.idProofNo}
                onChange={(e) => form.setValue("idProofNo", e.target.value)}
                error={form.errorFor("idProofNo")}
                hint="As printed on the selected proof"
                trailingIcon={validTick("idProofNo")}
              />
              <Input
                ref={form.registerRef("nationalId")}
                name="nationalId"
                label="National ID"
                placeholder="National identity number"
                value={form.values.nationalId}
                onChange={(e) => form.setValue("nationalId", e.target.value)}
                error={form.errorFor("nationalId")}
                trailingIcon={validTick("nationalId")}
              />
            </FormRow>

            <FormRow className="lg:grid-cols-3">
              <Input
                ref={form.registerRef("passportNo")}
                name="passportNo"
                label="Passport Number"
                placeholder="If applicable"
                value={form.values.passportNo}
                onChange={(e) => form.setValue("passportNo", e.target.value)}
                error={form.errorFor("passportNo")}
                hint="e.g. P1234567"
                trailingIcon={validTick("passportNo")}
              />
              <Input
                ref={form.registerRef("kraPin")}
                name="kraPin"
                label="KRA Pin"
                placeholder="KRA pin"
                value={form.values.kraPin}
                onChange={(e) => form.setValue("kraPin", e.target.value)}
                error={form.errorFor("kraPin")}
                hint="Format: A123456789B"
                trailingIcon={validTick("kraPin")}
              />
            </FormRow>
          </FormSection>

          {/* Guardian */}
          <FormSection title="Guardian / Next of Kin">
            <FormRow className="lg:grid-cols-3">
              <Input
                name="guardianName"
                label="Guardian Name"
                placeholder="Full name"
                value={form.values.guardianName}
                onChange={(e) => form.setValue("guardianName", e.target.value)}
              />
              <Select
                name="guardianRelation"
                label="Relation"
                placeholder="Select relation"
                value={form.values.guardianRelation}
                onChange={(v) => form.setValue("guardianRelation", v)}
                options={Object.keys(guardianRelations).map((r) => ({
                  value: r,
                  label: r,
                }))}
              />
              <Input
                ref={form.registerRef("guardianMobile")}
                name="guardianMobile"
                label="Guardian Mobile"
                type="tel"
                placeholder="+91 9845011223"
                value={form.values.guardianMobile}
                onChange={(e) =>
                  form.setValue("guardianMobile", e.target.value)
                }
                error={form.errorFor("guardianMobile")}
                hint="Country code allowed (e.g. +91 …)"
                trailingIcon={validTick("guardianMobile")}
              />
            </FormRow>
          </FormSection>

          {/* Other Details */}
          <FormSection
            title="Other Details"
            description="Optional — emergency contact, demographic & referral info"
          >
            <FormRow className="lg:grid-cols-3">
              <Input
                name="occupation"
                label="Occupation"
                placeholder="Enter occupation"
                value={form.values.occupation}
                onChange={(e) => form.setValue("occupation", e.target.value)}
              />
              <Select
                name="religion"
                label="Religion"
                placeholder="Select religion"
                value={form.values.religion}
                onChange={(v) => form.setValue("religion", v)}
                options={RELIGIONS.map((r) => ({ value: r, label: r }))}
              />
            </FormRow>

            <FormRow className="lg:grid-cols-3">
              <Input
                name="emergencyFirstName"
                label="Emg First Name"
                placeholder="Emergency contact first name"
                value={form.values.emergencyFirstName}
                onChange={(e) =>
                  form.setValue("emergencyFirstName", e.target.value)
                }
              />
              <Input
                name="emergencyLastName"
                label="Emg Last Name"
                placeholder="Emergency contact last name"
                value={form.values.emergencyLastName}
                onChange={(e) =>
                  form.setValue("emergencyLastName", e.target.value)
                }
              />
              <Select
                name="emergencyRelation"
                label="Emg Relation"
                placeholder="Select relation"
                value={form.values.emergencyRelation}
                onChange={(v) => form.setValue("emergencyRelation", v)}
                options={Object.keys(guardianRelations).map((r) => ({
                  value: r,
                  label: r,
                }))}
              />
            </FormRow>

            <FormRow className="lg:grid-cols-2">
              <Input
                ref={form.registerRef("emergencyMobile")}
                name="emergencyMobile"
                label="Emg Mobile No"
                type="tel"
                placeholder="+91 9845011223"
                value={form.values.emergencyMobile}
                onChange={(e) =>
                  form.setValue("emergencyMobile", e.target.value)
                }
                error={form.errorFor("emergencyMobile")}
                hint="Country code allowed (e.g. +91 …)"
                trailingIcon={validTick("emergencyMobile")}
              />
              <Input
                ref={form.registerRef("emergencyResidentNo")}
                name="emergencyResidentNo"
                label="Emg Resident No"
                type="tel"
                placeholder="Resident / landline number"
                value={form.values.emergencyResidentNo}
                onChange={(e) =>
                  form.setValue("emergencyResidentNo", e.target.value)
                }
                error={form.errorFor("emergencyResidentNo")}
                trailingIcon={validTick("emergencyResidentNo")}
              />
            </FormRow>

            <FormRow className="lg:grid-cols-2">
              <Input
                name="emergencyAddress"
                label="Emg Address"
                placeholder="Emergency contact address"
                value={form.values.emergencyAddress}
                onChange={(e) =>
                  form.setValue("emergencyAddress", e.target.value)
                }
              />
              <Input
                ref={form.registerRef("internationalNo")}
                name="internationalNo"
                label="International No"
                type="tel"
                placeholder="International contact number"
                value={form.values.internationalNo}
                onChange={(e) =>
                  form.setValue("internationalNo", e.target.value)
                }
                error={form.errorFor("internationalNo")}
                hint="Include + and country code"
                trailingIcon={validTick("internationalNo")}
              />
            </FormRow>

            <div className="pt-1">
              <Checkbox
                checked={form.values.isInternational}
                onCheckedChange={(v) =>
                  form.setValue("isInternational", Boolean(v))
                }
                label="Is International (patient resides outside the country)"
              />
            </div>

            <FormRow className="lg:grid-cols-3">
              <Input
                name="locality"
                label="Locality"
                placeholder="Area / locality"
                value={form.values.locality}
                onChange={(e) => form.setValue("locality", e.target.value)}
              />
              <Input
                ref={form.registerRef("membershipNo")}
                name="membershipNo"
                label="Membership No"
                placeholder="Hospital membership number"
                value={form.values.membershipNo}
                onChange={(e) => form.setValue("membershipNo", e.target.value)}
                error={form.errorFor("membershipNo")}
                trailingIcon={validTick("membershipNo")}
              />
              <Select
                name="patientType"
                label="Patient Type"
                placeholder="Select patient type"
                value={form.values.patientType}
                onChange={(v) => form.setValue("patientType", v)}
                options={PATIENT_TYPES.map((t) => ({ value: t, label: t }))}
                hint="Existing status options: New / Review / Referral / Emergency"
              />
            </FormRow>

            <FormRow className="lg:grid-cols-3">
              <Select
                name="source"
                label="Source"
                placeholder="Select source"
                value={form.values.source}
                onChange={(v) => form.setValue("source", v)}
                options={PATIENT_SOURCES.map((s) => ({ value: s, label: s }))}
              />
              <Input
                ref={form.registerRef("employeeReferenceId")}
                name="employeeReferenceId"
                label="Emp Reference Id"
                placeholder="Employee reference id"
                value={form.values.employeeReferenceId}
                onChange={(e) =>
                  form.setValue("employeeReferenceId", e.target.value)
                }
                error={form.errorFor("employeeReferenceId")}
                trailingIcon={validTick("employeeReferenceId")}
              />
              <Select
                name="referenceType"
                label="Reference Type"
                placeholder="Select reference type"
                value={form.values.referenceType}
                onChange={(v) => form.setValue("referenceType", v)}
                options={REFERENCE_TYPES.map((r) => ({ value: r, label: r }))}
              />
            </FormRow>

            <FormRow className="lg:grid-cols-3">
              <Input
                name="identityMark1"
                label="Identity Mark"
                placeholder="Visible identification mark"
                value={form.values.identityMark1}
                onChange={(e) => form.setValue("identityMark1", e.target.value)}
              />
              <Input
                name="identityMark2"
                label="Identity Mark 2"
                placeholder="Visible identification mark"
                value={form.values.identityMark2}
                onChange={(e) => form.setValue("identityMark2", e.target.value)}
              />
            </FormRow>

            <FormRow className="lg:grid-cols-3">
              <Select
                name="mlcType"
                label="MLC Type"
                placeholder="Select MLC type"
                value={form.values.mlcType}
                onChange={(v) => form.setValue("mlcType", v)}
                options={MLC_TYPES.map((m) => ({ value: m, label: m }))}
              />
              <Input
                ref={form.registerRef("mlcNo")}
                name="mlcNo"
                label="MLC No"
                placeholder="Medico-legal case number"
                value={form.values.mlcNo}
                onChange={(e) => form.setValue("mlcNo", e.target.value)}
                error={form.errorFor("mlcNo")}
                trailingIcon={validTick("mlcNo")}
              />
            </FormRow>
          </FormSection>

          {/* Panel */}
          <FormSection
            title="Scheme Details (Panel / Corporate / Insurance)"
            description="Select panel for cashless rates & co-pay. Leave empty for cash/self-pay."
          >
            <FormRow className="lg:grid-cols-3">
              <Select
                name="panelId"
                label="Select Panel"
                placeholder="Cash / Self Pay"
                value={form.values.panelId}
                onChange={(v) => form.setValue("panelId", v)}
                options={panels}
              />
              <Input
                ref={form.registerRef("panelPolicyNo")}
                name="panelPolicyNo"
                label="Policy / Card / Emp No."
                placeholder="min. 6 characters"
                value={form.values.panelPolicyNo}
                onChange={(e) => form.setValue("panelPolicyNo", e.target.value)}
                error={form.errorFor("panelPolicyNo")}
                trailingIcon={validTick("panelPolicyNo")}
                disabled={!form.values.panelId}
              />
              <DatePicker
                label="Valid Till"
                placeholder="Select date"
                value={form.values.panelValidTill}
                onChange={(v) => form.setValue("panelValidTill", v)}
                disabled={!form.values.panelId}
              />
            </FormRow>

            <FormRow className="lg:grid-cols-4">
              <Input
                name="insuranceGroup"
                label="Insurance Group"
                placeholder="Insurance group"
                value={form.values.insuranceGroup}
                onChange={(e) =>
                  form.setValue("insuranceGroup", e.target.value)
                }
              />
              <Input
                name="insurance"
                label="Insurance"
                placeholder="Insurance company"
                value={form.values.insurance}
                onChange={(e) => form.setValue("insurance", e.target.value)}
              />
              <Input
                ref={form.registerRef("policyCardNo")}
                name="policyCardNo"
                label="Policy Card No"
                placeholder="Card number"
                value={form.values.policyCardNo}
                onChange={(e) => form.setValue("policyCardNo", e.target.value)}
                error={form.errorFor("policyCardNo")}
                hint="As printed on the policy card"
                trailingIcon={validTick("policyCardNo")}
              />
              <Input
                ref={form.registerRef("nameOnCard")}
                name="nameOnCard"
                label="Name On Card"
                placeholder="Name as printed on card"
                value={form.values.nameOnCard}
                onChange={(e) => form.setValue("nameOnCard", e.target.value)}
                error={form.errorFor("nameOnCard")}
                trailingIcon={validTick("nameOnCard")}
              />
            </FormRow>

            <FormRow className="lg:grid-cols-3">
              <Input
                ref={form.registerRef("cardHolder")}
                name="cardHolder"
                label="Card Holder"
                placeholder="Card holder name"
                value={form.values.cardHolder}
                onChange={(e) => form.setValue("cardHolder", e.target.value)}
                error={form.errorFor("cardHolder")}
                trailingIcon={validTick("cardHolder")}
              />
              <Input
                ref={form.registerRef("approvalAmount")}
                name="approvalAmount"
                label="Approval Amount"
                type="number"
                inputMode="decimal"
                placeholder="Approved amount"
                value={String(form.values.approvalAmount ?? "")}
                onChange={(e) =>
                  form.setValue("approvalAmount", e.target.value)
                }
                error={form.errorFor("approvalAmount")}
                hint="e.g. 5000 or 5000.50"
                trailingIcon={validTick("approvalAmount")}
              />
              <Input
                name="approvalRemark"
                label="Approval Remark"
                placeholder="Approval remark"
                value={form.values.approvalRemark}
                onChange={(e) =>
                  form.setValue("approvalRemark", e.target.value)
                }
              />
            </FormRow>
          </FormSection>

          {/* Medical */}
          <FormSection title="Medical & Additional Details">
            <FormRow className="lg:grid-cols-2">
              <Textarea
                name="allergies"
                label="Allergies"
                rows={2}
                placeholder="e.g. Penicillin, or None known"
                value={form.values.allergies}
                onChange={(e) => form.setValue("allergies", e.target.value)}
              />
              <Textarea
                name="chronicDiseases"
                label="Chronic Diseases"
                rows={2}
                placeholder="e.g. Diabetes, hypertension"
                value={form.values.chronicDiseases}
                onChange={(e) =>
                  form.setValue("chronicDiseases", e.target.value)
                }
              />
            </FormRow>

            <FormRow className="lg:grid-cols-2">
              <Select
                name="department"
                label="Department"
                placeholder="Select department"
                value={form.values.department}
                onChange={(v) => form.setValue("department", v)}
                options={departments.map((d) => ({
                  value: String(d.id),
                  label: d.name,
                }))}
              />
            </FormRow>

            <div className="pt-2">
              <Checkbox
                checked={form.values.consentToShare}
                onCheckedChange={(v) =>
                  form.setValue("consentToShare", Boolean(v))
                }
                label="Patient consents to share digital health records (ABDM / care continuity)."
              />
            </div>
          </FormSection>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
            <p className="text-[11.5px] text-ink-400">
              <span className="font-semibold text-coral-500">*</span> required
              fields
            </p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate("/patients")}
              >
                Cancel
              </Button>
              <Button type="submit" loading={form.submitting}>
                {isEdit ? "Update Patient" : "Register Patient"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
