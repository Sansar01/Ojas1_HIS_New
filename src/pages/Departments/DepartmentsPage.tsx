import { useCallback, useEffect, useState } from "react";
import {
  Eye,
  Layers,
  Pencil,
  RefreshCw,
  Trash2,
  UserRound,
} from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { usePermission, useTable } from "@/hooks";
import { departmentService } from "@/pages/Departments/department.service";
import { doctorService } from "@/pages/doctors/doctor.service";
import { appointmentService } from "@/pages/appointments/appointment.service";
import { toast } from "@/store/slices/uiSlice";
import { formatDate, fullName } from "@/utils";
import type { Department } from "@/types";
import {
  Avatar,
  Badge,
  Button,
  Panel,
  StatusBadge,
} from "@/components/ui/primitives";
import { Select } from "@/components/ui/fields";
import {
  DataTable,
  Pagination,
  RowActions,
  TableToolbar,
} from "@/components/ui/table";
import { Sheet } from "@/components/ui/overlays";
import { DetailGrid, PageIntro, SectionPanel } from "@/components/common";
import { DepartmentFormDialog } from "./DepartmentsFormPage";

/* -------------------------------- Departments ------------------------------- */

export function DepartmentsPage() {
  const dispatch = useAppDispatch();
  const { canCreate, canEdit, canDelete } = usePermission();
  const [editing, setEditing] = useState<Partial<Department> | null>(null);
  const [detail, setDetail] = useState<Department | null>(null);
  const [filters, setFilters] = useState({ status: "all" });

  /* ------------------------------- local data ----------------------------- */

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** departments + the collections the table columns render */
  const loadDepartments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await departmentService.fetchDepartments();
      if (response.status === 200) setDepartments(response.data?.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Could not load departments");
      dispatch(toast.error("Could not load departments", e?.message));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  const [doctors, setDoctors] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await doctorService.fetchDoctors();
        if (active && response.status === 200)
          setDoctors(response.data?.data ?? []);
      } catch (e: any) {
        dispatch(toast.error("Could not load doctors", e?.message));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await appointmentService.fetchAppointments();
        if (active && response.status === 200) {
          setAppointments(response.data?.data ?? []);
        }
      } catch (e: any) {
        dispatch(toast.error("Could not load appointments", e?.message));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  /** re-run the department list API (e.g. after a write) */
  const refreshList = useCallback(async () => {
    await loadDepartments();
  }, [loadDepartments]);

  const remove = useCallback(
    async (department: Department) => {
      try {
        await departmentService.deleteDepartment(department.id);
        setDepartments((rows) =>
          rows.filter((row) => row.id !== department.id),
        );
        dispatch(
          toast.success(
            "Record deleted",
            `${department.name} was removed from the portal.`,
          ),
        );
      } catch (e: any) {
        dispatch(toast.error("Delete failed", e?.message));
      }
    },
    [dispatch, setDepartments],
  );

  const status = loading ? "loading" : error ? "error" : "ready";

  const table = useTable<Department>(departments, {
    pageSize: 8,
    filters,
    searchFields: [(d) => `${d.name} ${d.code} ${d.description} ${d.floor}`],
    sortAccessors: { name: (d) => d.name, status: (d) => d.status },
  });

  const stats = (id: string) => ({
    doctors: doctors.filter((d: any) => d.departmentId === id).length,
    visits: appointments.filter((a: any) => a.departmentId === id).length,
  });

  return (
    <>
      <PageIntro
        title="Departments"
        description="Clinical and support departments that group doctors, specializations and reporting lines."
        module="departments"
        createLabel="Add department"
        onCreate={() =>
          setEditing({
            name: "",
            code: "",
            description: "",
            floor: "",
            status: "active",
            headDoctorId: null,
          })
        }
        meta={
          <>
            <Badge tone="brand" dot>
              {departments.filter((d: any) => d.status === "active").length}{" "}
              operational
            </Badge>
            <Badge tone="lagoon">{doctors.length} doctors mapped</Badge>
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canCreate("departments") ? (
              <Button
                size="sm"
                variant="outline"
                icon={<RefreshCw />}
                loading={loading}
                onClick={refreshList}
              >
                Refresh
              </Button>
            ) : undefined}
          </div>
        }
      />
      <Panel>
        <TableToolbar
          search={table.query.search}
          onSearch={table.setSearch}
          searchPlaceholder="Search department…"
          filters={
            <Select
              size="sm"
              className="w-[9rem]"
              name="st"
              value={filters.status}
              onChange={(v) => setFilters({ status: v })}
              options={[
                { value: "all", label: "Any status" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
          }
        />
        <DataTable
          columns={[
            {
              key: "name",
              header: "Department",
              sortable: true,
              render: (d) => (
                <button
                  className="flex items-center gap-3 text-left"
                  onClick={() => setDetail(d)}
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-brand-25 text-brand-600 ring-1 ring-inset ring-brand-100">
                    <Layers className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-ink-900">
                      {d.name}
                    </span>
                    <span className="num block truncate text-[11.5px] text-ink-400">
                      {d.code} · {d.floor || "—"}
                    </span>
                  </span>
                </button>
              ),
            },
            {
              key: "description",
              header: "Scope",
              hideBelow: "lg",
              render: (d) => (
                <span className="line-clamp-1 text-[12.5px] text-ink-500">
                  {d.description}
                </span>
              ),
            },
            {
              key: "head",
              header: "Head of department",
              hideBelow: "md",
              render: (d) => {
                const doc = doctors.find((x: any) => x.id === d.headDoctorId);
                return doc ? (
                  <span className="flex items-center gap-2 text-[12.5px]">
                    <Avatar name={fullName(doc)} size="xs" color="bg-ink-600" />
                    Dr. {fullName(doc)}
                  </span>
                ) : (
                  <span className="text-[12px] text-ink-300">Vacant</span>
                );
              },
            },
            {
              key: "doctors",
              header: "Doctors",
              align: "center",
              render: (d) => (
                <span className="num font-semibold text-ink-700">
                  {stats(d.id).doctors}
                </span>
              ),
            },
            {
              key: "visits",
              header: "Visits (30d)",
              align: "right",
              hideBelow: "xl",
              render: (d) => (
                <span className="num text-ink-600">{stats(d.id).visits}</span>
              ),
            },
            {
              key: "status",
              header: "Status",
              align: "center",
              // Read-only badge: green Active when the API's isActive is true,
              // grey Inactive otherwise. Toggling lives in the form dialog.
              render: (d) => (
                <StatusBadge status={d.isActive ? "Active" : "InActive"} />
              ),
            },
          ]}
          rows={table.rows}
          status={status}
          sort={{
            sortBy: table.query.sortBy,
            sortDir: table.query.sortDir,
            onSort: table.toggleSort,
          }}
          actions={(d) => (
            <RowActions
              items={[
                {
                  label: "View department",
                  icon: <Eye />,
                  onClick: () => setDetail(d),
                },
                {
                  label: "Edit",
                  icon: <Pencil />,
                  hidden: !canEdit("departments"),
                  onClick: () => setEditing(d),
                },
                {
                  label: "Delete",
                  icon: <Trash2 />,
                  tone: "danger",
                  hidden: !canDelete("departments"),
                  onClick: () => remove(d),
                },
              ]}
            />
          )}
          emptyTitle="No departments configured"
          footer={
            <Pagination
              page={table.page}
              pageCount={table.pageCount}
              total={table.total}
              pageSize={table.pageSize}
              onPage={table.setPage}
              onPageSize={table.setPageSize}
              label="departments"
            />
          }
        />
      </Panel>

      {editing && (
        <DepartmentFormDialog
          initial={editing}
          onClose={() => setEditing(null)}
        />
      )}

      <Sheet
        open={!!detail}
        onOpenChange={(v) => !v && setDetail(null)}
        title={detail?.name ?? ""}
        description={
          detail ? `Established ${formatDate(detail.createdAt)}` : ""
        }
      >
        {detail && (
          <div className="space-y-4">
            <DetailGrid
              columns={2}
              items={[
                {
                  label: "Code",
                  value: <span className="num">{detail.code}</span>,
                },
                { label: "Location", value: detail.floor || "—" },
                {
                  label: "Status",
                  value: <StatusBadge status={detail.status} />,
                },
                {
                  label: "Head of department",
                  value:
                    fullName(
                      doctors.find((x: any) => x.id === detail.headDoctorId),
                    ) || "Vacant",
                },
              ]}
            />
            <p className="rounded-xl bg-ink-25 p-3 text-[13px] leading-relaxed text-ink-600">
              {detail.description || "No scope description provided."}
            </p>
            <SectionPanel
              title="Doctors in this department"
              icon={<UserRound />}
              bodyClass="p-0"
            >
              <ul className="divide-y divide-ink-100">
                {doctors
                  .filter((d: any) => d.departmentId === detail.id)
                  .map((d: any) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <span className="flex items-center gap-2.5">
                        <Avatar
                          name={fullName(d)}
                          size="xs"
                          color="bg-brand-600"
                        />
                        <span>
                          <span className="block text-[13px] font-medium text-ink-800">
                            Dr. {fullName(d)}
                          </span>
                          <span className="block text-[11px] text-ink-400">
                            {(d as any).specialization ||
                              (d as any).specializationId ||
                              ""}
                          </span>
                        </span>
                      </span>
                      <StatusBadge status={d.status} />
                    </li>
                  ))}
                {doctors.filter((d: any) => d.departmentId === detail.id)
                  .length === 0 && (
                  <li className="px-4 py-6 text-center text-[12.5px] text-ink-400">
                    No doctors mapped yet.
                  </li>
                )}
              </ul>
            </SectionPanel>
          </div>
        )}
      </Sheet>
    </>
  );
}
