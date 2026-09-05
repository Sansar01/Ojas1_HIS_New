import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Eye,
  KeyRound,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  Users2,
} from "lucide-react";
import { APP_NAME, AVATAR_COLORS, MODULES, PERMISSIONS } from "@/constants";
import {
  useAppDispatch,
  usePermission,
  useRootSelector,
  useTable,
} from "@/hooks";
import { useRootSelector as _rootSelector } from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { patientsApi, usersApi } from "@/features/slices";
import { syncUser } from "@/features/auth/authSlice";
import { request } from "@/services/apiClient";
import { API_ENDPOINTS } from "@/config/api";
import { formatDateTime, fullName, relativeTime } from "@/utils";
import { cn } from "@/utils/cn";
import type { ModuleKey, Permission, Status, User } from "@/types";
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  Panel,
  StatusBadge,
} from "@/components/ui/primitives";
import {
  Checkbox,
  Input,
  MultiSelect,
  PermissionMatrix,
  Select,
  DatePicker,
} from "@/components/ui/fields";
import {
  DataTable,
  Pagination,
  RowActions,
  TableToolbar,
} from "@/components/ui/table";
import { Sheet, Tooltip } from "@/components/ui/overlays";
import {
  FormDialog,
  DetailGrid,
  FormRow,
  FormSection,
  SectionPanel,
  PageIntro,
} from "@/components/common";
import { useCurrentUser } from "@/hooks";

const emptyUser = (): Partial<User> => ({
  firstName: "Neha",
  lastName: "Deshpande",
  gender: "Female",
  dateOfBirth: "1994-02-09",
  email: "neha.deshpande@meridian.care",
  mobile: "+91 99001 48210",
  title: "Executive · Patient Access",
  status: "active",
  password: "Portal@2026",
  modules: ["dashboard", "patients", "appointments", "billing"],
  permissions: {
    dashboard: ["view"],
    patients: ["view", "create", "edit"],
    appointments: ["view", "create", "edit"],
    billing: ["view", "create"],
  },
});

const normalizeUser = (record: any): User => {
  const primaryRole =
    record.roles?.find((assignment: any) => assignment.isPrimary) ??
    record.roles?.[0];
  const roleName =
    primaryRole?.hospitalRole?.roleName?.name ??
    primaryRole?.hospitalRole?.name ??
    record.role ??
    "Staff";

  return {
    ...record,
    firstName: record.firstName ?? "",
    lastName: record.lastName ?? "",
    email: record.email ?? "",
    mobile: record.mobile ?? "",
    roleId: String(primaryRole?.hospitalRoleId ?? record.roleId ?? ""),
    role: roleName,
    status: String(record.status ?? "INACTIVE").toLowerCase() as Status,
    gender: record.gender ?? record.staffProfile?.gender ?? "Other",
    dateOfBirth: record.dateOfBirth ?? "",
    modules: record.modules ?? [],
    permissions: record.permissions ?? {},
    lastLogin: record.lastLoginAt ?? record.lastLogin ?? null,
    createdAt: record.createdAt ?? new Date().toISOString(),
    color: record.color ?? AVATAR_COLORS[0],
    userType: record.userType ?? "REGULAR_USER",
    title:
      record.title ??
      record.staffProfile?.designation ??
      record.staffProfile?.title ??
      roleName,
  };
};

export function UsersPage() {
  const dispatch = useAppDispatch();
  const me = useCurrentUser();
  const { canCreate, canEdit, canDelete } = usePermission();
  const [users, setUsers] = useState<User[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [refreshKey, setRefreshKey] = useState(0);
  const roles = useRootSelector((s) => s.roles.items);
  const [filters, setFilters] = useState({ role: "all", status: "all" });
  const [editing, setEditing] = useState<Partial<User> | null>(null);
  const [detail, setDetail] = useState<User | null>(null);

  const table = useTable<User>(users as User[], {
    pageSize: 8,
    filters,
    searchFields: [
      (u) => `${u.firstName} ${u.lastName} ${u.email} ${u.mobile} ${u.role}`,
      (u) => u.id,
    ],
    sortAccessors: {
      name: (u) => `${u.lastName}${u.firstName}`,
      role: (u) => u.role,
      status: (u) => u.status,
      lastLogin: (u) => u.lastLogin ?? "",
      modules: (u) => u.modules.length,
    },
  });

  useEffect(() => {
    let active = true;

    request<any[]>({
      url: API_ENDPOINTS.users,
      method: "GET",
    })
      .then((response) => {
        if (!active) return;
        const rawResponse: any = response;
        const records = Array.isArray(rawResponse)
          ? rawResponse
          : Array.isArray(rawResponse.data)
            ? rawResponse.data
            : rawResponse.data?.rows ?? [];
        setUsers(records.map(normalizeUser));
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const toggleStatus = (user: User) => {
    const next: Status = user.status === "active" ? "inactive" : "active";
    dispatch(
      usersApi.thunks.toggleActive({
        id: user.id,
        status: next,
        label: `${user.firstName} ${user.lastName}`,
      } as any),
    );
  };

  const remove = (user: User) => {
    if (user.id === me?.id) return;
    dispatch(
      usersApi.thunks.removeOne({
        id: user.id,
        label: `${user.firstName} ${user.lastName}`,
      } as any),
    );
  };

  return (
    <>
      <PageIntro
        title="User management"
        description="Create portal accounts, assign roles and configure module-level permissions. Navigation and actions adapt instantly for each user."
        meta={
          <>
            <Badge tone="brand" dot>
              {users.filter((u: any) => u.status === "active").length} active
            </Badge>
            <Badge tone="neutral">
              {users.length -
                users.filter((u: any) => u.status === "active").length}{" "}
              inactive
            </Badge>
            <Badge tone="lagoon">{roles.length} roles defined</Badge>
          </>
        }
        module="users"
        createLabel="Add user"
        onCreate={() => setEditing(emptyUser())}
        actions={
          <Button
            variant="outline"
            size="md"
            icon={<Users2 />}
            loading={status === "loading"}
            onClick={() => {
              setStatus("loading");
              setRefreshKey((value) => value + 1);
            }}
          >
            Refresh
          </Button>
        }
      />

      <Panel>
        <TableToolbar
          search={table.query.search}
          onSearch={table.setSearch}
          searchPlaceholder="Search name, email, mobile…"
          filters={
            <>
              <Select
                name="role"
                size="sm"
                className="w-[10.5rem]"
                value={filters.role}
                onChange={(v) => setFilters((f) => ({ ...f, role: v }))}
                options={[
                  { value: "all", label: "All roles" },
                  ...roles.map((r: any) => ({ value: r.name, label: r.name })),
                ]}
              />
              <Select
                name="status"
                size="sm"
                className="w-[9.5rem]"
                value={filters.status}
                onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
                options={[
                  { value: "all", label: "Any status" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
              {(filters.role !== "all" ||
                filters.status !== "all" ||
                table.query.search) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setFilters({ role: "all", status: "all" });
                    table.setSearch("");
                  }}
                >
                  Clear
                </Button>
              )}
            </>
          }
          actions={
            canCreate("users") ? (
              <Button
                size="sm"
                icon={<UserPlus />}
                onClick={() => setEditing(emptyUser())}
              >
                New user
              </Button>
            ) : (
              <Badge tone="neutral">Read-only access</Badge>
            )
          }
        />

        <DataTable
          columns={[
            {
              key: "name",
              header: "User",
              sortable: true,
              render: (u) => (
                <button
                  className="flex items-center gap-3 text-left"
                  onClick={() => setDetail(u)}
                >
                  <Avatar
                    name={`${u.firstName} ${u.lastName}`}
                    color={u.color}
                    size="sm"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-ink-900">
                      {fullName(u)}
                    </span>
                    <span className="num block truncate text-[11.5px] text-ink-400">
                      {u.email}
                    </span>
                  </span>
                </button>
              ),
            },
            {
              key: "role",
              header: "Role",
              sortable: true,
              render: (u) => (
                <Badge
                  tone={u.role === "SUPER_ADMIN" ? "ink" : "brand"}
                  size="xs"
                >
                  {u.role}
                </Badge>
              ),
            },
            {
              key: "modules",
              header: "Modules",
              sortable: true,
              hideBelow: "lg",
              render: (u) => (
                <div className="flex items-center gap-1">
                  {u.modules.slice(0, 4).map((m) => {
                    const def = MODULES.find((x) => x.key === m);
                    return (
                      <Tooltip
                        key={m}
                        content={`${def?.label ?? m} · ${(u.permissions?.[m] ?? ["view"]).join(", ")}`}
                      >
                        <span className="grid size-6 place-items-center rounded-md bg-ink-50 text-[10px] font-bold uppercase text-ink-500 ring-1 ring-inset ring-ink-100">
                          {def?.label.slice(0, 2)}
                        </span>
                      </Tooltip>
                    );
                  })}
                  {u.modules.length > 4 && (
                    <span className="num text-[11px] font-semibold text-ink-400">
                      +{u.modules.length - 4}
                    </span>
                  )}
                </div>
              ),
            },
            {
              key: "mobile",
              header: "Contact",
              hideBelow: "xl",
              render: (u) => (
                <span className="num text-[12px] text-ink-500">{u.mobile}</span>
              ),
            },
            {
              key: "lastLogin",
              header: "Last sign-in",
              sortable: true,
              hideBelow: "md",
              render: (u) => (
                <span className="text-[12px] text-ink-500">
                  {u.lastLogin ? relativeTime(u.lastLogin) : "Never"}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              sortable: true,
              align: "center",
              render: (u) => <StatusBadge status={u.status} />,
            },
          ]}
          rows={table.rows}
          status={
            status === "ready"
              ? "ready"
              : status === "error"
                ? "error"
                : "loading"
          }
          sort={{
            sortBy: table.query.sortBy,
            sortDir: table.query.sortDir,
            onSort: table.toggleSort,
          }}
          onRowClick={(u) => setDetail(u)}
          actions={(u) => (
            <RowActions
              items={[
                {
                  label: "View profile",
                  icon: <Eye />,
                  onClick: () => setDetail(u),
                },
                {
                  label: "Edit user",
                  icon: <Pencil />,
                  onClick: () => setEditing(u),
                  hidden: !canEdit("users"),
                },
                {
                  label: u.status === "active" ? "Deactivate" : "Activate",
                  icon: u.status === "active" ? <Ban /> : <CheckCircle2 />,
                  onClick: () => toggleStatus(u),
                  hidden: !canEdit("users") || u.id === me?.id,
                },
                {
                  label: "Delete user",
                  icon: <Trash2 />,
                  tone: "danger",
                  onClick: () => remove(u),
                  hidden: !canDelete("users") || u.id === me?.id,
                },
              ]}
            />
          )}
          emptyTitle="No portal users yet"
          emptyDescription="Create your first staff account to start delegating module access."
          footer={
            <Pagination
              page={table.page}
              pageCount={table.pageCount}
              total={table.total}
              pageSize={table.pageSize}
              onPage={table.setPage}
              onPageSize={table.setPageSize}
              label="users"
            />
          }
        />
      </Panel>

      {editing && (
        <UserFormDialog
          initial={editing}
          roles={roles as any}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}

      <Sheet
        open={!!detail}
        onOpenChange={(v) => !v && setDetail(null)}
        title="User profile"
        description={
          detail
            ? `${detail.title ?? detail.role} · joined ${formatDateTime(detail.createdAt)}`
            : undefined
        }
        footer={
          detail && (
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <IconButton
                  label="Copy login link"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigator.clipboard?.writeText(
                      `https://portal.meridian.care/invite/${detail.id}`,
                    )
                  }
                >
                  <KeyRound />
                </IconButton>
                {canEdit("users") && detail.status === "active" && (
                  <Badge tone="mint" size="xs">
                    Can sign in
                  </Badge>
                )}
                {canEdit("users") && detail.status !== "active" && (
                  <Badge tone="coral" size="xs">
                    Sign-in blocked
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                {canEdit("users") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      toggleStatus(detail);
                      setDetail({ ...detail });
                    }}
                  >
                    {detail.status === "active"
                      ? "Deactivate account"
                      : "Activate account"}
                  </Button>
                )}
                {canEdit("users") && (
                  <Button
                    size="sm"
                    icon={<Pencil />}
                    onClick={() => {
                      setEditing(detail);
                      setDetail(null);
                    }}
                  >
                    Edit access
                  </Button>
                )}
              </div>
            </div>
          )
        }
      >
        {detail && (
          <div className="space-y-5">
            <div className="flex items-center gap-4 rounded-xl border border-ink-100 bg-ink-25/70 p-4">
              <Avatar name={fullName(detail)} color={detail.color} size="lg" />
              <div className="min-w-0">
                <p className="font-display text-[19px] font-bold text-ink-900">
                  {fullName(detail)}
                </p>
                <p className="text-[12.5px] text-ink-500">
                  {detail.title ?? detail.role}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="brand" size="xs">
                    {detail.role}
                  </Badge>
                  <StatusBadge status={detail.status} />
                  <Badge tone="neutral" size="xs">
                    {detail.modules.length} modules
                  </Badge>
                </div>
              </div>
            </div>

            <DetailGrid
              columns={2}
              items={[
                {
                  label: "Email address",
                  value: (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="size-3.5 text-ink-400" />
                      {detail.email}
                    </span>
                  ),
                },
                {
                  label: "Mobile number",
                  value: (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="size-3.5 text-ink-400" />
                      {detail.mobile}
                    </span>
                  ),
                },
                { label: "Gender", value: detail.gender },
                {
                  label: "Date of birth",
                  value: formatDateSafe(detail.dateOfBirth),
                },
                {
                  label: "Last sign-in",
                  value: detail.lastLogin
                    ? formatDateTime(detail.lastLogin)
                    : "Never signed in",
                },
                {
                  label: "Account created",
                  value: formatDateTime(detail.createdAt),
                },
              ]}
            />

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                <ShieldCheck className="size-3.5 text-brand-600" /> Module
                permissions
              </p>
              <div className="overflow-hidden rounded-xl border border-ink-100">
                <table className="w-full text-left text-[12.5px]">
                  <thead className="bg-ink-25 text-[10.5px] uppercase tracking-[0.1em] text-ink-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Module</th>
                      {PERMISSIONS.map((p) => (
                        <th
                          key={p}
                          className="px-2 py-2 text-center font-semibold"
                        >
                          {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {MODULES.filter((m) => detail.modules.includes(m.key)).map(
                      (m) => (
                        <tr key={m.key}>
                          <td className="px-3 py-2 font-medium text-ink-700">
                            {m.label}
                          </td>
                          {PERMISSIONS.map((p) => (
                            <td key={p} className="px-2 py-2 text-center">
                              <span
                                className={cn(
                                  "inline-block size-4 rounded-full ring-1",
                                  (detail.permissions[m.key] ?? []).includes(p)
                                    ? "bg-brand-500 ring-brand-600"
                                    : "bg-white ring-ink-200",
                                )}
                              />
                            </td>
                          ))}
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <SectionPanel
              title="What this user can see"
              icon={<UserCog />}
              bodyClass="p-4"
            >
              <ul className="space-y-2 text-[12.5px] leading-relaxed text-ink-500">
                <li>
                  • Sidebar exposes {detail.modules.length} modules — everything
                  else is hidden and blocked at the route level.
                </li>
                <li>
                  • Create buttons render only where{" "}
                  <span className="font-semibold text-ink-700">create</span> is
                  granted.
                </li>
                <li>
                  • Edit & delete row actions are filtered per module by{" "}
                  <span className="font-semibold text-ink-700">edit</span> /{" "}
                  <span className="font-semibold text-ink-700">delete</span>.
                </li>
              </ul>
            </SectionPanel>
          </div>
        )}
      </Sheet>
    </>
  );
}

const formatDateSafe = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

/* ------------------------------ create / edit ------------------------------ */

function UserFormDialog({
  initial,
  roles,
  onClose,
  onSaved,
}: {
  initial: Partial<User>;
  roles: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const dispatch = useAppDispatch();
  const isEdit = Boolean(initial.id);
  const me = useCurrentUser();
  const role = roles.find((r) => r.id === initial.roleId);

  const form = useForm({
    initialValues: {
      firstName: initial.firstName ?? "",
      lastName: initial.lastName ?? "",
      email: initial.email ?? "",
      mobile: initial.mobile ?? "",
      roleId: initial.roleId ?? roles[1]?.id ?? "",
      status: (initial.status ?? "active") as Status,
      password: "",
      gender: initial.gender ?? "Female",
      dateOfBirth: initial.dateOfBirth ?? "1995-01-01",
      title: initial.title ?? "",
      modules: (initial.modules ?? ["dashboard"]) as ModuleKey[],
      permissions: (initial.permissions ?? { dashboard: ["view"] }) as Partial<
        Record<ModuleKey, Permission[]>
      >,
      color:
        initial.color ??
        AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    },
    schema: {
      firstName: [{ required: "First name is required", min: 2 }],
      lastName: [{ required: "Last name is required", min: 2 }],
      email: [{ required: "Email address is required", email: true }],
      mobile: [
        {
          required: "Mobile number is required",
          pattern: /^[+0-9][0-9\s()-]{7,}$/,
        },
      ],
      roleId: [{ required: "Choose a role" }],
      dateOfBirth: [{ required: "Date of birth is required" }],
      password: isEdit
        ? []
        : [{ required: "A temporary password is required", min: 6 }],
    },
  });

  const moduleOptions = useMemo(
    () =>
      MODULES.map((m) => ({
        value: m.key,
        label: m.label,
        description: m.description,
      })),
    [],
  );

  const applyRoleDefaults = (roleId: string) => {
    const selected = roles.find((r) => r.id === roleId);
    const perms = (selected?.permissions ?? {}) as Record<string, Permission[]>;
    const modules = Object.keys(perms).filter(
      (k) => (perms[k] ?? []).length,
    ) as ModuleKey[];
    const nextPermissions: Partial<Record<ModuleKey, Permission[]>> = {};
    modules.forEach((m) => (nextPermissions[m] = perms[m] ?? ["view"]));
    if (!nextPermissions.dashboard) nextPermissions.dashboard = ["view"];
    const nextModules = modules.length
      ? modules
      : (["dashboard"] as ModuleKey[]);
    form.setValues({
      ...form.values,
      roleId,
      modules: nextModules,
      permissions: nextPermissions,
    });
  };

  const togglePermission = (module: string, permission: Permission) => {
    const key = module as ModuleKey;
    const current = form.values.permissions[key] ?? [];
    const next = current.includes(permission)
      ? current.filter((p) => p !== permission)
      : [...current, permission];
    if (
      next.includes("create") ||
      next.includes("edit") ||
      next.includes("delete")
    ) {
      if (!next.includes("view")) next.unshift("view");
    }
    form.setValue("permissions", {
      ...form.values.permissions,
      [key]: next,
    });
  };

  const save = form.handleSubmit(async (values) => {
    const payload: any = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      mobile: values.mobile,
      roleId: values.roleId,
      role: roles.find((r) => r.id === values.roleId)?.name ?? "Staff",
      status: values.status,
      gender: values.gender,
      dateOfBirth: values.dateOfBirth,
      title: values.title,
      color: values.color,
      modules: values.modules,
      permissions: values.permissions,
    };
    if (!isEdit) payload.password = values.password;
    if (isEdit) {
      const res: any = await dispatch(
        usersApi.thunks.updateOne({
          id: initial.id!,
          data: payload,
          successMessage: "User updated",
        } as any),
      );
      if (initial.id === me?.id && res?.payload)
        dispatch(syncUser(res.payload as User));
    } else {
      await dispatch(
        usersApi.thunks.createOne({
          data: payload,
          successMessage: "User account created",
        } as any),
      );
    }
    dispatch(patientsApi.thunks.fetchAll() as any);
    onSaved();
  });

  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <UserCog className="size-4.5 text-brand-600" />
          {isEdit ? `Edit ${fullName(initial)}` : "Create portal user"}
        </span>
      }
      description={
        isEdit
          ? "Update identity, role assignment and module permissions."
          : `New account on ${APP_NAME}. Permissions drive the sidebar and every action button.`
      }
      onSubmit={save}
      loading={form.submitting}
      footerNote={
        <span className="flex items-center gap-2">
          <Badge tone="brand" size="xs">
            {form.values.modules.length} modules
          </Badge>
          {role ? (
            <span>Role default: {role.name}</span>
          ) : (
            "Assign a role to preload permissions"
          )}
        </span>
      }
    >
      {/* Step 1: User Info */}
      <FormSection
        title="User Info"
        description="Basic profile information for the new user"
      >
        <FormRow className="lg:grid-cols-4">
          <Input
            name="firstName"
            label="First name"
            required
            placeholder="Asha"
            value={form.values.firstName}
            onChange={(e) => form.setValue("firstName", e.target.value)}
            error={form.errors.firstName}
          />
          <Input
            name="lastName"
            label="Last name"
            required
            placeholder="Verma"
            value={form.values.lastName}
            onChange={(e) => form.setValue("lastName", e.target.value)}
            error={form.errors.lastName}
          />
          <Input
            name="email"
            type="email"
            label="Email address"
            required
            placeholder="name@meridian.care"
            value={form.values.email}
            onChange={(e) => form.setValue("email", e.target.value)}
            error={form.errors.email}
          />
          <Input
            name="mobile"
            label="Mobile number"
            required
            placeholder="+91 99001 20000"
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
            label="Date of birth"
            required
            value={form.values.dateOfBirth}
            onChange={(v) => form.setValue("dateOfBirth", v)}
            error={form.errors.dateOfBirth}
          />
          <Input
            name="title"
            label="Designation"
            placeholder="Front Desk Lead"
            value={form.values.title}
            onChange={(e) => form.setValue("title", e.target.value)}
            hint="Shown on profile cards and audit logs"
          />
          <div className="flex flex-col justify-end gap-2">
            <p className="text-[12.5px] font-medium text-ink-600">
              Avatar tint
            </p>
            <div className="flex flex-wrap gap-1.5">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => form.setValue("color", c)}
                  className={cn(
                    "size-7 rounded-lg transition-transform hover:scale-110",
                    c,
                    form.values.color === c &&
                      "ring-2 ring-ink-900 ring-offset-2",
                  )}
                  aria-label={`tint ${c}`}
                />
              ))}
            </div>
          </div>
        </FormRow>
      </FormSection>

      {/* Step 2: Module Rights */}
      <FormSection
        title="Module Rights"
        description="Define which modules the user can access and their permissions"
      >
        <FormRow className="lg:grid-cols-3">
          <Select
            name="roleId"
            label="Role"
            required
            value={form.values.roleId}
            onChange={applyRoleDefaults}
            options={roles.map((r) => ({
              value: r.id,
              label: r.name,
              description: r.description,
            }))}
            hint="Switching roles reapplies that role's defaults"
          />
          <Select
            name="status"
            label="Account status"
            value={form.values.status}
            onChange={(v) => form.setValue("status", v)}
            options={[
              { value: "active", label: "Active — can sign in" },
              { value: "inactive", label: "Inactive — sign-in blocked" },
            ]}
          />
          {!isEdit && (
            <Input
              name="password"
              type="password"
              label="Temporary password"
              required
              placeholder="Minimum 6 characters"
              value={form.values.password}
              onChange={(e) => form.setValue("password", e.target.value)}
              error={form.errors.password}
              hint="User will be prompted to change on first login"
            />
          )}
        </FormRow>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,17rem)_1fr]">
          <MultiSelect
            label="Allowed modules"
            required
            values={form.values.modules as string[]}
            options={moduleOptions}
            onChange={(vals) => {
              const modules = vals as ModuleKey[];
              const permissions = { ...form.values.permissions };
              modules.forEach((m) => {
                if (!permissions[m]?.length) permissions[m] = ["view"];
              });
              Object.keys(permissions).forEach((k) => {
                if (!modules.includes(k as ModuleKey))
                  delete permissions[k as ModuleKey];
              });
              form.setValues({ ...form.values, modules, permissions });
            }}
            error={
              form.values.modules.length
                ? undefined
                : "Select at least one module"
            }
            hint="Modules appear in the sidebar for this user"
            placeholder="Search and select modules…"
            columns={1}
          />
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12.5px] font-medium text-ink-600">
                Module permissions
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    const all: Partial<Record<ModuleKey, Permission[]>> = {};
                    form.values.modules.forEach(
                      (m) => (all[m] = [...PERMISSIONS]),
                    );
                    form.setValue("permissions", all);
                  }}
                >
                  Grant all
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    const viewOnly: Partial<Record<ModuleKey, Permission[]>> =
                      {};
                    form.values.modules.forEach(
                      (m) => (viewOnly[m] = ["view"]),
                    );
                    form.setValue("permissions", viewOnly);
                  }}
                >
                  View only
                </Button>
              </div>
            </div>
            <PermissionMatrix
              modules={form.values.modules as ModuleKey[]}
              permissions={form.values.permissions}
              onToggle={togglePermission}
            />
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-ink-100 bg-ink-25/70 px-3 py-2">
              <span className="text-[11.5px] font-medium text-ink-500">
                Quick toggles
              </span>
              {(["view", "create", "edit", "delete"] as Permission[]).map(
                (p) => {
                  const allOn =
                    form.values.modules.length > 0 &&
                    form.values.modules.every((m) =>
                      (form.values.permissions[m] ?? []).includes(p),
                    );
                  return (
                    <Checkbox
                      key={p}
                      checked={allOn}
                      label={<span className="capitalize">{p} all</span>}
                      onCheckedChange={(v) => {
                        const next: Partial<Record<ModuleKey, Permission[]>> =
                          {};
                        form.values.modules.forEach((m) => {
                          const cur = new Set(form.values.permissions[m] ?? []);
                          v ? cur.add(p) : cur.delete(p);
                          if (cur.size && !cur.has("view")) cur.add("view");
                          next[m] = Array.from(cur);
                        });
                        form.setValue("permissions", next);
                      }}
                    />
                  );
                },
              )}
            </div>
          </div>
        </div>
      </FormSection>

      {/* Step 3: Credentials & Mapping */}
      <FormSection
        title="Credentials & Mapping"
        description="Set login credentials and optionally copy the same rights to other users or departments"
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Credentials Section */}
          <div className="space-y-4">
            <div className="text-[13px] font-semibold text-ink-700">
              Step 3 A Credentials
            </div>

            <Input
              name="username"
              label="Username (Email)"
              value={form.values.email}
              disabled
              hint="Username is automatically set to email address"
            />

            <Input
              name="tempPassword"
              type="password"
              label="Temporary Password"
              placeholder="Min 8 chars (leave empty for auto-generated)"
              value={form.values.password || ""}
              onChange={(e) => form.setValue("password", e.target.value)}
              error={form.errors.password}
            />

            <Select
              name="loginType"
              label="Login type"
              value="password"
              onChange={() => {}}
              options={[
                { value: "password", label: "Password" },
                { value: "sso", label: "Single Sign-On (SSO)" },
              ]}
            />

            <div className="space-y-2 pt-2">
              <Checkbox
                checked={true}
                onCheckedChange={() => {}}
                label="Force password change on first login"
              />
              <Checkbox
                checked={false}
                onCheckedChange={() => {}}
                label="Enable Two Factor Authentication"
              />
              <Checkbox
                checked={false}
                onCheckedChange={() => {}}
                label="Send credentials via SMS"
              />
              <Checkbox
                checked={true}
                onCheckedChange={() => {}}
                label="Send credentials via Email"
              />
            </div>

            {/* Review Box */}
            <div className="mt-4 rounded-lg border border-ink-100 bg-ink-25/60 p-3 text-[12px]">
              <div className="mb-1 font-semibold text-ink-600">
                Review Before Submit
              </div>
              <div className="grid grid-cols-2 gap-x-4 text-[11.5px]">
                <div>
                  <span className="text-ink-400">Name:</span>{" "}
                  {form.values.firstName} {form.values.lastName}
                </div>
                <div>
                  <span className="text-ink-400">Email:</span>{" "}
                  {form.values.email}
                </div>
                <div>
                  <span className="text-ink-400">Role:</span>{" "}
                  {roles.find((r) => r.id === form.values.roleId)?.name || "—"}
                </div>
                <div>
                  <span className="text-ink-400">Modules:</span>{" "}
                  {form.values.modules.length} assigned
                </div>
              </div>
            </div>
          </div>

          {/* Mapping Section */}
          <div className="space-y-4">
            <div className="text-[13px] font-semibold text-ink-700">
              Map Same Rights To Other Users / Departments
            </div>

            <MultiSelect
              label="Search & Select Users"
              values={[]}
              onChange={() => {}}
              options={(useRootSelector((s) => s.users.items) as any[])
                .filter((u: any) => u.id !== initial.id)
                .map((u: any) => ({
                  value: u.id,
                  label: `${u.firstName} ${u.lastName}`,
                  description: u.role,
                }))}
              placeholder="Search by name or employee ID"
              columns={1}
            />

            <MultiSelect
              label="Map to Department(s)"
              values={[]}
              onChange={() => {}}
              options={(
                useRootSelector((s) => s.departments.items) as any[]
              ).map((d: any) => ({ value: d.id, label: d.name }))}
              placeholder="Hold Ctrl / Cmd to select multiple"
              columns={1}
            />

            <div className="rounded-lg border border-amberly-200 bg-amberly-50 p-3 text-[11.5px] text-amberly-700">
              <strong>Note:</strong> Selected users / departments will inherit
              the same module rights and permissions. Existing rights will be
              replaced.
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                // Demo action — in real app this would copy permissions
                alert("Rights copied to selected users/departments (demo)");
              }}
            >
              Copy Rights to Selected
            </Button>
          </div>
        </div>
      </FormSection>

      {isEdit && initial.id === me?.id && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amberly-500/25 bg-amberly-50 px-3.5 py-3 text-[12.5px] text-amberly-600">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          <p>
            You are editing your own account. Removing the{" "}
            <strong>users</strong> module or its delete permission will restrict
            your own access after the next sign-in.
          </p>
        </div>
      )}
    </FormDialog>
  );
}
