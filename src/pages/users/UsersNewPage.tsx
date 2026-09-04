import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useRootSelector } from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { rolesApi, usersApi } from "@/features/slices";
import { PageIntro } from "@/components/common";
import { Input, Select, MultiSelect, Checkbox } from "@/components/ui/fields";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/utils/cn";
import { User, Key, Check } from "lucide-react";

const STEPS = [
  { id: 1, label: "User Info", icon: User },
  { id: 2, label: "Credentials & Roles", icon: Key },
];

export function UsersNewPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items: roles, status: rolesStatus } = useRootSelector((s) => s.roles);
  const departments = useRootSelector((s: any) => s.departments?.items ?? []);

  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    if (rolesStatus === "idle") {
      dispatch(rolesApi.thunks.fetchAll() as any);
    }
  }, [dispatch, rolesStatus]);

  const form = useForm({
    initialValues: {
      // ===== userInfo =====
      firstName: "",
      lastName: "",
      email: "",
      mobile: "",
      userType: "DOCTOR",

      // ===== staffProfile =====
      title: "Dr.",
      designation: "",
      gender: "MALE",

      // ===== roles =====
      primaryRoleId: "",
      additionalRoleIds: [] as string[],

      // ===== departmentIds =====
      departmentIds: [] as string[],

      // ===== credentials =====
      password: "",
      loginType: "PASSWORD",
      forcePasswordChange: true,
      twoFactorEnabled: false,
      sendCredentialsViaSms: false,
      sendCredentialsViaEmail: true,
    },
    schema: {
      firstName: [{ required: "First Name is required" }],
      lastName: [{ required: "Last Name is required" }],
      email: [{ required: "Email is required", email: true }],
      mobile: [{ required: "Mobile is required" }],
      userType: [{ required: "User Type is required" }],
      primaryRoleId: [{ required: "Primary role is required" }],
      password: [{ required: "Password is required", min: 8 }],
    },
  });

  // Step 1 validation before navigating to next step
  const validateStep1 = () => {
    const step1Fields = ["firstName", "lastName", "email", "mobile", "userType"] as const;
    return Object.keys(form.validateFields([...step1Fields])).length === 0;
  };

  const nextStep = () => {
    if (currentStep === 1 && !validateStep1()) return;
    setCurrentStep((p) => Math.min(p + 1, STEPS.length));
  };

  const prevStep = () => setCurrentStep((p) => Math.max(p - 1, 1));

  // Submit — final payload perfectly matches your requested API body
  const handleSubmit = form.handleSubmit(async (values) => {
    const payload = {
      userInfo: {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        mobile: values.mobile.trim(),
        userType: values.userType,
      },
      credentials: {
        password: values.password,
        loginType: values.loginType,
        forcePasswordChange: values.forcePasswordChange,
        twoFactorEnabled: values.twoFactorEnabled,
        sendCredentialsViaSms: values.sendCredentialsViaSms,
        sendCredentialsViaEmail: values.sendCredentialsViaEmail,
      },
      roles: {
        // Parse primaryRoleId as Int/Number, default to 0 if something is wrong
        primaryRoleId: Number(values.primaryRoleId) || 0,
        // Map elements to numbers, return empty array if empty
        additionalRoleIds: (values.additionalRoleIds || []).map(Number),
      },
      // Map elements to numbers, return empty array if empty
      departmentIds: (values.departmentIds || []).map(Number),
      staffProfile: {
        title: values.title,
        designation: values.designation.trim() || undefined, // Send string or undefined
        gender: values.gender,
      },
    };

    await dispatch(
      usersApi.thunks.createOne({
        data: payload,
        successMessage: "User created successfully",
      } as any)
    ).unwrap();
    navigate("/users");
  });

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-6">
      <PageIntro
        title="Add New User"
        description="Create a new portal user with login credentials."
        back
      />

      {/* Stepper UI */}
      <div className="bg-white rounded-xl shadow-sm border border-ink-200 p-4">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            const Icon = step.icon;

            return (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex items-center justify-center size-10 rounded-full border-2 transition-colors",
                      isActive
                        ? "border-primary text-primary bg-primary/10"
                        : isCompleted
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-ink-200 text-ink-400 bg-ink-50"
                    )}
                  >
                    {isCompleted ? <Check className="size-5" /> : <Icon className="size-5" />}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">
                      Step {step.id}
                    </p>
                    <p className={cn("text-sm font-medium", isActive ? "text-ink-900" : "text-ink-600")}>
                      {step.label}
                    </p>
                  </div>
                </div>
                {index < STEPS.length - 1 && <div className="flex-1 mx-4 h-px bg-ink-200" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-sm border border-ink-200 flex flex-col min-h-[500px]"
      >
        {/* Step Header */}
        <div className="px-8 py-5 border-b border-ink-100 bg-ink-50/50">
          <h2 className="text-lg font-semibold text-ink-900">
            Step {currentStep} • {STEPS[currentStep - 1].label}
          </h2>
        </div>

        {/* Body */}
        <div className="p-8 flex-1">
          {/* ================= STEP 1: USER INFO ================= */}
          {currentStep === 1 && (
            <div className="space-y-8">
              {/* Personal Details */}
              <div>
                <h3 className="text-base font-semibold text-ink-900 mb-4">Personal Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                  <Select
                    name="title"
                    label="Title"
                    value={form.values.title}
                    onChange={(v) => form.setValue("title", v)}
                    options={[
                      { value: "Mr.", label: "Mr." },
                      { value: "Ms.", label: "Ms." },
                      { value: "Mrs.", label: "Mrs." },
                      { value: "Dr.", label: "Dr." },
                    ]}
                  />
                  <Input
                    name="firstName"
                    label="First Name *"
                    value={form.values.firstName}
                    onChange={(e) => form.setValue("firstName", e.target.value)}
                    error={form.errors.firstName}
                  />
                  <Input
                    name="lastName"
                    label="Last Name *"
                    value={form.values.lastName}
                    onChange={(e) => form.setValue("lastName", e.target.value)}
                    error={form.errors.lastName}
                  />
                  <Select
                    name="gender"
                    label="Gender"
                    value={form.values.gender}
                    onChange={(v) => form.setValue("gender", v)}
                    options={[
                      { value: "MALE", label: "Male" },
                      { value: "FEMALE", label: "Female" },
                      { value: "OTHER", label: "Other" },
                    ]}
                  />
                  <Input
                    name="designation"
                    label="Designation"
                    placeholder="e.g. Cardiologist"
                    value={form.values.designation}
                    onChange={(e) => form.setValue("designation", e.target.value)}
                  />
                  <Select
                    name="userType"
                    label="User Type *"
                    value={form.values.userType}
                    onChange={(v) => form.setValue("userType", v)}
                    options={[
                      { value: "DOCTOR", label: "Doctor" },
                      { value: "REGULAR_USER", label: "Regular User" },
                    ]}
                    error={form.errors.userType}
                  />
                </div>
              </div>

              {/* Contact Details */}
              <div className="border-t border-ink-100 pt-8">
                <h3 className="text-base font-semibold text-ink-900 mb-4">Contact Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <Input
                    name="email"
                    label="Email Address *"
                    type="email"
                    placeholder="user@hospital.com"
                    value={form.values.email}
                    onChange={(e) => form.setValue("email", e.target.value)}
                    error={form.errors.email}
                  />
                  <Input
                    name="mobile"
                    label="Mobile Number *"
                    placeholder="9876543210"
                    value={form.values.mobile}
                    onChange={(e) => form.setValue("mobile", e.target.value)}
                    error={form.errors.mobile}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 2: CREDENTIALS & ROLES ================= */}
          {currentStep === 2 && (
            <div className="space-y-8">
              {/* Role Assignment */}
              <div>
                <h3 className="text-base font-semibold text-ink-900 mb-4">Role Assignment</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                  <Select
                    name="primaryRoleId"
                    label="Primary Role *"
                    value={form.values.primaryRoleId}
                    onChange={(v) => form.setValue("primaryRoleId", v)}
                    options={roles.map((r: any) => ({ value: String(r.id), label: r.name }))}
                    error={form.errors.primaryRoleId}
                  />
                  <MultiSelect
                    label="Additional Roles"
                    values={form.values.additionalRoleIds}
                    onChange={(v) => form.setValue("additionalRoleIds", v as string[])}
                    options={roles
                      .filter((r: any) => String(r.id) !== form.values.primaryRoleId)
                      .map((r: any) => ({ value: String(r.id), label: r.name }))}
                  />
                  <MultiSelect
                    label="Departments"
                    values={form.values.departmentIds}
                    onChange={(v) => form.setValue("departmentIds", v as string[])}
                    options={departments.map((d: any) => ({ value: String(d.id), label: d.name }))}
                  />
                </div>
              </div>

              {/* Login Credentials */}
              <div className="border-t border-ink-100 pt-8">
                <h3 className="text-base font-semibold text-ink-900 mb-4">Login Credentials</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                  <Input name="username" label="Username (Email)" value={form.values.email} disabled />
                  <Input
                    name="password"
                    label="Temporary Password *"
                    type="password"
                    placeholder="Min. 8 characters"
                    value={form.values.password}
                    onChange={(e) => form.setValue("password", e.target.value)}
                    error={form.errors.password}
                  />
                  <Select
                    name="loginType"
                    label="Login Type"
                    value={form.values.loginType}
                    onChange={(v) => form.setValue("loginType", v)}
                    options={[
                      { value: "PASSWORD", label: "Password" },
                      { value: "SSO", label: "SSO" },
                      { value: "OTP", label: "OTP" },
                    ]}
                  />
                </div>
              </div>

              {/* Security Options */}
              <div className="border-t border-ink-100 pt-8">
                <h3 className="text-base font-semibold text-ink-900 mb-4">Security Options</h3>
                <div className="bg-ink-50 border border-ink-100 rounded-lg p-4 space-y-3">
                  <Checkbox
                    checked={form.values.forcePasswordChange}
                    label="Force password change on first login"
                    onCheckedChange={(c) => form.setValue("forcePasswordChange", !!c)}
                  />
                  <Checkbox
                    checked={form.values.twoFactorEnabled}
                    label="Enable Two Factor Authentication"
                    onCheckedChange={(c) => form.setValue("twoFactorEnabled", !!c)}
                  />
                </div>
              </div>

              {/* Notification Options */}
              <div className="border-t border-ink-100 pt-8">
                <h3 className="text-base font-semibold text-ink-900 mb-4">Send Credentials Via</h3>
                <div className="bg-ink-50 border border-ink-100 rounded-lg p-4 space-y-3">
                  <Checkbox
                    checked={form.values.sendCredentialsViaEmail}
                    label="Send credentials via Email"
                    onCheckedChange={(c) => form.setValue("sendCredentialsViaEmail", !!c)}
                  />
                  <Checkbox
                    checked={form.values.sendCredentialsViaSms}
                    label="Send credentials via SMS"
                    onCheckedChange={(c) => form.setValue("sendCredentialsViaSms", !!c)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Nav */}
        <div className="px-8 py-5 bg-ink-50 border-t border-ink-200 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="w-28"
          >
            ← Previous
          </Button>

          <span className="text-sm text-ink-500 font-medium">
            Step {currentStep} of {STEPS.length}
          </span>

          {currentStep < STEPS.length ? (
            <Button
              type="button"
              onClick={nextStep}
              className="w-28 bg-blue-600 hover:bg-blue-700 text-white"
            >
              Next →
            </Button>
          ) : (
            <Button
              type="submit"
              loading={form.submitting}
              className="w-36 bg-blue-600 hover:bg-blue-700 text-white"
            >
              Create User
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}