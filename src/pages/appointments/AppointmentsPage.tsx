import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock, CalendarDays, CheckCheck, CircleSlash, Eye, ListChecks, Pencil, RefreshCw, Stethoscope,
  Timer, Trash2, UserRound, XCircle,
} from "lucide-react";
import { APPT_TYPE_COLORS, APPOINTMENT_STATUSES } from "@/constants";
import { addDays } from "@/data/db";
import { useAppDispatch, usePermission, useRootSelector, useTable } from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { appointmentsApi } from "@/features/slices";
import { formatDate, formatMoney, formatTime, fullName, generateSlots } from "@/utils";
import { cn } from "@/utils/cn";
import type { Appointment, AppointmentStatus } from "@/types";
import { Avatar, Badge, Button, Panel, StatusBadge } from "@/components/ui/primitives";
import { Input, Segmented, Select, DatePicker, Textarea } from "@/components/ui/fields";
import { DataTable, Pagination, RowActions, TableToolbar } from "@/components/ui/table";
import { Sheet, Tooltip } from "@/components/ui/overlays";
import { DetailGrid, FormDialog, FormRow, FormSection, PageIntro, SectionPanel } from "@/components/common";

export function SlotPicker({
  doctorId, date, appointments, value, onChange,
}: {
  doctorId: string;
  date: string;
  appointments: Appointment[];
  value: string;
  onChange: (time: string) => void;
}) {
  const doctors = useRootSelector((s) => s.doctors.items);
  const doctor = doctors.find((d: any) => d.id === doctorId) as any;
  const slots = useMemo(() => generateSlots(doctor, date, appointments), [doctor, date, appointments]);
  const available = slots.filter((s) => s.state === "available");

  if (!doctor) return <p className="rounded-lg border border-dashed border-ink-200 px-3 py-6 text-center text-[12.5px] text-ink-400">Select a doctor to load published slots.</p>;
  if (!slots.length)
    return (
      <p className="rounded-lg border border-dashed border-coral-500/25 bg-coral-50/60 px-3 py-6 text-center text-[12.5px] text-coral-600">
        No clinic hours on {formatDate(date, { weekday: "long", day: "2-digit", month: "short" })}. Choose another date or update the doctor's weekly schedule.
      </p>
    );

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-25 px-3 py-2 text-[11.5px] text-brand-800 ring-1 ring-inset ring-brand-100">
        <span>
          Slots generated from <strong>{doctor.slotDuration}m</strong> duration + <strong>{doctor.bufferTime}m</strong> buffer · max{" "}
          <strong>{doctor.maxPatientsPerDay}</strong> patients/day
        </span>
        <Badge tone="mint" size="xs">{available.length} open</Badge>
      </div>
      <div className="grid max-h-[15rem] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-6">
        {slots.map((s) => (
          <button
            key={s.time}
            type="button"
            disabled={s.state !== "available"}
            onClick={() => onChange(s.time)}
            className={cn(
              "group rounded-lg border px-1.5 py-2 text-center transition-all duration-150",
              s.state === "available" && "border-ink-200 bg-white hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-card",
              s.state === "booked" && "cursor-not-allowed border-ink-100 bg-ink-50 text-ink-300",
              s.state === "past" && "cursor-not-allowed border-ink-100 bg-white text-ink-200 line-through",
              s.state === "unavailable" && "cursor-not-allowed border-coral-500/20 bg-coral-50 text-coral-500",
              value === s.time && s.state === "available" && "border-brand-600 bg-brand-600 text-white shadow-[0_10px_22px_-14px_rgba(13,105,97,.95)]",
            )}
          >
            <span className="num block text-[12.5px] font-bold">{s.time}</span>
            <span className="block text-[9.5px] font-semibold uppercase tracking-wide opacity-70">{s.state === "available" ? "open" : s.state}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- create dialog ------------------------------ */

function AppointmentForm({
  initial,
  onClose,
}: {
  initial: { patientId?: string; doctorId?: string; date?: string; id?: string; mode?: "new" | "reschedule"; time?: string; reason?: string };
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const patients = useRootSelector((s) => s.patients.items);
  const doctors = useRootSelector((s) => s.doctors.items);
  const departments = useRootSelector((s) => s.departments.items);
  const specializations = useRootSelector((s) => s.specializations.items);
  const existing = useRootSelector((s) => s.appointments.items) as Appointment[];
  const isReschedule = initial.mode === "reschedule";
  const record = isReschedule ? existing.find((a) => a.id === initial.id) : undefined;

  const form = useForm({
    initialValues: {
      patientId: initial.patientId ?? record?.patientId ?? (patients.find((p: any) => p.status === "active")?.id ?? ""),
      doctorId: initial.doctorId ?? record?.doctorId ?? (doctors.find((d: any) => d.status === "active")?.id ?? ""),
      date: initial.date ?? record?.date ?? addDays(new Date(), 1),
      time: initial.time ?? record?.time ?? "",
      type: (record?.type ?? "Consultation") as Appointment["type"],
      priority: (record?.priority ?? "Routine") as Appointment["priority"],
      fee: doctors.find((d: any) => d.id === (initial.doctorId ?? record?.doctorId))?.consultationFee ?? 0,
      notes: record?.notes ?? "",
      reason: initial.reason ?? "",
    },
    schema: {
      patientId: [{ required: "Select a patient" }],
      doctorId: [{ required: "Select a doctor" }],
      date: [{ required: "Appointment date is required" }],
      time: [{ required: "Choose an available time slot" }],
      fee: [{ required: "Consultation fee is required", validate: (v: number) => (Number(v) >= 0 ? true : "Invalid fee") }],
      reason: isReschedule ? [{ required: "Provide a reason for the change" }] : [],
    },
  });

  const doctor = doctors.find((d: any) => d.id === form.values.doctorId) as any;

  useEffect(() => {
    if (doctor) form.setValue("fee", doctor.consultationFee, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.doctorId]);

  /** pick the first open slot for the chosen clinician + date so a booking can be confirmed directly */
  useEffect(() => {
    if (!doctor || !form.values.date) return;
    const slots = generateSlots(doctor, form.values.date, existing);
    const currentUsable = slots.some((s) => s.time === form.values.time && s.state === "available");
    if (currentUsable) return;
    const open = slots.find((s) => s.state === "available");
    if (open) form.setValue("time", open.time, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.doctorId, form.values.date]);

  const save = form.handleSubmit(async (values) => {
    const payload: any = {
      patientId: values.patientId,
      doctorId: values.doctorId,
      departmentId: doctor?.departmentId ?? "",
      specializationId: doctor?.specializationId ?? "",
      date: values.date,
      time: values.time,
      duration: doctor?.slotDuration ?? 20,
      type: values.type,
      priority: values.priority,
      fee: Number(values.fee),
      notes: values.notes,
      status: isReschedule ? "Scheduled" : "Scheduled",
      ...(isReschedule ? { cancelledReason: "" } : {}),
    };
    if (isReschedule && record) {
      await dispatch(
        appointmentsApi.thunks.updateOne({
          id: record.id,
          data: { ...payload, notes: `${values.reason ? `Rescheduled: ${values.reason}. ` : ""}${values.notes}` },
          successMessage: `Appointment moved to ${formatDate(values.date)} · ${formatTime(values.time)}`,
        } as any),
      );
    } else {
      const sequence = 1000 + Math.floor(Math.random() * 8999);
      await dispatch(appointmentsApi.thunks.createOne({ data: { ...payload, code: `APT-${9000 + sequence}`, createdAt: new Date().toISOString() }, successMessage: "Appointment booked" } as any));
    }
    onClose();
  });

  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title={isReschedule ? "Reschedule appointment" : "Book appointment"}
      description={isReschedule && record ? `${record.code} · currently ${formatDate(record.date)} at ${formatTime(record.time)}` : "Slots are produced live from the doctor's schedule, slot length, buffer and daily cap."}
      onSubmit={save}
      loading={form.submitting}
      submitLabel={isReschedule ? "Confirm new slot" : "Confirm booking"}
    >
      <FormSection title="Patient & clinician">
        <FormRow className="lg:grid-cols-2">
          <Select
            name="patientId"
            label="Patient"
            required
            value={form.values.patientId}
            onChange={(v) => form.setValue("patientId", v)}
            error={form.errors.patientId}
            placeholder="Search registered patients…"
            options={patients.filter((p: any) => p.status === "active").map((p: any) => ({
              value: p.id,
              label: `${fullName(p)}`,
              description: `${p.mrn} · ${calcBrief(p)}`,
            }))}
          />
          <Select
            name="doctorId"
            label="Doctor"
            required
            value={form.values.doctorId}
            onChange={(v) => form.setValue("doctorId", v)}
            error={form.errors.doctorId}
            options={doctors.map((d: any) => ({
              value: d.id,
              label: `Dr. ${fullName(d)}`,
              description: `${specializations.find((s: any) => s.id === d.specializationId)?.name ?? ""} · ${formatMoney(d.consultationFee)}`,
              disabled: d.status !== "active",
            }))}
            hint={doctor ? `${departments.find((d: any) => d.id === doctor.departmentId)?.name} · ${doctor.slotDuration}m slots` : undefined}
          />
        </FormRow>
      </FormSection>

      <FormSection title="Date & slot">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,15rem)_1fr]">
          <div className="space-y-3">
            <DatePicker label="Appointment date" required value={form.values.date} onChange={(v) => form.setValue("date", v)} error={form.errors.date} min={addDays(new Date(), 0)} />
            <Select name="type" label="Appointment type" value={form.values.type} onChange={(v) => form.setValue("type", v)} options={["Consultation", "Follow-up", "Procedure", "Emergency", "Telemedicine"].map((t) => ({ value: t, label: t }))} />
            <Select name="priority" label="Priority" value={form.values.priority} onChange={(v) => form.setValue("priority", v)} options={[{ value: "Routine", label: "Routine" }, { value: "Urgent", label: "Urgent — queue first" }]} />
            <Input name="fee" type="number" label="Consultation fee" required prefix="₹" value={String(form.values.fee)} onChange={(e) => form.setValue("fee", Number(e.target.value))} error={form.errors.fee} hint="Auto-filled from the doctor profile" />
          </div>
          <div>
            <p className="mb-2 text-[12.5px] font-medium text-ink-600">
              Available slots <span className="text-ink-400">· {formatDate(form.values.date, { weekday: "long", day: "2-digit", month: "short" })}</span>
            </p>
            <SlotPicker doctorId={form.values.doctorId} date={form.values.date} appointments={existing} value={form.values.time} onChange={(t) => form.setValue("time", t)} />
            {form.errors.time && <p className="mt-1.5 text-[11.5px] font-medium text-coral-600">{form.errors.time}</p>}
          </div>
        </div>
      </FormSection>

      <FormRow className="lg:grid-cols-2">
        {isReschedule && (
          <Input name="reason" label="Reason for change" required value={form.values.reason} onChange={(e) => form.setValue("reason", e.target.value)} error={form.errors.reason} placeholder="Patient requested evening slot" />
        )}
        <Textarea name="notes" label="Front desk notes" rows={2} placeholder="Interpreter needed, bring previous reports…" value={form.values.notes} onChange={(e) => form.setValue("notes", e.target.value)} />
      </FormRow>
    </FormDialog>
  );
}

const calcBrief = (p: any) => `${calcAgeShort(p.dateOfBirth)} · ${p.gender}`;
const calcAgeShort = (dob: string) => (dob ? formatDate(dob, { day: "2-digit", month: "short", year: "numeric" }) : "—");

/* ---------------------------------- page ----------------------------------- */

export function AppointmentsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { items: appointments, status } = useRootSelector((s) => s.appointments);
  const patients = useRootSelector((s) => s.patients.items);
  const doctors = useRootSelector((s) => s.doctors.items);
  const departments = useRootSelector((s) => s.departments.items);
  const { canCreate, canEdit, canDelete } = usePermission();

  const [view, setView] = useState<"list" | "board">("list");
  const [boardDate, setBoardDate] = useState(addDays(new Date(), 0));
  const [filters, setFilters] = useState({ doctor: "all", department: "all", status: "all", from: "", to: "" });
  const [form, setForm] = useState<any>(params.get("new") === "1" ? { patientId: params.get("patient") ?? undefined, doctorId: params.get("doctor") ?? undefined, mode: "new" } : null);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("Patient request");
  const [detailId, setDetailId] = useState<string | null>(params.get("focus"));

  useEffect(() => {
    if (status === "idle") dispatch(appointmentsApi.thunks.fetchAll() as any);
  }, [status, dispatch]);

  const patientMap = useMemo(() => new Map(patients.map((p: any) => [p.id, p])), [patients]);
  const doctorMap = useMemo(() => new Map(doctors.map((d: any) => [d.id, d])), [doctors]);

  const filtered = useMemo(() => {
    return (appointments as Appointment[]).filter((a) => {
      if (filters.doctor !== "all" && a.doctorId !== filters.doctor) return false;
      if (filters.department !== "all" && a.departmentId !== filters.department) return false;
      if (filters.status !== "all" && a.status !== filters.status) return false;
      if (filters.from && a.date < filters.from) return false;
      if (filters.to && a.date > filters.to) return false;
      return true;
    });
  }, [appointments, filters]);

  const table = useTable<Appointment>(filtered, {
    pageSize: 10,
    searchFields: [
      (a) => a.code,
      (a) => fullName(patientMap.get(a.patientId)),
      (a) => `Dr. ${fullName(doctorMap.get(a.doctorId))}`,
      (a) => a.notes,
    ],
    sortAccessors: { date: (a) => `${a.date}${a.time}`, status: (a) => a.status, fee: (a) => a.fee, patient: (a) => fullName(patientMap.get(a.patientId)) },
  });

  const detail = (appointments as Appointment[]).find((a) => a.id === detailId) ?? null;

  const advance = (a: Appointment, next: AppointmentStatus) => dispatch(appointmentsApi.thunks.updateOne({ id: a.id, data: { status: next }, successMessage: `${a.code} → ${next}` } as any));

  const todayBoard = (appointments as Appointment[]).filter((a) => a.date === boardDate && !["Cancelled", "No Show"].includes(a.status));

  const clearParams = () => {
    if (params.get("new") || params.get("focus")) {
      params.delete("new");
      params.delete("focus");
      params.delete("patient");
      params.delete("doctor");
      setParams(params, { replace: true });
    }
  };

  return (
    <>
      <PageIntro
        title="Appointment scheduling"
        description="Book, reschedule and progress visits. The slot builder reads each doctor's clinic hours, slot length, buffer time and daily patient cap."
        module="appointments"
        createLabel="Book appointment"
        onCreate={() => setForm({ mode: "new" })}
        meta={
          <>
            <Badge tone="amber" dot>{appointments.filter((a: any) => a.date === addDays(new Date(), 0) && a.status !== "Completed").length} still open today</Badge>
            <Badge tone="mint">{appointments.filter((a: any) => a.status === "Completed").length} completed</Badge>
            <Badge tone="coral">{appointments.filter((a: any) => a.status === "Cancelled" || a.status === "No Show").length} cancelled / no-show</Badge>
          </>
        }
        actions={
          <Segmented
            value={view}
            onChange={(v) => setView(v)}
            options={[
              { value: "list", label: <span className="flex items-center gap-1.5"><ListChecks className="size-3.5" /> List</span> },
              { value: "board", label: <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" /> Day board</span> },
            ]}
          />
        }
      />

      {view === "board" ? (
        <Panel className="p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setBoardDate(addDays(new Date(), dayOffset(boardDate, -1)))}>← Prev</Button>
              <DatePicker label="" value={boardDate} onChange={setBoardDate} />
              <Button size="sm" variant="outline" onClick={() => setBoardDate(addDays(new Date(), dayOffset(boardDate, 1)))}>Next →</Button>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-ink-500">
              <Timer className="size-4" /> {todayBoard.length} visits on the floor · {formatDate(boardDate, { weekday: "long", day: "2-digit", month: "long" })}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(doctors as any[]).filter((d) => d.status === "active").map((doc) => {
              const rows = todayBoard.filter((a) => a.doctorId === doc.id).sort((a, b) => a.time.localeCompare(b.time));
              const slots = generateSlots(doc, boardDate, appointments as any);
              const open = slots.filter((s) => s.state === "available").length;
              return (
                <div key={doc.id} className="overflow-hidden rounded-xl border border-ink-100 bg-white">
                  <div className="flex items-center justify-between gap-2 border-b border-ink-100 bg-ink-25/70 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={fullName(doc)} size="xs" color="bg-brand-600" />
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-semibold text-ink-900">Dr. {fullName(doc)}</p>
                        <p className="num text-[10.5px] text-ink-400">{doc.slotDuration}m slots · {open} open</p>
                      </div>
                    </div>
                    <Badge tone={rows.length > doc.maxPatientsPerDay * 0.8 ? "coral" : "brand"} size="xs">
                      {rows.length}/{doc.maxPatientsPerDay}
                    </Badge>
                  </div>
                  <ul className="divide-y divide-ink-100">
                    {rows.length === 0 && <li className="px-3 py-6 text-center text-[12px] text-ink-400">No visits booked</li>}
                    {rows.map((a) => (
                      <li key={a.id} className="group flex items-center gap-3 px-3 py-2 transition-colors hover:bg-brand-25/60">
                        <span className="num w-12 shrink-0 text-[12px] font-bold text-ink-700">{a.time}</span>
                        <button className="min-w-0 flex-1 text-left" onClick={() => navigate(`/app/patients/${a.patientId}`)}>
                          <span className="block truncate text-[12.5px] font-medium text-ink-800">{fullName(patientMap.get(a.patientId))}</span>
                          <span className="block truncate text-[11px] text-ink-400">{a.type} · {a.code}</span>
                        </button>
                        {canEdit("appointments") && a.status !== "Completed" && (
                          <button onClick={() => advance(a, "Completed")} className="rounded-md p-1 text-ink-300 opacity-0 transition-all hover:bg-mint-50 hover:text-mint-600 group-hover:opacity-100" aria-label="Mark completed">
                            <CheckCheck className="size-4" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Panel>
      ) : (
        <Panel>
          <TableToolbar
            search={table.query.search}
            onSearch={table.setSearch}
            searchPlaceholder="Search patient, code, notes…"
            filters={
              <>
                <Select size="sm" className="w-[11rem]" name="doc" value={filters.doctor} onChange={(v) => setFilters((f) => ({ ...f, doctor: v }))} options={[{ value: "all", label: "All doctors" }, ...doctors.map((d: any) => ({ value: d.id, label: `Dr. ${d.lastName}` }))]} />
                <Select size="sm" className="w-[11rem]" name="dep" value={filters.department} onChange={(v) => setFilters((f) => ({ ...f, department: v }))} options={[{ value: "all", label: "All departments" }, ...departments.map((d: any) => ({ value: d.id, label: d.name }))]} />
                <Select size="sm" className="w-[10rem]" name="status" value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} options={[{ value: "all", label: "Any status" }, ...APPOINTMENT_STATUSES.map((s) => ({ value: s, label: s }))]} />
                <div className="flex items-center gap-1.5">
                  <DatePicker label="" value={filters.from} onChange={(v) => setFilters((f) => ({ ...f, from: v }))} placeholder="From" />
                  <DatePicker label="" value={filters.to} onChange={(v) => setFilters((f) => ({ ...f, to: v }))} placeholder="To" />
                </div>
                <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={() => setFilters({ doctor: "all", department: "all", status: "all", from: "", to: "" })}>
                  Reset
                </Button>
              </>
            }
            actions={
              canCreate("appointments") ? (
                <Button size="sm" icon={<CalendarClock />} onClick={() => setForm({ mode: "new" })}>
                  Book slot
                </Button>
              ) : (
                <Badge tone="neutral">Read only</Badge>
              )
            }
          />
          <DataTable
            columns={[
              {
                key: "patient",
                header: "Patient",
                sortable: true,
                render: (a) => (
                  <div className="flex items-center gap-2.5">
                    <Avatar name={fullName(patientMap.get(a.patientId))} size="xs" color="bg-ink-600" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-ink-900">{fullName(patientMap.get(a.patientId))}</p>
                      <p className="num truncate text-[11px] text-ink-400">{a.code} · {patientMap.get(a.patientId)?.mrn}</p>
                    </div>
                  </div>
                ),
              },
              { key: "doctor", header: "Doctor", hideBelow: "md", render: (a) => <span className="text-[12.5px] text-ink-600">Dr. {fullName(doctorMap.get(a.doctorId))}</span> },
              {
                key: "date",
                header: "Slot",
                sortable: true,
                render: (a) => (
                  <div>
                    <p className="text-[12.5px] font-medium text-ink-800">{formatDate(a.date, { day: "2-digit", month: "short", year: "numeric" })}</p>
                    <p className="num text-[11px] text-ink-400">{formatTime(a.time)} · {a.duration}m</p>
                  </div>
                ),
              },
              { key: "type", header: "Type", hideBelow: "lg", align: "center", render: (a) => <Badge className={cn("ring-1 ring-inset", APPT_TYPE_COLORS[a.type] ?? "")} size="xs" tone="neutral">{a.type}</Badge> },
              { key: "fee", header: "Fee", align: "right", sortable: true, hideBelow: "sm", render: (a) => <span className="num text-[12.5px] font-semibold">{formatMoney(a.fee)}</span> },
              { key: "status", header: "Status", align: "center", sortable: true, render: (a) => <StatusBadge status={a.status} /> },
            ]}
            rows={table.rows}
            status={status === "ready" ? "ready" : status === "error" ? "error" : "loading"}
            onRetry={() => dispatch(appointmentsApi.thunks.fetchAll() as any)}
            sort={{ sortBy: table.query.sortBy, sortDir: table.query.sortDir, onSort: table.toggleSort }}
            onRowClick={(a) => setDetailId(a.id)}
            actions={(a) => (
              <RowActions
                items={[
                  { label: "Appointment details", icon: <Eye />, onClick: () => setDetailId(a.id) },
                  { label: "Reschedule", icon: <Pencil />, hidden: !canEdit("appointments") || ["Completed", "Cancelled"].includes(a.status), onClick: () => setForm({ mode: "reschedule", id: a.id }) },
                  { label: "Mark checked in", icon: <UserRound />, hidden: !canEdit("appointments") || !["Scheduled", "Confirmed"].includes(a.status), onClick: () => advance(a, "Checked In") },
                  { label: "Start consultation", icon: <Stethoscope />, hidden: !canEdit("appointments") || a.status === "In Progress", onClick: () => advance(a, "In Progress") },
                  { label: "Complete", icon: <CheckCheck />, hidden: !canEdit("appointments") || a.status === "Completed", onClick: () => advance(a, "Completed") },
                  { label: "Cancel appointment", icon: <XCircle />, tone: "danger", hidden: !canEdit("appointments") || ["Cancelled", "Completed"].includes(a.status), onClick: () => setCancelTarget(a) },
                  { label: "Delete record", icon: <Trash2 />, tone: "danger", hidden: !canDelete("appointments"), onClick: () => dispatch(appointmentsApi.thunks.removeOne({ id: a.id, label: a.code } as any)) },
                ]}
              />
            )}
            emptyTitle="No appointments match this view"
            emptyDescription="Adjust the filters, or book the first slot for this day."
            emptyAction={canCreate("appointments") ? <Button size="sm" onClick={() => setForm({ mode: "new" })}>Book appointment</Button> : undefined}
            footer={
              <Pagination page={table.page} pageCount={table.pageCount} total={table.total} pageSize={table.pageSize} onPage={table.setPage} onPageSize={table.setPageSize} label="appointments" />
            }
          />
        </Panel>
      )}

      {form && (
        <AppointmentForm
          initial={form}
          onClose={() => {
            setForm(null);
            clearParams();
          }}
        />
      )}

      <FormDialog
        open={!!cancelTarget}
        onOpenChange={(v) => !v && setCancelTarget(null)}
        size="sm"
        title="Cancel appointment"
        description={cancelTarget ? `${cancelTarget.code} · ${formatDate(cancelTarget.date)} at ${formatTime(cancelTarget.time)}` : ""}
        submitLabel="Cancel appointment"
        onSubmit={async () => {
          if (!cancelTarget) return;
          await dispatch(
            appointmentsApi.thunks.updateOne({
              id: cancelTarget.id,
              data: { status: "Cancelled" as AppointmentStatus, cancelledReason: cancelReason },
              successMessage: "Appointment cancelled",
            } as any),
          );
          setCancelTarget(null);
        }}
      >
        <Select name="reason" label="Cancellation reason" value={cancelReason} onChange={setCancelReason} options={["Patient request", "Doctor unavailable", "Duplicate booking", "Travel constraint", "No response"].map((r) => ({ value: r, label: r }))} />
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-amberly-50 px-3 py-2 text-[12px] text-amberly-600">
          <CircleSlash className="mt-0.5 size-3.5 shrink-0" /> The slot is released back to the doctor's availability grid immediately.
        </p>
      </FormDialog>

      {/* details sheet */}
      <Sheet
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) {
            setDetailId(null);
            clearParams();
          }
        }}
        title={detail ? `Appointment ${detail.code}` : "Appointment"}
        description={detail ? `${formatDate(detail.date, { weekday: "long" })} at ${formatTime(detail.time)} · ${detail.type}` : undefined}
        footer={
          detail && (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {canEdit("appointments") &&
                  APPOINTMENT_STATUSES.filter((s) => s !== detail.status && !["Cancelled", "No Show"].includes(s)).slice(0, 4).map((s) => (
                    <Tooltip key={s} content={`Move this visit to ${s}`}>
                      <button onClick={() => advance(detail, s)} className="rounded-full border border-ink-200 px-2.5 py-1 text-[11.5px] font-medium text-ink-600 transition-colors hover:border-brand-400 hover:bg-brand-25 hover:text-brand-700">
                        {s}
                      </button>
                    </Tooltip>
                  ))}
              </div>
              <div className="flex gap-2">
                {canEdit("appointments") && <Button size="sm" variant="outline" icon={<Pencil />} onClick={() => setForm({ mode: "reschedule", id: detail.id })}>Reschedule</Button>}
                <Button size="sm" onClick={() => navigate(`/app/patients/${detail.patientId}`)}>Open patient chart</Button>
              </div>
            </div>
          )
        }
      >
        {detail && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border border-ink-100 bg-ink-25/70 p-3.5">
              <Avatar name={fullName(patientMap.get(detail.patientId))} color="bg-brand-600" />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-ink-900">{fullName(patientMap.get(detail.patientId))}</p>
                <p className="text-[11.5px] text-ink-400">
                  {patientMap.get(detail.patientId)?.mrn} · {patientMap.get(detail.patientId)?.mobile}
                </p>
              </div>
              <StatusBadge status={detail.status} className="ml-auto" />
            </div>
            <DetailGrid
              columns={2}
              items={[
                { label: "Doctor", value: `Dr. ${fullName(doctorMap.get(detail.doctorId))}` },
                { label: "Department", value: departments.find((d: any) => d.id === detail.departmentId)?.name ?? "—" },
                { label: "Date", value: formatDate(detail.date, { weekday: "long", day: "2-digit", month: "long", year: "numeric" }) },
                { label: "Time", value: `${formatTime(detail.time)} · ${detail.duration} min` },
                { label: "Type", value: detail.type },
                { label: "Priority", value: detail.priority },
                { label: "Consultation fee", value: formatMoney(detail.fee) },
                { label: "Booked on", value: formatDate(detail.createdAt) },
                { label: "Notes", value: detail.notes || "—" },
                ...(detail.cancelledReason ? [{ label: "Cancellation reason", value: detail.cancelledReason }] : []),
              ]}
            />
            <SectionPanel title="Slot context" icon={<Timer />}>
              <SlotPicker doctorId={detail.doctorId} date={detail.date} appointments={appointments as any} value={detail.time} onChange={() => undefined} />
            </SectionPanel>
          </div>
        )}
      </Sheet>
    </>
  );
}

const dayOffset = (date: string, delta: number) => {
  const d = new Date(date);
  const diff = Math.round((d.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  return diff + delta;
};
