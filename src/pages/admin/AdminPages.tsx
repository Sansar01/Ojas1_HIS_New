import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Compass,
  Home,
  KeyRound,
  Save,
  ServerCog,
  ShieldCheck,
  Trash2,
  UserCog,
} from "lucide-react";
import { PERMISSIONS } from "@/constants";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { usePermission } from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { roleService } from "@/pages/admin/role.service";
import { userService } from "@/pages/users/user.service";
import { toast } from "@/store/slices/uiSlice";
import type { RoleMasterCatalogItem, RolePermissionAssignment } from "@/types";
import { cn } from "@/utils/cn";
import type { HospitalInfo, Permission, Role } from "@/types";
import { Badge, Button, Panel, PanelHeader } from "@/components/ui/primitives";
import {
  Input,
  Select,
  MultiSelect,
  PermissionMatrix,
  Switch,
  Textarea,
} from "@/components/ui/fields";
import {
  FormRow,
  FormSection,
  PageIntro,
  SectionPanel,
} from "@/components/common";
import { Banner, ListSkeleton, MatrixSkeleton } from "@/components/ui/feedback";
import { Dialog, useConfirmDialog } from "@/components/ui/overlays";

/* -------------------------------- Roles & RBAC ------------------------------- */

export function RolesPage() {
  const dispatch = useAppDispatch();
  // the current user's module catalogue is global authorization state (Redux)
  const entitlementModules = useAppSelector((s) => s.modules.availableModules);
  const { canCreate, canEdit, canDelete } = usePermission();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Role> | null>(null);
  const [assignedPermissions, setAssignedPermissions] = useState<
    RolePermissionAssignment[]
  >([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const { ask, confirmNode } = useConfirmDialog();

  /** role list + user counts: page data, through the services, into local state */
  const [roles, setRoles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  /** drives the skeleton of the list + matrix (never the global loader) */
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await roleService.fetchRoles();
        if (active && response.status === 200)
          setRoles(response.data?.data ?? []);
      } catch (e: any) {
        if (active) dispatch(toast.error("Could not load roles", e?.message));
      } finally {
        if (active) setRolesLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [dispatch]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await userService.fetchUsers();
        if (active && response.status === 200)
          setUsers(response.data?.data ?? []);
      } catch (e: any) {
        if (active) dispatch(toast.error("Could not load users", e?.message));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selected = roles.find(
    (r: any) => r.id === (selectedId ?? roles[0]?.id),
  ) as Role | undefined;

  useEffect(() => {
    if (!selected?.id) {
      setAssignedPermissions([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        setPermissionsLoading(true);
        const response = await roleService.fetchRolePermissions(
          String(selected.id),
        );
        if (active && response.status === 200) {
          setAssignedPermissions(
            (response.data?.data ?? []) as RolePermissionAssignment[],
          );
        }
      } catch (e: any) {
        if (active) {
          setAssignedPermissions([]);
          dispatch(toast.error("Could not load permissions", e?.message));
        }
      } finally {
        if (active) setPermissionsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selected?.id]);
  const usersByRole = useMemo(() => {
    const map = new Map<string, number>();
    users.forEach((u: any) => map.set(u.roleId, (map.get(u.roleId) ?? 0) + 1));
    return map;
  }, [users]);

  return (
    <>
      <PageIntro
        title="Roles & permissions"
        description="Define what each role may reach. A role seeds default module permissions; individual users can still be overridden in User management."
        module="roles"
        createLabel="Create role"
        onCreate={() =>
          canCreate("roles") &&
          setEditing({
            name: "",
            slug: "",
            description: "",
            system: false,
            permissions: { dashboard: ["view"] },
          })
        }
      />

      {!canCreate("roles") && (
        <Banner tone="info" className="mb-4" title="Read-only view">
          Your role grants view access to the permission matrix but not
          modification. Ask a Super Admin for <strong>create / edit</strong> on
          the Roles module.
        </Banner>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,20rem)_1fr]">
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Defined roles"
            subtitle={`${roles.length} roles · ${users.length} assigned users`}
            icon={<ShieldCheck />}
          />
          <ul className="divide-y divide-ink-100">
            {rolesLoading && <ListSkeleton rows={5} />}
            {!rolesLoading &&
              roles.map((r: any) => (
                <li key={r.id}>
                  <button
                    onClick={() => setSelectedId(r.id)}
                    className={cn(
                      "group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                      selected?.id === r.id ? "bg-brand-25" : "hover:bg-ink-25",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg [&>svg]:size-4",
                        selected?.id === r.id
                          ? "bg-brand-600 text-white"
                          : "bg-ink-50 text-ink-500",
                      )}
                    >
                      <UserCog />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[13.5px] font-semibold text-ink-900">
                          {r.name}
                        </span>
                        {r.system && (
                          <Badge tone="ink" size="xs">
                            system
                          </Badge>
                        )}
                      </span>
                      <span className="mt-0.5 block line-clamp-2 text-[11.5px] leading-snug text-ink-400">
                        {r.description}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        <Badge tone="neutral" size="xs">
                          {Object.keys(r.permissions ?? {}).length} modules
                        </Badge>
                        <Badge tone="lagoon" size="xs">
                          {usersByRole.get(r.id) ?? 0} users
                        </Badge>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </Panel>

        {selected && (
          <Panel className="overflow-hidden">
            <PanelHeader
              title={`${selected.name} · permission matrix`}
              subtitle="Check a cell to grant that action on the module"
              icon={<KeyRound />}
              action={
                <div className="flex gap-2">
                  {canEdit("roles") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(selected)}
                    >
                      Edit role
                    </Button>
                  )}
                  {canDelete("roles") && !selected.system && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 />}
                      onClick={() =>
                        ask({
                          title: `Delete ${selected.name}?`,
                          description: `${usersByRole.get(selected.id) ?? 0} user(s) currently use this role. They will lose module access until reassigned.`,
                          confirmLabel: "Delete role",
                          action: async () => {
                            await roleService.deleteRole(selected.id);
                            dispatch(
                              toast.success(
                                "Record deleted",
                                `${selected.name} was removed from the portal.`,
                              ),
                            );
                          },
                        })
                      }
                    >
                      Delete
                    </Button>
                  )}
                  {selected.system && (
                    <Badge tone="amber">Protected system role</Badge>
                  )}
                </div>
              }
            />
            <div className="space-y-4 p-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {entitlementModules.map((m) => {
                  const granted = assignedPermissions
                    .filter(
                      (assignment) => assignment.moduleId === Number(m.id),
                    )
                    .map((assignment) =>
                      featureAction(
                        assignment.moduleFeature?.feature?.code ?? "",
                      ),
                    )
                    .filter(Boolean) as Permission[];
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "rounded-xl border p-2.5 transition-colors",
                        granted?.length
                          ? "border-brand-100 bg-brand-25/60"
                          : "border-ink-100 bg-ink-25/40",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "text-[12.5px] font-semibold",
                            granted?.length ? "text-brand-800" : "text-ink-400",
                          )}
                        >
                          {m.name}
                        </p>
                        <span className="num text-[10.5px] font-bold text-ink-400">
                          {permissionsLoading ? "..." : `${granted.length}/4`}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {PERMISSIONS.map((p) => (
                          <span
                            key={p}
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide",
                              granted?.includes(p)
                                ? "bg-brand-600 text-white"
                                : "bg-white text-ink-300 ring-1 ring-inset ring-ink-100",
                            )}
                          >
                            {p[0]}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {canEdit("roles") && (
                <RoleMatrixEditor
                  role={selected}
                  assignedPermissions={assignedPermissions}
                  loading={permissionsLoading}
                  onSaved={() => {
                    (async () => {
                      try {
                        const response = await roleService.fetchRolePermissions(
                          String(selected.id),
                        );
                        if (response.status === 200) {
                          setAssignedPermissions(
                            (response.data?.data ??
                              []) as RolePermissionAssignment[],
                          );
                        }
                      } catch (e: any) {
                        dispatch(
                          toast.error(
                            "Could not refresh permissions",
                            e?.message,
                          ),
                        );
                      }
                    })();
                  }}
                />
              )}
            </div>
          </Panel>
        )}
      </div>

      {editing && (
        <RoleForm initial={editing} onClose={() => setEditing(null)} />
      )}
      {confirmNode}
    </>
  );
}

function RoleMatrixEditor({
  role,
  assignedPermissions,
  loading,
  onSaved,
}: {
  role: Role;
  assignedPermissions: RolePermissionAssignment[];
  loading: boolean;
  onSaved: () => void;
}) {
  const dispatch = useAppDispatch();
  const entitlementModules = useAppSelector((s) => s.modules.availableModules);
  const [modules, setModules] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<
    Partial<Record<string, Permission[]>>
  >({});

  useEffect(() => {
    const nextModules = Array.from(
      new Set(
        assignedPermissions
          .map((assignment) => assignment.moduleFeature?.module?.code)
          .filter(Boolean) as string[],
      ),
    );
    setModules(nextModules);
    setPermissions(mapAssignedPermissions(assignedPermissions));
  }, [role.id, assignedPermissions]);

  const toggle = (module: string, permission: Permission) => {
    const current = new Set(permissions[module] ?? []);
    current.has(permission)
      ? current.delete(permission)
      : current.add(permission);
    if (current.size && !current.has("view")) current.add("view");
    setPermissions({ ...permissions, [module]: Array.from(current) });
  };

  const save = async () => {
    const moduleFeatures = modules.flatMap((moduleKey) => {
      const apiModule = entitlementModules.find(
        (module) => module.code === moduleKey,
      );

      if (!apiModule) return [];

      return (permissions[moduleKey] ?? []).flatMap((action) => {
        const feature = apiModule.features?.find((item) =>
          featureMatchesAction(item.code, item.name, action),
        );
        return feature
          ? [{ moduleId: Number(apiModule.id), featureId: Number(feature.id) }]
          : [];
      });
    });

    try {
      await roleService.updateRolePermissions(role.id, moduleFeatures);
      dispatch(toast.success(`${role.name} permissions updated`));
    } catch (e: any) {
      dispatch(toast.error("Update failed", e?.message));
      return;
    }
    onSaved();
  };

  return (
    <div className="space-y-3 rounded-xl border border-ink-100 bg-ink-25/50 p-3.5">
      <MultiSelect
        label="Modules for this role"
        values={modules as string[]}
        options={entitlementModules.map((module) => ({
          value: module.code,
          label: module.name,
          description: module.features
            ?.map((feature) => feature.name)
            .join(", "),
        }))}
        onChange={(vals) => setModules(vals as string[])}
        hint="Only checked modules appear in the sidebar for users of this role"
      />
      {loading ? (
        <MatrixSkeleton rows={Math.max(4, modules.length)} cols={4} />
      ) : (
        <PermissionMatrix
          modules={modules}
          permissions={permissions}
          onToggle={toggle}
        />
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11.5px] text-ink-400">
          Users inheriting this role: all accounts assigned to {role.name}.
        </p>
        <Button size="sm" icon={<Save />} onClick={save}>
          Save role permissions
        </Button>
      </div>
    </div>
  );
}

function mapAssignedPermissions(assignments: RolePermissionAssignment[]) {
  const result: Partial<Record<string, Permission[]>> = {};
  assignments.forEach((assignment) => {
    const moduleCode = assignment.moduleFeature?.module?.code;
    const action = featureAction(assignment.moduleFeature?.feature?.code ?? "");
    if (!moduleCode || !action) return;
    result[moduleCode] = [...(result[moduleCode] ?? []), action];
  });
  return result;
}

function featureAction(code: string): Permission | undefined {
  const normalized = code.toUpperCase();
  if (normalized.includes("VIEW")) return "view";
  if (normalized.includes("CREATE")) return "create";
  if (
    normalized.includes("EDIT") ||
    normalized.includes("UPDATE") ||
    normalized.includes("DEACTIVATE")
  )
    return "edit";
  if (normalized.includes("DELETE")) return "delete";
  return undefined;
}

function featureMatchesAction(code: string, name: string, action: Permission) {
  const normalizedCode = code.toUpperCase();
  const normalizedName = name.toUpperCase();
  const actionName = action.toUpperCase();

  return (
    normalizedCode === actionName ||
    normalizedCode.startsWith(`${actionName}_`) ||
    normalizedCode.endsWith(`_${actionName}`) ||
    normalizedName.startsWith(actionName)
  );
}

function RoleForm({
  initial,
  onClose,
}: {
  initial: Partial<Role>;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const [roleMode, setRoleMode] = useState<"master" | "custom">("master");
  const [masterRoles, setMasterRoles] = useState<RoleMasterCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(!initial.id);
  const entitlementModules = useAppSelector((s) => s.modules.availableModules);

  useEffect(() => {
    if (initial.id) return;
    (async () => {
      try {
        const response = await roleService.fetchRoleMasterCatalog();
        if (response.status === 200) {
          setMasterRoles(
            (response.data?.data ?? []) as RoleMasterCatalogItem[],
          );
        }
      } catch (e: any) {
        setMasterRoles([]);
        dispatch(toast.error("Could not load role catalog", e?.message));
      } finally {
        setCatalogLoading(false);
      }
    })();
  }, [dispatch, initial.id]);

  const form = useForm({
    initialValues: {
      roleNameId: "",
      roleCode: "",
      name: initial.name ?? "",
      slug: initial.slug ?? "",
      description: initial.description ?? "",
      permissions: (initial.permissions ?? {}) as Partial<
        Record<string, Permission[]>
      >,
      modules: Object.keys(initial.permissions ?? {}) as string[],
    },
    schema: {
      roleNameId:
        roleMode === "master" ? [{ required: "Select a master role" }] : [],
      name:
        roleMode === "custom"
          ? [{ required: "Role name is required", min: 3 }]
          : [],
      slug: [
        { required: "Slug is required", pattern: /^[a-z][a-z0-9_]{2,24}$/ },
      ],
      description: [{ required: "Describe what this role does", min: 10 }],
    },
  });

  const toggle = (module: string, permission: Permission) => {
    const key = module;
    const current = new Set(form.values.permissions[key] ?? []);
    current.has(permission)
      ? current.delete(permission)
      : current.add(permission);
    if (current.size && !current.has("view")) current.add("view");
    form.setValue("permissions", {
      ...form.values.permissions,
      [key]: Array.from(current),
    });
  };

  const save = form.handleSubmit(async (values) => {
    const permissions: Partial<Record<string, Permission[]>> = {};
    values.modules.forEach(
      (m) =>
        (permissions[m] = values.permissions[m]?.length
          ? values.permissions[m]
          : ["view"]),
    );
    const data = {
      name: values.name,
      slug: values.slug,
      description: values.description,
      permissions,
      system: false,
    };
    if (initial.id) {
      try {
        await roleService.updateRole(initial.id, data);
        dispatch(toast.success("Role updated"));
      } catch (e: any) {
        dispatch(toast.error("Update failed", e?.message));
        return;
      }
    } else {
      let created: any;
      try {
        created = (
          await roleService.createRole({
            ...(roleMode === "master"
              ? { roleNameId: Number(values.roleNameId) }
              : {
                  roleName: values.name.trim(),
                  roleCode:
                    values.roleCode.trim() ||
                    values.name
                      .trim()
                      .toUpperCase()
                      .replace(/[^A-Z0-9]+/g, "_"),
                }),
            description: values.description.trim(),
          })
        ).data;
      } catch (e: any) {
        dispatch(toast.error("Creation failed", e?.message));
        return;
      }

      const createdRoleId = String(created?.id ?? created?.data?.id ?? "");
      try {
        if (createdRoleId && entitlementModules.length) {
          const moduleFeatures = Object.entries(values.permissions).flatMap(
            ([moduleCode, actions]) => {
              const requestedModule = moduleCode
                .toUpperCase()
                .replace(/S$/, "");
              const module = entitlementModules.find(
                (item) =>
                  item.code.toUpperCase().replace(/S$/, "") ===
                    requestedModule ||
                  String(item.route ?? "")
                    .replace(/^\/+/, "")
                    .split("/")[0]
                    .toUpperCase()
                    .replace(/S$/, "") === requestedModule,
              );
              if (!module) return [];
              return (actions ?? []).flatMap((action) => {
                const feature = module.features?.find((item) =>
                  featureMatchesAction(item.code, item.name, action),
                );
                return feature
                  ? [
                      {
                        moduleId: Number(module.id),
                        featureId: Number(feature.id),
                      },
                    ]
                  : [];
              });
            },
          );
          await roleService.updateRolePermissions(
            createdRoleId,
            moduleFeatures,
          );
        }
      } catch (e: any) {
        dispatch(toast.error("Permissions could not be saved", e?.message));
      }
    }
    onClose();
  });

  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title={initial.id ? `Edit ${initial.name}` : "Create role"}
      description="Roles bundle module access with default permissions. Assign the role to users to apply it."
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={form.submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="role-form"
            size="sm"
            loading={form.submitting}
          >
            {initial.id ? "Save role" : "Create role"}
          </Button>
        </>
      }
    >
      <form id="role-form" onSubmit={save} className="space-y-1">
        <FormSection title="Identity">
          <FormRow>
            {!initial.id && (
              <Select
                name="roleMode"
                label="Role source"
                value={roleMode}
                onChange={(value) => {
                  setRoleMode(value as "master" | "custom");
                  form.setMany({ roleNameId: "", name: "", roleCode: "" });
                }}
                options={[
                  { value: "master", label: "Existing master role" },
                  { value: "custom", label: "Create custom role" },
                ]}
              />
            )}
            {!initial.id && roleMode === "master" ? (
              <Select
                name="roleNameId"
                label="Master role"
                required
                value={form.values.roleNameId}
                loading={catalogLoading}
                loadingLabel="Loading master roles…"
                onChange={(value) => {
                  const selected = masterRoles.find(
                    (item) => String(item.id) === value,
                  );
                  form.setMany({
                    roleNameId: value,
                    name: selected?.name ?? "",
                    slug: selected?.code.toLowerCase() ?? "",
                  });
                }}
                options={masterRoles
                  .filter((item) => item.isActivatedInHospital)
                  .map((item) => ({
                    value: String(item.id),
                    label: item.name,
                  }))}
                error={form.errors.roleNameId}
              />
            ) : (
              <Input
                name="name"
                label="Role name"
                required
                placeholder="Night Shift Nurse"
                value={form.values.name}
                onChange={(e) => form.setValue("name", e.target.value)}
                error={form.errors.name}
              />
            )}
            {!initial.id && roleMode === "custom" && (
              <Input
                name="roleCode"
                label="Role code"
                placeholder="NIGHT_NURSE"
                value={form.values.roleCode}
                onChange={(e) =>
                  form.setValue("roleCode", e.target.value.toUpperCase())
                }
              />
            )}
            <Input
              name="slug"
              label="Slug"
              required
              placeholder="ward_supervisor"
              hint="lowercase, underscore, 3–25 chars"
              value={form.values.slug}
              onChange={(e) =>
                form.setValue("slug", e.target.value.toLowerCase())
              }
              error={form.errors.slug}
            />
            <Textarea
              name="description"
              label="Description"
              required
              rows={2}
              placeholder="What this role is responsible for…"
              value={form.values.description}
              onChange={(e) => form.setValue("description", e.target.value)}
              error={form.errors.description}
            />
          </FormRow>
        </FormSection>
        <FormSection title="Modules & permissions">
          <div className="mt-3 space-y-3">
            <MultiSelect
              label="Allowed modules"
              required
              values={form.values.modules as string[]}
              options={entitlementModules.map((m: any) => ({
                value: m.code.toLowerCase(),
                label: m.name,
                description:
                  m.features?.map((f: any) => f.name).join(", ") || m.route,
              }))}
              onChange={(vals) => form.setValue("modules", vals as string[])}
              error={
                form.values.modules.length
                  ? undefined
                  : "Choose at least one module"
              }
            />
            <PermissionMatrix
              modules={form.values.modules}
              permissions={form.values.permissions}
              onToggle={toggle}
            />
          </div>
        </FormSection>
      </form>
    </Dialog>
  );
}

/* --------------------------------- Settings ---------------------------------- */

export function SettingsPage() {
  const dispatch = useAppDispatch();
  const { can, canEdit } = usePermission();
  const navigate = useNavigate();
  const { ask, confirmNode } = useConfirmDialog();
  const editable = canEdit("settings");

  /**
   * Facility profile.
   *
   * The settings endpoint is not part of the backend build, so this form no
   * longer loads or saves: it shows the values the screen can display locally
   * and the save action is disabled with an explanation.
   */
  const hospital: HospitalInfo | null = null;

  const form = useForm({
    initialValues: {
      name: "",
      tagline: "",
      address: "",
      city: "",
      phone: "",
      email: "",
      website: "",
      taxId: "",
      currency: "INR",
      currencySymbol: "₹",
      invoicePrefix: "MCH",
      defaultTaxRate: 5,
      timezone: "",
      licenseNo: "",
    } as HospitalInfo,
    schema: {
      name: [{ required: "Facility name is required", min: 4 }],
      address: [{ required: "Address is required" }],
      phone: [{ required: "Phone is required" }],
      email: [{ required: "Email is required", email: true }],
      invoicePrefix: [
        { required: "Invoice prefix required", pattern: /^[A-Za-z]{2,6}$/ },
      ],
      defaultTaxRate: [{ required: "Tax rate is required" }],
    },
  });

  useEffect(() => {
    if (hospital) form.setValues(hospital);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospital]);

  const save = form.handleSubmit(async () => {
    dispatch(
      toast.error(
        "Settings API unavailable",
        "This backend build exposes no facility-profile endpoint.",
      ),
    );
  });

  return (
    <>
      <PageIntro
        title="Hospital settings"
        description="Facility identity used across invoices, printables and notifications. Changes apply immediately to new documents."
        module="settings"
        meta={
          <Badge tone={editable ? "mint" : "neutral"} dot>
            {editable
              ? "Editable with your access"
              : "Read-only with your access"}
          </Badge>
        }
        actions={
          import.meta.env.DEV ? (
            <Button
              variant="outline"
              icon={<ServerCog />}
              onClick={() =>
                ask({
                  title: "Reset demo dataset?",
                  description:
                    "All locally created patients, appointments, invoices and profile edits will be replaced with the seeded demo hospital data.",
                  confirmLabel: "Reset data",
                  action: async () => {
                    window.location.reload();
                  },
                })
              }
            >
              Reset demo data
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_minmax(0,20rem)]">
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Facility profile"
            subtitle="Appears on invoices and portal footers"
            icon={<Compass />}
            action={
              editable && (
                <Button size="sm" icon={<Save />} onClick={save}>
                  Save settings
                </Button>
              )
            }
          />
          <div className="space-y-5 p-4 sm:p-5">
            <FormSection title="Identity">
              <FormRow className="lg:grid-cols-2">
                <Input
                  name="name"
                  label="Facility name"
                  required
                  disabled={!editable}
                  value={form.values.name}
                  onChange={(e) => form.setValue("name", e.target.value)}
                  error={form.errors.name}
                />
                <Input
                  name="tagline"
                  label="Tagline"
                  disabled={!editable}
                  value={form.values.tagline}
                  onChange={(e) => form.setValue("tagline", e.target.value)}
                />
                <Input
                  name="address"
                  label="Street address"
                  required
                  disabled={!editable}
                  value={form.values.address}
                  onChange={(e) => form.setValue("address", e.target.value)}
                  error={form.errors.address}
                />
                <Input
                  name="city"
                  label="City / postal code"
                  disabled={!editable}
                  value={form.values.city}
                  onChange={(e) => form.setValue("city", e.target.value)}
                />
                <Input
                  name="phone"
                  label="Main phone"
                  required
                  disabled={!editable}
                  value={form.values.phone}
                  onChange={(e) => form.setValue("phone", e.target.value)}
                  error={form.errors.phone}
                />
                <Input
                  name="email"
                  label="Public email"
                  required
                  disabled={!editable}
                  value={form.values.email}
                  onChange={(e) => form.setValue("email", e.target.value)}
                  error={form.errors.email}
                />
                <Input
                  name="website"
                  label="Website"
                  disabled={!editable}
                  value={form.values.website}
                  onChange={(e) => form.setValue("website", e.target.value)}
                />
                <Input
                  name="licenseNo"
                  label="Operating licence"
                  disabled={!editable}
                  value={form.values.licenseNo}
                  onChange={(e) => form.setValue("licenseNo", e.target.value)}
                />
              </FormRow>
            </FormSection>

            <FormSection title="Financial defaults">
              <FormRow className="lg:grid-cols-4">
                <Input
                  name="invoicePrefix"
                  label="Invoice prefix"
                  required
                  disabled={!editable}
                  value={form.values.invoicePrefix}
                  onChange={(e) =>
                    form.setValue("invoicePrefix", e.target.value)
                  }
                  error={form.errors.invoicePrefix}
                  hint="e.g. MCH → MCH-2401"
                />
                <Input
                  name="taxId"
                  label="Tax / GST identifier"
                  disabled={!editable}
                  value={form.values.taxId}
                  onChange={(e) => form.setValue("taxId", e.target.value)}
                />
                <Input
                  name="currency"
                  label="Currency code"
                  disabled={!editable}
                  value={form.values.currency}
                  onChange={(e) => form.setValue("currency", e.target.value)}
                />
                <Input
                  name="currencySymbol"
                  label="Currency symbol"
                  disabled={!editable}
                  value={form.values.currencySymbol}
                  onChange={(e) =>
                    form.setValue("currencySymbol", e.target.value)
                  }
                />
                <Input
                  name="defaultTaxRate"
                  type="number"
                  label="Default tax rate %"
                  disabled={!editable}
                  value={String(form.values.defaultTaxRate)}
                  onChange={(e) =>
                    form.setValue("defaultTaxRate", Number(e.target.value))
                  }
                  error={form.errors.defaultTaxRate}
                />
                <Input
                  name="timezone"
                  label="Timezone"
                  disabled={!editable}
                  value={form.values.timezone}
                  onChange={(e) => form.setValue("timezone", e.target.value)}
                />
              </FormRow>
            </FormSection>
          </div>
        </Panel>

        <div className="space-y-4">
          <SectionPanel title="Portal health" icon={<ServerCog />}>
            <ul className="space-y-2.5 text-[12.5px]">
              {[
                { k: "Router mode", v: "Hash router (works offline)" },
                { k: "State", v: "Redux Toolkit slices" },
                { k: "Transport", v: "API service layer" },
                { k: "Auth", v: "Token + RBAC guards" },
              ].map((r) => (
                <li
                  key={r.k}
                  className="flex items-center justify-between gap-3 border-b border-dashed border-ink-100 pb-1.5 last:border-none"
                >
                  <span className="text-ink-400">{r.k}</span>
                  <span className="font-medium text-ink-800">{r.v}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-ink-25 px-3 py-2">
              <Switch
                checked
                label="Data persistence"
                description="Local snapshot survives refresh"
                onCheckedChange={() => undefined}
                disabled
              />
            </div>
          </SectionPanel>

          {!can("users", "view") && (
            <Banner tone="warn" title="Limited administrator view">
              You do not have access to the Users module, so role assignments
              cannot be changed from this screen.
            </Banner>
          )}

          <SectionPanel title="Quick links" bodyClass="p-3">
            <div className="grid gap-2">
              {can("users", "view") && (
                <button
                  onClick={() => navigate("/users")}
                  className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2.5 text-left text-[12.5px] font-medium text-ink-700 transition-colors hover:border-brand-200 hover:bg-brand-25"
                >
                  Manage users & access{" "}
                  <UserCog className="size-4 text-brand-600" />
                </button>
              )}
              <button
                onClick={() => navigate("/dashboard")}
                className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2.5 text-left text-[12.5px] font-medium text-ink-700 transition-colors hover:border-brand-200 hover:bg-brand-25"
              >
                Back to dashboard <Home className="size-4 text-brand-600" />
              </button>
            </div>
          </SectionPanel>
        </div>
      </div>
      {confirmNode}
    </>
  );
}

/* ---------------------------------- errors --------------------------------- */

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    // No layout around it — it owns the whole viewport.
    <div className="grid min-h-screen place-items-center bg-brand-25/40 px-5">
      <div className="max-w-md text-center">
        <p className="font-display text-[64px] font-bold leading-none text-brand-500">
          404
        </p>
        <h1 className="mt-2 font-display text-[22px] font-bold text-ink-900">
          This page isn't part of the portal
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-400">
          The link may be outdated, or your role does not include the requested
          module.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Go to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
