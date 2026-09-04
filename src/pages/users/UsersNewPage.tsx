import { useNavigate } from "react-router-dom";
import { useAppDispatch, useRootSelector } from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { usersApi } from "@/features/slices";
import { AVATAR_COLORS, MODULES } from "@/constants";
import {
  FormDialog,
  FormRow,
  FormSection,
  PageIntro,
} from "@/components/common";
import {
  Input,
  Select,
  DatePicker,
  MultiSelect,
  PermissionMatrix,
  Checkbox,
} from "@/components/ui/fields";
import { Button } from "@/components/ui/primitives";
import type { ModuleKey, Permission } from "@/types";
import { cn } from "@/utils/cn";

export function UsersNewPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const roles = useRootSelector((s) => s.roles.items);

  const form = useForm({
    initialValues: {
      firstName: "Aarav",
      lastName: "Sharma",
      email: "aarav.sharma@meridian.care",
      mobile: "+91 98765 43210",
      gender: "Male",
      dateOfBirth: "1992-05-14",
      title: "Senior Executive",
      roleId: roles[1]?.id || "",
      status: "active",
      password: "Portal@2026",
      modules: ["dashboard", "patients", "appointments"],
      permissions: {
        dashboard: ["view"],
        patients: ["view", "create", "edit"],
        appointments: ["view", "create", "edit"],
      },
      color: AVATAR_COLORS[0],
    },
    schema: {
      firstName: [{ required: "First name is required" }],
      lastName: [{ required: "Last name is required" }],
      email: [{ required: "Email is required", email: true }],
      mobile: [{ required: "Mobile is required" }],
      roleId: [{ required: "Role is required" }],
      password: [{ required: "Password is required", min: 6 }],
    },
  });

  const togglePermission = (module: ModuleKey, permission: Permission) => {
    const current = new Set((form.values.permissions as any)[module] ?? []);
    current.has(permission)
      ? current.delete(permission)
      : current.add(permission);
    if (current.size && !current.has("view")) current.add("view");
    form.setValue("permissions", {
      ...(form.values.permissions as any),
      [module]: Array.from(current),
    });
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    const role = roles.find((r: any) => r.id === values.roleId);
    const payload: any = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      mobile: values.mobile,
      gender: values.gender,
      dateOfBirth: values.dateOfBirth,
      title: values.title,
      roleId: values.roleId,
      role: role?.name || "Staff",
      status: values.status,
      password: values.password,
      modules: values.modules,
      permissions: values.permissions,
      color: values.color,
    };
    await dispatch(
      usersApi.thunks.createOne({
        data: payload,
        successMessage: "User created successfully",
      } as any),
    );
    navigate("/users");
  });

  return (
    <div className="max-w-5xl mx-auto">
      <PageIntro
        title="Add New User"
        description="Create a new portal user with role-based access."
        back
      />

      <FormDialog
        open
        onOpenChange={(v) => !v && navigate("/app/users")}
        title="Create New User"
        description="Complete all three steps to register a new user."
        onSubmit={handleSubmit}
        loading={form.submitting}
        submitLabel="Create User"
      >
        {/* Step 1: User Info */}
        <FormSection title="User Info" description="Basic profile details">
          <FormRow className="lg:grid-cols-4">
            <Input
              name="firstName"
              label="First Name"
              required
              value={form.values.firstName}
              onChange={(e) => form.setValue("firstName", e.target.value)}
              error={form.errors.firstName}
            />
            <Input
              name="lastName"
              label="Last Name"
              required
              value={form.values.lastName}
              onChange={(e) => form.setValue("lastName", e.target.value)}
              error={form.errors.lastName}
            />
            <Input
              name="email"
              label="Email Address"
              required
              value={form.values.email}
              onChange={(e) => form.setValue("email", e.target.value)}
              error={form.errors.email}
            />
            <Input
              name="mobile"
              label="Mobile Number"
              required
              value={form.values.mobile}
              onChange={(e) => form.setValue("mobile", e.target.value)}
              error={form.errors.mobile}
            />
            <Select
              name="gender"
              label="Gender"
              value={form.values.gender}
              onChange={(v) => form.setValue("gender", v)}
              options={[
                { value: "Male", label: "Male" },
                { value: "Female", label: "Female" },
                { value: "Other", label: "Other" },
              ]}
            />
            <DatePicker
              label="Date of Birth"
              required
              value={form.values.dateOfBirth}
              onChange={(v) => form.setValue("dateOfBirth", v)}
              error={form.errors.dateOfBirth}
            />
            <Input
              name="title"
              label="Designation"
              value={form.values.title}
              onChange={(e) => form.setValue("title", e.target.value)}
            />
            <div>
              <p className="text-[12.5px] font-medium text-ink-600 mb-1">
                Avatar Color
              </p>
              <div className="flex gap-1.5">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => form.setValue("color", c)}
                    className={cn(
                      "size-7 rounded-lg",
                      c,
                      form.values.color === c &&
                        "ring-2 ring-offset-2 ring-ink-900",
                    )}
                  />
                ))}
              </div>
            </div>
          </FormRow>
        </FormSection>

        {/* Step 2: Module Rights */}
        <FormSection
          title="Module Rights"
          description="Assign role and permissions"
        >
          <FormRow className="lg:grid-cols-3">
            <Select
              name="roleId"
              label="Role"
              required
              value={form.values.roleId}
              onChange={(v) => form.setValue("roleId", v)}
              options={roles.map((r: any) => ({ value: r.id, label: r.name }))}
            />
            <Select
              name="status"
              label="Status"
              value={form.values.status}
              onChange={(v) => form.setValue("status", v)}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
            <Input
              name="password"
              type="password"
              label="Temporary Password"
              required
              value={form.values.password}
              onChange={(e) => form.setValue("password", e.target.value)}
              error={form.errors.password}
            />
          </FormRow>

          <div className="mt-4">
            <MultiSelect
              label="Allowed Modules"
              values={form.values.modules}
              onChange={(v) => form.setValue("modules", v as any)}
              options={MODULES.map((m) => ({ value: m.key, label: m.label }))}
            />
            <div className="mt-4">
              <PermissionMatrix
                modules={form.values.modules}
                permissions={form.values.permissions as any}
                onToggle={togglePermission}
              />
            </div>
          </div>
        </FormSection>

        {/* Step 3: Credentials & Mapping */}
        <FormSection
          title="Credentials & Mapping"
          description="Set login credentials and optional permission mapping"
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <Input
                name="username"
                label="Username (Email)"
                value={form.values.email}
                disabled
              />
              <Input
                name="tempPassword"
                label="Temporary Password"
                type="password"
                value={form.values.password}
                onChange={(e) => form.setValue("password", e.target.value)}
              />
              <Select
                name="loginType"
                label="Login Type"
                value="password"
                onChange={() => {}}
                options={[
                  { value: "password", label: "Password" },
                  { value: "sso", label: "SSO" },
                ]}
              />
              <div className="mt-3 space-y-2">
                <Checkbox
                  checked
                  label="Force password change on first login"
                  onCheckedChange={() => {}}
                />
                <Checkbox
                  checked={false}
                  label="Enable Two Factor Authentication"
                  onCheckedChange={() => {}}
                />
              </div>
            </div>

            <div>
              <MultiSelect
                label="Copy Rights To Other Users"
                values={[]}
                onChange={() => {}}
                options={useRootSelector((s) => s.users.items)
                  .filter((u: any) => u.email !== form.values.email)
                  .map((u: any) => ({
                    value: u.id,
                    label: `${u.firstName} ${u.lastName}`,
                  }))}
              />
              <div className="mt-3 text-[11.5px] text-ink-400">
                Note: Selected users will receive the same module access.
              </div>
            </div>
          </div>
        </FormSection>
      </FormDialog>
    </div>
  );
}
