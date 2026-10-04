/* --------------------------------- profile --------------------------------- */

import {
  Emptyish,
  SectionPanel,
  PageIntro,
  DetailGrid,
} from "@/components/common";
import {
  Panel,
  Avatar,
  StatusBadge,
  Button,
  Badge,
} from "@/components/ui/primitives";
import { ListSkeleton, Skeleton } from "@/components/ui/feedback";
import { DataTable } from "@/components/ui/table";
import { usePermission } from "@/hooks";
import { useAppDispatch } from "@/store/hooks";
import { toast } from "@/store/slices/uiSlice";
import { Patient } from "@/types";
import { patientService } from "@/pages/patients/patient.service";
import { appointmentService } from "@/pages/appointments/appointment.service";
import { consultationService } from "@/pages/consultations/consultation.service";
import { doctorService } from "@/pages/doctors/doctor.service";
import { departmentService } from "@/pages/Departments/department.service";
import { billingService } from "@/pages/billing/billing.service";
import { fullName, formatDate, calcAge, formatMoney } from "@/utils";
import { cn } from "@/utils/cn";
import {
  UserRound,
  CalendarPlus,
  Receipt,
  FileText,
  Heart,
  Stethoscope,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

export function PatientDetailPage() {
  const dispatch = useAppDispatch();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { canCreate } = usePermission();
  const [tab, setTab] = useState("overview");

  /**
   * Everything this page renders is loaded here, through the feature services,
   * into local state. There is no shared cache and no bootstrap step: opening
   * the profile asks the backend for the patient plus the four collections the
   * tabs display, and nothing else.
   */
  const [patient, setPatient] = useState<Patient | undefined>(undefined);
  const [isLoadingPatient, setIsLoadingPatient] = useState(false);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  /** the patient record of this route */
  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      try {
        setIsLoadingPatient(true);
        const response = await patientService.fetchPatientById(id);
        const body: any = response.data ?? {};
        if (active && response.status === 200) {
          setPatient((body.data ?? body) as Patient);
        }
      } catch (e: any) {
        if (active) dispatch(toast.error("Could not load patient", e?.message));
      } finally {
        if (active) setIsLoadingPatient(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, dispatch]);

  /** the collections the tabs of this page render */
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
    let active = true;
    (async () => {
      try {
        const response = await consultationService.fetchConsultations();
        if (active && response.status === 200) {
          setConsultations(response.data?.data ?? []);
        }
      } catch (e: any) {
        dispatch(toast.error("Could not load consultations", e?.message));
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
        const response = await billingService.fetchInvoices();
        if (active && response.status === 200) {
          setInvoices(response.data?.data ?? []);
        }
      } catch (e: any) {
        dispatch(toast.error("Could not load invoices", e?.message));
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
        const response = await departmentService.fetchDepartments();
        if (active && response.status === 200) {
          setDepartments(response.data?.data ?? []);
        }
      } catch (e: any) {
        dispatch(toast.error("Could not load departments", e?.message));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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

  if (!patient && isLoadingPatient) {
    // Patient detail is this page's own data: skeleton, not a global loader.
    return (
      <div className="space-y-4">
        <SectionPanel title="Patient record" icon={<UserRound />}>
          <div className="flex items-center gap-4 py-2">
            <Skeleton className="size-14 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-2.5 w-64" />
            </div>
          </div>
        </SectionPanel>
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-ink-100 bg-white p-4"
            >
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-3.5 w-2/3" />
              <Skeleton className="mt-2 h-2.5 w-1/2" />
            </div>
          ))}
        </div>
        <SectionPanel title="Recent activity">
          <ListSkeleton rows={4} />
        </SectionPanel>
      </div>
    );
  }

  if (!patient) {
    return (
      <SectionPanel title="Patient not found" icon={<UserRound />}>
        <Emptyish onBack={() => navigate("/patients")} />
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
                    {(patient.chronicDiseases || "None reported")
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
                      onClick={() => navigate(`/consultations/${c.id}`)}
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
    </div>
  );
}
