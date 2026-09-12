import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Ban,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  IdCard,
  KeyRound,
  Layers,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
} from "lucide-react";
import { useAppDispatch, useRootSelector } from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { rolesApi, usersApi } from "@/features/slices";
import { FormSection, PageIntro } from "@/components/common";
import { Avatar, Badge, Button, Panel } from "@/components/ui/primitives";
import {
  Checkbox,
  Input,
  MultiSelect,
  Select,
  Switch,
} from "@/components/ui/fields";
import { toast } from "@/features/ui/uiSlice";
import { cn } from "@/utils/cn";

/* ---------------------------------------------------------------------------
 * Add user — two-step wizard.
 *
 * Step 1  User info            → identity, user type & contact details
 * Step 2  Credentials & roles  → stays locked until step 1 is valid
 *
 * Validation is field-level (see useForm): a field shows its red message once
 * it has been blurred or a step/submit attempt was made, the asterisk marks
 * required fields, and attempting to advance with missing fields raises a
 * toast naming them. The API payload is unchanged.
 * ------------------------------------------------------------------------- */

const STEPS = [
  {
    id: 1,
    label: "User info",
    hint: "Identity, user type & contact",
    icon: UserRound,
  },
  {
    id: 2,
    label: "Credentials & roles",
    hint: "Role assignment, login & security",
    icon: KeyRound,
  },
] as const;

/** Fields that gate the move from step 1 to step 2. */
const STEP_1_FIELDS = ["firstName", "lastName", "email", "mobile", "userType"];
/** Everything validated when the form is submitted. */
const ALL_FIELDS = [...STEP_1_FIELDS, "primaryRoleId", "password"];

/* ---------------------------- password strength --------------------------- */

function passwordScore(value: string) {
  if (!value) return { score: 0, label: "Empty", tone: "bg-ink-200" };
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value) || value.length >= 12) score += 1;
  const labels = ["Weak", "Fair", "Good", "Strong"];
  const tones = [
    "bg-coral-500",
    "bg-amberly-500",
    "bg-lagoon-500",
    "bg-mint-500",
  ];
  return {
    score,
    label: labels[score - 1] ?? "Weak",
    tone: tones[score - 1] ?? "bg-coral-500",
  };
}

/* --------------------------------- stepper -------------------------------- */

function Stepper({
  current,
  completed,
  isLocked,
  onSelect,
}: {
  current: number;
  completed: number[];
  isLocked: (id: number) => boolean;
  onSelect: (step: (typeof STEPS)[number]) => void;
}) {
  const progress = Math.round((completed.length / STEPS.length) * 100);

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:gap-3">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = current === step.id;
          const isCompleted = completed.includes(step.id);
          const locked = isLocked(step.id);

          const circle = cn(
            "grid size-10 shrink-0 place-items-center rounded-full border transition-all duration-200",
            isCompleted
              ? "border-mint-500 bg-mint-500 text-white"
              : isActive
                ? "border-brand-600 bg-brand-600 text-white ring-4 ring-brand-500/20"
                : locked
                  ? "border-dashed border-ink-200 bg-ink-50 text-ink-300"
                  : "border-ink-200 bg-white text-ink-500",
            locked &&
              "group-hover:border-coral-300 group-hover:bg-coral-50 group-hover:text-coral-500",
          );

          return (
            <div
              key={step.id}
              className="flex min-w-0 items-center gap-2 sm:flex-1 sm:last:flex-none"
            >
              <button
                type="button"
                onClick={() => onSelect(step)}
                aria-current={isActive ? "step" : undefined}
                aria-disabled={locked || undefined}
                title={locked ? "Complete step 1 to unlock" : step.hint}
                className={cn(
                  "group flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-all duration-150 sm:flex-none",
                  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20",
                  locked
                    ? "cursor-not-allowed"
                    : isActive
                      ? "bg-brand-25 ring-1 ring-inset ring-brand-200"
                      : "cursor-pointer hover:bg-ink-25",
                )}
              >
                <span className={circle}>
                  {isCompleted ? (
                    <Check className="size-5" strokeWidth={2.6} />
                  ) : locked ? (
                    <>
                      <Icon className="size-4.5 group-hover:hidden" />
                      <Ban className="hidden size-4.5 group-hover:block" />
                    </>
                  ) : (
                    <Icon className="size-4.5" />
                  )}
                </span>

                <span className="min-w-0">
                  <span
                    className={cn(
                      "flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.13em]",
                      locked
                        ? "text-ink-300"
                        : isActive
                          ? "text-brand-600"
                          : "text-ink-400",
                    )}
                  >
                    Step {step.id}
                    {locked && (
                      <>
                        <Lock className="size-3 group-hover:hidden" />
                        <Ban className="hidden size-3 group-hover:block" />
                      </>
                    )}
                  </span>
                  <span
                    className={cn(
                      "block truncate text-[13.5px] font-semibold",
                      locked
                        ? "text-ink-400"
                        : isActive
                          ? "text-ink-900"
                          : "text-ink-600",
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="hidden truncate text-[11px] text-ink-400 sm:block">
                    {locked ? "Locked — finish step 1" : step.hint}
                  </span>
                </span>
              </button>

              {index < STEPS.length - 1 && (
                <span className="hidden h-0.5 flex-1 overflow-hidden rounded-full bg-ink-100 sm:block">
                  <span
                    className={cn(
                      "block h-full rounded-full bg-mint-500 transition-all duration-500",
                      isCompleted ? "w-full" : "w-0",
                    )}
                  />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ---------------------------------- page ---------------------------------- */

export function UsersNewPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items: roles, status: rolesStatus } = useRootSelector((s) => s.roles);
  const departments = useRootSelector((s: any) => s.departments?.items ?? []);

  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);

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
    labels: {
      firstName: "First name",
      lastName: "Last name",
      email: "Email address",
      mobile: "Mobile number",
      userType: "User type",
      primaryRoleId: "Primary role",
      password: "Temporary password",
    },
    // errors appear on blur / step attempt instead of on the first keystroke
    validateOnChange: false,
    validateOnBlur: true,
    schema: {
      firstName: [
        { required: "First name is required" },
        { min: 2, message: "Use at least 2 characters" },
        {
          pattern: /^[A-Za-z][A-Za-z .'-]*$/,
          message: "Letters, spaces, apostrophes and hyphens only",
        },
      ],
      lastName: [
        { required: "Last name is required" },
        { min: 2, message: "Use at least 2 characters" },
        {
          pattern: /^[A-Za-z][A-Za-z .'-]*$/,
          message: "Letters, spaces, apostrophes and hyphens only",
        },
      ],
      email: [{ required: "Email address is required", email: true }],
      mobile: [
        { required: "Mobile number is required" },
        {
          pattern: /^(\+?\d{1,3}[\s-]?)?\d{10}$/,
          message: "Enter a 10-digit mobile number (optionally with +91)",
        },
      ],
      userType: [{ required: "User type is required" }],
      primaryRoleId: [{ required: "Primary role is required" }],
      password: [
        { required: "Temporary password is required" },
        { min: 8, message: "Use at least 8 characters" },
      ],
    },
  });

  /* ------------------------------ step helpers ----------------------------- */

  const step1Missing = useMemo(
    () => form.missingFields(STEP_1_FIELDS as unknown as string[]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.values, form.missingFields],
  );

  const step2Unlocked = step1Missing.length === 0;
  const isLocked = (id: number) => id > 1 && !step2Unlocked;
  const completedSteps = useMemo(
    () =>
      [1, 2].filter((id) => id < currentStep || (id === 1 && step2Unlocked)),
    [currentStep, step2Unlocked],
  );

  /** Attempting to advance with missing fields → highlight them + toast. */
  const nextStep = () => {
    if (currentStep === 1) {
      const missing = form.missingFields(STEP_1_FIELDS as unknown as string[]);
      if (missing.length) {
        form.revealErrors(STEP_1_FIELDS as unknown as string[]);
        dispatch(
          toast.error(
            `Step 1 is incomplete · ${missing.length} required field${missing.length > 1 ? "s" : ""}`,
            `${missing.map((m) => m.label).join(" · ")} ${missing.length > 1 ? "are" : "is"} still empty.`,
          ),
        );
        form.focusField(missing[0].name);
        return;
      }
    }
    setCurrentStep((p) => Math.min(p + 1, STEPS.length));
  };

  const prevStep = () => setCurrentStep((p) => Math.max(p - 1, 1));

  const selectStep = (step: (typeof STEPS)[number]) => {
    if (step.id <= currentStep) {
      setCurrentStep(step.id);
      return;
    }
    const missing = form.missingFields(STEP_1_FIELDS as unknown as string[]);
    form.revealErrors(STEP_1_FIELDS as unknown as string[]);
    dispatch(
      toast.warning(
        `${step.label} is locked`,
        missing.length
          ? `Complete ${missing.map((m) => m.label).join(" · ")} in step 1 to unlock it.`
          : "Complete step 1 to unlock it.",
      ),
    );
    if (missing.length) form.focusField(missing[0].name);
  };

  const password = passwordScore(form.values.password);
  const stepMeta = STEPS[currentStep - 1];

  /* --------------------------------- submit -------------------------------- */

  // Submit — final payload perfectly matches the requested API body
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
      } as any),
    ).unwrap();
    navigate("/users");
  });

  /** Submit from step 2 reveals anything still open and toasts the summary. */
  const submit = async () => {
    const missing = form.missingFields(ALL_FIELDS);
    if (missing.length) {
      form.revealErrors(ALL_FIELDS);
      if (missing.some((m) => STEP_1_FIELDS.includes(m.name)))
        setCurrentStep(1);
      dispatch(
        toast.error(
          "Cannot create the user yet",
          `${missing.map((m) => m.label).join(" · ")} still need${missing.length > 1 ? "" : "s"} attention.`,
        ),
      );
      form.focusField(missing[0].name);
      return;
    }
    await handleSubmit();
  };

  /* ---------------------------------- render -------------------------------- */

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-12">
      <PageIntro
        title="Add new user"
        description="Create a portal user with login credentials. Required fields are marked with a red asterisk and validated as you go."
        back
        meta={
          <>
            <Badge tone="brand" size="xs" dot>
              {roles.length} roles available
            </Badge>
            <Badge tone="neutral" size="xs">
              {departments.length} departments
            </Badge>
            <Badge tone="mint" size="xs" dot>
              {step2Unlocked ? "Ready for credentials" : "Step 1 in progress"}
            </Badge>
          </>
        }
      />

      <Stepper
        current={currentStep}
        completed={completedSteps}
        isLocked={isLocked}
        onSelect={selectStep}
      />

      <form onSubmit={handleSubmit} noValidate>
        <Panel className="animate-fade-up">
          {/* ------------------------------ card header ------------------------ */}
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 [&>svg]:size-5">
                <stepMeta.icon />
              </span>
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand-600">
                  Step {currentStep}
                </p>
                <h2 className="font-display text-[17px] font-semibold leading-tight text-ink-900">
                  {stepMeta.label}
                </h2>
              </div>
            </div>
          </div>

          {/* --------------------------------- body --------------------------- */}
          <div className="space-y-7 px-5 py-5">
            {/* ==================== STEP 1 — USER INFO ==================== */}
            {currentStep === 1 && (
              <>
                <FormSection title="Identity">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Select
                      name="title"
                      label="Title"
                      placeholder="Select title"
                      value={form.values.title}
                      onChange={(v) => form.setValue("title", v)}
                      options={["Mr.", "Ms.", "Mrs.", "Dr."].map((t) => ({
                        value: t,
                        label: t,
                      }))}
                    />
                    <Input
                      ref={form.registerRef("firstName")}
                      name="firstName"
                      label="First name"
                      required
                      autoComplete="given-name"
                      placeholder="e.g. Meera"
                      leadingIcon={<IdCard />}
                      value={form.values.firstName}
                      onChange={(e) =>
                        form.setValue("firstName", e.target.value)
                      }
                      error={form.errorFor("firstName")}
                      trailingIcon={
                        form.isValid(["firstName"]) && form.values.firstName ? (
                          <Check className="size-4 text-mint-500" />
                        ) : undefined
                      }
                    />
                    <Input
                      ref={form.registerRef("lastName")}
                      name="lastName"
                      label="Last name"
                      required
                      autoComplete="family-name"
                      placeholder="e.g. Nair"
                      leadingIcon={<IdCard />}
                      value={form.values.lastName}
                      onChange={(e) =>
                        form.setValue("lastName", e.target.value)
                      }
                      error={form.errorFor("lastName")}
                      trailingIcon={
                        form.isValid(["lastName"]) && form.values.lastName ? (
                          <Check className="size-4 text-mint-500" />
                        ) : undefined
                      }
                    />
                    <Select
                      name="gender"
                      label="Gender"
                      placeholder="Select gender"
                      value={form.values.gender}
                      onChange={(v) => form.setValue("gender", v)}
                      options={[
                        { value: "MALE", label: "Male" },
                        { value: "FEMALE", label: "Female" },
                        { value: "OTHER", label: "Other" },
                      ]}
                    />
                  </div>
                </FormSection>

                <FormSection title="Work profile">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Select
                      name="userType"
                      label="User type"
                      required
                      placeholder="Select user type"
                      hint="Doctors get the clinical workspace; regular users get operational modules"
                      value={form.values.userType}
                      onChange={(v) => form.setValue("userType", v)}
                      options={[
                        {
                          value: "DOCTOR",
                          label: "Doctor",
                          description: "OPD, consultations & prescriptions",
                        },
                        {
                          value: "REGULAR_USER",
                          label: "Regular user",
                          description: "Front desk, billing & records",
                        },
                      ]}
                      error={form.errorFor("userType")}
                    />
                    <Input
                      name="designation"
                      label="Designation"
                      placeholder="e.g. Consultant cardiologist"
                      leadingIcon={<Layers />}
                      value={form.values.designation}
                      onChange={(e) =>
                        form.setValue("designation", e.target.value)
                      }
                      hint="Optional — printed next to the name"
                    />
                  </div>
                </FormSection>

                <FormSection title="Contact details">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      ref={form.registerRef("email")}
                      name="email"
                      type="email"
                      label="Email address"
                      required
                      autoComplete="email"
                      placeholder="name@hospital.com"
                      leadingIcon={<Mail />}
                      value={form.values.email}
                      onChange={(e) => form.setValue("email", e.target.value)}
                      error={form.errorFor("email")}
                      hint="This doubles as the username"
                      trailingIcon={
                        form.isValid(["email"]) && form.values.email ? (
                          <Check className="size-4 text-mint-500" />
                        ) : undefined
                      }
                    />
                    <Input
                      ref={form.registerRef("mobile")}
                      name="mobile"
                      type="tel"
                      label="Mobile number"
                      required
                      autoComplete="tel"
                      placeholder="+91 98765 43210"
                      leadingIcon={<Phone />}
                      value={form.values.mobile}
                      onChange={(e) => form.setValue("mobile", e.target.value)}
                      error={form.errorFor("mobile")}
                      hint="10 digits — used for login alerts and SMS credentials"
                      trailingIcon={
                        form.isValid(["mobile"]) && form.values.mobile ? (
                          <Check className="size-4 text-mint-500" />
                        ) : undefined
                      }
                    />
                  </div>
                </FormSection>
              </>
            )}

            {/* ================ STEP 2 — CREDENTIALS & ROLES ================ */}
            {currentStep === 2 && (
              <>
                <FormSection
                  title="Role assignment"
                  description="Primary role decides the module menu; extra roles are additive"
                >
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Select
                      name="primaryRoleId"
                      label="Primary role"
                      required
                      placeholder="Select a role"
                      hint={
                        roles.length
                          ? undefined
                          : "No roles loaded — create a role first (Roles & permissions)"
                      }
                      value={form.values.primaryRoleId}
                      onChange={(v) => form.setValue("primaryRoleId", v)}
                      options={roles.map((r: any) => ({
                        value: String(r.id),
                        label: r.name,
                      }))}
                      error={form.errorFor("primaryRoleId")}
                    />
                    <MultiSelect
                      label="Additional roles"
                      placeholder="Add secondary roles"
                      hint="Used for cross-cover duties"
                      values={form.values.additionalRoleIds}
                      onChange={(v) =>
                        form.setValue("additionalRoleIds", v as string[])
                      }
                      options={roles
                        .filter(
                          (r: any) =>
                            String(r.id) !== form.values.primaryRoleId,
                        )
                        .map((r: any) => ({
                          value: String(r.id),
                          label: r.name,
                        }))}
                    />
                    <MultiSelect
                      label="Departments"
                      placeholder="Assign departments"
                      hint="Scope of clinical / operational access"
                      values={form.values.departmentIds}
                      onChange={(v) =>
                        form.setValue("departmentIds", v as string[])
                      }
                      options={departments.map((d: any) => ({
                        value: String(d.id),
                        label: d.name,
                      }))}
                    />
                  </div>
                </FormSection>

                <FormSection
                  title="Login credentials"
                  description="Shared with the user depending on the options below"
                >
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Input
                      name="username"
                      label="Username (email)"
                      value={form.values.email}
                      disabled
                      readOnly
                      leadingIcon={<Mail />}
                      hint="Same as the email entered in step 1"
                    />
                    <div className="space-y-2">
                      <Input
                        ref={form.registerRef("password")}
                        name="password"
                        type={showPassword ? "text" : "password"}
                        label="Temporary password"
                        required
                        autoComplete="new-password"
                        placeholder="Minimum 8 characters"
                        leadingIcon={<Lock />}
                        value={form.values.password}
                        onChange={(e) =>
                          form.setValue("password", e.target.value)
                        }
                        error={form.errorFor("password")}
                        trailingIcon={
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
                            className="pointer-events-auto rounded p-0.5 text-ink-400 transition-colors hover:text-ink-700"
                          >
                            {showPassword ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </button>
                        }
                      />
                      {form.values.password && (
                        <div className="flex items-center gap-2">
                          <span className="flex flex-1 gap-1">
                            {[1, 2, 3, 4].map((i) => (
                              <span
                                key={i}
                                className={cn(
                                  "h-1.5 flex-1 rounded-full transition-colors",
                                  i <= password.score
                                    ? password.tone
                                    : "bg-ink-100",
                                )}
                              />
                            ))}
                          </span>
                          <span
                            className={cn(
                              "text-[11px] font-semibold",
                              password.score >= 3
                                ? "text-mint-600"
                                : password.score === 2
                                  ? "text-lagoon-600"
                                  : "text-coral-600",
                            )}
                          >
                            {password.label}
                          </span>
                        </div>
                      )}
                    </div>
                    <Select
                      name="loginType"
                      label="Login type"
                      placeholder="Select login type"
                      value={form.values.loginType}
                      onChange={(v) => form.setValue("loginType", v)}
                      options={[
                        {
                          value: "PASSWORD",
                          label: "Password",
                          description: "Email + password",
                        },
                        {
                          value: "SSO",
                          label: "SSO",
                          description: "Hospital identity provider",
                        },
                        {
                          value: "OTP",
                          label: "OTP",
                          description: "One-time code on mobile",
                        },
                      ]}
                      hint="SSO / OTP ignore the temporary password"
                    />
                  </div>
                </FormSection>

                <FormSection
                  title="Security"
                  description="Applied from the first sign-in"
                >
                  <div className="grid gap-3 rounded-xl border border-ink-100 bg-ink-25/60 p-4 sm:grid-cols-2">
                    <Switch
                      checked={form.values.forcePasswordChange}
                      onCheckedChange={(c) =>
                        form.setValue("forcePasswordChange", !!c)
                      }
                      label="Force password change"
                      description="Prompt on first login"
                    />
                    <Switch
                      checked={form.values.twoFactorEnabled}
                      onCheckedChange={(c) =>
                        form.setValue("twoFactorEnabled", !!c)
                      }
                      label="Two-factor authentication"
                      description="OTP on every new device"
                    />
                  </div>
                </FormSection>

                <FormSection
                  title="Send credentials via"
                  description="Pick at least one delivery channel"
                >
                  <div className="grid gap-3 rounded-xl border border-ink-100 bg-ink-25/60 p-4 sm:grid-cols-2">
                    <Checkbox
                      checked={form.values.sendCredentialsViaEmail}
                      label="Email"
                      description="Send to the address above"
                      onCheckedChange={(c) =>
                        form.setValue("sendCredentialsViaEmail", !!c)
                      }
                    />
                    <Checkbox
                      checked={form.values.sendCredentialsViaSms}
                      label="SMS"
                      description="Send to the mobile number above"
                      onCheckedChange={(c) =>
                        form.setValue("sendCredentialsViaSms", !!c)
                      }
                    />
                  </div>
                  {!form.values.sendCredentialsViaEmail &&
                    !form.values.sendCredentialsViaSms && (
                      <p className="mt-2 flex items-center gap-1.5 text-[11.5px] font-medium text-amberly-600">
                        <ShieldCheck className="size-3.5" />
                        Nothing selected — share the password with the user
                        manually.
                      </p>
                    )}
                </FormSection>
              </>
            )}
          </div>

          {/* -------------------------------- footer -------------------------- */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 bg-ink-25/70 px-5 py-3.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={prevStep}
              disabled={currentStep === 1}
            >
              ← Previous
            </Button>

            <div className="flex items-center gap-3">
              <span className="text-[12px] text-ink-400">
                <span className="font-semibold text-ink-600">
                  Step {currentStep}
                </span>{" "}
                of {STEPS.length} · fields with a red
                <span className="mx-0.5 text-coral-500">*</span>
                are required
              </span>

              {currentStep < STEPS.length ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={nextStep}
                  iconRight={step2Unlocked ? <CheckCircle2 /> : undefined}
                >
                  Next: {STEPS[currentStep].label} →
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  loading={form.submitting}
                  icon={<UserPlus />}
                  onClick={submit}
                >
                  Create user
                </Button>
              )}
            </div>
          </div>
        </Panel>
      </form>
    </div>
  );
}

export default UsersNewPage;
