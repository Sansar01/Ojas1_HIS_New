import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Ban, CalendarClock, CalendarPlus, CheckCircle2, Clock3, Eye, Hourglass, Layers, Pencil, Star, Stethoscope, Trash2, UserCog,
} from "lucide-react";
import { GENDERS, WEEKDAYS_SHORT } from "@/constants";
import { useAppDispatch, usePermission, useRootSelector, useTable } from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { doctorsApi } from "@/features/slices";
import { addDays } from "@/data/db";
import { calcAge, formatDate, formatMoney, fullName, generateSlots } from "@/utils";
import { cn } from "@/utils/cn";
import type { Doctor, ScheduleDay, Status } from "@/types";
import { Avatar, Badge, Button, IconButton, Panel, Progress, StatusBadge } from "@/components/ui/primitives";
import { Input, NumberInput, Select, Switch, Textarea, DatePicker } from "@/components/ui/fields";
import { DataTable, Pagination, RowActions, TableToolbar } from "@/components/ui/table";
import { FormDialog, FormRow, FormSection, PageIntro, SectionPanel, TagInput } from "@/components/common";

const emptyDoctor = (): Partial<Doctor> => ({
  firstName: "Aditi", lastName: "Rao", gender: "Female", dateOfBirth: "1984-06-12",
  email: "aditi.rao@meridian.care", mobile: "+91 98450 61209",
  consultationFee: 1200, slotDuration: 20, bufferTime: 5, maxPatientsPerDay: 18, mode: "Both", status: "active",
  qualifications: ["MBBS", "MD", "DM (Endocrinology)"], experienceYears: 14,
  registrationNumber: `MCI-${Math.floor(30000 + Math.random() * 49999)}`,
  about: "Metabolic clinic lead — thyroid disorders, osteoporosis and complex diabetes in pregnancy.",
  schedule: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    enabled: day >= 1 && day <= 5 || day === 6,
    start: day === 6 ? "10:00" : "09:00",
    end: day === 6 ? "13:00" : "17:00",
  })),
});

/* ------------------------------ schedule editor ----------------------------- */

export function ScheduleEditor({ schedule, onChange, doctor }: { schedule: ScheduleDay[]; onChange: (s: ScheduleDay[]) => void; doctor?: Doctor }) {
  const patch = (day: number, next: Partial<ScheduleDay>) => onChange(schedule.map((s) => (s.day === day ? { ...s, ...next } : s)));
  const today = new Date().getDay();
  const previewDate = addDays(new Date(), 0);
  const slots = generateSlots(doctor as Doctor, previewDate, []);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-ink-100">
        <table className="w-full text-[12.5px]">
          <thead className="bg-ink-25 text-[10.5px] uppercase tracking-[0.1em] text-ink-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Day</th>
              <th className="px-3 py-2 text-center font-semibold">Clinic open</th>
              <th className="px-3 py-2 text-left font-semibold">Start</th>
              <th className="px-3 py-2 text-left font-semibold">End</th>
              <th className="px-3 py-2 text-right font-semibold">Slots</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {schedule.map((day) => {
              const capacity = day.enabled ? Math.max(0, Math.floor((toMin(day.end) - toMin(day.start)) / ((doctor?.slotDuration ?? 20) + (doctor?.bufferTime ?? 0)))) : 0;
              return (
                <tr key={day.day} className={cn(day.day === today && "bg-brand-25/50")}>
                  <td className="px-3 py-2 font-semibold text-ink-700">
                    {WEEKDAYS_SHORT[day.day]}
                    {day.day === today && <span className="ml-1.5 rounded bg-brand-600 px-1 py-px text-[9px] font-bold uppercase text-white">today</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Switch checked={day.enabled} onCheckedChange={(v) => patch(day.day, { enabled: v })} />
                  </td>
                  <td className="px-2 py-2">
                    <input type="time" value={day.start} disabled={!day.enabled} onChange={(e) => patch(day.day, { start: e.target.value })} className="num h-8 rounded-lg border border-ink-200 bg-white px-2 text-[12px] focus:border-brand-400 focus:outline-none disabled:bg-ink-50 disabled:text-ink-300" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="time" value={day.end} disabled={!day.enabled} onChange={(e) => patch(day.day, { end: e.target.value })} className="num h-8 rounded-lg border border-ink-200 bg-white px-2 text-[12px] focus:border-brand-400 focus:outline-none disabled:bg-ink-50 disabled:text-ink-300" />
                  </td>
                  <td className="num px-3 py-2 text-right font-semibold text-ink-600">{capacity}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-ink-100 bg-ink-25/60 p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
          <Clock3 className="size-3.5" /> Slot builder preview · {formatDate(previewDate)}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {slots.length === 0 && <span className="text-[12px] text-ink-400">No clinic configured for today — enable a weekday to publish slots.</span>}
          {slots.slice(0, 22).map((s) => (
            <span
              key={s.time}
              className={cn(
                "num rounded-md px-2 py-1 text-[11.5px] font-semibold ring-1 ring-inset",
                s.state === "available" && "bg-white text-brand-700 ring-brand-200",
                s.state === "booked" && "bg-ink-100 text-ink-400 ring-ink-200 line-through",
                s.state === "past" && "bg-ink-50 text-ink-300 ring-ink-100",
                s.state === "unavailable" && "bg-coral-50 text-coral-600 ring-coral-500/20",
              )}
            >
              {s.time}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/* --------------------------------- form ------------------------------------ */

function DoctorForm({ initial, onClose }: { initial: Partial<Doctor>; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const isEdit = Boolean(initial.id);
  const departments = useRootSelector((s) => s.departments.items);
  const specializations = useRootSelector((s) => s.specializations.items);

  const form = useForm({
    initialValues: {
      firstName: initial.firstName ?? "", lastName: initial.lastName ?? "", email: initial.email ?? "", mobile: initial.mobile ?? "",
      gender: (initial.gender ?? "Male") as any, dateOfBirth: initial.dateOfBirth ?? "1985-01-01",
      departmentId: initial.departmentId ?? (departments[0]?.id ?? ""), specializationId: initial.specializationId ?? (specializations[0]?.id ?? ""),
      qualifications: (initial.qualifications ?? []).join(", "), experienceYears: initial.experienceYears ?? 5,
      registrationNumber: initial.registrationNumber ?? "", consultationFee: initial.consultationFee ?? 900,
      slotDuration: initial.slotDuration ?? 20, bufferTime: initial.bufferTime ?? 5, maxPatientsPerDay: initial.maxPatientsPerDay ?? 20,
      mode: (initial.mode ?? "In-clinic") as any, status: (initial.status ?? "active") as Status, about: initial.about ?? "",
      schedule: (initial.schedule ?? emptyDoctor().schedule!) as ScheduleDay[],
    },
    schema: {
      firstName: [{ required: "First name is required", min: 2 }],
      lastName: [{ required: "Last name is required", min: 2 }],
      email: [{ required: "Email address is required", email: true }],
      mobile: [{ required: "Mobile number is required", pattern: /^[+0-9][0-9\s()-]{7,}$/ }],
      departmentId: [{ required: "Select a department" }],
      specializationId: [{ required: "Select a specialization" }],
      registrationNumber: [{ required: "Medical registration number is required", min: 4 }],
      consultationFee: [{ required: "Consultation fee is required", validate: (v: number) => (Number(v) > 0 ? true : "Fee must be greater than zero") }],
      slotDuration: [{ required: "Slot duration is required", validate: (v: number) => (Number(v) >= 5 ? true : "Minimum slot length is 5 minutes") }],
      maxPatientsPerDay: [{ validate: (v: number) => (Number(v) > 0 ? true : "Set a daily capacity") }],
    },
  });

  const save = form.handleSubmit(async (values) => {
    const payload: any = {
      ...values,
      qualifications: String(values.qualifications).split(",").map((q) => q.trim()).filter(Boolean),
      schedule: values.schedule,
    };
    if (isEdit) await dispatch(doctorsApi.thunks.updateOne({ id: initial.id!, data: payload, successMessage: "Doctor profile updated" } as any));
    else await dispatch(doctorsApi.thunks.createOne({ data: { ...payload, rating: 4.6, joinedAt: new Date().toISOString(), userId: null }, successMessage: "Doctor added to the roster" } as any));
    onClose();
  });

  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && onClose()}
      size="xl"
      title={isEdit ? `Edit Dr. ${initial.firstName} ${initial.lastName}` : "Add doctor"}
      description="Profile, fees, slot policy and weekly clinic schedule — these values drive the appointment slot builder."
      onSubmit={save}
      loading={form.submitting}
      submitLabel={isEdit ? "Save doctor" : "Create profile"}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_15.5rem]">
        <div className="space-y-5">
          <FormSection title="Identity">
            <FormRow className="lg:grid-cols-3">
              <Input name="firstName" label="First name" required value={form.values.firstName} onChange={(e) => form.setValue("firstName", e.target.value)} error={form.errors.firstName} />
              <Input name="lastName" label="Last name" required value={form.values.lastName} onChange={(e) => form.setValue("lastName", e.target.value)} error={form.errors.lastName} />
              <Select name="gender" label="Gender" value={form.values.gender} onChange={(v) => form.setValue("gender", v)} options={GENDERS.map((g) => ({ value: g, label: g }))} />
              <Input name="email" type="email" label="Email address" required value={form.values.email} onChange={(e) => form.setValue("email", e.target.value)} error={form.errors.email} />
              <Input name="mobile" label="Mobile number" required value={form.values.mobile} onChange={(e) => form.setValue("mobile", e.target.value)} error={form.errors.mobile} />
              <DatePicker label="Date of birth" value={form.values.dateOfBirth} onChange={(v) => form.setValue("dateOfBirth", v)} hint={calcAge(form.values.dateOfBirth)} />
              <Select name="departmentId" label="Department" required value={form.values.departmentId} onChange={(v) => form.setValue("departmentId", v)} error={form.errors.departmentId} options={departments.map((d: any) => ({ value: d.id, label: d.name }))} />
              <Select name="specializationId" label="Specialization" required value={form.values.specializationId} onChange={(v) => form.setValue("specializationId", v)} error={form.errors.specializationId} options={specializations.map((sp: any) => ({ value: sp.id, label: sp.name }))} />
              <Input name="registrationNumber" label="Registration number" required value={form.values.registrationNumber} onChange={(e) => form.setValue("registrationNumber", e.target.value)} error={form.errors.registrationNumber} hint="Medical council identifier" />
              <div className="sm:col-span-2 lg:col-span-2">
                <p className="mb-1.5 text-[12.5px] font-medium text-ink-600">Qualifications</p>
                <TagInput value={form.values.qualifications} onChange={(v) => form.setValue("qualifications", v)} placeholder="MBBS, MD, DM…" />
                <p className="mt-1 text-[11.5px] text-ink-400">Comma separated · shown on the public doctor profile</p>
              </div>
            </FormRow>
          </FormSection>

          <FormSection title="Fees & slot policy" description="Used by the appointment engine to build available slots">
            <FormRow className="lg:grid-cols-4">
              <NumberInput label="Consultation fee" required value={form.values.consultationFee} onValueChange={(v) => form.setValue("consultationFee", v)} min={0} step={50} suffix="₹" error={form.errors.consultationFee} />
              <NumberInput label="Slot duration" required value={form.values.slotDuration} onValueChange={(v) => form.setValue("slotDuration", v)} min={5} max={120} step={5} suffix="min" error={form.errors.slotDuration} />
              <NumberInput label="Buffer time" value={form.values.bufferTime} onValueChange={(v) => form.setValue("bufferTime", v)} min={0} max={60} step={5} suffix="min" hint="Between consecutive patients" />
              <NumberInput label="Max patients / day" required value={form.values.maxPatientsPerDay} onValueChange={(v) => form.setValue("maxPatientsPerDay", v)} min={1} max={200} suffix="pts" error={form.errors.maxPatientsPerDay} />
              <NumberInput label="Experience" value={form.values.experienceYears} onValueChange={(v) => form.setValue("experienceYears", v)} min={0} max={60} suffix="yrs" />
              <Select name="mode" label="Consultation mode" value={form.values.mode} onChange={(v) => form.setValue("mode", v)} options={["In-clinic", "Telemedicine", "Both"].map((m) => ({ value: m, label: m }))} />
              <Select name="status" label="Roster status" value={form.values.status} onChange={(v) => form.setValue("status", v)} options={[{ value: "active", label: "Active — accepting patients" }, { value: "inactive", label: "Inactive — block booking" }]} />
              <Input name="rating" label="Patient rating" type="number" step={0.1} defaultValue={String(initial.rating ?? 4.6)} hint="0 – 5 scale" />
            </FormRow>
            <Textarea name="about" label="Professional summary" className="mt-4" rows={3} placeholder="Focus areas, programs led, notable clinical interests…" value={form.values.about} onChange={(e) => form.setValue("about", e.target.value)} />
          </FormSection>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-ink-100 bg-ink-25/60 p-4 text-center">
            <Avatar name={`${form.values.firstName} ${form.values.lastName}`} size="xl" color="bg-brand-600" className="mx-auto" />
            <p className="mt-3 font-display text-[15px] font-semibold text-ink-900">
              {form.values.firstName || form.values.lastName ? `Dr. ${form.values.firstName} ${form.values.lastName}`.trim() : "New doctor"}
            </p>
            <p className="text-[12px] text-ink-400">{specializations.find((s: any) => s.id === form.values.specializationId)?.name ?? "Specialization"}</p>
            <p className="num mt-2 text-[13px] font-semibold text-brand-700">{formatMoney(form.values.consultationFee || 0)}</p>
            <p className="text-[11px] text-ink-400">per consultation</p>
          </div>
          <div className="rounded-xl border border-brand-100 bg-brand-25 p-3.5 text-[12px] leading-relaxed text-brand-800">
            <p className="font-semibold">Slot maths</p>
            <p className="mt-1">
              Each clinic day yields <strong className="num">{Math.max(0, Math.floor((10 * 60 - 9 * 60) / (form.values.slotDuration + form.values.bufferTime)))}</strong> slots for a 9‑hour day at{" "}
              <span className="num">{form.values.slotDuration}+{form.values.bufferTime}</span> minutes, capped at the daily patient limit.
            </p>
          </div>
        </div>
      </div>

      <FormSection title="Working schedule" description="Toggle clinic days, set hours and review the generated slot grid">
        <ScheduleEditor
          doctor={{ ...(initial as any), slotDuration: form.values.slotDuration, bufferTime: form.values.bufferTime, maxPatientsPerDay: form.values.maxPatientsPerDay, schedule: form.values.schedule } as Doctor}
          schedule={form.values.schedule}
          onChange={(s) => form.setValue("schedule", s)}
        />
      </FormSection>
    </FormDialog>
  );
}

/* --------------------------------- listing ---------------------------------- */

export function DoctorsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items: doctors, status } = useRootSelector((s) => s.doctors);
  const appointments = useRootSelector((s) => s.appointments.items);
  const departments = useRootSelector((s) => s.departments.items);
  const specializations = useRootSelector((s) => s.specializations.items);
  const { canCreate, canEdit, canDelete } = usePermission();
  const [filters, setFilters] = useState({ department: "all", specialization: "all", status: "all" });
  const [editing, setEditing] = useState<Partial<Doctor> | null>(null);

  useEffect(() => {
    if (status === "idle") dispatch(doctorsApi.thunks.fetchAll() as any);
  }, [status, dispatch]);

  const table = useTable<Doctor>(doctors as Doctor[], {
    pageSize: 8,
    filters,
    searchFields: [(d) => `${d.firstName} ${d.lastName} ${d.registrationNumber} ${d.email}`, (d) => d.qualifications.join(" ")],
    sortAccessors: { name: (d) => `${d.lastName}${d.firstName}`, consultationFee: (d) => d.consultationFee, experienceYears: (d) => d.experienceYears, rating: (d) => d.rating, status: (d) => d.status },
  });

  const todaysCount = (id: string) => appointments.filter((a: any) => a.doctorId === id && a.date === addDays(new Date(), 0) && !["Cancelled", "No Show"].includes(a.status)).length;

  return (
    <>
      <PageIntro
        title="Doctor directory"
        description="Roster, consultation fees, slot policy and availability. Booking capacity for each clinician is derived from these profiles."
        module="doctors"
        createLabel="Add doctor"
        onCreate={() => setEditing(emptyDoctor())}
        meta={
          <>
            <Badge tone="mint" dot>{doctors.filter((d: any) => d.status === "active").length} consulting</Badge>
            <Badge tone="neutral">{departments.length} departments</Badge>
            <Badge tone="lagoon">{specializations.length} specializations</Badge>
          </>
        }
      />

      <Panel>
        <TableToolbar
          search={table.query.search}
          onSearch={table.setSearch}
          searchPlaceholder="Search doctor, registration no…"
          filters={
            <>
              <Select size="sm" className="w-[11rem]" name="dep" value={filters.department} onChange={(v) => setFilters((f) => ({ ...f, department: v }))} options={[{ value: "all", label: "All departments" }, ...departments.map((d: any) => ({ value: d.id, label: d.name }))]} />
              <Select size="sm" className="w-[11rem]" name="spe" value={filters.specialization} onChange={(v) => setFilters((f) => ({ ...f, specialization: v }))} options={[{ value: "all", label: "All specializations" }, ...specializations.map((s: any) => ({ value: s.id, label: s.name }))]} />
              <Select size="sm" className="w-[8.5rem]" name="status" value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} options={[{ value: "all", label: "Any status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
            </>
          }
          actions={canCreate("doctors") ? <Button size="sm" icon={<UserCog />} onClick={() => setEditing(emptyDoctor())}>Add doctor</Button> : <Badge tone="neutral">View only</Badge>}
        />
        <DataTable
          columns={[
            {
              key: "name",
              header: "Doctor",
              sortable: true,
              render: (d) => (
                <button className="flex items-center gap-3 text-left" onClick={() => navigate(`/app/doctors/${d.id}`)}>
                  <Avatar name={fullName(d)} color={d.status === "active" ? "bg-brand-600" : "bg-ink-400"} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-ink-900">Dr. {fullName(d)}</span>
                    <span className="block truncate text-[11.5px] text-ink-400">{specializations.find((s: any) => s.id === d.specializationId)?.name ?? "—"} · {d.registrationNumber}</span>
                  </span>
                </button>
              ),
            },
            { key: "department", header: "Department", hideBelow: "lg", render: (d) => <span className="text-[12.5px] text-ink-600">{departments.find((dep: any) => dep.id === d.departmentId)?.name ?? "—"}</span> },
            { key: "experienceYears", header: "Exp.", align: "center", sortable: true, hideBelow: "md", render: (d) => <span className="num text-[12.5px] font-semibold">{d.experienceYears}y</span> },
            { key: "consultationFee", header: "Fee", align: "right", sortable: true, render: (d) => <span className="num font-semibold text-ink-800">{formatMoney(d.consultationFee)}</span> },
            {
              key: "slotDuration",
              header: "Slot policy",
              hideBelow: "xl",
              render: (d) => (
                <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-500">
                  <Hourglass className="size-3.5 text-ink-400" />
                  <span className="num">{d.slotDuration}m</span> + <span className="num">{d.bufferTime}m</span> · max <span className="num">{d.maxPatientsPerDay}</span>
                </span>
              ),
            },
            {
              key: "load",
              header: "Today",
              align: "center",
              hideBelow: "lg",
              render: (d) => {
                const booked = todaysCount(d.id);
                return (
                  <div className="mx-auto w-20">
                    <p className="num text-[11px] font-semibold text-ink-600">{booked}/{d.maxPatientsPerDay}</p>
                    <Progress value={(booked / Math.max(1, d.maxPatientsPerDay)) * 100} tone={booked > d.maxPatientsPerDay * 0.8 ? "coral" : "brand"} />
                  </div>
                );
              },
            },
            { key: "rating", header: "Rating", align: "right", sortable: true, hideBelow: "md", render: (d) => <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-ink-700"><Star className="size-3.5 fill-amberly-500 text-amberly-500" />{d.rating}</span> },
            { key: "status", header: "Status", align: "center", sortable: true, render: (d) => <StatusBadge status={d.status} /> },
          ]}
          rows={table.rows}
          status={status === "ready" ? "ready" : status === "error" ? "error" : "loading"}
          sort={{ sortBy: table.query.sortBy, sortDir: table.query.sortDir, onSort: table.toggleSort }}
          onRowClick={(d) => navigate(`/app/doctors/${d.id}`)}
          actions={(d) => (
            <RowActions
              items={[
                { label: "View profile", icon: <Eye />, onClick: () => navigate(`/app/doctors/${d.id}`) },
                { label: "Edit doctor", icon: <Pencil />, onClick: () => setEditing(d), hidden: !canEdit("doctors") },
                {
                  label: d.status === "active" ? "Deactivate" : "Activate",
                  icon: d.status === "active" ? <Ban /> : <CheckCircle2 />,
                  hidden: !canEdit("doctors"),
                  onClick: () => dispatch(doctorsApi.thunks.toggleActive({ id: d.id, status: (d.status === "active" ? "inactive" : "active") as Status, label: `Dr. ${fullName(d)}` } as any)),
                },
                { label: "Delete doctor", icon: <Trash2 />, tone: "danger", hidden: !canDelete("doctors"), onClick: () => dispatch(doctorsApi.thunks.removeOne({ id: d.id, label: `Dr. ${fullName(d)}` } as any)) },
              ]}
            />
          )}
          emptyTitle="No doctors on the roster"
          emptyDescription="Add clinicians to publish OPD slots in the scheduler."
          emptyAction={canCreate("doctors") ? <Button size="sm" onClick={() => setEditing(emptyDoctor())}>Add doctor</Button> : undefined}
          footer={<Pagination page={table.page} pageCount={table.pageCount} total={table.total} pageSize={table.pageSize} onPage={table.setPage} onPageSize={table.setPageSize} label="doctors" />}
        />
      </Panel>

      {editing && <DoctorForm initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

/* ------------------------------- profile page ------------------------------- */

export function DoctorDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const doctors = useRootSelector((s) => s.doctors.items);
  const appointments = useRootSelector((s) => s.appointments.items);
  const consultations = useRootSelector((s) => s.consultations.items);
  const patients = useRootSelector((s) => s.patients.items);
  const departments = useRootSelector((s) => s.departments.items);
  const specializations = useRootSelector((s) => s.specializations.items);
  const { can, canEdit, canCreate } = usePermission();
  const [tab, setTab] = useState("schedule");
  const [editing, setEditing] = useState<Partial<Doctor> | null>(null);
  const [date, setDate] = useState(addDays(new Date(), 0));

  const doctor = doctors.find((d: any) => d.id === id) as Doctor | undefined;
  const patientMap = useMemo(() => new Map(patients.map((p: any) => [p.id, p])), [patients]);
  const slots = useMemo(() => (doctor ? generateSlots(doctor, date, appointments as any) : []), [doctor, date, appointments]);
  const dayAppointments = useMemo(
    () => appointments.filter((a: any) => a.doctorId === id && a.date === date).sort((a: any, b: any) => a.time.localeCompare(b.time)),
    [appointments, id, date],
  );
  const upcoming = appointments.filter((a: any) => a.doctorId === id && a.date >= addDays(new Date(), 0) && ["Scheduled", "Confirmed"].includes(a.status));

  if (!doctor) {
    return (
      <SectionPanel title="Doctor profile unavailable" icon={<Stethoscope />}>
        <p className="py-6 text-center text-[13px] text-ink-400">This profile may have been removed, or your role has no access to the doctor module.</p>
        <div className="flex justify-center pb-4">
          <Button size="sm" variant="outline" onClick={() => navigate("/app/doctors")}>Back to directory</Button>
        </div>
      </SectionPanel>
    );
  }

  const bookedCount = slots.filter((s) => s.state === "booked").length;
  const openCount = slots.filter((s) => s.state === "available").length;

  return (
    <div className="space-y-4">
      <PageIntro back title={`Dr. ${fullName(doctor)}`} description={doctor.about} module="doctors" createLabel="Book with doctor" onCreate={() => navigate(`/app/appointments?new=1&doctor=${doctor.id}`)} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,21rem)_1fr]">
        {/* profile card */}
        <div className="space-y-4">
          <Panel className="overflow-hidden">
            <div className="relative bg-ink-950 px-5 pb-12 pt-5 text-white">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(64,190,174,.35),transparent_60%)]" />
              <div className="relative flex items-center gap-3">
                <Avatar name={fullName(doctor)} size="lg" color="bg-brand-500" ring />
                <div className="min-w-0">
                  <p className="font-display text-[18px] font-bold leading-tight">Dr. {fullName(doctor)}</p>
                  <p className="text-[12px] text-white/55">{specializations.find((s: any) => s.id === doctor.specializationId)?.name}</p>
                  <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-amberly-500">
                    <Star className="size-3.5 fill-current" /> {doctor.rating} · {doctor.experienceYears} yrs experience
                  </p>
                </div>
              </div>
            </div>
            <div className="-mt-8 px-4 pb-4">
              <div className="rounded-xl border border-ink-100 bg-white p-3 shadow-card">
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { k: "Fee", v: formatMoney(doctor.consultationFee) },
                    { k: "Slot", v: `${doctor.slotDuration}m` },
                    { k: "Buffer", v: `${doctor.bufferTime}m` },
                  ].map((s) => (
                    <div key={s.k}>
                      <p className="num text-[14px] font-bold text-ink-900">{s.v}</p>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-ink-400">{s.k}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 space-y-2.5">
                {[
                  { label: "Email", value: doctor.email },
                  { label: "Mobile", value: doctor.mobile },
                  { label: "Registration", value: doctor.registrationNumber },
                  { label: "Department", value: departments.find((d: any) => d.id === doctor.departmentId)?.name ?? "—" },
                  { label: "Mode", value: doctor.mode },
                  { label: "Max / day", value: `${doctor.maxPatientsPerDay} patients` },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 border-b border-dashed border-ink-100 pb-1.5 text-[12.5px] last:border-none">
                    <span className="text-ink-400">{row.label}</span>
                    <span className="truncate font-medium text-ink-800">{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {doctor.qualifications.map((q) => (
                  <Badge key={q} tone="brand" size="xs">{q}</Badge>
                ))}
              </div>
              {canEdit("doctors") && (
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" icon={<Pencil />} onClick={() => setEditing(doctor)}>Edit profile</Button>
                  <Button size="sm" variant={doctor.status === "active" ? "danger" : "success"} icon={doctor.status === "active" ? <Ban /> : <CheckCircle2 />} onClick={() => dispatch(doctorsApi.thunks.toggleActive({ id: doctor.id, status: (doctor.status === "active" ? "inactive" : "active") as Status, label: `Dr. ${fullName(doctor)}` } as any))}>
                    {doctor.status === "active" ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              )}
            </div>
          </Panel>

          <SectionPanel title="Weekly clinic" subtitle="Published availability" icon={<CalendarClock />} bodyClass="p-3">
            <ul className="space-y-1.5">
              {doctor.schedule.map((s) => (
                <li key={s.day} className={cn("flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[12.5px]", s.enabled ? "bg-white ring-1 ring-inset ring-ink-100" : "bg-ink-25/60 text-ink-400")}>
                  <span className="font-semibold">{WEEKDAYS_SHORT[s.day]}</span>
                  <span className="num">{s.enabled ? `${s.start} – ${s.end}` : "No clinic"}</span>
                </li>
              ))}
            </ul>
          </SectionPanel>
        </div>

        {/* workspace */}
        <div className="space-y-4">
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-2.5">
              <div className="flex gap-1">
                {[
                  { value: "schedule", label: "Availability & slots" },
                  { value: "appointments", label: `Appointments (${appointments.filter((a: any) => a.doctorId === id).length})` },
                  { value: "consultations", label: `Consultations (${consultations.filter((c: any) => c.doctorId === id).length})` },
                ].filter((t) => can("appointments", "view") || t.value === "schedule").map((t) => (
                  <button key={t.value} onClick={() => setTab(t.value)} className={cn("rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors", tab === t.value ? "bg-brand-600 text-white shadow-[0_10px_20px_-14px_rgba(13,105,97,.95)]" : "text-ink-500 hover:bg-ink-50")}>
                    {t.label}
                  </button>
                ))}
              </div>
              {canCreate("appointments") && (
                <Button size="sm" variant="outline" icon={<CalendarPlus />} onClick={() => navigate(`/app/appointments?new=1&doctor=${doctor.id}`)}>
                  Book slot
                </Button>
              )}
            </div>

            {tab === "schedule" && (
              <div className="space-y-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <DatePicker label="Viewing slots for" value={date} onChange={setDate} min={addDays(new Date(), -30)} />
                    <IconButton label="Today" variant="outline" size="sm" onClick={() => setDate(addDays(new Date(), 0))}>
                      <CalendarClock />
                    </IconButton>
                  </div>
                  <div className="flex gap-2 text-[12px]">
                    <Badge tone="mint" size="xs">{openCount} open</Badge>
                    <Badge tone="neutral" size="xs">{bookedCount} booked</Badge>
                    <Badge tone="amber" size="xs">{doctor.maxPatientsPerDay - bookedCount} capacity left</Badge>
                  </div>
                </div>

                {slots.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-ink-200 px-4 py-10 text-center text-[13px] text-ink-400">
                    No clinic scheduled on {formatDate(date, { weekday: "long", day: "2-digit", month: "long" })}. Choose another day or update the weekly schedule.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                    {slots.map((s) => (
                      <div
                        key={s.time}
                        className={cn(
                          "rounded-lg border px-2 py-2 text-center transition-all",
                          s.state === "available" && "border-brand-200 bg-brand-25 text-brand-700 hover:-translate-y-0.5 hover:shadow-card",
                          s.state === "booked" && "border-ink-100 bg-ink-50 text-ink-400",
                          s.state === "past" && "border-ink-100 bg-white text-ink-300 line-through",
                          s.state === "unavailable" && "border-coral-500/25 bg-coral-50 text-coral-600",
                        )}
                      >
                        <p className="num text-[13px] font-bold">{s.time}</p>
                        <p className="text-[10px] font-medium uppercase tracking-wide">{s.state}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-xl border border-ink-100 bg-ink-25/60 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                    <Layers className="size-3.5" /> Day sheet · {formatDate(date)}
                  </p>
                  {dayAppointments.length === 0 ? (
                    <p className="mt-2 text-[12.5px] text-ink-400">No appointments booked on this date.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {dayAppointments.map((a: any) => (
                        <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-[12.5px] ring-1 ring-inset ring-ink-100">
                          <span className="num font-semibold text-ink-700">{a.time}</span>
                          <button className="truncate font-medium text-brand-700 hover:underline" onClick={() => navigate(`/app/patients/${a.patientId}`)}>
                            {fullName(patientMap.get(a.patientId))}
                          </button>
                          <StatusBadge status={a.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {tab === "appointments" && (
              <DataTable
                columns={[
                  { key: "date", header: "Date", render: (a: any) => formatDate(a.date) },
                  { key: "time", header: "Time", render: (a: any) => <span className="num">{a.time}</span> },
                  { key: "patient", header: "Patient", render: (a: any) => fullName(patientMap.get(a.patientId)) },
                  { key: "type", header: "Type", render: (a: any) => <Badge tone="brand" size="xs">{a.type}</Badge> },
                  { key: "status", header: "Status", align: "center", render: (a: any) => <StatusBadge status={a.status} /> },
                ]}
                rows={appointments.filter((a: any) => a.doctorId === id).slice(0, 25) as any}
                onRowClick={(a: any) => navigate(`/app/appointments?focus=${a.id}`)}
                emptyTitle="No appointments yet"
              />
            )}

            {tab === "consultations" && (
              <div className="space-y-2.5 p-4">
                {consultations.filter((c: any) => c.doctorId === id).slice(0, 12).map((c: any) => (
                  <button key={c.id} onClick={() => navigate(`/app/consultations/${c.id}`)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-ink-100 px-4 py-3 text-left transition-all hover:border-brand-200 hover:shadow-card">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-ink-900">{fullName(patientMap.get(c.patientId))}</span>
                      <span className="block truncate text-[11.5px] text-ink-400">{c.diagnosis || c.chiefComplaint}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="num text-[11.5px] text-ink-400">{formatDate(c.date)}</span>
                      <StatusBadge status={c.status} />
                    </span>
                  </button>
                ))}
                {consultations.filter((c: any) => c.doctorId === id).length === 0 && <p className="py-8 text-center text-[13px] text-ink-400">No consultation records.</p>}
              </div>
            )}
          </Panel>

          {upcoming.length > 0 && (
            <SectionPanel title="Upcoming with this doctor" subtitle={`${upcoming.length} booked ahead`} icon={<CalendarPlus />} bodyClass="p-0">
              <ul className="divide-y divide-ink-100">
                {upcoming.slice(0, 5).map((a: any) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span>
                      <span className="block text-[13px] font-medium text-ink-800">{fullName(patientMap.get(a.patientId))}</span>
                      <span className="block text-[11.5px] text-ink-400">{formatDate(a.date)} · {a.time} · {a.type}</span>
                    </span>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            </SectionPanel>
          )}
        </div>
      </div>

      {editing && <DoctorForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
