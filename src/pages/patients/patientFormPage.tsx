import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppDispatch, useRootSelector } from "@/hooks";
import { useForm } from "@/hooks/useForm";
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

export function PatientsFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const fetchKey = `${id ?? "register"}`;
  const fetchedRef = useState(() => new Set<string>())[0];
  const patient = useRootSelector((state) =>
    (state.patients?.items ?? []).find(
      (item) => item && String(item.id) === id,
    ),
  ) as Patient | undefined;
  const [loadingPatient, setLoadingPatient] = useState(Boolean(id));

  useEffect(() => {
    if (!id) {
      setLoadingPatient(false);
      return;
    }

    if (fetchedRef.has(fetchKey)) return;
    fetchedRef.add(fetchKey);

    dispatch(patientsApi.thunks.getOne(id) as any)
      .unwrap()
      .catch(() => undefined)
      .finally(() => setLoadingPatient(false));
  }, [dispatch, fetchKey, fetchedRef, id]);

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
  const departmentsFetchedRef = useState(() => ({ current: false }))[0];

  useEffect(() => {
    if (departmentsFetchedRef.current) return;
    departmentsFetchedRef.current = true;
    dispatch(departmentsApi.thunks.fetchAll() as any);
  }, [departmentsFetchedRef, dispatch]);

  const displayBloodGroup = (bloodGroup?: string) => {
    const normalized = String(bloodGroup ?? "O+").toUpperCase();
    return normalized.replace("_POSITIVE", "+").replace("_NEGATIVE", "-");
  };

  const form = useForm({
    initialValues: {
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
        (patient as any)?.chronicDiseases ?? patient?.chronicConditions ?? "",
      companyName: (patient as any)?.companyName ?? "",
      empId: (patient as any)?.empId ?? "",
      coverage: (patient as any)?.coverage ?? "",
      consultingDoctor: (patient as any)?.consultingDoctor ?? "",
      country: (patient as any)?.country ?? "",
      department:
        (patient as any)?.department ?? (patient as any)?.departmentId ?? "",
    },
    schema: {
      firstName: [{ required: "First name is required", min: 2 }],
      lastName: [{ required: "Last name is required", min: 2 }],
      gender: [{ required: "Select a gender" }],
      mobile: [{ required: "Mobile number is required" }],
      pincode: [
        {
          pattern: /^[1-9][0-9]{5}$/,
          message: "Enter a valid 6-digit Indian pincode",
        },
      ],
      aadhaarNumber: [
        {
          pattern: /^[0-9]{12}$/,
          message: "Enter a valid 12-digit Aadhaar number",
        },
      ],
      email: [{ email: true }],
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
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
  });

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <PageIntro
        title={isEdit ? "Edit Patient" : "Register New Patient"}
        description={
          isEdit
            ? "Update the patient record. All fields marked with * are required."
            : "Create a new patient record. All fields marked with * are required."
        }
        back
      />

      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Step 1: Personal Information */}
          <FormSection title="Personal Information">
            <FormRow className="lg:grid-cols-4">
              <Input
                name="firstName"
                label="First Name"
                required
                placeholder="Enter first name"
                value={form.values.firstName}
                onChange={(e) => form.setValue("firstName", e.target.value)}
                error={form.errors.firstName}
              />
              <Input
                name="lastName"
                label="Last Name"
                required
                placeholder="Enter last name"
                value={form.values.lastName}
                onChange={(e) => form.setValue("lastName", e.target.value)}
                error={form.errors.lastName}
              />
              <Select
                name="gender"
                label="Gender"
                required
                placeholder="Select gender"
                value={form.values.gender}
                onChange={(v) => form.setValue("gender", v)}
                options={GENDERS.map((g) => ({ value: g, label: g }))}
              />
              <DatePicker
                label="Date of Birth"
                placeholder="Select date of birth"
                value={form.values.dateOfBirth}
                onChange={(v) => form.setValue("dateOfBirth", v)}
              />
            </FormRow>

            <FormRow className="lg:grid-cols-4">
              <Input
                name="age"
                label="Age"
                type="number"
                placeholder="Enter age"
                value={String(form.values.age)}
                onChange={(e) => form.setValue("age", Number(e.target.value))}
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

          {/* Step 2: Contact Information */}
          <FormSection title="Contact Information">
            <FormRow className="lg:grid-cols-3">
              <Input
                name="mobile"
                label="Mobile Number"
                required
                placeholder="Enter mobile number"
                value={form.values.mobile}
                onChange={(e) => form.setValue("mobile", e.target.value)}
                error={form.errors.mobile}
              />
              <Input
                name="alternateMobile"
                label="Alternate Mobile"
                placeholder="Enter alternate mobile"
                value={form.values.alternateMobile}
                onChange={(e) =>
                  form.setValue("alternateMobile", e.target.value)
                }
              />
              <Input
                name="email"
                label="Email Address"
                placeholder="Enter email address"
                value={form.values.email}
                onChange={(e) => form.setValue("email", e.target.value)}
                error={form.errors.email}
              />
            </FormRow>

            <FormRow className="lg:grid-cols-2">
              <Input
                name="address"
                label="Address"
                placeholder="Enter address"
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
                name="pincode"
                label="Pincode"
                placeholder="Enter pincode"
                value={form.values.pincode}
                onChange={(e) => form.setValue("pincode", e.target.value)}
              />
            </FormRow>
          </FormSection>

          {/* Step 3: Identity Documents */}
          <FormSection title="Identity Documents">
            <FormRow className="lg:grid-cols-2">
              <Input
                name="aadhaarNumber"
                label="Aadhaar Number"
                placeholder="Enter Aadhaar number"
                value={form.values.aadhaarNumber}
                onChange={(e) => form.setValue("aadhaarNumber", e.target.value)}
              />
              <Input
                name="abhaId"
                label="ABHA ID"
                placeholder="Enter ABHA ID"
                value={form.values.abhaId}
                onChange={(e) => form.setValue("abhaId", e.target.value)}
              />
            </FormRow>
          </FormSection>

          {/* Step 4: Guardian / NOK */}
          <FormSection title="Guardian / Next of Kin">
            <FormRow className="lg:grid-cols-3">
              <Input
                name="guardianName"
                label="Guardian Name"
                placeholder="Enter guardian name"
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
                name="guardianMobile"
                label="Guardian Mobile"
                placeholder="Enter guardian mobile"
                value={form.values.guardianMobile}
                onChange={(e) =>
                  form.setValue("guardianMobile", e.target.value)
                }
              />
            </FormRow>
          </FormSection>

          {/* Step 5: Insurance */}
          <FormSection title="Insurance Details">
            <FormRow className="lg:grid-cols-3">
              <Input
                name="insuranceProvider"
                label="Insurance Provider"
                placeholder="Enter insurance provider"
                value={form.values.insuranceProvider}
                onChange={(e) =>
                  form.setValue("insuranceProvider", e.target.value)
                }
              />
              <Input
                name="insurancePolicyNo"
                label="Policy Number"
                placeholder="Enter policy number"
                value={form.values.insurancePolicyNo}
                onChange={(e) =>
                  form.setValue("insurancePolicyNo", e.target.value)
                }
              />
              <DatePicker
                label="Valid Till"
                placeholder="Select valid till date"
                value={form.values.insuranceValidTill}
                onChange={(v) => form.setValue("insuranceValidTill", v)}
              />
            </FormRow>
          </FormSection>

          {/* Step 6: Medical & Employment */}
          <FormSection title="Medical & Employment Details">
            <FormRow className="lg:grid-cols-2">
              <Textarea
                name="allergies"
                label="Allergies"
                rows={2}
                placeholder="Enter allergies"
                value={form.values.allergies}
                onChange={(e) => form.setValue("allergies", e.target.value)}
              />
              <Textarea
                name="chronicDiseases"
                label="Chronic Diseases"
                rows={2}
                placeholder="Enter chronic diseases"
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
                placeholder="Enter company name"
                value={form.values.companyName}
                onChange={(e) => form.setValue("companyName", e.target.value)}
              />
              <Input
                name="empId"
                label="Employee ID"
                placeholder="Enter employee ID"
                value={form.values.empId}
                onChange={(e) => form.setValue("empId", e.target.value)}
              />
              <Input
                name="coverage"
                label="Coverage"
                placeholder="Enter coverage details"
                value={form.values.coverage}
                onChange={(e) => form.setValue("coverage", e.target.value)}
              />
            </FormRow>

            <FormRow className="lg:grid-cols-3">
              <Input
                name="consultingDoctor"
                label="Consulting Doctor"
                placeholder="Enter consulting doctor"
                value={form.values.consultingDoctor}
                onChange={(e) =>
                  form.setValue("consultingDoctor", e.target.value)
                }
              />
              <Input
                name="country"
                label="Country"
                placeholder="Enter country"
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
          <div className="flex justify-end gap-3 pt-4 border-t border-ink-100">
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
        </form>
      </div>
    </div>
  );
}
