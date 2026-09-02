import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Ban,
  CalendarPlus,
  CheckCircle2,
  Eye,
  FileText,
  Heart,
  Pencil,
  Phone,
  Receipt,
  Stethoscope,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { BLOOD_GROUPS, GENDERS, MARITAL_STATUS } from "@/constants";
import {
  useAppDispatch,
  usePermission,
  useRootSelector,
  useTable,
} from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { patientsApi } from "@/features/slices";
import { calcAge, formatDate, formatMoney, fullName } from "@/utils";
import { samplePatient } from "@/data/formDefaults";
import { cn } from "@/utils/cn";
import type { Patient, Status } from "@/types";
import {
  Avatar,
  Badge,
  Button,
  Panel,
  StatusBadge,
} from "@/components/ui/primitives";
import { Input, Select, DatePicker, Textarea } from "@/components/ui/fields";
import {
  DataTable,
  Pagination,
  RowActions,
  TableToolbar,
} from "@/components/ui/table";
import { useConfirmDialog } from "@/components/ui/overlays";
import {
  DetailGrid,
  FormDialog,
  FormRow,
  FormSection,
  PageIntro,
  SectionPanel,
  TagInput,
} from "@/components/common";

export const emptyPatient = (): Partial<Patient> => samplePatient();

export function PatientForm({
  initial,
  onClose,
}: {
  initial: Partial<Patient>;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const isEdit = Boolean(initial.id);
  const form = useForm({
    initialValues: {
      firstName: initial.firstName ?? "",
      lastName: initial.lastName ?? "",
      gender: (initial.gender ?? "Female") as any,
      dateOfBirth: initial.dateOfBirth ?? "2000-01-01",
      ageUnit: (initial.ageUnit ?? "Years") as any,
      mobile: initial.mobile ?? "",
      altMobile: initial.altMobile ?? "",
      email: initial.email ?? "",
      bloodGroup: initial.bloodGroup ?? "O+",
      maritalStatus: (initial.maritalStatus ?? "Single") as any,
      address: initial.address ?? "",
      city: initial.city ?? "",
      emergencyContactName: initial.emergencyContactName ?? "",
      emergencyContactNumber: initial.emergencyContactNumber ?? "",
      allergies: initial.allergies ?? "",
      chronicConditions: initial.chronicConditions ?? "",
      heightCm: initial.heightCm ?? 168,
      weightKg: initial.weightKg ?? 64,
      status: (initial.status ?? "active") as Status,
    },
    schema: {
      firstName: [{ required: "First name is required", min: 2 }],
      lastName: [{ required: "Last name is required", min: 2 }],
      gender: [{ required: "Select a gender" }],
      dateOfBirth: [{ required: "Date of birth is required" }],
      mobile: [
        {
          required: "Mobile number is required",
          pattern: /^[+0-9][0-9\s()-]{7,}$/,
        },
      ],
      email: [
        {
          email: true,
          validate: (v: string) =>
            v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
              ? "Enter a valid email address"
              : true,
        },
      ],
      emergencyContactNumber: [
        {
          required: "Emergency contact number is required",
          pattern: /^[+0-9][0-9\s()-]{7,}$/,
        },
      ],
      address: [{ required: "Address is required", min: 6 }],
      city: [{ required: "City is required" }],
    },
  });

  const save = form.handleSubmit(async (values) => {
    if (isEdit) {
      await dispatch(
        patientsApi.thunks.updateOne({
          id: initial.id!,
          data: values,
          successMessage: "Patient record updated",
        } as any),
      );
    } else {
      const sequence = 1000 + Math.floor(Math.random() * 8999);
      await dispatch(
        patientsApi.thunks.createOne({
          data: { ...values, mrn: `MRN-${sequence}` },
          successMessage: "Patient registered",
        } as any),
      );
    }
    onClose();
  });

  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title={
        isEdit
          ? `Edit ${initial.firstName} ${initial.lastName}`
          : "Register new patient"
      }
      description="Demographics, emergency contact and clinical background. MRN is generated automatically."
      onSubmit={save}
      loading={form.submitting}
      submitLabel={isEdit ? "Save changes" : "Register patient"}
    >
      <FormSection title="Personal information">
        <FormRow className="lg:grid-cols-4">
          <Input
            name="firstName"
            label="First name"
            required
            value={form.values.firstName}
            onChange={(e) => form.setValue("firstName", e.target.value)}
            error={form.errors.firstName}
            placeholder="Ananya"
          />
          <Input
            name="lastName"
            label="Last name"
            required
            value={form.values.lastName}
            onChange={(e) => form.setValue("lastName", e.target.value)}
            error={form.errors.lastName}
            placeholder="Iyer"
          />
          <Select
            name="gender"
            label="Gender"
            required
            value={form.values.gender}
            onChange={(v) => form.setValue("gender", v)}
            options={GENDERS.map((g) => ({
              value: g,
              label: g,
              description:
                g === "Other" ? "Prefer to self-describe at intake" : undefined,
            }))}
            hint="Used for clinical protocols and ward allocation"
          />
          <DatePicker
            label="Date of birth"
            required
            value={form.values.dateOfBirth}
            onChange={(v) => form.setValue("dateOfBirth", v)}
            error={form.errors.dateOfBirth}
            hint={`Age ${calcAge(form.values.dateOfBirth, form.values.ageUnit)}`}
          />
          <Select
            name="ageUnit"
            label="Age unit"
            value={form.values.ageUnit}
            onChange={(v) => form.setValue("ageUnit", v)}
            options={["Years", "Months", "Days"].map((u) => ({
              value: u,
              label: u,
            }))}
          />
          <Select
            name="bloodGroup"
            label="Blood group"
            value={form.values.bloodGroup}
            onChange={(v) => form.setValue("bloodGroup", v)}
            options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))}
          />
          <Select
            name="maritalStatus"
            label="Marital status"
            value={form.values.maritalStatus}
            onChange={(v) => form.setValue("maritalStatus", v)}
            options={MARITAL_STATUS.map((m) => ({ value: m, label: m }))}
          />
          <Select
            name="status"
            label="Record status"
            value={form.values.status}
            onChange={(v) => form.setValue("status", v)}
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Archived" },
            ]}
          />
        </FormRow>
      </FormSection>

      <FormSection title="Contact & address">
        <FormRow className="lg:grid-cols-3">
          <Input
            name="mobile"
            label="Mobile number"
            required
            leadingIcon={<Phone />}
            placeholder="+91 98450 11223"
            value={form.values.mobile}
            onChange={(e) => form.setValue("mobile", e.target.value)}
            error={form.errors.mobile}
          />
          <Input
            name="altMobile"
            label="Alternate number"
            placeholder="Optional"
            value={form.values.altMobile ?? ""}
            onChange={(e) => form.setValue("altMobile", e.target.value)}
          />
          <Input
            name="email"
            type="email"
            label="Email address"
            placeholder="patient@mail.com"
            value={form.values.email}
            onChange={(e) => form.setValue("email", e.target.value)}
            error={form.errors.email}
          />
          <Input
            name="address"
            label="Address"
            required
            className="sm:col-span-2 lg:col-span-2"
            placeholder="7 Marina Bay Ave, Apt 3B"
            value={form.values.address}
            onChange={(e) => form.setValue("address", e.target.value)}
            error={form.errors.address}
          />
          <Input
            name="city"
            label="City / state"
            required
            placeholder="Bengaluru, KA 560001"
            value={form.values.city}
            onChange={(e) => form.setValue("city", e.target.value)}
            error={form.errors.city}
          />
          <Input
            name="emergencyContactName"
            label="Emergency contact name"
            placeholder="Relationship & name"
            value={form.values.emergencyContactName}
            onChange={(e) =>
              form.setValue("emergencyContactName", e.target.value)
            }
          />
          <Input
            name="emergencyContactNumber"
            label="Emergency contact number"
            required
            placeholder="+91 90000 00000"
            value={form.values.emergencyContactNumber}
            onChange={(e) =>
              form.setValue("emergencyContactNumber", e.target.value)
            }
            error={form.errors.emergencyContactNumber}
          />
        </FormRow>
      </FormSection>

      <FormSection
        title="Medical information"
        description="Comma separated — rendered as tags for fast scanning"
      >
        <FormRow>
          <div className="flex flex-col gap-1.5">
            <p className="text-[12.5px] font-medium text-ink-600">
              Known allergies
            </p>
            <TagInput
              value={form.values.allergies}
              onChange={(v) => form.setValue("allergies", v)}
              placeholder="Penicillin, Dust mites…"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-[12.5px] font-medium text-ink-600">
              Chronic conditions
            </p>
            <TagInput
              value={form.values.chronicConditions}
              onChange={(v) => form.setValue("chronicConditions", v)}
              placeholder="Hypertension, Asthma…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              name="heightCm"
              type="number"
              label="Height (cm)"
              value={String(form.values.heightCm)}
              onChange={(e) =>
                form.setValue("heightCm", Number(e.target.value))
              }
            />
            <Input
              name="weightKg"
              type="number"
              label="Weight (kg)"
              value={String(form.values.weightKg)}
              onChange={(e) =>
                form.setValue("weightKg", Number(e.target.value))
              }
            />
          </div>
        </FormRow>
        <Textarea
          name="instructions"
          label="Care instructions on the face register"
          rows={3}
          placeholder="Mobility support, interpreter needs, appointment reminders…"
          className="mt-4"
        />
      </FormSection>
    </FormDialog>
  );
}

/* ---------------------------------- list ---------------------------------- */

export function PatientsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { items: patients, status } = useRootSelector((s) => s.patients);
  const appointments = useRootSelector((s) => s.appointments.items);
  const { canEdit, canDelete, canCreate } = usePermission();
  const [filters, setFilters] = useState({
    gender: "all",
    status: "all",
    bloodGroup: "all",
  });
  const [editing, setEditing] = useState<Partial<Patient> | null>(
    params.get("new") === "1" ? emptyPatient() : null,
  );
  const { ask, confirmNode } = useConfirmDialog();

  const table = useTable<Patient>(patients as Patient[], {
    pageSize: 8,
    filters,
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
    if (status === "idle") dispatch(patientsApi.thunks.fetchAll() as any);
  }, [status, dispatch]);

  const visits = useMemo(() => {
    const map = new Map<string, number>();
    appointments.forEach((a: any) =>
      map.set(a.patientId, (map.get(a.patientId) ?? 0) + 1),
    );
    return map;
  }, [appointments]);

  const toggle = (p: Patient) => {
    const next: Status = p.status === "active" ? "inactive" : "active";
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
        onCreate={() => setEditing(emptyPatient())}
        meta={
          <>
            <Badge tone="brand" dot>
              {patients.filter((p: any) => p.status === "active").length} active
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
          actions={
            canCreate("patients") ? (
              <Button
                size="sm"
                variant="outline"
                icon={<Users />}
                onClick={() => dispatch(patientsApi.thunks.fetchAll() as any)}
              >
                Reload
              </Button>
            ) : (
              <Badge tone="neutral">View only</Badge>
            )
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
              render: (p) => (
                <Badge
                  tone={p.bloodGroup.includes("-") ? "coral" : "neutral"}
                  size="xs"
                >
                  {p.bloodGroup}
                </Badge>
              ),
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
          onRowClick={(p) => navigate(`/app/patients/${p.id}`)}
          actions={(p) => (
            <RowActions
              items={[
                {
                  label: "Open profile",
                  icon: <Eye />,
                  onClick: () => navigate(`/app/patients/${p.id}`),
                },
                {
                  label: "Edit patient",
                  icon: <Pencil />,
                  onClick: () => setEditing(p),
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
                onClick={() => setEditing(emptyPatient())}
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
      {editing && (
        <PatientForm
          initial={editing}
          onClose={() => {
            setEditing(null);
            if (params.get("new")) {
              params.delete("new");
              setParams(params, { replace: true });
            }
          }}
        />
      )}
    </>
  );
}

/* --------------------------------- profile --------------------------------- */

export function PatientDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const patients = useRootSelector((s) => s.patients.items);
  const appointments = useRootSelector((s) => s.appointments.items);
  const consultations = useRootSelector((s) => s.consultations.items);
  const invoices = useRootSelector((s) => s.invoices.items);
  const doctors = useRootSelector((s) => s.doctors.items);
  const departments = useRootSelector((s) => s.departments.items);
  const { canCreate } = usePermission();
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState<Partial<Patient> | null>(null);

  const patient = patients.find((p: any) => p.id === id) as Patient | undefined;
  const doctorMap = new Map(doctors.map((d: any) => [d.id, d]));
  const myAppointments = appointments.filter((a: any) => a.patientId === id);
  const myConsultations = consultations.filter((c: any) => c.patientId === id);
  const myInvoices = invoices.filter((i: any) => i.patientId === id);
  const outstanding = myInvoices.reduce(
    (sum, i: any) =>
      sum +
      (i.items.reduce(
        (s: number, it: any) => s + it.quantity * it.unitPrice,
        0,
      ) -
        i.discountValue +
        Math.round(
          ((i.items.reduce(
            (s: number, it: any) => s + it.quantity * it.unitPrice,
            0,
          ) -
            i.discountValue) *
            i.taxRate) /
            100,
        ) -
        i.payments.reduce((s: number, p: any) => s + p.amount, 0)),
    0,
  );

  if (!patient) {
    return (
      <SectionPanel title="Patient not found" icon={<UserRound />}>
        <Emptyish onBack={() => navigate("/app/patients")} />
      </SectionPanel>
    );
  }

  const tabs = [
    { value: "overview", label: "Overview" },
    {
      value: "appointments",
      label: "Appointments",
      count: myAppointments.length,
    },
    {
      value: "consultations",
      label: "Consultations",
      count: myConsultations.length,
    },
    {
      value: "prescriptions",
      label: "Prescriptions",
      count: myConsultations.reduce(
        (n: number, c: any) => n + (c.prescriptions?.length ?? 0),
        0,
      ),
    },
    { value: "billing", label: "Billing", count: myInvoices.length },
  ];

  return (
    <div className="space-y-4">
      <PageIntro
        back
        title={`${fullName(patient)}`}
        description={`MRN ${patient.mrn} · registered ${formatDate(patient.createdAt)}`}
        module="patients"
        createLabel="Book appointment"
        onCreate={() =>
          navigate("/app/appointments?new=1&patient=" + patient.id)
        }
      />

      <Panel className="overflow-hidden">
        <div className="relative bg-ink-950 px-5 pb-16 pt-5 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_-20%,rgba(64,190,174,.35),transparent_55%)]" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar
                name={fullName(patient)}
                size="xl"
                color={
                  patient.gender === "Female" ? "bg-lagoon-500" : "bg-brand-500"
                }
                ring
              />
              <div>
                <p className="font-display text-[22px] font-bold leading-tight">
                  {fullName(patient)}
                </p>
                <p className="mt-0.5 text-[12.5px] text-white/55">
                  {calcAge(patient.dateOfBirth, patient.ageUnit)} ·{" "}
                  {patient.gender} · {patient.bloodGroup} · {patient.city}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <StatusBadge status={patient.status} />
                  <Badge
                    tone="ink"
                    size="xs"
                    className="bg-white/10 text-white/80 ring-white/15"
                  >
                    {myAppointments.length} visits
                  </Badge>
                  {outstanding > 0 && (
                    <Badge tone="coral" size="xs">
                      {formatMoney(outstanding)} due
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="relative flex flex-wrap gap-2">
              {canCreate("appointments") && (
                <Button
                  size="sm"
                  variant="subtle"
                  icon={<CalendarPlus />}
                  onClick={() =>
                    navigate(`/app/appointments?new=1&patient=${patient.id}`)
                  }
                >
                  Book visit
                </Button>
              )}
              {canCreate("billing") && (
                <Button
                  size="sm"
                  variant="subtle"
                  icon={<Receipt />}
                  onClick={() =>
                    navigate(`/app/billing?new=1&patient=${patient.id}`)
                  }
                >
                  New invoice
                </Button>
              )}
              <Button
                size="sm"
                variant="subtle"
                icon={<FileText />}
                onClick={() => window.print()}
              >
                Print summary
              </Button>
            </div>
          </div>
        </div>
        <div className="-mt-10 px-5">
          <div className="flex gap-1 overflow-x-auto rounded-t-xl border-x border-t border-ink-100 bg-ink-25/80 px-1.5 pt-1.5">
            {tabs.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={cn(
                  "relative flex shrink-0 items-center gap-2 rounded-t-lg px-3.5 py-2 text-[13px] font-medium transition-all",
                  tab === t.value
                    ? "bg-white text-brand-700 shadow-[0_-1px_0_0_rgba(30,158,144,.7)_inset]"
                    : "text-ink-500 hover:bg-white/60 hover:text-ink-800",
                )}
              >
                {t.label}
                {t.count !== undefined && (
                  <span
                    className={cn(
                      "num rounded-full px-1.5 text-[10.5px] font-semibold",
                      tab === t.value
                        ? "bg-brand-50 text-brand-700"
                        : "bg-ink-100 text-ink-500",
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-ink-100 p-5">
          {tab === "overview" && (
            <div className="space-y-5">
              <DetailGrid
                items={[
                  {
                    label: "Date of birth",
                    value: formatDate(patient.dateOfBirth),
                  },
                  { label: "Gender", value: patient.gender },
                  { label: "Blood group", value: patient.bloodGroup },
                  { label: "Marital status", value: patient.maritalStatus },
                  { label: "Mobile number", value: patient.mobile },
                  {
                    label: "Alternate number",
                    value: patient.altMobile || "—",
                  },
                  { label: "Email address", value: patient.email || "—" },
                  {
                    label: "Address",
                    value: `${patient.address}, ${patient.city}`,
                  },
                  {
                    label: "Emergency contact",
                    value: `${patient.emergencyContactName || "—"} · ${patient.emergencyContactNumber || "—"}`,
                  },
                  {
                    label: "Height / weight",
                    value: `${patient.heightCm ?? "—"} cm · ${patient.weightKg ?? "—"} kg`,
                  },
                ]}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-coral-500/20 bg-coral-50/60 p-3.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-coral-600">
                    <Heart className="size-3.5" /> Allergies
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(patient.allergies || "None recorded")
                      .split(",")
                      .map((a) => (
                        <span
                          key={a}
                          className="rounded-md bg-white px-2 py-1 text-[12px] font-medium text-ink-700 ring-1 ring-inset ring-coral-500/15"
                        >
                          {a.trim()}
                        </span>
                      ))}
                  </div>
                </div>
                <div className="rounded-xl border border-amberly-500/20 bg-amberly-50/60 p-3.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-amberly-600">
                    <Stethoscope className="size-3.5" /> Chronic conditions
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(patient.chronicConditions || "None reported")
                      .split(",")
                      .map((a) => (
                        <span
                          key={a}
                          className="rounded-md bg-white px-2 py-1 text-[12px] font-medium text-ink-700 ring-1 ring-inset ring-amberly-500/15"
                        >
                          {a.trim()}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {myAppointments.slice(0, 3).map((a: any) => (
                  <button
                    key={a.id}
                    onClick={() => navigate(`/app/appointments?focus=${a.id}`)}
                    className="rounded-xl border border-ink-100 bg-white p-3 text-left transition-all hover:border-brand-200 hover:shadow-card"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                      {formatDate(a.date)}
                    </p>
                    <p className="mt-1 text-[13px] font-semibold text-ink-800">
                      Dr. {fullName(doctorMap.get(a.doctorId))}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-ink-400">
                      {a.type} ·{" "}
                      {departments.find((d: any) => d.id === a.departmentId)
                        ?.name ?? "—"}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "appointments" && (
            <DataTable
              columns={[
                {
                  key: "code",
                  header: "Reference",
                  render: (a: any) => (
                    <span className="num font-semibold text-ink-800">
                      {a.code}
                    </span>
                  ),
                },
                {
                  key: "date",
                  header: "Date",
                  render: (a: any) => formatDate(a.date),
                },
                {
                  key: "time",
                  header: "Time",
                  render: (a: any) => <span className="num">{a.time}</span>,
                },
                {
                  key: "doctor",
                  header: "Doctor",
                  render: (a: any) =>
                    `Dr. ${fullName(doctorMap.get(a.doctorId))}`,
                },
                {
                  key: "type",
                  header: "Type",
                  render: (a: any) => (
                    <Badge tone="brand" size="xs">
                      {a.type}
                    </Badge>
                  ),
                },
                {
                  key: "fee",
                  header: "Fee",
                  align: "right",
                  render: (a: any) => (
                    <span className="num">{formatMoney(a.fee)}</span>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  align: "center",
                  render: (a: any) => <StatusBadge status={a.status} />,
                },
              ]}
              rows={myAppointments as any}
              onRowClick={(a: any) =>
                navigate(`/app/appointments?focus=${a.id}`)
              }
              emptyTitle="No appointments yet"
            />
          )}

          {tab === "consultations" && (
            <div className="space-y-3">
              {myConsultations.length === 0 && (
                <p className="py-8 text-center text-[13px] text-ink-400">
                  No consultations recorded for this patient.
                </p>
              )}
              {myConsultations.map((c: any) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-ink-100 p-4 transition-colors hover:border-brand-200"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13.5px] font-semibold text-ink-900">
                      {c.diagnosis || "Consultation note"}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral" size="xs">
                        {c.code}
                      </Badge>
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                  <p className="mt-1 text-[12px] text-ink-400">
                    {formatDate(c.date)} · Dr.{" "}
                    {fullName(doctorMap.get(c.doctorId))} · {c.startTime}–
                    {c.endTime ?? "ongoing"}
                  </p>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-ink-600">
                    {c.chiefComplaint}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    {Object.entries(c.vitals ?? {}).map(([k, v]) => (
                      <div
                        key={k}
                        className="rounded-lg bg-ink-25 px-2.5 py-1.5"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                          {k === "spo2" ? "SpO₂" : k}
                        </p>
                        <p className="num text-[12.5px] font-semibold text-ink-800">
                          {v as string}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => navigate(`/app/consultations/${c.id}`)}
                    >
                      Open record
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "prescriptions" && (
            <div className="space-y-3">
              {myConsultations.flatMap((c: any) =>
                (c.prescriptions ?? []).map((rx: any) => ({
                  ...rx,
                  date: c.date,
                  doctor: `Dr. ${fullName(doctorMap.get(c.doctorId))}`,
                  code: c.code,
                })),
              ).length === 0 && (
                <p className="py-8 text-center text-[13px] text-ink-400">
                  No prescriptions issued yet.
                </p>
              )}
              {myConsultations
                .flatMap((c: any) =>
                  (c.prescriptions ?? []).map((rx: any) => ({
                    ...rx,
                    date: c.date,
                    doctor: `Dr. ${fullName(doctorMap.get(c.doctorId))}`,
                    code: c.code,
                  })),
                )
                .map((rx: any) => (
                  <div
                    key={rx.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-ink-900">
                        {rx.medicine}
                      </p>
                      <p className="text-[11.5px] text-ink-400">
                        {rx.dosage} · {rx.frequency} · {rx.instructions}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[12px] font-medium text-ink-600">
                        {rx.doctor}
                      </p>
                      <p className="text-[11px] text-ink-400">
                        {formatDate(rx.date)} · {rx.code}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {tab === "billing" && (
            <DataTable
              columns={[
                {
                  key: "number",
                  header: "Invoice",
                  render: (i: any) => (
                    <span className="num font-semibold text-ink-800">
                      {i.number}
                    </span>
                  ),
                },
                {
                  key: "date",
                  header: "Billed",
                  render: (i: any) => formatDate(i.date),
                },
                {
                  key: "items",
                  header: "Line items",
                  align: "center",
                  hideBelow: "md",
                  render: (i: any) => i.items.length,
                },
                {
                  key: "total",
                  header: "Total",
                  align: "right",
                  render: (i: any) => (
                    <span className="num">
                      {formatMoney(
                        i.items.reduce(
                          (s: number, it: any) =>
                            s + it.quantity * it.unitPrice,
                          0,
                        ) -
                          i.discountValue +
                          Math.round(
                            ((i.items.reduce(
                              (s: number, it: any) =>
                                s + it.quantity * it.unitPrice,
                              0,
                            ) -
                              i.discountValue) *
                              i.taxRate) /
                              100,
                          ),
                      )}
                    </span>
                  ),
                },
                {
                  key: "paid",
                  header: "Paid",
                  align: "right",
                  render: (i: any) => (
                    <span className="num">
                      {formatMoney(
                        i.payments.reduce(
                          (s: number, p: any) => s + p.amount,
                          0,
                        ),
                      )}
                    </span>
                  ),
                },
                {
                  key: "paymentStatus",
                  header: "Status",
                  align: "center",
                  render: (i: any) => <StatusBadge status={i.paymentStatus} />,
                },
              ]}
              rows={myInvoices as any}
              onRowClick={(i: any) => navigate(`/app/billing?invoice=${i.id}`)}
              emptyTitle="No invoices raised"
            />
          )}
        </div>
      </Panel>

      {editing && (
        <PatientForm initial={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function Emptyish({ onBack }: { onBack: () => void }) {
  return (
    <div className="py-10">
      <p className="text-center text-[13px] text-ink-400">
        This patient record may have been removed or you may not have permission
        to view it.
      </p>
      <div className="mt-4 flex justify-center">
        <Button size="sm" variant="outline" onClick={onBack}>
          Back to registry
        </Button>
      </div>
    </div>
  );
}
