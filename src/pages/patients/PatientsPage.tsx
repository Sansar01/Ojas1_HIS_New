import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useAppDispatch } from "@/store/hooks";
import { usePermission, useTable } from "@/hooks";
import { patientService } from "@/pages/patients/patient.service";
import { appointmentService } from "@/pages/appointments/appointment.service";
import { toast } from "@/store/slices/uiSlice";
import { calcAge, formatDate, fullName } from "@/utils";
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
import { toBackendBloodGroup, toDisplayBloodGroup } from "@/utils/bloodGroup";

/* ---------------------------------- list ---------------------------------- */

/**
 * Patient registry.
 *
 * Data comes from `patient.service` (list) and `appointment.service` (visit
 * counter) straight into this page's local state — no slice, no bootstrap step.
 */
export function PatientsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { canEdit, canDelete, canCreate } = usePermission();
  const [filters, setFilters] = useState({
    gender: "all",
    status: "all",
    bloodGroup: "all",
  });
  const { ask, confirmNode } = useConfirmDialog();

  /* ------------------------------ local data ------------------------------ */

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await patientService.fetchPatients();
      if (response.status === 200) setPatients(response.data?.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Could not load patients");
      dispatch(toast.error("Could not load patients", e?.message));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  // the "visits" column is derived from the appointment list — the page asks
  // for exactly the two collections it renders and nothing else
  const [appointments, setAppointments] = useState<any[]>([]);

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
    loadPatients();
  }, [loadPatients]);

  const table = useTable<Patient>(patients, {
    pageSize: 8,
    filters: {
      ...filters,
      bloodGroup:
        filters.bloodGroup === "all"
          ? "all"
          : [filters.bloodGroup, toBackendBloodGroup(filters.bloodGroup)],
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

  const visits = useMemo(() => {
    const map = new Map<string, number>();
    appointments.forEach((a: any) =>
      map.set(a.patientId, (map.get(a.patientId) ?? 0) + 1),
    );
    return map;
  }, [appointments]);

  /* ------------------------------ mutations ------------------------------- */

  const toggle = useCallback(
    async (patient: Patient) => {
      const next: Status = patient?.status === "active" ? "inactive" : "active";
      try {
        await patientService.updatePatient(patient.id, { status: next });
        setPatients((rows) =>
          rows.map((row) =>
            row.id === patient.id ? { ...row, status: next } : row,
          ),
        );
        dispatch(
          toast.info(
            next === "active" ? "Marked active" : "Marked inactive",
            `${fullName(patient)} is now ${next}.`,
          ),
        );
      } catch (e: any) {
        dispatch(toast.error("Status change failed", e?.message));
      }
    },
    [dispatch, setPatients],
  );

  const remove = useCallback(
    async (patient: Patient) => {
      try {
        await patientService.deletePatient(patient.id);
        setPatients((rows) => rows.filter((row) => row.id !== patient.id));
        dispatch(
          toast.success(
            "Record deleted",
            `${fullName(patient)} was removed from the portal.`,
          ),
        );
      } catch (e: any) {
        dispatch(toast.error("Delete failed", e?.message));
      }
    },
    [dispatch, setPatients],
  );

  const status = loading ? "loading" : error ? "error" : "ready";

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
              onClick={loadPatients}
            >
              Refresh
            </Button>
          ) : undefined
        }
        meta={
          <>
            <Badge tone="brand" dot>
              {patients.filter((p: any) => p?.status === "active").length}{" "}
              active
            </Badge>
            <Badge tone="lagoon">
              {
                appointments.filter(
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
          status={status}
          onRetry={loadPatients}
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
                      action: () => remove(p),
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
