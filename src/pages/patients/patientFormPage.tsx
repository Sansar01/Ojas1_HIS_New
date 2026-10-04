import { useEffect, useState } from "react";
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
  Input,
  Select,
  DatePicker,
  Textarea,
  Checkbox,
} from "@/components/ui/fields";
import { Button } from "@/components/ui/primitives";
import { FormSkeleton } from "@/components/ui/feedback";
import {
  GENDERS,
  BLOOD_GROUPS,
  MARITAL_STATUS,
  guardianRelations,
} from "@/constants";
import type { Patient } from "@/types";
import { toBackendBloodGroup, toDisplayBloodGroup } from "@/utils/bloodGroup";

/* ── HELPERS ────────────────────────────────────────────────── */

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

const isMobile = (v: string) => {
  const d = digits(v);
  return (
    /^[6-9]\d{9}$/.test(d) ||
    /^0[6-9]\d{9}$/.test(d) ||
    /^91[6-9]\d{9}$/.test(d)
  );
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
      dispatch(showLoader("Loading"));
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

  const todayISO = new Date().toISOString().slice(0, 10);

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
        optional("guardianMobile", isMobile, "Invalid 10-digit mobile"),
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
      alternateMobile: values.alternateMobile || undefined,
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
      guardianMobile: values.guardianMobile || undefined,
      panelId: values.panelId || undefined,
      panelPolicyNo: values.panelPolicyNo || undefined,
      allergies: values.allergies || undefined,
      chronicDiseases: values.chronicDiseases || undefined,
      department: values.department || undefined,
      consentToShare: values.consentToShare,
      dateOfBirth: toISO(values.dateOfBirth),
      panelValidTill: toISO(values.panelValidTill),
    };

    if (!isEdit) payload.mobile = values.mobile;

    if (values.guardianRelation) {
      payload.guardianRelation =
        guardianRelations[
          values.guardianRelation as keyof typeof guardianRelations
        ] ?? values.guardianRelation.toUpperCase();
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
          <FormSection title="Personal Information">
            <FormRow className="lg:grid-cols-4">
              <Input
                ref={form.registerRef("firstName")}
                name="firstName"
                label="First Name *"
                placeholder="Enter first name"
                value={form.values.firstName}
                onChange={(e) => form.setValue("firstName", e.target.value)}
                error={form.errorFor("firstName")}
              />
              <Input
                ref={form.registerRef("lastName")}
                name="lastName"
                label="Last Name *"
                placeholder="Enter last name"
                value={form.values.lastName}
                onChange={(e) => form.setValue("lastName", e.target.value)}
                error={form.errorFor("lastName")}
              />
              <Select
                name="gender"
                label="Gender *"
                placeholder="Select gender"
                value={form.values.gender}
                onChange={(v) => form.setValue("gender", v)}
                options={GENDERS.map((g) => ({ value: g, label: g }))}
                error={form.errorFor("gender")}
              />

              {/* ⚡ DOB: TYPE OR SELECT SUPPORT */}
              <Input
                name="dateOfBirth"
                label="Date of Birth"
                placeholder="DD/MM/YYYY or YYYY-MM-DD"
                value={form.values.dateOfBirth}
                onChange={(e) => handleDobChange(e.target.value)}
                onBlur={(e) => {
                  const formatted = parseDobInput(e.target.value);
                  if (formatted && formatted !== e.target.value) {
                    form.setValue("dateOfBirth", formatted);
                  }
                }}
                error={form.errorFor("dateOfBirth")}
              />
            </FormRow>

            <FormRow className="lg:grid-cols-4">
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
            </FormRow>
          </FormSection>

          {/* Contact */}
          <FormSection title="Contact Information">
            <FormRow className="lg:grid-cols-3">
              <Input
                ref={form.registerRef("mobile")}
                name="mobile"
                label={isEdit ? "Mobile Number" : "Mobile Number *"}
                type="tel"
                placeholder="e.g. 9845011223"
                value={form.values.mobile}
                onChange={(e) => form.setValue("mobile", e.target.value)}
                error={form.errorFor("mobile")}
                hint={isEdit ? "Not editable here" : undefined}
                disabled={isEdit}
              />
              <Input
                ref={form.registerRef("alternateMobile")}
                name="alternateMobile"
                label="Alternate Mobile"
                type="tel"
                placeholder="Optional"
                value={form.values.alternateMobile}
                onChange={(e) =>
                  form.setValue("alternateMobile", e.target.value)
                }
                error={form.errorFor("alternateMobile")}
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

            <FormRow className="lg:grid-cols-2">
              <Input
                name="address"
                label="Address"
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
            </FormRow>

            <FormRow className="lg:grid-cols-3">
              <Input
                name="district"
                label="District"
                value={form.values.district}
                onChange={(e) => form.setValue("district", e.target.value)}
              />
              <Input
                name="state"
                label="State"
                value={form.values.state}
                onChange={(e) => form.setValue("state", e.target.value)}
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
                placeholder="10-digit number"
                value={form.values.guardianMobile}
                onChange={(e) =>
                  form.setValue("guardianMobile", e.target.value)
                }
                error={form.errorFor("guardianMobile")}
                trailingIcon={validTick("guardianMobile")}
              />
            </FormRow>
          </FormSection>

          {/* Panel */}
          <FormSection
            title="Panel / Corporate / Insurance"
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
              <Input
                name="country"
                label="Country"
                placeholder="India"
                value={form.values.country}
                onChange={(e) => form.setValue("country", e.target.value)}
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
