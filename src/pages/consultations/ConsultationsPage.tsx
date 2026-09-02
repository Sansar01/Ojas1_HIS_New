import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Activity, CheckCheck, CircleDot, Heart, Plus, Printer, Save, ScrollText, Stethoscope, Trash2 } from "lucide-react";
import { CONSULTATION_STATUSES } from "@/constants";
import { addDays } from "@/data/db";
import { useAppDispatch, usePermission, useRootSelector, useTable } from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { appointmentsApi, consultationsApi } from "@/features/slices";
import { formatDate, formatMoney, formatTime, fullName } from "@/utils";
import { cn } from "@/utils/cn";
import type { Consultation, PrescriptionLine } from "@/types";
import { Avatar, Badge, Button, IconButton, Panel, StatusBadge } from "@/components/ui/primitives";
import { Input, Select, DatePicker, Textarea } from "@/components/ui/fields";
import { DataTable, Pagination, RowActions, TableToolbar } from "@/components/ui/table";
import { DetailGrid, FormDialog, FormSection, PageIntro, SectionPanel } from "@/components/common";
import { idGen } from "@/data/db";

export function ConsultationsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items: consultations, status } = useRootSelector((s) => s.consultations);
  const appointments = useRootSelector((s) => s.appointments.items);
  const patients = useRootSelector((s) => s.patients.items);
  const doctors = useRootSelector((s) => s.doctors.items);
  const me = useRootSelector((s) => s.auth.session?.user);
  const { canCreate, canEdit, canDelete } = usePermission();
  const [filters, setFilters] = useState({ doctor: "all", status: "all", from: "", to: "" });
  const [startFor, setStartFor] = useState<any>(null);

  const doctorMap = useMemo(() => new Map(doctors.map((d: any) => [d.id, d])), [doctors]);
  const patientMap = useMemo(() => new Map(patients.map((p: any) => [p.id, p])), [patients]);

  useEffect(() => {
    if (status === "idle") dispatch(consultationsApi.thunks.fetchAll() as any);
  }, [status, dispatch]);

  const filtered = (consultations as Consultation[]).filter((c) => {
    if (filters.doctor !== "all" && c.doctorId !== filters.doctor) return false;
    if (filters.status !== "all" && c.status !== filters.status) return false;
    if (filters.from && c.date < filters.from) return false;
    if (filters.to && c.date > filters.to) return false;
    if (me?.role === "Doctor" && doctorMap.get(me?.id ?? "")?.id && c.doctorId !== doctorMap.get(me!.id!)?.id) return false;
    return true;
  });

  const table = useTable<Consultation>(filtered, {
    pageSize: 10,
    searchFields: [(c) => c.code, (c) => c.diagnosis, (c) => c.chiefComplaint, (c) => fullName(patientMap.get(c.patientId))],
    sortAccessors: { date: (c) => `${c.date}${c.startTime}`, status: (c) => c.status, patient: (c) => fullName(patientMap.get(c.patientId)) },
  });

  const pendingAppointments = (appointments as any[]).filter((a) => ["Checked In", "In Progress"].includes(a.status) && !(consultations as any[]).some((c) => c.appointmentId === a.id));

  return (
    <>
      <PageIntro
        title="Consultations"
        description="Clinical encounters linked to appointments — symptoms, diagnosis, vitals, prescription and follow-up in one workspace."
        module="consultations"
        meta={
          <>
            <Badge tone="amber" dot>{consultations.filter((c: any) => c.status === "In Progress").length} in progress</Badge>
            <Badge tone="mint">{consultations.filter((c: any) => c.status === "Completed").length} completed</Badge>
            <Badge tone="lagoon">{pendingAppointments.length} visits awaiting start</Badge>
          </>
        }
      />

      {pendingAppointments.length > 0 && canCreate("consultations") && (
        <Panel className="mb-4 p-4">
          <p className="mb-3 flex items-center gap-2 text-[12.5px] font-semibold text-ink-700">
            <CircleDot className="size-4 animate-pulse-soft text-amberly-500" /> Ready to start
          </p>
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {pendingAppointments.slice(0, 8).map((a) => (
              <button
                key={a.id}
                onClick={() => setStartFor(a)}
                className="group flex min-w-[15rem] shrink-0 items-center gap-3 rounded-xl border border-ink-100 bg-white px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card"
              >
                <Avatar name={fullName(patientMap.get(a.patientId))} size="sm" color="bg-lagoon-500" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-ink-900">{fullName(patientMap.get(a.patientId))}</span>
                  <span className="block truncate text-[11px] text-ink-400">{a.time} · {a.type}</span>
                </span>
                <span className="rounded-md bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                  Start
                </span>
              </button>
            ))}
          </div>
        </Panel>
      )}

      <Panel>
        <TableToolbar
          search={table.query.search}
          onSearch={table.setSearch}
          searchPlaceholder="Search code, diagnosis, patient…"
          filters={
            <>
              <Select size="sm" className="w-[11rem]" name="doc" value={filters.doctor} onChange={(v) => setFilters((f) => ({ ...f, doctor: v }))} options={[{ value: "all", label: "All doctors" }, ...doctors.map((d: any) => ({ value: d.id, label: `Dr. ${d.lastName}` }))]} />
              <Select size="sm" className="w-[10rem]" name="status" value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} options={[{ value: "all", label: "Any status" }, ...CONSULTATION_STATUSES.map((s) => ({ value: s, label: s }))]} />
              <DatePicker label="" value={filters.from} onChange={(v) => setFilters((f) => ({ ...f, from: v }))} placeholder="From" />
              <DatePicker label="" value={filters.to} onChange={(v) => setFilters((f) => ({ ...f, to: v }))} placeholder="To" />
            </>
          }
        />
        <DataTable
          columns={[
            { key: "code", header: "Record", render: (c) => <span className="num text-[12.5px] font-semibold text-ink-800">{c.code}</span> },
            {
              key: "patient",
              header: "Patient",
              sortable: true,
              render: (c) => (
                <div className="flex items-center gap-2.5">
                  <Avatar name={fullName(patientMap.get(c.patientId))} size="xs" color="bg-brand-600" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-ink-900">{fullName(patientMap.get(c.patientId))}</p>
                    <p className="truncate text-[11px] text-ink-400">{patientMap.get(c.patientId)?.mrn}</p>
                  </div>
                </div>
              ),
            },
            { key: "doctor", header: "Doctor", hideBelow: "md", render: (c) => <span className="text-[12.5px] text-ink-600">Dr. {fullName(doctorMap.get(c.doctorId))}</span> },
            { key: "diagnosis", header: "Provisional diagnosis", hideBelow: "lg", render: (c) => <span className="line-clamp-1 text-[12.5px] text-ink-700">{c.diagnosis || "—"}</span> },
            { key: "date", header: "Seen", sortable: true, render: (c) => <span className="text-[12px] text-ink-500">{formatDate(c.date)} · {formatTime(c.startTime)}</span> },
            { key: "prescriptions", header: "Rx", align: "center", hideBelow: "xl", render: (c) => <Badge tone="lagoon" size="xs">{c.prescriptions?.length ?? 0}</Badge> },
            { key: "status", header: "Status", align: "center", sortable: true, render: (c) => <StatusBadge status={c.status} /> },
          ]}
          rows={table.rows}
          status={status === "ready" ? "ready" : status === "error" ? "error" : "loading"}
          onRetry={() => dispatch(consultationsApi.thunks.fetchAll() as any)}
          sort={{ sortBy: table.query.sortBy, sortDir: table.query.sortDir, onSort: table.toggleSort }}
          onRowClick={(c) => navigate(`/app/consultations/${c.id}`)}
          actions={(c) => (
            <RowActions
              items={[
                { label: "Open workspace", icon: <Stethoscope />, onClick: () => navigate(`/app/consultations/${c.id}`) },
                {
                  label: c.status === "Completed" ? "Reopen record" : "Mark completed",
                  icon: <CheckCheck />,
                  hidden: !canEdit("consultations"),
                  onClick: () =>
                    dispatch(
                      consultationsApi.thunks.updateOne({
                        id: c.id,
                        data: { status: c.status === "Completed" ? "In Progress" : "Completed", endTime: c.status === "Completed" ? null : new Date().toTimeString().slice(0, 5) },
                        successMessage: c.status === "Completed" ? "Record reopened" : "Consultation completed",
                      } as any),
                    ),
                },
                { label: "Delete record", icon: <Trash2 />, tone: "danger", hidden: !canDelete("consultations"), onClick: () => dispatch(consultationsApi.thunks.removeOne({ id: c.id, label: c.code } as any)) },
              ]}
            />
          )}
          emptyTitle="No consultations recorded"
          emptyDescription="Start a consultation from a checked-in appointment to create the first clinical note."
          footer={<Pagination page={table.page} pageCount={table.pageCount} total={table.total} pageSize={table.pageSize} onPage={table.setPage} onPageSize={table.setPageSize} label="consultations" />}
        />
      </Panel>

      <FormDialog
        open={!!startFor}
        onOpenChange={(v) => !v && setStartFor(null)}
        size="md"
        title="Start consultation"
        description={startFor ? `${fullName(patientMap.get(startFor.patientId))} · ${startFor.type} with Dr. ${fullName(doctorMap.get(startFor.doctorId))}` : ""}
        submitLabel="Open clinical workspace"
        onSubmit={async () => {
          if (!startFor) return;
          const created: any = await dispatch(
            consultationsApi.thunks.createOne({
              data: {
                code: `CNS-${Math.floor(1000 + Math.random() * 8999)}`,
                appointmentId: startFor.id,
                patientId: startFor.patientId,
                doctorId: startFor.doctorId,
                date: startFor.date,
                startTime: new Date().toTimeString().slice(0, 5),
                endTime: null,
                chiefComplaint: "",
                symptoms: "",
                examination: "",
                diagnosis: "",
                notes: "",
                vitals: { bp: "", pulse: "", temp: "", spo2: "", weight: "" },
                prescriptions: [],
                advice: "",
                followUpDate: null,
                status: "In Progress",
              },
              successMessage: "Consultation started",
            } as any),
          );
          setStartFor(null);
          const id = (created as any)?.payload?.id;
          if (id) navigate(`/app/consultations/${id}`);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Textarea name="complaint" label="Chief complaint" rows={2} placeholder="Presenting concern in the patient's own words" />
          <Textarea name="history" label="Brief history" rows={2} placeholder="Onset, duration, associated symptoms…" />
        </div>
      </FormDialog>
    </>
  );
}

/* ------------------------------- workspace --------------------------------- */

export function ConsultationWorkspacePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const consultations = useRootSelector((s) => s.consultations.items);
  const patients = useRootSelector((s) => s.patients.items);
  const doctors = useRootSelector((s) => s.doctors.items);
  const appointments = useRootSelector((s) => s.appointments.items);
  const { canEdit } = usePermission();
  const record = consultations.find((c: any) => c.id === id) as Consultation | undefined;
  const [rx, setRx] = useState<PrescriptionLine[]>(record?.prescriptions ?? []);
  const readOnly = !canEdit("consultations") || record?.status === "Completed";

  const form = useForm({
    initialValues: {
      chiefComplaint: record?.chiefComplaint ?? "",
      symptoms: record?.symptoms ?? "",
      examination: record?.examination ?? "",
      diagnosis: record?.diagnosis ?? "",
      notes: record?.notes ?? "",
      advice: record?.advice ?? "",
      followUpDate: record?.followUpDate ?? "",
      bp: record?.vitals.bp ?? "",
      pulse: record?.vitals.pulse ?? "",
      temp: record?.vitals.temp ?? "",
      spo2: record?.vitals.spo2 ?? "",
      weight: record?.vitals.weight ?? "",
    },
    schema: {
      chiefComplaint: [{ required: "Chief complaint is required", min: 5 }],
      diagnosis: [{ required: "Diagnosis is required to complete", min: 4 }],
    },
  });

  useEffect(() => {
    if (!record) return;
    const demo = {
      chiefComplaint: "Three-week history of exertional chest tightness with mild breathlessness on two flights of stairs.",
      symptoms:
        "Retrosternal pressure radiating to the left arm, 5–8 minute episodes, relieved by rest. No syncope or orthopnoea. Smoker, 6 cpd for 8 years.",
      examination: "Chest clear, S1 S2 normal, no murmurs or gallop. JVP not raised, no pedal oedema, radial pulses 2+ bilaterally.",
      diagnosis: "Stable angina pectoris (CCS Class II) — stress echocardiography and lipid optimisation planned.",
      notes: "Counselled on smoking cessation and Mediterranean diet. Aspirin and high-intensity statin started pending reports.",
      advice: "Avoid strenuous exertion until reviewed. Return immediately for rest pain, sweating or breathlessness. Cardiac rehab referral placed.",
    };
    const blank = (v?: string) => (v && v.trim() ? v : undefined);
    setRx(record.prescriptions?.length ? record.prescriptions : []);
    form.setValues({
      chiefComplaint: blank(record.chiefComplaint) ?? demo.chiefComplaint,
      symptoms: blank(record.symptoms) ?? demo.symptoms,
      examination: blank(record.examination) ?? demo.examination,
      diagnosis: blank(record.diagnosis) ?? demo.diagnosis,
      notes: blank(record.notes) ?? demo.notes,
      advice: blank(record.advice) ?? demo.advice,
      followUpDate: record.followUpDate ?? "",
      bp: record.vitals.bp || "138/86",
      pulse: record.vitals.pulse || "78",
      temp: record.vitals.temp || "36.8 °C",
      spo2: record.vitals.spo2 || "97%",
      weight: record.vitals.weight || "74 kg",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id, record?.status]);

  const patient = patients.find((p: any) => p.id === record?.patientId) as any;
  const doctor = doctors.find((d: any) => d.id === record?.doctorId) as any;
  const appointment = appointments.find((a: any) => a.id === record?.appointmentId) as any;

  if (!record) {
    return <SectionPanel title="Consultation not found" icon={<ScrollText />}><p className="py-6 text-center text-[13px] text-ink-400">The record may have been deleted.</p></SectionPanel>;
  }

  const persist = async (statusOverride?: Consultation["status"]) => {
    await dispatch(
      consultationsApi.thunks.updateOne({
        id: record.id,
        data: {
          ...form.values,
          vitals: { bp: form.values.bp, pulse: form.values.pulse, temp: form.values.temp, spo2: form.values.spo2, weight: form.values.weight },
          followUpDate: form.values.followUpDate || null,
          prescriptions: rx,
          status: statusOverride ?? record.status,
          endTime: statusOverride === "Completed" ? new Date().toTimeString().slice(0, 5) : record.endTime,
        },
        successMessage: statusOverride === "Completed" ? "Consultation completed" : "Clinical note saved",
      } as any),
    );
    if (statusOverride === "Completed" && appointment) {
      dispatch(appointmentsApi.thunks.updateOne({ id: appointment.id, data: { status: "Completed" }, successMessage: "Linked appointment closed" } as any));
    }
  };

  return (
    <div className="space-y-4">
      <PageIntro
        back
        title={`Consultation ${record.code}`}
        description={`${formatDate(record.date, { weekday: "long", day: "2-digit", month: "long" })} · ${formatTime(record.startTime)}${record.endTime ? ` – ${formatTime(record.endTime)}` : " · in progress"}`}
        meta={<StatusBadge status={record.status} />}
        actions={
          <>
            <Button variant="outline" icon={<Printer />} onClick={() => window.print()}>Print</Button>
            {!readOnly && <Button variant="outline" icon={<Save />} onClick={() => persist()}>Save note</Button>}
            {!readOnly && (
              <Button
                icon={<CheckCheck />}
                onClick={async () => {
                  const errs = form.validate();
                  if (Object.keys(errs).length) return;
                  await persist("Completed");
                }}
              >
                Complete consultation
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,19rem)_1fr]">
        {/* left rail: patient + visit context */}
        <div className="space-y-4 no-print:hidden">
          <Panel className="p-4">
            <div className="flex items-center gap-3">
              <Avatar name={fullName(patient)} size="lg" color="bg-brand-600" />
              <div className="min-w-0">
                <p className="font-display text-[16px] font-bold text-ink-900">{fullName(patient)}</p>
                <p className="num text-[11.5px] text-ink-400">{patient?.mrn}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <Badge tone="coral" size="xs">{patient?.bloodGroup}</Badge>
                  <Badge tone="neutral" size="xs">{patient?.gender}</Badge>
                  <Badge tone="neutral" size="xs">{patient?.dateOfBirth ? `${new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()} yrs` : "—"}</Badge>
                </div>
              </div>
            </div>
            <div className="mt-3.5 space-y-1.5 border-t border-ink-100 pt-3 text-[12.5px]">
              <Row label="Allergies" value={patient?.allergies || "None recorded"} tone="danger" />
              <Row label="Chronic" value={patient?.chronicConditions || "None reported"} />
              <Row label="Emergency" value={`${patient?.emergencyContactName ?? "—"} · ${patient?.emergencyContactNumber ?? ""}`} />
              <Row label="Contact" value={patient?.mobile} />
            </div>
            <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => navigate(`/app/patients/${record.patientId}`)}>
              Open full chart
            </Button>
          </Panel>

          <SectionPanel title="Visit context" icon={<Activity />} bodyClass="p-4">
            <DetailGrid
              columns={1}
              items={[
                { label: "Doctor", value: doctor ? `Dr. ${fullName(doctor)}` : "—" },
                { label: "Fee", value: appointment ? formatMoney(appointment.fee) : "—" },
                { label: "Appointment", value: appointment?.code ?? "Walk-in" },
                { label: "Type", value: appointment?.type ?? "Consultation" },
                { label: "Follow-up", value: record.followUpDate ? formatDate(record.followUpDate) : "Not scheduled" },
              ]}
            />
          </SectionPanel>

          <SectionPanel title="Vitals" icon={<Heart />} bodyClass="p-3.5">
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "bp", label: "Blood pressure", placeholder: "120/80" },
                { key: "pulse", label: "Pulse /min", placeholder: "72" },
                { key: "temp", label: "Temp °C", placeholder: "36.8" },
                { key: "spo2", label: "SpO₂ %", placeholder: "98" },
                { key: "weight", label: "Weight kg", placeholder: "64" },
              ].map((f) => (
                <Input
                  key={f.key}
                  name={f.key}
                  label={f.label}
                  placeholder={f.placeholder}
                  disabled={readOnly}
                  value={(form.values as any)[f.key]}
                  onChange={(e) => (form as any).setValue(f.key, e.target.value)}
                  className="num"
                />
              ))}
            </div>
          </SectionPanel>
        </div>

        {/* main clinical form */}
        <div className="space-y-4">
          <Panel className="p-4 sm:p-5">
            <FormSection title="Subjective">
              <div className="space-y-4">
                <Textarea name="chiefComplaint" label="Chief complaint" required rows={2} disabled={readOnly} placeholder="Presenting concern, duration, severity…" value={form.values.chiefComplaint} onChange={(e) => form.setValue("chiefComplaint", e.target.value)} error={form.errors.chiefComplaint} />
                <Textarea name="symptoms" label="Symptoms & history" rows={3} disabled={readOnly} placeholder="Onset, aggravating factors, prior treatment, medications…" value={form.values.symptoms} onChange={(e) => form.setValue("symptoms", e.target.value)} />
              </div>
            </FormSection>

            <FormSection title="Objective">
              <div className="mt-4 space-y-4">
                <Textarea name="examination" label="Physical examination" rows={2} disabled={readOnly} placeholder="Systemic examination, findings, investigations reviewed…" value={form.values.examination} onChange={(e) => form.setValue("examination", e.target.value)} />
                <Textarea name="diagnosis" label="Diagnosis / impression" required rows={2} disabled={readOnly} placeholder="Provisional or confirmed diagnosis" value={form.values.diagnosis} onChange={(e) => form.setValue("diagnosis", e.target.value)} error={form.errors.diagnosis} />
              </div>
            </FormSection>

            <FormSection title="Prescription" description="Add medicines with dosage, frequency and duration">
              <div className="mt-3 space-y-2">
                {rx.length === 0 && (
                  <p className="rounded-xl border border-dashed border-ink-200 px-4 py-6 text-center text-[12.5px] text-ink-400">
                    No medicines added yet{readOnly ? " — this record is locked." : "."}
                  </p>
                )}
                {rx.map((line, index) => (
                  <div key={line.id} className="grid gap-2 rounded-xl border border-ink-100 bg-ink-25/50 p-2.5 lg:grid-cols-[1.4fr_.8fr_1fr_.8fr_1.1fr_auto]">
                    <Input name={`m${index}`} label={index === 0 ? "Medicine" : undefined} placeholder="Paracetamol 650 mg" disabled={readOnly} value={line.medicine} onChange={(e) => setRx(rx.map((r) => (r.id === line.id ? { ...r, medicine: e.target.value } : r)))} />
                    <Input name={`d${index}`} label={index === 0 ? "Dosage" : undefined} placeholder="1 tablet" disabled={readOnly} value={line.dosage} onChange={(e) => setRx(rx.map((r) => (r.id === line.id ? { ...r, dosage: e.target.value } : r)))} />
                    <Input name={`f${index}`} label={index === 0 ? "Frequency" : undefined} placeholder="TID × 3 days" disabled={readOnly} value={line.frequency} onChange={(e) => setRx(rx.map((r) => (r.id === line.id ? { ...r, frequency: e.target.value } : r)))} />
                    <Input name={`dur${index}`} label={index === 0 ? "Duration" : undefined} placeholder="3 days" disabled={readOnly} value={line.duration} onChange={(e) => setRx(rx.map((r) => (r.id === line.id ? { ...r, duration: e.target.value } : r)))} />
                    <Input name={`i${index}`} label={index === 0 ? "Instructions" : undefined} placeholder="After meals" disabled={readOnly} value={line.instructions} onChange={(e) => setRx(rx.map((r) => (r.id === line.id ? { ...r, instructions: e.target.value } : r)))} />
                    {!readOnly && (
                      <div className="flex items-end">
                        <IconButton label="Remove medicine" size="sm" variant="ghost" className="mb-1 text-coral-500 hover:bg-coral-50" onClick={() => setRx(rx.filter((r) => r.id !== line.id))}>
                          <Trash2 />
                        </IconButton>
                      </div>
                    )}
                  </div>
                ))}
                {!readOnly && (
                  <Button size="sm" variant="outline" icon={<Plus />} onClick={() => setRx([...rx, { id: idGen("rx"), medicine: "", dosage: "", frequency: "", duration: "", instructions: "" }])}>
                    Add medicine
                  </Button>
                )}
              </div>
            </FormSection>

            <FormSection title="Plan & advice">
              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_13rem]">
                <Textarea name="advice" label="Advice & lifestyle guidance" rows={3} disabled={readOnly} placeholder="Diet, activity, red-flag symptoms, investigations advised…" value={form.values.advice} onChange={(e) => form.setValue("advice", e.target.value)} />
                <DatePicker label="Follow-up date" value={form.values.followUpDate} onChange={(v) => form.setValue("followUpDate", v)} disabled={readOnly} min={addDays(new Date(), 0)} />
              </div>
              <Textarea name="notes" label="Internal notes (not printed)" rows={2} className="mt-4" disabled={readOnly} placeholder="Referrals, coding notes, insurance remarks…" value={form.values.notes} onChange={(e) => form.setValue("notes", e.target.value)} />
            </FormSection>
          </Panel>

          {record.status === "Completed" && (
            <div className="flex items-center gap-2.5 rounded-xl border border-mint-500/25 bg-mint-50 px-4 py-3 text-[12.5px] font-medium text-mint-600">
              <CheckCheck className="size-4" />
              Signed off {record.endTime ? `at ${formatTime(record.endTime)}` : ""}. Editing is locked — reopen from the consultations list to amend.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-ink-400">{label}</span>
      <span className={cn("max-w-[62%] text-right font-medium", tone === "danger" ? "text-coral-600" : "text-ink-700")}>{value}</span>
    </div>
  );
}
