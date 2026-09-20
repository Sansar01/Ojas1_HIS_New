/* ------------------------------- Specializations ------------------------------ */

import { PageIntro, FormDialog, FormRow } from "@/components/common";
import { Input, Textarea } from "@/components/ui/fields";
import { Panel, Button, StatusBadge } from "@/components/ui/primitives";
import {
  TableToolbar,
  DataTable,
  RowActions,
  Pagination,
} from "@/components/ui/table";
import { specializationsApi } from "@/features/slices";
import {
  useAppDispatch,
  useRootSelector,
  usePermission,
  useTable,
} from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { Specialization, Status } from "@/types";
import { cn } from "@/utils/cn";
import { Select } from "@radix-ui/react-select";
import { Layers, Badge, Pencil, Ban, CheckCircle2, Trash2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";

export function SpecializationsPage() {
  const dispatch = useAppDispatch();
  const { items: specializations, status } = useRootSelector(
    (s) => s.specializations,
  );
  const departments = useRootSelector((s) => s.departments.items);
  const doctors = useRootSelector((s) => s.doctors.items);
  const { canCreate, canEdit, canDelete } = usePermission();
  const [editing, setEditing] = useState<Partial<Specialization> | null>(null);
  const [filters, setFilters] = useState({ department: "all", status: "all" });

  useEffect(() => {
    // if (status === "idle") dispatch(specializationsApi.thunks.fetchAll() as any);
  }, [status, dispatch]);

  const table = useTable<Specialization>(specializations as Specialization[], {
    pageSize: 8,
    filters,
    searchFields: [(s) => `${s.name} ${s.code} ${s.description}`],
    sortAccessors: { name: (s) => s.name, status: (s) => s.status },
  });

  const doctorCount = (id: string) =>
    doctors.filter((d: any) => d.specializationId === id).length;
  const deptName = useMemo(
    () => new Map(departments.map((d: any) => [d.id, d.name])),
    [departments],
  );

  return (
    <>
      <PageIntro
        title="Specializations"
        description="Clinical specializations used for doctor profiles, appointment filtering and referral routing."
        module="specializations"
        createLabel="Add specialization"
        onCreate={() =>
          setEditing({
            name: "",
            code: "",
            description: "",
            status: "active",
            departmentId: departments[0]?.id ?? "",
          })
        }
      />
      <Panel>
        <TableToolbar
          search={table.query.search}
          onSearch={table.setSearch}
          searchPlaceholder="Search specialization…"
          filters={
            <>
              <Select
                size="sm"
                className="w-[12rem]"
                name="dep"
                value={filters.department}
                onChange={(v) => setFilters((f) => ({ ...f, department: v }))}
                options={[
                  { value: "all", label: "All departments" },
                  ...departments.map((d: any) => ({
                    value: d.id,
                    label: d.name,
                  })),
                ]}
              />
              <Select
                size="sm"
                className="w-[9rem]"
                name="st"
                value={filters.status}
                onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
                options={[
                  { value: "all", label: "Any status" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />
            </>
          }
          actions={
            canCreate("specializations") ? (
              <Button
                size="sm"
                icon={<Layers />}
                onClick={() =>
                  setEditing({
                    status: "active",
                    departmentId: departments[0]?.id ?? "",
                  })
                }
              >
                Add specialization
              </Button>
            ) : (
              <Badge tone="neutral">Read only</Badge>
            )
          }
        />
        <DataTable
          columns={[
            {
              key: "name",
              header: "Specialization",
              sortable: true,
              render: (s) => (
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "grid size-8 place-items-center rounded-lg text-[10px] font-bold",
                      s.status === "active"
                        ? "bg-mint-50 text-mint-600"
                        : "bg-ink-100 text-ink-400",
                    )}
                  >
                    {s.code}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-ink-900">
                      {s.name}
                    </span>
                    <span className="block truncate text-[11.5px] text-ink-400">
                      {s.description}
                    </span>
                  </span>
                </div>
              ),
            },
            {
              key: "departmentId",
              header: "Department",
              hideBelow: "md",
              render: (s) => (
                <Badge tone="brand" size="xs">
                  {deptName.get(s.departmentId) ?? "Unassigned"}
                </Badge>
              ),
            },
            {
              key: "doctors",
              header: "Doctors",
              align: "center",
              render: (s) => (
                <span className="num font-semibold text-ink-700">
                  {doctorCount(s.id)}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              align: "center",
              sortable: true,
              render: (s) => <StatusBadge status={s.status} />,
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
          actions={(s) => (
            <RowActions
              items={[
                {
                  label: "Edit",
                  icon: <Pencil />,
                  hidden: !canEdit("specializations"),
                  onClick: () => setEditing(s),
                },
                {
                  label: s.status === "active" ? "Deactivate" : "Activate",
                  icon: s.status === "active" ? <Ban /> : <CheckCircle2 />,
                  hidden: !canEdit("specializations"),
                  onClick: () =>
                    dispatch(
                      specializationsApi.thunks.toggleActive({
                        id: s.id,
                        status: (s.status === "active"
                          ? "inactive"
                          : "active") as Status,
                        label: s.name,
                      } as any),
                    ),
                },
                {
                  label: "Delete",
                  icon: <Trash2 />,
                  tone: "danger",
                  hidden: !canDelete("specializations"),
                  onClick: () =>
                    dispatch(
                      specializationsApi.thunks.removeOne({
                        id: s.id,
                        label: s.name,
                      } as any),
                    ),
                },
              ]}
            />
          )}
          emptyTitle="No specializations defined"
          footer={
            <Pagination
              page={table.page}
              pageCount={table.pageCount}
              total={table.total}
              pageSize={table.pageSize}
              onPage={table.setPage}
              onPageSize={table.setPageSize}
              label="specializations"
            />
          }
        />
      </Panel>

      {editing && (
        <SpecializationForm
          initial={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function SpecializationForm({
  initial,
  onClose,
}: {
  initial: Partial<Specialization>;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const departments = useRootSelector((s) => s.departments.items);
  const form = useForm({
    initialValues: {
      name: initial.name ?? "",
      code: initial.code ?? "",
      departmentId: initial.departmentId ?? departments[0]?.id ?? "",
      description: initial.description ?? "",
      status: (initial.status ?? "active") as Status,
    },
    schema: {
      name: [{ required: "Name is required", min: 3 }],
      code: [{ required: "Code is required", pattern: /^[A-Za-z]{2,6}$/ }],
      departmentId: [
        { required: "Attach this specialization to a department" },
      ],
      description: [{ required: "Description is required", min: 8 }],
    },
  });

  const save = form.handleSubmit(async (values) => {
    const data = { ...values, code: values.code.toUpperCase() };
    if (initial.id)
      await dispatch(
        specializationsApi.thunks.updateOne({
          id: initial.id,
          data,
          successMessage: "Specialization updated",
        } as any),
      );
    else
      await dispatch(
        specializationsApi.thunks.createOne({
          data: { ...data, createdAt: new Date().toISOString() },
          successMessage: "Specialization created",
        } as any),
      );
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
        <Input
          name="name"
          label="Specialization name"
          required
          placeholder="Interventional Cardiology"
          value={form.values.name}
          onChange={(e) => form.setValue("name", e.target.value)}
          error={form.errors.name}
        />
        <Input
          name="code"
          label="Code"
          required
          placeholder="IC"
          value={form.values.code}
          onChange={(e) => form.setValue("code", e.target.value)}
          error={form.errors.code}
          className="uppercase"
        />
        <Select
          name="departmentId"
          label="Department"
          required
          value={form.values.departmentId}
          onChange={(v) => form.setValue("departmentId", v)}
          error={form.errors.departmentId}
          options={departments.map((d: any) => ({
            value: d.id,
            label: d.name,
          }))}
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
      </FormRow>
      <Textarea
        name="description"
        label="Description"
        required
        rows={3}
        placeholder="Clinical focus, procedures and referral criteria…"
        value={form.values.description}
        onChange={(e) => form.setValue("description", e.target.value)}
        error={form.errors.description}
      />
    </FormDialog>
  );
}
