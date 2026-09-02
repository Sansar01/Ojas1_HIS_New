import { useEffect, useMemo, useState } from "react";
import { Ban, Building2, CheckCircle2, Eye, Layers, Pencil, Trash2, UserRound } from "lucide-react";
import { useAppDispatch, usePermission, useRootSelector, useTable } from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { departmentsApi, specializationsApi } from "@/features/slices";
import { formatDate, fullName } from "@/utils";
import { cn } from "@/utils/cn";
import type { Department, Specialization, Status } from "@/types";
import { Avatar, Badge, Button, Panel, StatusBadge } from "@/components/ui/primitives";
import { Input, Select, Textarea } from "@/components/ui/fields";
import { DataTable, Pagination, RowActions, TableToolbar } from "@/components/ui/table";
import { Sheet } from "@/components/ui/overlays";
import { DetailGrid, FormDialog, FormRow, PageIntro, SectionPanel } from "@/components/common";

/* -------------------------------- Departments ------------------------------- */

export function DepartmentsPage() {
  const dispatch = useAppDispatch();
  const { items: departments, status } = useRootSelector((s) => s.departments);
  const doctors = useRootSelector((s) => s.doctors.items);
  const specializations = useRootSelector((s) => s.specializations.items);
  const appointments = useRootSelector((s) => s.appointments.items);
  const { canCreate, canEdit, canDelete } = usePermission();
  const [editing, setEditing] = useState<Partial<Department> | null>(null);
  const [detail, setDetail] = useState<Department | null>(null);
  const [filters, setFilters] = useState({ status: "all" });

  useEffect(() => {
    if (status === "idle") dispatch(departmentsApi.thunks.fetchAll() as any);
  }, [status, dispatch]);

  const table = useTable<Department>(departments as Department[], {
    pageSize: 8,
    filters,
    searchFields: [(d) => `${d.name} ${d.code} ${d.description} ${d.floor}`],
    sortAccessors: { name: (d) => d.name, status: (d) => d.status },
  });

  const stats = (id: string) => ({
    doctors: doctors.filter((d: any) => d.departmentId === id).length,
    specializations: specializations.filter((s: any) => s.departmentId === id).length,
    visits: appointments.filter((a: any) => a.departmentId === id).length,
  });

  return (
    <>
      <PageIntro
        title="Departments"
        description="Clinical and support departments that group doctors, specializations and reporting lines."
        module="departments"
        createLabel="Add department"
        onCreate={() => setEditing({ name: "", code: "", description: "", floor: "", status: "active", headDoctorId: null })}
        meta={
          <>
            <Badge tone="brand" dot>{departments.filter((d: any) => d.status === "active").length} operational</Badge>
            <Badge tone="lagoon">{doctors.length} doctors mapped</Badge>
          </>
        }
      />
      <Panel>
        <TableToolbar
          search={table.query.search}
          onSearch={table.setSearch}
          searchPlaceholder="Search department…"
          filters={
            <Select size="sm" className="w-[9rem]" name="st" value={filters.status} onChange={(v) => setFilters({ status: v })} options={[{ value: "all", label: "Any status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
          }
          actions={canCreate("departments") ? <Button size="sm" icon={<Building2 />} onClick={() => setEditing({ status: "active" })}>Add department</Button> : <Badge tone="neutral">Read only</Badge>}
        />
        <DataTable
          columns={[
            {
              key: "name",
              header: "Department",
              sortable: true,
              render: (d) => (
                <button className="flex items-center gap-3 text-left" onClick={() => setDetail(d)}>
                  <span className="grid size-9 place-items-center rounded-lg bg-brand-25 text-brand-600 ring-1 ring-inset ring-brand-100">
                    <Layers className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-ink-900">{d.name}</span>
                    <span className="num block truncate text-[11.5px] text-ink-400">{d.code} · {d.floor || "—"}</span>
                  </span>
                </button>
              ),
            },
            { key: "description", header: "Scope", hideBelow: "lg", render: (d) => <span className="line-clamp-1 text-[12.5px] text-ink-500">{d.description}</span> },
            { key: "head", header: "Head of department", hideBelow: "md", render: (d) => { const doc = doctors.find((x: any) => x.id === d.headDoctorId); return doc ? <span className="flex items-center gap-2 text-[12.5px]"><Avatar name={fullName(doc)} size="xs" color="bg-ink-600" />Dr. {fullName(doc)}</span> : <span className="text-[12px] text-ink-300">Vacant</span>; } },
            { key: "doctors", header: "Doctors", align: "center", render: (d) => <span className="num font-semibold text-ink-700">{stats(d.id).doctors}</span> },
            { key: "specializations", header: "Spec.", align: "center", hideBelow: "sm", render: (d) => <span className="num text-ink-600">{stats(d.id).specializations}</span> },
            { key: "visits", header: "Visits (30d)", align: "right", hideBelow: "xl", render: (d) => <span className="num text-ink-600">{stats(d.id).visits}</span> },
            { key: "status", header: "Status", align: "center", render: (d) => <StatusBadge status={d.status} /> },
          ]}
          rows={table.rows}
          status={status === "ready" ? "ready" : status === "error" ? "error" : "loading"}
          sort={{ sortBy: table.query.sortBy, sortDir: table.query.sortDir, onSort: table.toggleSort }}
          actions={(d) => (
            <RowActions
              items={[
                { label: "View department", icon: <Eye />, onClick: () => setDetail(d) },
                { label: "Edit", icon: <Pencil />, hidden: !canEdit("departments"), onClick: () => setEditing(d) },
                { label: d.status === "active" ? "Deactivate" : "Activate", icon: d.status === "active" ? <Ban /> : <CheckCircle2 />, hidden: !canEdit("departments"), onClick: () => dispatch(departmentsApi.thunks.toggleActive({ id: d.id, status: (d.status === "active" ? "inactive" : "active") as Status, label: d.name } as any)) },
                { label: "Delete", icon: <Trash2 />, tone: "danger", hidden: !canDelete("departments"), onClick: () => dispatch(departmentsApi.thunks.removeOne({ id: d.id, label: d.name } as any)) },
              ]}
            />
          )}
          emptyTitle="No departments configured"
          footer={<Pagination page={table.page} pageCount={table.pageCount} total={table.total} pageSize={table.pageSize} onPage={table.setPage} onPageSize={table.setPageSize} label="departments" />}
        />
      </Panel>

      {editing && (
        <Panel className="mb-4 animate-fade-up overflow-hidden border-brand-200 shadow-pop">
          <div className="flex items-start justify-between gap-3 border-b border-ink-100 bg-ink-25/70 px-4 py-3">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-brand-600">Inline department form</p>
              <h3 className="mt-0.5 font-display text-[16px] font-semibold text-ink-900">{editing.id ? `Edit ${editing.name}` : "Add department"}</h3>
              <p className="mt-0.5 text-[12px] text-ink-400">Code and floor help staff route patients quickly.</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
              Close
            </Button>
          </div>
          <div className="p-4">
            <DepartmentFields initial={editing} onSubmitted={() => setEditing(null)} />
          </div>
        </Panel>
      )}

      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)} title={detail?.name ?? ""} description={detail ? `Established ${formatDate(detail.createdAt)}` : ""}>
        {detail && (
          <div className="space-y-4">
            <DetailGrid
              columns={2}
              items={[
                { label: "Code", value: <span className="num">{detail.code}</span> },
                { label: "Location", value: detail.floor || "—" },
                { label: "Status", value: <StatusBadge status={detail.status} /> },
                { label: "Head of department", value: fullName(doctors.find((x: any) => x.id === detail.headDoctorId)) || "Vacant" },
              ]}
            />
            <p className="rounded-xl bg-ink-25 p-3 text-[13px] leading-relaxed text-ink-600">{detail.description || "No scope description provided."}</p>
            <SectionPanel title="Doctors in this department" icon={<UserRound />} bodyClass="p-0">
              <ul className="divide-y divide-ink-100">
                {doctors.filter((d: any) => d.departmentId === detail.id).map((d: any) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={fullName(d)} size="xs" color="bg-brand-600" />
                      <span>
                        <span className="block text-[13px] font-medium text-ink-800">Dr. {fullName(d)}</span>
                        <span className="block text-[11px] text-ink-400">{specializations.find((s: any) => s.id === d.specializationId)?.name}</span>
                      </span>
                    </span>
                    <StatusBadge status={d.status} />
                  </li>
                ))}
                {doctors.filter((d: any) => d.departmentId === detail.id).length === 0 && <li className="px-4 py-6 text-center text-[12.5px] text-ink-400">No doctors mapped yet.</li>}
              </ul>
            </SectionPanel>
          </div>
        )}
      </Sheet>
    </>
  );
}

function DepartmentFields({ initial, onSubmitted }: { initial: Partial<Department>; onSubmitted: () => void }) {
  const dispatch = useAppDispatch();
  const doctors = useRootSelector((s) => s.doctors.items);
  const form = useForm({
    initialValues: {
      name: initial.name ?? "", code: initial.code ?? "", description: initial.description ?? "",
      floor: initial.floor ?? "", headDoctorId: initial.headDoctorId ?? "", status: (initial.status ?? "active") as Status,
    },
    schema: {
      name: [{ required: "Department name is required", min: 3 }],
      code: [{ required: "Short code is required", pattern: /^[A-Za-z]{2,6}$/ }],
      description: [{ required: "Add a short scope description", min: 10 }],
    },
  });

  const save = form.handleSubmit(async (values) => {
    const data = { ...values, code: values.code.toUpperCase(), headDoctorId: values.headDoctorId || null };
    if (initial.id) await dispatch(departmentsApi.thunks.updateOne({ id: initial.id, data, successMessage: "Department updated" } as any));
    else await dispatch(departmentsApi.thunks.createOne({ data: { ...data, createdAt: new Date().toISOString() }, successMessage: "Department created" } as any));
    onSubmitted();
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.target as HTMLElement)?.tagName !== "TEXTAREA") {
        e.preventDefault();
        save();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <form onSubmit={save} className="space-y-4">
      <FormRow>
        <Input name="name" label="Department name" required placeholder="Cardiac Sciences" value={form.values.name} onChange={(e) => form.setValue("name", e.target.value)} error={form.errors.name} />
        <Input name="code" label="Code" required placeholder="CAR" hint="2–6 letters" value={form.values.code} onChange={(e) => form.setValue("code", e.target.value)} error={form.errors.code} className="uppercase" />
        <Input name="floor" label="Location / floor" placeholder="Block A · 4th" value={form.values.floor} onChange={(e) => form.setValue("floor", e.target.value)} />
        <Select name="headDoctorId" label="Head of department" clearable value={form.values.headDoctorId ?? ""} onChange={(v) => form.setValue("headDoctorId", v)} options={doctors.map((d: any) => ({ value: d.id, label: `Dr. ${fullName(d)}` }))} />
        <Select name="status" label="Status" value={form.values.status} onChange={(v) => form.setValue("status", v)} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
      </FormRow>
      <Textarea name="description" label="Scope" required rows={3} placeholder="Services, units and programs run by this department…" value={form.values.description} onChange={(e) => form.setValue("description", e.target.value)} error={form.errors.description} />
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onSubmitted}>Cancel</Button>
        <Button type="submit" size="sm" loading={form.submitting}>{initial.id ? "Save department" : "Create department"}</Button>
      </div>
    </form>
  );
}

/* ------------------------------- Specializations ------------------------------ */

export function SpecializationsPage() {
  const dispatch = useAppDispatch();
  const { items: specializations, status } = useRootSelector((s) => s.specializations);
  const departments = useRootSelector((s) => s.departments.items);
  const doctors = useRootSelector((s) => s.doctors.items);
  const { canCreate, canEdit, canDelete } = usePermission();
  const [editing, setEditing] = useState<Partial<Specialization> | null>(null);
  const [filters, setFilters] = useState({ department: "all", status: "all" });

  useEffect(() => {
    if (status === "idle") dispatch(specializationsApi.thunks.fetchAll() as any);
  }, [status, dispatch]);

  const table = useTable<Specialization>(specializations as Specialization[], {
    pageSize: 8,
    filters,
    searchFields: [(s) => `${s.name} ${s.code} ${s.description}`],
    sortAccessors: { name: (s) => s.name, status: (s) => s.status },
  });

  const doctorCount = (id: string) => doctors.filter((d: any) => d.specializationId === id).length;
  const deptName = useMemo(() => new Map(departments.map((d: any) => [d.id, d.name])), [departments]);

  return (
    <>
      <PageIntro
        title="Specializations"
        description="Clinical specializations used for doctor profiles, appointment filtering and referral routing."
        module="specializations"
        createLabel="Add specialization"
        onCreate={() => setEditing({ name: "", code: "", description: "", status: "active", departmentId: departments[0]?.id ?? "" })}
      />
      <Panel>
        <TableToolbar
          search={table.query.search}
          onSearch={table.setSearch}
          searchPlaceholder="Search specialization…"
          filters={
            <>
              <Select size="sm" className="w-[12rem]" name="dep" value={filters.department} onChange={(v) => setFilters((f) => ({ ...f, department: v }))} options={[{ value: "all", label: "All departments" }, ...departments.map((d: any) => ({ value: d.id, label: d.name }))]} />
              <Select size="sm" className="w-[9rem]" name="st" value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} options={[{ value: "all", label: "Any status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
            </>
          }
          actions={canCreate("specializations") ? <Button size="sm" icon={<Layers />} onClick={() => setEditing({ status: "active", departmentId: departments[0]?.id ?? "" })}>Add specialization</Button> : <Badge tone="neutral">Read only</Badge>}
        />
        <DataTable
          columns={[
            { key: "name", header: "Specialization", sortable: true, render: (s) => (
              <div className="flex items-center gap-3">
                <span className={cn("grid size-8 place-items-center rounded-lg text-[10px] font-bold", s.status === "active" ? "bg-mint-50 text-mint-600" : "bg-ink-100 text-ink-400")}>{s.code}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold text-ink-900">{s.name}</span>
                  <span className="block truncate text-[11.5px] text-ink-400">{s.description}</span>
                </span>
              </div>
            ) },
            { key: "departmentId", header: "Department", hideBelow: "md", render: (s) => <Badge tone="brand" size="xs">{deptName.get(s.departmentId) ?? "Unassigned"}</Badge> },
            { key: "doctors", header: "Doctors", align: "center", render: (s) => <span className="num font-semibold text-ink-700">{doctorCount(s.id)}</span> },
            { key: "status", header: "Status", align: "center", sortable: true, render: (s) => <StatusBadge status={s.status} /> },
          ]}
          rows={table.rows}
          status={status === "ready" ? "ready" : status === "error" ? "error" : "loading"}
          sort={{ sortBy: table.query.sortBy, sortDir: table.query.sortDir, onSort: table.toggleSort }}
          actions={(s) => (
            <RowActions
              items={[
                { label: "Edit", icon: <Pencil />, hidden: !canEdit("specializations"), onClick: () => setEditing(s) },
                { label: s.status === "active" ? "Deactivate" : "Activate", icon: s.status === "active" ? <Ban /> : <CheckCircle2 />, hidden: !canEdit("specializations"), onClick: () => dispatch(specializationsApi.thunks.toggleActive({ id: s.id, status: (s.status === "active" ? "inactive" : "active") as Status, label: s.name } as any)) },
                { label: "Delete", icon: <Trash2 />, tone: "danger", hidden: !canDelete("specializations"), onClick: () => dispatch(specializationsApi.thunks.removeOne({ id: s.id, label: s.name } as any)) },
              ]}
            />
          )}
          emptyTitle="No specializations defined"
          footer={<Pagination page={table.page} pageCount={table.pageCount} total={table.total} pageSize={table.pageSize} onPage={table.setPage} onPageSize={table.setPageSize} label="specializations" />}
        />
      </Panel>

      {editing && <SpecializationForm initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function SpecializationForm({ initial, onClose }: { initial: Partial<Specialization>; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const departments = useRootSelector((s) => s.departments.items);
  const form = useForm({
    initialValues: {
      name: initial.name ?? "", code: initial.code ?? "", departmentId: initial.departmentId ?? (departments[0]?.id ?? ""),
      description: initial.description ?? "", status: (initial.status ?? "active") as Status,
    },
    schema: {
      name: [{ required: "Name is required", min: 3 }],
      code: [{ required: "Code is required", pattern: /^[A-Za-z]{2,6}$/ }],
      departmentId: [{ required: "Attach this specialization to a department" }],
      description: [{ required: "Description is required", min: 8 }],
    },
  });

  const save = form.handleSubmit(async (values) => {
    const data = { ...values, code: values.code.toUpperCase() };
    if (initial.id) await dispatch(specializationsApi.thunks.updateOne({ id: initial.id, data, successMessage: "Specialization updated" } as any));
    else await dispatch(specializationsApi.thunks.createOne({ data: { ...data, createdAt: new Date().toISOString() }, successMessage: "Specialization created" } as any));
    onClose();
  });

  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && onClose()}
      size="md"
      title={initial.id ? `Edit ${initial.name}` : "Add specialization"}
      description="Specializations refine doctor search and appointment routing."
      onSubmit={save}
      loading={form.submitting}
      submitLabel={initial.id ? "Save changes" : "Create specialization"}
    >
      <FormRow>
        <Input name="name" label="Specialization name" required placeholder="Interventional Cardiology" value={form.values.name} onChange={(e) => form.setValue("name", e.target.value)} error={form.errors.name} />
        <Input name="code" label="Code" required placeholder="IC" value={form.values.code} onChange={(e) => form.setValue("code", e.target.value)} error={form.errors.code} className="uppercase" />
        <Select name="departmentId" label="Department" required value={form.values.departmentId} onChange={(v) => form.setValue("departmentId", v)} error={form.errors.departmentId} options={departments.map((d: any) => ({ value: d.id, label: d.name }))} />
        <Select name="status" label="Status" value={form.values.status} onChange={(v) => form.setValue("status", v)} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
      </FormRow>
      <Textarea name="description" label="Description" required rows={3} placeholder="Clinical focus, procedures and referral criteria…" value={form.values.description} onChange={(e) => form.setValue("description", e.target.value)} error={form.errors.description} />
    </FormDialog>
  );
}
