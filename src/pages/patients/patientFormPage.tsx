import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check } from "lucide-react";
import { useAppDispatch, useRootSelector } from "@/hooks";
import { useForm, type Rule } from "@/hooks/useForm";
import { departmentsApi, patientsApi } from "@/features/slices";
import {
  Emptyish,
  FormRow,
  FormSection,
  PageIntro,
  SectionPanel,
} from "@/components/common";
import { Input, Select, DatePicker, Textarea } from "@/components/ui/fields";
import { Button } from "@/components/ui/primitives";
import {
  GENDERS,
  BLOOD_GROUPS,
  MARITAL_STATUS,
  guardianRelations,
} from "@/constants";
import type { Patient } from "@/types";

/* ---------------------------------------------------------------------------
 * Patient form — register (create) and edit share this page.
 *
 * Validation model
 * ----------------
 *  required      : first name, last name, gender, mobile (mobile only while
 *                  registering — it is not sent on update)
 *  optional      : everything else, including pincode, Aadhaar, ABHA, guardian
 *                  mobile, alternate mobile, email, policy no, employee id.
 *                  Optional fields are validated ONLY when filled.
 *  feedback      : errors appear on blur (or on submit for pickers); a blocked
 *                  submit reveals them all, focuses the first offender and
 *                  raises the portal's standard "Please fill all the required
 *                  fields" toast (FORM_INVALID) — no custom toast, no new UI.
 *  edit safety   : values that already exist on the record and were not touched
 *                  are never blocked (legacy formats such as "+91 98450 22118"
 *                  are tolerated).
 * ------------------------------------------------------------------------- */

/* ------------------------------ normalisers ------------------------------- */

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const text = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const isMobile = (v: string) => {
  const d = digits(v);
  return (
    /^[6-9]\d{9}$/.test(d) || // 9845011223
    /^0[6-9]\d{9}$/.test(d) || // 09845011223
    /^91[6-9]\d{9}$/.test(d) // +91 98450 11223
  );
};
const isPincode = (v: string) => /^[1-9]\d{5}$/.test(digits(v));
const isAadhaar = (v: string) => {
  const d = digits(v);
  return /^\d{12}$/.test(d) && !/^0+$/.test(d);
};
const isAbha = (v: string) => /^\d{14}$/.test(digits(v));
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const isPolicyNo = (v: string) => /^[A-Za-z0-9-]{6,}$/.test(v.trim());
const isEmpId = (v: string) => /^[A-Za-z0-9-]{3,}$/.test(v.trim());

/** Fields whose "unchanged" comparison should ignore formatting. */
const DIGIT_FIELDS = new Set([
  "mobile",
  "alternateMobile",
  "pincode",
  "aadhaarNumber",
  "abhaId",
  "guardianMobile",
]);

export function PatientsFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const patient = useRootSelector((state) =>
    (state.patients?.items ?? []).find(
      (item) => item && String(item.id) === id,
    ),
  ) as Patient | undefined;
  const [loadingPatient, setLoadingPatient] = useState(Boolean(id));

  // load the record whenever the route id changes
  useEffect(() => {
    if (!id) {
      setLoadingPatient(false);
      return;
    }

    setLoadingPatient(true);
    dispatch(patientsApi.thunks.getOne(id) as any)
      .unwrap()
      .catch(() => undefined)
      .finally(() => setLoadingPatient(false));
  }, [dispatch, id]);

  if (loadingPatient) {
    return null;
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

function PatientsFormContent({ patient }: { patient?: Patient }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isEdit = Boolean(patient?.id);
  const departments = useRootSelector((state) => state.departments.items);

  // department options for the dropdown
  useEffect(() => {
    dispatch(departmentsApi.thunks.fetchAll() as any);
  }, [dispatch]);

  const displayBloodGroup = (bloodGroup?: string) => {
    const normalized = String(bloodGroup ?? "O+").toUpperCase();
    return normalized.replace("_POSITIVE", "+").replace("_NEGATIVE", "-");
  };

  /** Seed values — also used to detect "untouched legacy value" on edit. */
  const initialValues = {
    firstName: patient?.firstName ?? "",
    lastName: patient?.lastName ?? "",
    gender: patient?.gender
      ? patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase()
      : "Male",
    dateOfBirth: patient?.dateOfBirth?.slice(0, 10) ?? "",
    age: (patient as any)?.age ?? 0,
    ageUnit: (patient as any)?.ageUnit ?? "years",
    bloodGroup: displayBloodGroup(patient?.bloodGroup),
    maritalStatus: patient?.maritalStatus
      ? patient.maritalStatus.charAt(0) +
        patient.maritalStatus.slice(1).toLowerCase()
      : "Single",
    mobile: patient?.mobile ?? "",
    alternateMobile:
      (patient as any)?.alternateMobile ?? patient?.altMobile ?? "",
    email: patient?.email ?? "",
    address: patient?.address ?? "",
    city: patient?.city ?? "",
    district: (patient as any)?.district ?? "",
    state: (patient as any)?.state ?? "",
    pincode: (patient as any)?.pincode ?? "",
    aadhaarNumber: (patient as any)?.aadhaarNumber ?? "",
    abhaId: (patient as any)?.abhaId ?? "",
    guardianName: (patient as any)?.guardianName ?? "",
    guardianRelation: (patient as any)?.guardianRelation
      ? String((patient as any).guardianRelation).charAt(0) +
        String((patient as any).guardianRelation)
          .slice(1)
          .toLowerCase()
      : "",
    guardianMobile: (patient as any)?.guardianMobile ?? "",
    insuranceProvider: (patient as any)?.insuranceProvider ?? "",
    insurancePolicyNo: (patient as any)?.insurancePolicyNo ?? "",
    insuranceValidTill:
      (patient as any)?.insuranceValidTill?.slice(0, 10) ?? "",
    allergies: patient?.allergies ?? "",
    chronicDiseases:
      (patient as any)?.chronicDiseases ?? patient?.chronicDiseases ?? "",
    companyName: (patient as any)?.companyName ?? "",
    empId: (patient as any)?.empId ?? "",
    coverage: (patient as any)?.coverage ?? "",
    consultingDoctor: (patient as any)?.consultingDoctor ?? "",
    country: (patient as any)?.country ?? "",
    department:
      (patient as any)?.department ?? (patient as any)?.departmentId ?? "",
  };

  const registered = (key: keyof typeof initialValues) =>
    String(initialValues[key] ?? "");

  /**
   * Optional field rule: blank passes, a value that was already on the record
   * (and was not edited) passes, anything else must match the format.
   */
  const optional = (
    key: keyof typeof initialValues,
    test: (v: string) => boolean,
    message: string,
  ): Rule => ({
    message,
    validate: (value: any) => {
      const raw = String(value ?? "").trim();
      if (!raw) return true; // optional — empty is allowed
      const current = DIGIT_FIELDS.has(String(key)) ? digits(raw) : text(raw);
      const existing = DIGIT_FIELDS.has(String(key))
        ? digits(registered(key))
        : text(registered(key));
      if (isEdit && existing && current === existing) return true; // untouched legacy value
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
      alternateMobile: "Alternate mobile",
      email: "Email address",
      pincode: "Pincode",
      aadhaarNumber: "Aadhaar number",
      abhaId: "ABHA ID",
      guardianMobile: "Guardian mobile",
      insurancePolicyNo: "Policy number",
      empId: "Employee ID",
      dateOfBirth: "Date of birth",
      age: "Age",
    },
    // quiet while typing, red on blur, everything revealed on submit
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
      // mobile is not part of the update payload, so it is only mandatory
      // while registering a new patient
      mobile: [
        ...(isEdit ? [] : [{ required: "Mobile number is required" } as Rule]),
        optional("mobile", isMobile, "Enter a valid 10-digit mobile number"),
      ],
      alternateMobile: [
        optional(
          "alternateMobile",
          isMobile,
          "Enter a valid 10-digit mobile number",
        ),
      ],
      email: [optional("email", isEmail, "Enter a valid email address")],
      pincode: [
        optional("pincode", isPincode, "Enter a valid 6-digit Indian pincode"),
      ],
      aadhaarNumber: [
        optional(
          "aadhaarNumber",
          isAadhaar,
          "Aadhaar must be 12 digits (spaces allowed)",
        ),
      ],
      abhaId: [optional("abhaId", isAbha, "ABHA ID must be 14 digits")],
      guardianMobile: [
        optional(
          "guardianMobile",
          isMobile,
          "Enter a valid 10-digit mobile number",
        ),
      ],
      insurancePolicyNo: [
        optional(
          "insurancePolicyNo",
          isPolicyNo,
          "Policy number must be at least 6 letters/numbers",
        ),
      ],
      empId: [
        optional("empId", isEmpId, "Employee ID must be at least 3 characters"),
      ],
      dateOfBirth: [
        {
          message: "Date of birth cannot be in the future",
          validate: (value: any) =>
            !value || String(value) <= todayISO
              ? true
              : "Date of birth cannot be in the future",
        },
      ],
      age: [
        {
          message: "Enter an age between 0 and 129",
          validate: (value: any) => {
            const n = Number(value);
            if (!value && value !== 0) return true;
            if (Number.isNaN(n)) return "Enter a valid age";
            return n >= 0 && n <= 129 ? true : "Enter an age between 0 and 129";
          },
        },
      ],
    },
  });

  /* ------------------------------- submission ------------------------------ */

  const save = async (values: typeof initialValues) => {
    const toISOString = (date: string) =>
      date ? new Date(`${date}T00:00:00.000Z`).toISOString() : "";

    const payload = {
      ...Object.fromEntries(
        Object.entries(values).filter(
          ([key, value]) => value !== "" && !(isEdit && key === "mobile"),
        ),
      ),
      gender: values.gender.toUpperCase(),
      bloodGroup: values.bloodGroup
        .replace("+", "_POSITIVE")
        .replace("-", "_NEGATIVE")
        .toUpperCase(),
      maritalStatus: values.maritalStatus.toUpperCase(),
      ...(!isEdit && { mobile: values.mobile }),
      ...(values.alternateMobile && {
        alternateMobile: values.alternateMobile,
      }),
      ...(values.guardianRelation && {
        guardianRelation: guardianRelations[values.guardianRelation],
      }),
      ...(values.guardianMobile && { guardianMobile: values.guardianMobile }),
      ...(values.dateOfBirth && {
        dateOfBirth: toISOString(values.dateOfBirth),
      }),
      ...(values.insuranceValidTill && {
        insuranceValidTill: toISOString(values.insuranceValidTill),
      }),
    };

    if (isEdit) {
      await dispatch(
        patientsApi.thunks.updateOne({
          id: String(patient!.id),
          data: payload,
          successMessage: "Patient updated successfully",
        } as any),
      ).unwrap();
    } else {
      await dispatch(
        patientsApi.thunks.createOne({
          data: payload,
          successMessage: "Patient registered successfully",
        } as any),
      ).unwrap();
    }
    navigate("/patients");
  };

  const handleSubmit = form.handleSubmit(save as any);

  /**
   * Submit = the portal's standard flow, unchanged.
   *
   * <useForm> validates every field and, when anything is invalid (a required
   * field left empty, or a filled optional field with the wrong format),
   * dispatches the app's existing FORM_INVALID toast —
   * "Please fill all the required fields / Highlighted fields need your
   * attention before submitting." — and focuses the first offender.
   *
   * The only addition here is `revealErrors()`, so every inline message is
   * visible at once (a field the user never blurred would otherwise stay quiet)
   * before that same validation runs.
   */
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault?.();
    if (form.submitting) return;
    form.revealErrors(Object.keys(form.schema));
    await handleSubmit(e);
  };

  /* ------------------------------ render helpers --------------------------- */

  const validTick = (name: keyof typeof initialValues) =>
    form.values[name] && form.isValid([String(name)]) ? (
      <Check className="size-4 text-mint-500" />
    ) : undefined;

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <PageIntro
        title={isEdit ? "Edit Patient" : "Register New Patient"}
        description={
          isEdit
            ? "Update the patient record. Fields marked with * are required; the rest are optional and validated only when filled."
            : "Create a new patient record. Fields marked with * are required; the rest are optional and validated only when filled."
        }
        back
      />

      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <form onSubmit={submit} className="space-y-8" noValidate>
          {/* Personal Information */}
          <FormSection title="Personal Information">
            <FormRow className="lg:grid-cols-4">
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
                ref={form.registerRef("lastName")}
                name="lastName"
                label="Last Name"
                required
                placeholder="Enter last name"
                value={form.values.lastName}
                onChange={(e) => form.setValue("lastName", e.target.value)}
                error={form.errorFor("lastName")}
              />
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
              <DatePicker
                label="Date of Birth"
                placeholder="Select date of birth"
                max={todayISO}
                value={form.values.dateOfBirth}
                onChange={(v) => form.setValue("dateOfBirth", v)}
                error={form.errorFor("dateOfBirth")}
              />
            </FormRow>

            <FormRow className="lg:grid-cols-4">
              <Input
                name="age"
                label="Age"
                type="number"
                inputMode="numeric"
                placeholder="Enter age"
                value={String(form.values.age)}
                onChange={(e) => form.setValue("age", Number(e.target.value))}
                error={form.errorFor("age")}
                hint="Leave 0 for new-borns"
              />
              <Select
                name="ageUnit"
                label="Age Unit"
                placeholder="Select age unit"
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

          {/* Contact Information */}
          <FormSection title="Contact Information">
            <FormRow className="lg:grid-cols-3">
              <Input
                ref={form.registerRef("mobile")}
                name="mobile"
                label="Mobile Number"
                required={!isEdit}
                type="tel"
                autoComplete="tel"
                placeholder="e.g. 98450 11223 or +91 98450 11223"
                value={form.values.mobile}
                onChange={(e) => form.setValue("mobile", e.target.value)}
                error={form.errorFor("mobile")}
                hint={
                  isEdit ? "Mobile is not changed from this screen" : undefined
                }
              />
              <Input
                ref={form.registerRef("alternateMobile")}
                name="alternateMobile"
                label="Alternate Mobile"
                type="tel"
                placeholder="Optional — alternate 10-digit number"
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
                autoComplete="email"
                placeholder="Optional — name@example.com"
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
                placeholder="Enter district"
                value={form.values.district}
                onChange={(e) => form.setValue("district", e.target.value)}
              />
              <Input
                name="state"
                label="State"
                placeholder="Enter state"
                value={form.values.state}
                onChange={(e) => form.setValue("state", e.target.value)}
              />
              <Input
                ref={form.registerRef("pincode")}
                name="pincode"
                label="Pincode"
                type="tel"
                inputMode="numeric"
                maxLength={6}
                placeholder="Optional — 6-digit pincode"
                value={form.values.pincode}
                onChange={(e) =>
                  form.setValue("pincode", digits(e.target.value).slice(0, 6))
                }
                error={form.errorFor("pincode")}
                trailingIcon={validTick("pincode")}
              />
            </FormRow>
          </FormSection>

          {/* Identity Documents */}
          <FormSection
            title="Identity Documents"
            description="Optional — stored only when provided"
          >
            <FormRow className="lg:grid-cols-2">
              <Input
                ref={form.registerRef("aadhaarNumber")}
                name="aadhaarNumber"
                label="Aadhaar Number"
                type="tel"
                inputMode="numeric"
                maxLength={12}
                placeholder="Optional — 12-digit Aadhaar"
                value={form.values.aadhaarNumber}
                onChange={(e) =>
                  form.setValue(
                    "aadhaarNumber",
                    digits(e.target.value).slice(0, 12),
                  )
                }
                error={form.errorFor("aadhaarNumber")}
                hint="Digits only — spaces are ignored, never stored masked"
                trailingIcon={validTick("aadhaarNumber")}
              />
              <Input
                ref={form.registerRef("abhaId")}
                name="abhaId"
                label="ABHA ID"
                type="tel"
                inputMode="numeric"
                maxLength={14}
                placeholder="Optional — 14-digit ABHA ID"
                value={form.values.abhaId}
                onChange={(e) =>
                  form.setValue("abhaId", digits(e.target.value).slice(0, 14))
                }
                error={form.errorFor("abhaId")}
                trailingIcon={validTick("abhaId")}
              />
            </FormRow>
          </FormSection>

          {/* Guardian / NOK */}
          <FormSection title="Guardian / Next of Kin">
            <FormRow className="lg:grid-cols-3">
              <Input
                name="guardianName"
                label="Guardian Name"
                placeholder="Optional — full name"
                value={form.values.guardianName}
                onChange={(e) => form.setValue("guardianName", e.target.value)}
              />
              <Select
                name="guardianRelation"
                label="Relation"
                placeholder="Select relation"
                value={form.values.guardianRelation}
                onChange={(v) => form.setValue("guardianRelation", v)}
                options={Object.keys(guardianRelations).map((relation) => ({
                  value: relation,
                  label: relation,
                }))}
              />
              <Input
                ref={form.registerRef("guardianMobile")}
                name="guardianMobile"
                label="Guardian Mobile"
                type="tel"
                inputMode="numeric"
                placeholder="Optional — guardian 10-digit number"
                value={form.values.guardianMobile}
                onChange={(e) =>
                  form.setValue("guardianMobile", e.target.value)
                }
                error={form.errorFor("guardianMobile")}
                trailingIcon={validTick("guardianMobile")}
              />
            </FormRow>
          </FormSection>

          {/* Insurance */}
          <FormSection title="Insurance Details">
            <FormRow className="lg:grid-cols-3">
              <Input
                name="insuranceProvider"
                label="Insurance Provider"
                placeholder="Optional — e.g. Star Health"
                value={form.values.insuranceProvider}
                onChange={(e) =>
                  form.setValue("insuranceProvider", e.target.value)
                }
              />
              <Input
                ref={form.registerRef("insurancePolicyNo")}
                name="insurancePolicyNo"
                label="Policy Number"
                placeholder="Optional — min. 6 characters"
                value={form.values.insurancePolicyNo}
                onChange={(e) =>
                  form.setValue("insurancePolicyNo", e.target.value)
                }
                error={form.errorFor("insurancePolicyNo")}
                trailingIcon={validTick("insurancePolicyNo")}
              />
              <DatePicker
                label="Valid Till"
                placeholder="Select valid till date"
                value={form.values.insuranceValidTill}
                onChange={(v) => form.setValue("insuranceValidTill", v)}
              />
            </FormRow>
          </FormSection>

          {/* Medical & Employment */}
          <FormSection title="Medical & Employment Details">
            <FormRow className="lg:grid-cols-2">
              <Textarea
                name="allergies"
                label="Allergies"
                rows={2}
                placeholder="Optional — e.g. Penicillin, latex (or 'None known')"
                value={form.values.allergies}
                onChange={(e) => form.setValue("allergies", e.target.value)}
              />
              <Textarea
                name="chronicDiseases"
                label="Chronic Diseases"
                rows={2}
                placeholder="Optional — e.g. Type 2 diabetes, hypertension"
                value={form.values.chronicDiseases}
                onChange={(e) =>
                  form.setValue("chronicDiseases", e.target.value)
                }
              />
            </FormRow>

            <FormRow className="lg:grid-cols-3">
              <Input
                name="companyName"
                label="Company Name"
                placeholder="Optional — corporate tie-up"
                value={form.values.companyName}
                onChange={(e) => form.setValue("companyName", e.target.value)}
              />
              <Input
                ref={form.registerRef("empId")}
                name="empId"
                label="Employee ID"
                placeholder="Optional — min. 3 characters"
                value={form.values.empId}
                onChange={(e) => form.setValue("empId", e.target.value)}
                error={form.errorFor("empId")}
                trailingIcon={validTick("empId")}
              />
              <Input
                name="coverage"
                label="Coverage"
                placeholder="Optional — e.g. ₹5,00,000 floater"
                value={form.values.coverage}
                onChange={(e) => form.setValue("coverage", e.target.value)}
              />
            </FormRow>

            <FormRow className="lg:grid-cols-3">
              <Input
                name="consultingDoctor"
                label="Consulting Doctor"
                placeholder="Optional — referral doctor"
                value={form.values.consultingDoctor}
                onChange={(e) =>
                  form.setValue("consultingDoctor", e.target.value)
                }
              />
              <Input
                name="country"
                label="Country"
                placeholder="Optional — e.g. India"
                value={form.values.country}
                onChange={(e) => form.setValue("country", e.target.value)}
              />
              <Select
                name="department"
                label="Department"
                placeholder="Select department"
                value={form.values.department}
                onChange={(value) => form.setValue("department", value)}
                options={departments.map((department) => ({
                  value: String(department.id),
                  label: department.name,
                }))}
              />
            </FormRow>
          </FormSection>

          {/* Submit Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-ink-100">
            <p className="text-[11.5px] text-ink-400">
              Fields marked with a{" "}
              <span className="font-semibold text-coral-500">*</span> are
              required · optional fields are validated only when filled
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
