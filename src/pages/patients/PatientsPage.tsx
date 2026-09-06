import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Ban,
  CheckCircle2,
  Eye,
  Pencil,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { BLOOD_GROUPS, GENDERS } from "@/constants";
import {
  useAppDispatch,
  usePermission,
  useRootSelector,
  useTable,
} from "@/hooks";
import { patientsApi } from "@/features/slices";
import { calcAge, formatDate, fullName } from "@/utils";
import { samplePatient } from "@/data/formDefaults";
import type { Patient, Status } from "@/types";
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
import { useConfirmDialog } from "@/components/ui/overlays";
import { PageIntro } from "@/components/common";
import { toDisplayBloodGroup } from "@/types/bloodGroup";

export const emptyPatient = (): Partial<Patient> => samplePatient();

const bloodGroupApiValue = (bloodGroup: string) =>
  bloodGroup.replace("+", "_POSITIVE").replace("-", "_NEGATIVE").toUpperCase();

/* ---------------------------------- list ---------------------------------- */

export function PatientsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const hasFetchedPatients = useRef(false);
  const { items: patients, status } = useRootSelector((s) => s.patients);
  const appointments = useRootSelector((s) => s.appointments.items);
  const { canEdit, canDelete, canCreate } = usePermission();
  const [filters, setFilters] = useState({
    gender: "all",
    status: "all",
    bloodGroup: "all",
  });
  const { ask, confirmNode } = useConfirmDialog();

  const table = useTable<Patient>(patients as Patient[], {
    pageSize: 8,
    filters: {
      ...filters,
      bloodGroup:
        filters.bloodGroup === "all"
          ? "all"
          : [filters.bloodGroup, bloodGroupApiValue(filters.bloodGroup)],
    },
    searchFields: [
      (p) => `${p.firstName} ${p.lastName} ${p.mrn} ${p.mobile} ${p.email}`,
      (p) => p.city,
    ],
    sortAccessors: {
      name: (p) => `${p.lastName}${p.firstName}`,
      dateOfBirth: (p) => p.dateOfBirth,
      createdAt: (p) => p.createdAt,
      status: (p) => p.status,
    },
  });

  useEffect(() => {
    if (hasFetchedPatients.current) return;
    hasFetchedPatients.current = true;
    dispatch(patientsApi.thunks.fetchAll() as any);
  }, [dispatch]);

  const visits = useMemo(() => {
    const map = new Map<string, number>();
    appointments.forEach((a: any) =>
      map.set(a.patientId, (map.get(a.patientId) ?? 0) + 1),
    );
    return map;
  }, [appointments]);

  const toggle = (p: Patient) => {
    const next: Status = p?.status === "active" ? "inactive" : "active";
    dispatch(
      patientsApi.thunks.toggleActive({
        id: p.id,
        status: next,
        label: fullName(p),
      } as any),
    );
  };

  return (
    <>
      <PageIntro
        title="Patient registry"
        description="Master patient index with demographics, emergency contacts and clinical background. Open a row for the complete care timeline."
        module="patients"
        createLabel="Register patient"
        onCreate={() => navigate("/patients/register")}
        actions={
          canCreate("patients") ? (
            <Button
              size="sm"
              variant="outline"
              icon={<RefreshCw />}
              onClick={() => dispatch(patientsApi.thunks.fetchAll() as any)}
            >
              Refresh
            </Button>
          ) : undefined
        }
        meta={
          <>
            <Badge tone="brand" dot>
              {
                (patients ?? [])?.filter((p: any) => p?.status === "active")
                  .length
              }{" "}
              active
            </Badge>
            <Badge tone="lagoon">
              {
                (appointments ?? [])?.filter(
                  (a: any) => a.date === new Date().toISOString().slice(0, 10),
                ).length
              }{" "}
              visits today
            </Badge>
            <Badge tone="neutral">{patients.length} registered</Badge>
          </>
        }
      />

      <Panel>
        <TableToolbar
          search={table.query.search}
          onSearch={table.setSearch}
          searchPlaceholder="Search name, MRN, phone, email…"
          filters={
            <>
              <Select
                size="sm"
                className="w-[8.5rem]"
                name="gender"
                value={filters.gender}
                onChange={(v) => setFilters((f) => ({ ...f, gender: v }))}
                options={[
                  { value: "all", label: "Any gender" },
                  ...GENDERS.map((g) => ({ value: g, label: g })),
                ]}
              />
              <Select
                size="sm"
                className="w-[9rem]"
                name="blood"
                value={filters.bloodGroup}
                onChange={(v) => setFilters((f) => ({ ...f, bloodGroup: v }))}
                options={[
                  { value: "all", label: "Any blood group" },
                  ...BLOOD_GROUPS.map((b) => ({ value: b, label: b })),
                ]}
              />
              <Select
                size="sm"
                className="w-[8.5rem]"
                name="status"
                value={filters.status}
                onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
                options={[
                  { value: "all", label: "Any status" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Archived" },
                ]}
              />
            </>
          }
        />
        <DataTable
          columns={[
            {
              key: "name",
              header: "Patient",
              sortable: true,
              render: (p) => (
                <div className="flex items-center gap-3">
                  <Avatar
                    name={fullName(p)}
                    color={
                      p.gender === "Female"
                        ? "bg-lagoon-500"
                        : p.gender === "Male"
                          ? "bg-brand-500"
                          : "bg-amberly-500"
                    }
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold text-ink-900">
                      {fullName(p)}
                    </p>
                    <p className="num truncate text-[11.5px] text-ink-400">
                      {p.mrn}
                    </p>
                  </div>
                </div>
              ),
            },
            {
              key: "age",
              header: "Age / gender",
              hideBelow: "md",
              render: (p) => (
                <span className="text-[12.5px] text-ink-600">
                  {calcAge(p.dateOfBirth, p.ageUnit)} · {p.gender}
                </span>
              ),
            },
            {
              key: "mobile",
              header: "Contact",
              hideBelow: "lg",
              render: (p) => (
                <span className="num text-[12px] text-ink-500">{p.mobile}</span>
              ),
            },
            {
              key: "bloodGroup",
              header: "Blood",
              align: "center",
              hideBelow: "sm",
              render: (p) => {
                const group = toDisplayBloodGroup(p.bloodGroup);
                return (
                  <Badge
                    tone={group.includes("-") ? "coral" : "neutral"}
                    size="xs"
                  >
                    {group}
                  </Badge>
                );
              },
            },
            {
              key: "visits",
              header: "Visits",
              align: "right",
              hideBelow: "xl",
              render: (p) => (
                <span className="num font-semibold text-ink-700">
                  {visits.get(p.id) ?? 0}
                </span>
              ),
            },
            {
              key: "createdAt",
              header: "Registered",
              sortable: true,
              hideBelow: "lg",
              render: (p) => (
                <span className="text-[12px] text-ink-500">
                  {formatDate(p.createdAt)}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              align: "center",
              sortable: true,
              render: (p) => <StatusBadge status={p.status} />,
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
          onRetry={() => dispatch(patientsApi.thunks.fetchAll() as any)}
          sort={{
            sortBy: table.query.sortBy,
            sortDir: table.query.sortDir,
            onSort: table.toggleSort,
          }}
          onRowClick={(p) => navigate(`/patients/${p.id}/detail`)}
          actions={(p) => (
            <RowActions
              items={[
                {
                  label: "Open profile",
                  icon: <Eye />,
                  onClick: () => navigate(`/patients/${p.id}/detail`),
                },
                {
                  label: "Edit patient",
                  icon: <Pencil />,
                  onClick: () => navigate(`/patients/${p.id}/edit`),
                  hidden: !canEdit("patients"),
                },
                {
                  label:
                    p.status === "active" ? "Archive record" : "Restore record",
                  icon: p.status === "active" ? <Ban /> : <CheckCircle2 />,
                  onClick: () => toggle(p),
                  hidden: !canEdit("patients"),
                },
                {
                  label: "Delete patient",
                  icon: <Trash2 />,
                  tone: "danger",
                  hidden: !canDelete("patients"),
                  onClick: () =>
                    ask({
                      title: `Delete ${fullName(p)}?`,
                      description: `MRN ${p.mrn} and its linked appointments, consultations and invoices will be removed from the registry. This cannot be undone.`,
                      confirmLabel: "Delete patient",
                      action: async () => {
                        await dispatch(
                          patientsApi.thunks.removeOne({
                            id: p.id,
                            label: fullName(p),
                          } as any),
                        );
                      },
                    }),
                },
              ]}
            />
          )}
          emptyTitle="No patients registered"
          emptyDescription="Register the first patient to begin scheduling visits."
          emptyAction={
            canCreate("patients") ? (
              <Button
                size="sm"
                icon={<Users />}
                onClick={() => navigate("/patients/register")}
              >
                Register patient
              </Button>
            ) : undefined
          }
          footer={
            <Pagination
              page={table.page}
              pageCount={table.pageCount}
              total={table.total}
              pageSize={table.pageSize}
              onPage={table.setPage}
              onPageSize={table.setPageSize}
              label="patients"
            />
          }
        />
      </Panel>

      {confirmNode}
    </>
  );
}
