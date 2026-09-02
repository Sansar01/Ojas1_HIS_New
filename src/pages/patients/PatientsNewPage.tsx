import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { patientsApi } from "@/features/slices";
import { samplePatient } from "@/data/formDefaults";
import {
  FormDialog,
  FormRow,
  FormSection,
  PageIntro,
} from "@/components/common";
import { Input, Select, DatePicker, Textarea } from "@/components/ui/fields";
import { Button } from "@/components/ui/primitives";
import { GENDERS, BLOOD_GROUPS, MARITAL_STATUS } from "@/constants";
import { samplePatient as _sample } from "@/data/formDefaults";

export function PatientsNewPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const form = useForm({
    initialValues: samplePatient(),
    schema: {
      firstName: [{ required: "First name is required", min: 2 }],
      lastName: [{ required: "Last name is required", min: 2 }],
      gender: [{ required: "Select a gender" }],
      dateOfBirth: [{ required: "Date of birth is required" }],
      mobile: [
        {
          required: "Mobile number is required",
          pattern: /^[+0-9][0-9\s()-]{7,}$/,
        },
      ],
      email: [{ email: true }],
      emergencyContactNumber: [
        { required: "Emergency contact number is required" },
      ],
      address: [{ required: "Address is required", min: 6 }],
      city: [{ required: "City is required" }],
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    const payload = {
      ...values,
      mrn: `MRN-${240000 + Math.floor(Math.random() * 9999)}`,
      status: "active",
    };
    await dispatch(
      patientsApi.thunks.createOne({
        data: payload,
        successMessage: "Patient registered successfully",
      } as any),
    );
    navigate("/app/patients");
  });

  return (
    <div className="max-w-4xl mx-auto">
      <PageIntro
        title="Register New Patient"
        description="Create a new patient record. All fields marked with * are required."
        back
      />

      <FormDialog
        open
        onOpenChange={(v) => !v && navigate("/app/patients")}
        title="New Patient Registration"
        description="Fill in the patient details below. The form is divided into logical sections."
        onSubmit={handleSubmit}
        loading={form.submitting}
        submitLabel="Register Patient"
      >
        {/* Step 1: Personal Information */}
        <FormSection
          title="Personal Information"
          description="Basic demographic details"
        >
          <FormRow className="lg:grid-cols-4">
            <Input
              name="firstName"
              label="First Name"
              required
              value={form.values.firstName || ""}
              onChange={(e) => form.setValue("firstName", e.target.value)}
              error={form.errors.firstName}
            />
            <Input
              name="lastName"
              label="Last Name"
              required
              value={form.values.lastName || ""}
              onChange={(e) => form.setValue("lastName", e.target.value)}
              error={form.errors.lastName}
            />
            <Select
              name="gender"
              label="Gender"
              required
              value={form.values.gender || "Female"}
              onChange={(v) => form.setValue("gender", v)}
              options={GENDERS.map((g) => ({ value: g, label: g }))}
            />
            <DatePicker
              label="Date of Birth"
              required
              value={form.values.dateOfBirth || ""}
              onChange={(v) => form.setValue("dateOfBirth", v)}
              error={form.errors.dateOfBirth}
            />
          </FormRow>
          <FormRow>
            <Select
              name="maritalStatus"
              label="Marital Status"
              value={form.values.maritalStatus || "Single"}
              onChange={(v) => form.setValue("maritalStatus", v)}
              options={MARITAL_STATUS.map((m) => ({ value: m, label: m }))}
            />
          </FormRow>
        </FormSection>

        {/* Step 2: Contact Information */}
        <FormSection
          title="Contact Information"
          description="How to reach the patient or their emergency contact"
        >
          <FormRow className="lg:grid-cols-2">
            <Input
              name="mobile"
              label="Mobile Number"
              required
              value={form.values.mobile || ""}
              onChange={(e) => form.setValue("mobile", e.target.value)}
              error={form.errors.mobile}
            />
            <Input
              name="email"
              label="Email Address"
              value={form.values.email || ""}
              onChange={(e) => form.setValue("email", e.target.value)}
              error={form.errors.email}
            />
            <Input
              name="address"
              label="Address"
              required
              className="lg:col-span-2"
              value={form.values.address || ""}
              onChange={(e) => form.setValue("address", e.target.value)}
              error={form.errors.address}
            />
            <Input
              name="city"
              label="City"
              required
              value={form.values.city || ""}
              onChange={(e) => form.setValue("city", e.target.value)}
              error={form.errors.city}
            />
          </FormRow>
          <FormRow className="lg:grid-cols-2">
            <Input
              name="emergencyContactName"
              label="Emergency Contact Name"
              value={form.values.emergencyContactName || ""}
              onChange={(e) =>
                form.setValue("emergencyContactName", e.target.value)
              }
            />
            <Input
              name="emergencyContactNumber"
              label="Emergency Contact Number"
              required
              value={form.values.emergencyContactNumber || ""}
              onChange={(e) =>
                form.setValue("emergencyContactNumber", e.target.value)
              }
              error={form.errors.emergencyContactNumber}
            />
          </FormRow>
        </FormSection>

        {/* Step 3: Medical Information */}
        <FormSection
          title="Medical Information"
          description="Clinical background and identifiers"
        >
          <FormRow className="lg:grid-cols-3">
            <Select
              name="bloodGroup"
              label="Blood Group"
              value={form.values.bloodGroup || "O+"}
              onChange={(v) => form.setValue("bloodGroup", v)}
              options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))}
            />
            <Input
              name="heightCm"
              label="Height (cm)"
              type="number"
              value={String(form.values.heightCm || 168)}
              onChange={(e) =>
                form.setValue("heightCm", Number(e.target.value))
              }
            />
            <Input
              name="weightKg"
              label="Weight (kg)"
              type="number"
              value={String(form.values.weightKg || 64)}
              onChange={(e) =>
                form.setValue("weightKg", Number(e.target.value))
              }
            />
          </FormRow>
          <Textarea
            name="allergies"
            label="Allergies"
            rows={2}
            value={form.values.allergies || ""}
            onChange={(e) => form.setValue("allergies", e.target.value)}
          />
          <Textarea
            name="chronicConditions"
            label="Chronic Conditions"
            rows={2}
            value={form.values.chronicConditions || ""}
            onChange={(e) => form.setValue("chronicConditions", e.target.value)}
          />
        </FormSection>
      </FormDialog>

      <div className="flex justify-end mt-4">
        <Button variant="ghost" onClick={() => navigate("/app/patients")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
