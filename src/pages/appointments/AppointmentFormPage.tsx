import { useEffect, useState } from "react";
import { DatePicker, Input, Textarea } from "@/components/ui/fields";
import { Button } from "@/components/ui/primitives";
import { appointmentsApi, fetchDoctorSlots } from "@/features/slices";
import { useAppDispatch, useRootSelector } from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { addDays, fullName, formatDate, type SlotOption } from "@/utils";
import { Dialog } from "@/components/ui/overlays";
import { Select } from "@/components/ui/fields";
import { Badge } from "@/components/ui/primitives";
import { SlotPicker } from "./AppointmentsPage";
import { APPOINTMENT_TYPES, VISIT_TYPES, PRIORITY_OPTIONS } from "@/constants";

/** "HH:mm" → minutes since midnight */
const toMinutes = (t: string) => {
  const [h, m] = String(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Build the slot grid from the doctor availability API response, e.g.:
 * { doctorProfileId, slotDurationMins, bufferTimeMins,
 *   schedule: [{ dayOfWeek, isActive, startTime, endTime,
 *                breakStartTime, breakEndTime }] }
 * Slots are generated for the weekday matching the selected date, with the
 * break window marked unavailable and already-booked times marked booked.
 */
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

interface AppointmentFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** when set, the modal loads the record via appointments getById and saves edits instead of creating */
  editing?: any;
}

export function AppointmentFormModal({
  open,
  onOpenChange,
  editing = null,
}: AppointmentFormModalProps) {
  const dispatch = useAppDispatch();
  const isEdit = !!editing?.id;

  const patients = useRootSelector((s) => s.patients.items);
  const doctors = useRootSelector((s) => s.doctors.items);
  const departments = useRootSelector((s) => s.departments.items);
  const specializations = useRootSelector((s) => s.specializations.items);
  const existingAppointments = useRootSelector((s) => s.appointments.items);

  const form = useForm({
    initialValues: {
      patientId: "",
      doctorId: "",
      date: addDays(new Date(), 1),
      time: "",
      type: "",
      visitType: "",
      priority: "0",
      fee: 0,
      reasonForVisit: "",
      referredByDoctorName: "",
      referralNote: "",
      notes: "",
      reason: "",
    },
    schema: {
      patientId: [{ required: "Patient is required" }],
      doctorId: [{ required: "Doctor is required" }],
      type: [{ required: "Appointment Type is required" }],
      visitType: [{ required: "Visit Type is required" }],
      date: [{ required: "Date is required" }],
      time: [{ required: "Time slot is required" }],
    },
  });

  const doctor = doctors.find((d: any) => d.id === form.values.doctorId);

  /* --------------------- edit mode: load record by id --------------------- */
  const [editLoading, setEditLoading] = useState(false);
  // single appointments getById call — the patient/doctor lists are already in
  // the store from the page, so we don't re-fetch them here
  useEffect(() => {
    if (!open || !isEdit) return;
    let cancelled = false;
    setEditLoading(true);
    dispatch(appointmentsApi.thunks.getOne(editing.id) as any)
      .unwrap()
      .then((record: any) => {
        if (cancelled || !record) return;
        form.reset({
          patientId: record.patientId ?? "",
          doctorId: record.doctorId ?? "",
          date: record.date ?? addDays(new Date(), 1),
          time: record.time ?? "",
          type: record.raw?.appointmentType ?? record.type ?? "",
          visitType: record.raw?.visitType ?? record.visitType ?? "",
          priority: String(record.raw?.priority ?? (record.priority === "Urgent" ? 1 : 0)),
          fee: Number(record.fee ?? 0),
          reasonForVisit: record.reasonForVisit ?? "",
          referredByDoctorName: record.referredByDoctorName ?? "",
          referralNote: record.referralNote ?? "",
          notes: record.notes ?? "",
          reason: "",
        });
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setEditLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit]);

  /* default to the first active doctor once the doctors list arrives */
  // useEffect(() => {
  //   if (!form.values.doctorId) {
  //     const first = doctors.find((d: any) => d.isActive === true);
  //     if (first) form.setValue("doctorId", first.id, false);
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [doctors]);

  /* ------- runtime: doctor slot-by-id API whenever doctor/date changes ------ */
  const [slotLoading, setSlotLoading] = useState(false);
  const [remoteSlots, setRemoteSlots] = useState<SlotOption[] | null>(null);

  useEffect(() => {
    if (!form.values.doctorId) {
      setRemoteSlots(null);
      return;
    }
    let cancelled = false;
    setSlotLoading(true);
    setRemoteSlots(null);
    dispatch(
      fetchDoctorSlots({
        doctorId: form.values.doctorId,
        date: form.values.date,
      }) as any,
    )
      .unwrap()
      .then((data: any) => {
        if (!cancelled)
          setRemoteSlots(
            normalizeSlots(
              data,
              form.values.date,
              existingAppointments as any[],
              form.values.doctorId,
            ),
          );
      })
      .catch(() => {
        // fall back to schedule-generated slots on failure
        if (!cancelled) setRemoteSlots(null);
      })
      .finally(() => {
        if (!cancelled) setSlotLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.doctorId, form.values.date]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const doctorData = doctors.find((d: any) => d.id === values.doctorId);

    /* payload mirrors CreateAppointmentDto exactly */
    const payload = {
      patientId: values.patientId,
      doctorProfileId: values.doctorId,
      departmentId: doctorData?.departmentId
        ? Number(doctorData.departmentId)
        : undefined,
      appointmentDate: values.date, // "2025-06-10" (ISO date)
      slotStartTime: values.time, // "10:30" (HH:MM 24h)
      appointmentType: values.type,
      visitType: values.visitType,
      priority: Number(values.priority) || 0, // 0 Normal | 1 Urgent | 2 Emergency
      referredByDoctorName: values.referredByDoctorName?.trim() || undefined,
      referralNote: values.referralNote?.trim() || undefined,
      reasonForVisit: values.reasonForVisit?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
    };

    if (isEdit) {
      await dispatch(
        appointmentsApi.thunks.updateOne({
          id: editing.id,
          data: payload,
          successMessage: "Appointment updated successfully",
        } as any),
      );
    } else {
      await dispatch(
        appointmentsApi.thunks.createOne({
          data: payload,
          successMessage: "Appointment booked successfully",
        } as any),
      );
    }

    // re-sync the list from the API after create/update so the table reflects the change
    dispatch(appointmentsApi.thunks.fetchAll() as any);

    form.reset();
    onOpenChange(false);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) form.reset();
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
              options={patients
                .filter((p: any) => p.status === "ACTIVE")
                .map((p: any) => ({
                  value: p.id,
                  label: fullName(p),
                  description: p.mrn,
                }))}
            />

            <div>
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
                  description: specializations.find(
                    (s: any) => s.id === d.specializationId,
                  )?.name,
                  disabled: d.isActive !== true,
                }))}
              />
              {doctor && (
                <p className="mt-1 text-[12px] text-ink-500">
                  {
                    departments.find(
                      (dep: any) => dep.id === doctor.departmentId,
                    )?.name
                  }{" "}
                  · {doctor.slotDuration}m slots
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
                options={VISIT_TYPES.map((t) => ({ ...t }))}
              />
              <Select
                name="priority"
                label="Priority"
                value={form.values.priority}
                onChange={(v) => form.setValue("priority", v)}
                options={PRIORITY_OPTIONS.map((p) => ({ ...p }))}
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
                appointments={existingAppointments}
                value={form.values.time}
                onChange={(t) => form.setValue("time", t)}
                loading={slotLoading}
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
