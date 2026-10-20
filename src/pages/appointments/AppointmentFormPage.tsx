import { useEffect, useMemo, useState } from "react";
import { DatePicker, Input, Textarea, Select } from "@/components/ui/fields";
import { Button, Badge } from "@/components/ui/primitives";
import { appointmentService } from "@/pages/appointments/appointment.service";
import { doctorService } from "@/pages/doctors/doctor.service";
import { patientService } from "@/pages/patients/patient.service";
import { departmentService } from "@/pages/Departments/department.service";
import { consultationService } from "@/pages/consultations/consultation.service";
import { useAppDispatch } from "@/store/hooks";
import { toast } from "@/store/slices/uiSlice";
import { useForm } from "@/hooks/useForm";
import { appointmentSchema } from "@/pages/appointments/appointment.schema";
import {
  addDays,
  formatDate,
  patientOptionLabel,
  type SlotOption,
} from "@/utils";
import { Dialog } from "@/components/ui/overlays";
import { SlotPicker } from "./AppointmentsPage";
import { APPOINTMENT_TYPES, VISIT_TYPES } from "@/constants";

/** "HH:mm" → minutes since midnight */
const toMinutes = (t: string) => {
  const [h, m] = String(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

function normalizeSlots(
  data: any,
  date: string,
  appointments: any[] = [],
  doctorId?: string,
): SlotOption[] | null {
  const schedule = Array.isArray(data)
    ? data
    : (data?.schedule ?? data?.data?.schedule ?? null);
  if (!Array.isArray(schedule)) return null;

  const weekday = new Date(`${date}T00:00:00`).getDay();
  const day = schedule.find(
    (d: any) =>
      Number(d.dayOfWeek ?? d.day) === weekday &&
      (d.isActive ?? d.enabled ?? true),
  );
  if (!day || !day.startTime || !day.endTime) return [];

  const duration = Number(data?.slotDurationMins ?? 20);
  const buffer = Number(data?.bufferTimeMins ?? 0);
  const step = Math.max(5, duration + buffer);
  const start = toMinutes(day.startTime);
  const end = toMinutes(day.endTime);
  const breakStart = day.breakStartTime ? toMinutes(day.breakStartTime) : null;
  const breakEnd = day.breakEndTime ? toMinutes(day.breakEndTime) : null;

  const booked = new Set(
    appointments
      .filter(
        (a: any) =>
          a.doctorId === doctorId &&
          a.date === date &&
          !["Cancelled", "No Show"].includes(a.status),
      )
      .map((a: any) => toMinutes(a.time)),
  );

  const now = new Date();
  const isToday = date === now.toISOString().slice(0, 10);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const slots: SlotOption[] = [];
  for (let m = start; m + duration <= end; m += step) {
    const time = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const inBreak =
      breakStart != null && breakEnd != null && m >= breakStart && m < breakEnd;
    const past = isToday && m < nowMin;
    const isBooked = booked.has(m);
    const state: SlotOption["state"] = isBooked
      ? "booked"
      : inBreak
        ? "unavailable"
        : past
          ? "past"
          : "available";
    slots.push({
      time,
      minute: m,
      state,
      label: isBooked
        ? "Booked"
        : inBreak
          ? "Break"
          : past
            ? "Elapsed"
            : "Open",
    });
  }
  return slots;
}

/**
 * Fallback slot grid — when the doctor availability endpoint cannot serve a
 * usable schedule (unavailable, empty or no clinic hours), generate an OPEN
 * 09:00 → 17:00 grid at the doctor's slot duration (default 15 min). The
 * normalizer is reused so booked-conflict / elapsed-slot logic stays identical.
 */
const toFallbackSlots = (
  date: string,
  durationMins: number,
  appointments: any[] = [],
  doctorId?: string,
): SlotOption[] =>
  normalizeSlots(
    {
      // synthetic clinic day: 09:00 → 17:00, no break
      schedule: [
        {
          dayOfWeek: new Date(`${date}T00:00:00`).getDay(),
          isActive: true,
          startTime: "09:00",
          endTime: "17:00",
        },
      ],
      slotDurationMins: Math.min(120, Math.max(5, Number(durationMins) || 15)),
    },
    date,
    appointments,
    doctorId,
  ) ?? [];

/** Booking DTO priority values — strings ("ROUTINE" | "URGENT" | "EMERGENCY"). */
export const PRIORITY_SELECT = [
  { value: "ROUTINE", label: "Routine" },
  { value: "URGENT", label: "Urgent" },
  { value: "EMERGENCY", label: "Emergency" },
] as const;

/** Legacy numeric/labelled priorities → booking DTO strings (edit mode). */
const normalizePriority = (raw: unknown): string => {
  const map: Record<string, string> = {
    "0": "ROUTINE",
    "1": "URGENT",
    "2": "EMERGENCY",
    ROUTINE: "ROUTINE",
    URGENT: "URGENT",
    EMERGENCY: "EMERGENCY",
    ROUTINE_: "ROUTINE",
  };
  const str = String(raw ?? "").toUpperCase();
  return ["ROUTINE", "URGENT", "EMERGENCY"].includes(str)
    ? str
    : (map[str] ?? "ROUTINE");
};

interface AppointmentFormModalProps {  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** when set, the modal loads the record via appointments getById and saves edits instead of creating */
  editing?: any;
  /** called after a successful save so the page can refresh its own list */
  onSaved?: () => void;
}

/**
 * Create / reschedule appointment.
 *
 * The modal is self-contained: while it is open it loads exactly the data the
 * booking workflow needs — patients and doctors for the dropdowns, the clinic
 * lists for the context line, the existing appointments for slot conflicts,
 * the visit-type master dropdown, and the doctor's available slots whenever the
 * doctor or the date changes. Everything is local state; nothing is dispatched
 * to a store and nothing is preloaded before the user opens the form.
 */
export function AppointmentFormModal({
  open,
  onOpenChange,
  editing = null,
  onSaved,
}: AppointmentFormModalProps) {
  const dispatch = useAppDispatch();
  const isEdit = !!editing?.id;

  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  /** patient Select options — rebuilt only when the list changes, not on every keystroke of the form */
  const patientOptions = useMemo(
    () =>
      patients
        .filter((p: any) => Boolean(p.id))
        .map((p: any) => ({
          value: p.id,
          label: `${p.firstName ?? ""} ${p.lastName || ""}`.trim() || "Patient",
          description:
            [
              (p.gender ?? "").toLowerCase(),
              p.mobile ?? p.mobilePhone,
              p.age !== undefined && p.age !== null
                ? `${p.age}${p.ageUnit ?? ""}`
                : undefined,
            ]
              .filter(Boolean)
              .join(" · ") || undefined,
          data: p,
        })),
    [patients],
  );

  /** doctor Select options — rebuilt only when the list changes, not on every keystroke of the form */
  const doctorOptions = useMemo(
    () =>
      doctors.map((d: any) => {
        const name = [d.user?.firstName ?? d.firstName, d.user?.lastName ?? d.lastName]
          .filter(Boolean)
          .join(" ");
        const dept =
          d.clinicalDepartment?.name ?? d.specialization ?? undefined;
        return {
          value: d.id,
          label: `Dr. ${name} - ${dept ?? "General"}`,
          description:
            Number(d.consultationFee) > 0
              ? `₹${Number(d.consultationFee)} · ${Number(d.slotDurationMins ?? d.slotDuration ?? 15)}m slots`
              : undefined,
          disabled: d.isActive === false,
        };
      }),
    [doctors],
  );
  // slot-conflict source for the picker below — loaded lazily, only once the
  // doctor/date pair makes the slot picker relevant (see the effect below)
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  // visit types come from the CONSULTATION_TYPE master dropdown
  const [visitTypes, setVisitTypes] = useState<any[]>([]);

  /**
   * One loading flag per dropdown (doc: loading-owned-by-context).
   * The pickers below render their own indicator from these — never the global
   * loader — so the rest of the dialog stays usable while a list is in flight.
   */
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [visitTypesLoading, setVisitTypesLoading] = useState(false);
  /** the appointment list behind the slot states (see below) */
  const [slotsSourceLoading, setSlotsSourceLoading] = useState(false);

  const [appointmentsRequested, setAppointmentsRequested] = useState(false);

  /** the reference lists this dialog needs — requested when it opens */
  useEffect(() => {
    if (!open) return;
    let active = true;

    const noopFlag = () => {};
    const load = async (
      request: Promise<any>,
      apply: (rows: any[]) => void,
      setFlag: (v: boolean) => void,
    ) => {
      setFlag(true);
      try {
        const response = await request;
        if (active && response?.status === 200)
          apply(response.data?.data ?? []);
      } catch (e: any) {
        dispatch(toast.error("Could not load options", e?.message));
      } finally {
        if (active) setFlag(false);
      }
    };

    setAppointmentsRequested(false);

    // independent reference lists → one round of parallel requests
    void Promise.all([
      load(patientService.fetchPatients(), setPatients, setPatientsLoading),
      load(doctorService.fetchDoctors(), setDoctors, setDoctorsLoading),
      // departments are not an input of this dialog — the list only resolves
      // the doctor hint below, so it needs no own loading flag
      load(departmentService.fetchDepartments(), setDepartments, noopFlag),
      load(
        appointmentService.fetchConsultationTypes(),
        setVisitTypes,
        setVisitTypesLoading,
      ),
    ]);

    return () => {
      active = false;
    };
  }, [open]);

  const form = useForm({
    initialValues: {
      patientId: "",
      doctorId: "",
      date: addDays(new Date(), 1),
      time: "",
      type: "",
      visitType: "",
      priority: "ROUTINE",
      fee: 0,
      reasonForVisit: "",
      referredByDoctorName: "",
      referralNote: "",
      notes: "",
      reason: "",
    },
    schema: appointmentSchema,
  });

  /** doctor list + the selected doctor, resolved once per roster/selection */
  const doctorById = useMemo(() => {
    const map = new Map<string, any>();
    for (const d of doctors as any[]) map.set(d.id, d);
    return map;
  }, [doctors]);

  const doctor = doctorById.get(form.values.doctorId);

  /* ------- visit type options from the CONSULTATION_TYPE dropdown API ------ */
  /**
   * Derived from `visitTypes` during render (memoized) instead of being copied
   * into state by an effect: the effect version rendered the dialog once with
   * an empty list and again with the options, and kept a second copy of data
   * that the page already had.
   */
  const visitTypeOptions = useMemo<{ value: string; label: string }[]>(
    () =>
      (visitTypes ?? [])
        .map((item: any) => ({
          value: item.value,
          label: String(item.value)
            .replace(/_/g, " ")
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase()),
        }))
        .filter((o) => o.value),
    [visitTypes],
  );

  /* --------------------- edit mode: load record by id --------------------- */
  const [, setEditLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // single appointments getById call — the patient/doctor lists are already in
  // the store from the page, so we don't re-fetch them here
  useEffect(() => {
    if (!open || !isEdit) return;
    let cancelled = false;
    setEditLoading(true);
    (async () => {
      try {
        const response = await appointmentService.fetchAppointmentById(
          editing.id,
        );
        const body: any = response.data ?? {};
        const record: any =
          response.status === 200 ? (body.data ?? body) : null;
        if (cancelled || !record) return;
        form.reset({
          patientId: record.patientId ?? "",
          doctorId: record.doctorId ?? "",
          date: record.date ?? addDays(new Date(), 1),
          time: record.time ?? "",
          type: record.raw?.appointmentType ?? record.type ?? "",
          visitType: record.raw?.visitType ?? record.visitType ?? "",
          priority: normalizePriority(
            record.raw?.priority ?? record.priority,
          ),
          fee: Number(record.fee ?? 0),
          reasonForVisit: record.reasonForVisit ?? "",
          referredByDoctorName: record.referredByDoctorName ?? "",
          referralNote: record.referralNote ?? "",
          notes: record.notes ?? "",
          reason: "",
        });
      } catch (e: any) {
        if (!cancelled)
          dispatch(toast.error("Could not load appointment", e?.message));
      } finally {
        if (!cancelled) setEditLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit]);

  /**
   * The appointment list is NOT a reference list for this dialog: opening the
   * modal must not fetch it. It is only needed once the slot picker can show
   * something — i.e. when a doctor and a date are chosen — and even then it is
   * requested once, not per re-render.
   */
  useEffect(() => {
    if (!open || appointmentsRequested) return;
    if (!form.values.doctorId || !form.values.date) return;

    setAppointmentsRequested(true);
    setSlotsSourceLoading(true);
    (async () => {
      try {
        const response = await appointmentService.fetchAppointments();
        if (response.status === 200) {
          setExistingAppointments(response.data?.data ?? []);
        }
      } catch (e: any) {
        dispatch(toast.error("Could not load booked slots", e?.message));
      } finally {
        // cleared by the run itself, never from a cleanup: setting
        // `appointmentsRequested` above re-runs this effect and the re-run
        // returns early, so a cleanup-guarded clear would strand the spinner
        // over the slot grid forever
        setSlotsSourceLoading(false);
      }
    })();
  }, [
    open,
    appointmentsRequested,
    form.values.doctorId,
    form.values.date,
    dispatch,
  ]);

  /* ------- runtime: doctor slot-by-id API whenever doctor/date changes ------ */
  const [slotLoading, setSlotLoading] = useState(false);
  const [remoteSlots, setRemoteSlots] = useState<SlotOption[] | null>(null);

  useEffect(() => {
    if (!form.values.doctorId) {
      // no doctor (yet) → nothing to show, and the spinner of a cancelled run
      // must not be left behind
      setRemoteSlots(null);
      setSlotLoading(false);
      return;
    }
    let cancelled = false;
    setSlotLoading(true);
    setRemoteSlots(null);
    (async () => {
      // Reference data for the fallback: the selected doctor's slot length.
      const selectedDoctor: any = doctors.find(
        (d: any) => d.id === form.values.doctorId,
      );
      const duration = Number(
        selectedDoctor?.slotDurationMins ?? selectedDoctor?.slotDuration ?? 15,
      );
      try {
        const response = await doctorService.fetchDoctorSlots(
          form.values.doctorId,
          form.values.date,
        );
        // this endpoint answers with the payload itself —
        // { schedule, slotDurationMins, bufferTimeMins } — so unwrap `data`
        // only when the response really is wrapped
        const body: any = response.data ?? {};
        const normalized = normalizeSlots(
          body.data ?? body,
          form.values.date,
          existingAppointments as any[],
          form.values.doctorId,
        );
        if (!cancelled) {
          // a usable schedule (an active clinic day) → live slots; anything
          // else (endpoint unavailable / closed / no shape) → fallback grid
          setRemoteSlots(normalized && normalized.length ? normalized : null);
          if (!normalized || !normalized.length)
            setRemoteSlots(toFallbackSlots(
              form.values.date,
              duration,
              existingAppointments as any[],
              form.values.doctorId,
            ));
        }
      } catch (e: any) {
        // availability endpoint unreachable → spec: generate an OPEN 09:00–17:00
        // grid from the doctor's slot duration; booking must stay possible
        if (!cancelled)
          setRemoteSlots(
            toFallbackSlots(
              form.values.date,
              duration,
              existingAppointments as any[],
              form.values.doctorId,
            ),
          );
      } finally {
        if (!cancelled) setSlotLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.doctorId, form.values.date]);

  const handleSubmit = form.handleSubmit(async (values) => {
    /* Booking payload — mirrors CreateAppointmentDto exactly (strict whitelist):
       • the doctor travels as `doctorProfileId` (the doctor-profile UUID)
       • `slotStartTime` carries the chosen slot ("09:15", HH:MM 24h)
       • priority is an integer (0 Normal | 1 Urgent | 2 Emergency)
       • `consultationFee` is NOT accepted here — the fee belongs to billing;
         the referrer text travels as `referredByDoctorName` / `referralNote`. */
    const selectedDoctorProfile: any = doctors.find(
      (d: any) => d.id === values.doctorId,
    );
    const numericDeptId = Number(selectedDoctorProfile?.departmentId);
    const payload = {
      patientId: values.patientId,
      doctorProfileId: values.doctorId,
      departmentId:
        selectedDoctorProfile?.departmentId && Number.isFinite(numericDeptId)
          ? numericDeptId
          : undefined,
      appointmentDate: String(values.date).slice(0, 10), // "2026-10-17" (ISO date)
      slotStartTime: values.time, // "09:15" (HH:MM 24h)
      appointmentType: values.type || "WALK_IN",
      visitType: values.visitType || "NEW_VISIT",
      priority:
        values.priority === "EMERGENCY"
          ? 2
          : values.priority === "URGENT"
            ? 1
            : 0,
      referredByDoctorName: values.referredByDoctorName?.trim() || undefined,
      referralNote: values.referralNote?.trim() || undefined,
      reasonForVisit: values.reasonForVisit?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
    };
    try {
      let appointmentId: string | undefined;
      let savedToken: string | number | undefined;

      /** "Token #12" style suffix for the success toast. */
      const pickToken = (saved: any) =>
        saved?.tokenNumber ??
        saved?.token?.tokenNumber ??
        saved?.appointmentNumber ??
        saved?.code;

      // 1. Create or Update Appointment
      if (isEdit) {
        const result = await appointmentService.updateAppointment(
          editing.id,
          payload,
        );
        const body: any = result.data ?? {};
        const saved: any = body.data ?? body;
        dispatch(toast.success("Appointment updated successfully"));
        appointmentId = saved?.id ?? editing.id;
      } else {
        const result = await appointmentService.createAppointment(payload);
        const body: any = result.data ?? {};
        const saved: any = body.data ?? body;
        appointmentId = saved?.id;
        savedToken = pickToken(saved);
        dispatch(
          toast.success(
            `Appointment Booked Successfully!${savedToken ? ` token${savedToken}` : ""}`,
            "The visit now appears in the appointment list.",
          ),
        );
      }

      // 2. Post-Booking Chain — auto-token for walk-ins the API did not
      //    already enqueue on booking
      const isWalkIn =
        String(values.visitType).toUpperCase() === "WALK_IN" ||
        String(values.type).toUpperCase() === "WALK_IN";

      if (isWalkIn && appointmentId && !savedToken) {
        const tokenResponse =
          await consultationService.generateOpdToken(appointmentId);
        if (tokenResponse.status === 200) {
          const tokenBody: any = tokenResponse.data ?? {};
          const tokenNumber =
            tokenBody?.tokenNumber ?? tokenBody?.data?.tokenNumber ?? savedToken;
          if (tokenNumber) savedToken = tokenNumber;
          dispatch(
            toast.success(
              "Token Generated Successfully",
              tokenNumber ? `Token #${tokenNumber}` : undefined,
            ),
          );
        }
      }

      // 3. Success → close the form and let the page refresh its own list
      onSaved?.();
      form.reset();
      onOpenChange(false);
    } catch (err: any) {
      // graceful failure: keep the modal open so the user can correct & retry
      const message = err?.message ?? "Please try again";
      dispatch(toast.error(isEdit ? "Update failed" : "Booking failed", message));
      setSubmitError(message);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          form.reset();
          setSubmitError(null);
        }
        onOpenChange(v);
      }}
      title={isEdit ? "Edit Appointment" : "Book New Appointment"}
      description={
        isEdit
          ? "Update the patient, doctor, and slot details."
          : "Fill in the patient, doctor, and slot details."
      }
      size="xl"
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="appointment-new-form"
            loading={form.submitting}
          >
            {isEdit ? "Save Changes" : "Book Appointment"}
          </Button>
        </>
      }
    >
      <form
        id="appointment-new-form"
        onSubmit={handleSubmit}
        className="space-y-8"
      >
        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-coral-200 bg-coral-50 px-3.5 py-2.5 text-[12.5px] font-medium text-coral-700"
          >
            <span className="mt-0.5">⚠</span>
            <span className="flex-1">{submitError}</span>
            <button
              type="button"
              onClick={() => setSubmitError(null)}
              className="text-coral-500 hover:text-coral-700"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
              PATIENT &amp; CLINICIAN
            </span>
            <div className="h-px flex-1 bg-ink-100" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Select
              name="patientId"
              label="Patient"
              required
              value={form.values.patientId}
              onChange={(v) => form.setValue("patientId", v)}
              error={form.errors.patientId}
              placeholder="Search registered patients..."
              loading={patientsLoading}
              loadingLabel="Searching patients…"
              options={patientOptions}
              getOptionLabel={patientOptionLabel}
            />

            <div>
              <Select
                name="doctorId"
                label="Doctor"
                required
                value={form.values.doctorId}
                onChange={(v) => {
                  form.setValue("doctorId", v);
                  // Spec: selecting a doctor auto-populates the fee
                  const selected: any = doctors.find((d: any) => d.id === v);
                  const fee = Number(selected?.consultationFee ?? 0);
                  if (fee > 0) form.setValue("fee", fee);
                }}
                error={form.errors.doctorId}
                loading={doctorsLoading}
                loadingLabel="Loading doctors…"
                options={doctorOptions}
              />
              {doctor && (
                <p className="mt-1 text-[12px] text-ink-500">
                  {doctor.clinicalDepartment?.name ??
                    departments.find(
                      (dep: any) => dep.id === doctor.departmentId,
                    )?.name ??
                    "—"}{" "}
                  ·{" "}
                  {Number(doctor.slotDurationMins ?? doctor.slotDuration ?? 15)}
                  m slots · fee ₹{Number(doctor.consultationFee ?? 0)}
                </p>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
              DATE &amp; SLOT
            </span>
            <div className="h-px flex-1 bg-ink-100" />
          </div>

          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div className="space-y-4">
              <DatePicker
                label="Appointment date"
                required
                value={form.values.date}
                onChange={(v) => form.setValue("date", v)}
                error={form.errors.date}
                min={addDays(new Date(), 0)}
              />
              <Select
                name="type"
                label="Appointment type"
                required
                value={form.values.type}
                error={form.errors.type}
                onChange={(v) => form.setValue("type", v)}
                options={APPOINTMENT_TYPES.map((t) => ({ ...t }))}
              />
              <Select
                name="visitType"
                label="Visit type"
                required
                value={form.values.visitType}
                error={form.errors.visitType}
                onChange={(v) => form.setValue("visitType", v)}
                loading={visitTypesLoading}
                loadingLabel="Loading consultation types…"
                options={
                  visitTypeOptions.length
                    ? visitTypeOptions
                    : VISIT_TYPES.map((t) => ({ ...t }))
                }
              />
              <Select
                name="priority"
                label="Priority"
                value={
                  PRIORITY_SELECT.some((p) => p.value === form.values.priority)
                    ? form.values.priority
                    : "ROUTINE"
                }
                onChange={(v) => form.setValue("priority", v)}
                options={PRIORITY_SELECT.map((p) => ({ ...p }))}
              />
              <Input
                name="fee"
                label="Consultation Fee"
                type="number"
                prefix="₹"
                value={String(form.values.fee)}
                onChange={(e) => form.setValue("fee", Number(e.target.value))}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12.5px] font-medium text-ink-600">
                  Available slots ·{" "}
                  {formatDate(form.values.date, {
                    weekday: "long",
                    day: "2-digit",
                    month: "short",
                  })}
                </p>
                {doctor && (
                  <Badge tone="mint" size="xs">
                    {form.values.time ? "1 selected" : "Open slots"}
                  </Badge>
                )}
              </div>
              <SlotPicker
                doctorId={form.values.doctorId}
                date={form.values.date}
                doctors={doctors}
                appointments={existingAppointments}
                value={form.values.time}
                onChange={(t) => form.setValue("time", t)}
                loading={slotLoading || slotsSourceLoading}
                remoteSlots={remoteSlots}
              />
              {form.errors.time && (
                <p className="mt-1.5 text-[11.5px] font-medium text-coral-600">
                  {form.errors.time}
                </p>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
              REFERRAL &amp; PATIENT INPUT
            </span>
            <div className="h-px flex-1 bg-ink-100" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Input
              name="reasonForVisit"
              label="Reason for visit"
              placeholder="e.g. Chest pain since two days"
              value={form.values.reasonForVisit}
              onChange={(e) => form.setValue("reasonForVisit", e.target.value)}
            />
            <Input
              name="referredByDoctorName"
              label="Referred by (doctor name)"
              placeholder="Optional — Dr. who referred this patient"
              value={form.values.referredByDoctorName}
              onChange={(e) =>
                form.setValue("referredByDoctorName", e.target.value)
              }
            />
            <Textarea
              name="referralNote"
              label="Referral note"
              rows={2}
              placeholder="Optional — referral details"
              value={form.values.referralNote}
              onChange={(e) => form.setValue("referralNote", e.target.value)}
            />
          </div>
        </div>

        <Textarea
          name="notes"
          label="Notes"
          rows={3}
          value={form.values.notes}
          onChange={(e) => form.setValue("notes", e.target.value)}
        />
      </form>
    </Dialog>
  );
}
