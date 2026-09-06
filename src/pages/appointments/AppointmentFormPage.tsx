import { useNavigate } from "react-router-dom";
import { useAppDispatch, useRootSelector } from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { useState, useEffect } from "react";
import { appointmentsApi, departmentsApi } from "@/features/slices";
import { PageIntro } from "@/components/common";
import { Input, Select, DatePicker, Textarea } from "@/components/ui/fields";
import { Button, Badge } from "@/components/ui/primitives";
import { addDays } from "@/data/db";
import { fullName, formatDate } from "@/utils";
import { SlotPicker } from "./AppointmentsPage";

export function AppointmentFormPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const patients = useRootSelector((s) => s.patients.items);
  const doctors = useRootSelector((s) => s.doctors.items);
  const departments = useRootSelector((s) => s.departments.items);
  const specializations = useRootSelector((s) => s.specializations.items);
  const existingAppointments = useRootSelector((s) => s.appointments.items);
  const departmentsFetchedRef = useState(() => ({ current: false }))[0];

  useEffect(() => {
    if (departmentsFetchedRef.current) return;
    departmentsFetchedRef.current = true;
    dispatch(departmentsApi.thunks.fetchAll() as any);
  }, [departmentsFetchedRef, dispatch]);

  const form = useForm({
    initialValues: {
      patientId: "",
      doctorId: "",
      departmentId: "",
      date: addDays(new Date(), 1),
      time: "",
      type: "Consultation",
      priority: "Routine",
      fee: 0,
      notes: "",
    },
    schema: {
      patientId: [{ required: "Patient is required" }],
      doctorId: [{ required: "Doctor is required" }],
      date: [{ required: "Date is required" }],
      time: [{ required: "Time slot is required" }],
    },
  });

  const doctor = doctors.find((d: any) => d.id === form.values.doctorId);

  const handleSubmit = form.handleSubmit(async (values) => {
    const doctorData = doctors.find((d: any) => d.id === values.doctorId);

    const payload = {
      patientId: values.patientId,
      doctorId: values.doctorId,
      departmentId: doctorData?.departmentId || "",
      specializationId: doctorData?.specializationId || "",
      date: values.date,
      time: values.time,
      duration: doctorData?.slotDuration || 20,
      type: values.type,
      priority: values.priority,
      fee: Number(values.fee),
      notes: values.notes,
      status: "Scheduled",
    };

    await dispatch(
      appointmentsApi.thunks.createOne({
        data: {
          ...payload,
          code: `APT-${9000 + Math.floor(Math.random() * 9999)}`,
          createdAt: new Date().toISOString(),
        },
        successMessage: "Appointment booked successfully",
      } as any),
    ).unwrap();

    navigate("/appointments");
  });

  return (
    <div className="max-w-6xl mx-auto">
      <PageIntro
        title="Book New Appointment"
        description="Fill in the patient, doctor, and slot details."
        back
      />

      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Patient & Clinician Section */}
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
                  .filter((p: any) => p.status === "active")
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
                    disabled: d.status !== "active",
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
              <div>
                <Select
                  name="department"
                  label="Department"
                  placeholder="Select department"
                  value={form.values.departmentId}
                  onChange={(value) => form.setValue("departmentId", value)}
                  options={departments.map((department) => ({
                    value: String(department.id),
                    label: department.name,
                  }))}
                />
              </div>
            </div>
          </div>

          {/* Date & Slot Section */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                DATE &amp; SLOT
              </span>
              <div className="h-px flex-1 bg-ink-100" />
            </div>

            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
              {/* Left Side - Date & Type */}
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
                  value={form.values.type}
                  onChange={(v) => form.setValue("type", v)}
                  options={[
                    { value: "Consultation", label: "Consultation" },
                    { value: "Follow-up", label: "Follow-up" },
                    { value: "Procedure", label: "Procedure" },
                    { value: "Emergency", label: "Emergency" },
                    { value: "Telemedicine", label: "Telemedicine" },
                  ]}
                />
              </div>

              {/* Right Side - Slots */}
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
                />

                {form.errors.time && (
                  <p className="mt-1.5 text-[11.5px] font-medium text-coral-600">
                    {form.errors.time}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Additional Fields */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Select
              name="priority"
              label="Priority"
              value={form.values.priority}
              onChange={(v) => form.setValue("priority", v)}
              options={[
                { value: "Routine", label: "Routine" },
                { value: "Urgent", label: "Urgent" },
              ]}
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
            <Textarea
              name="notes"
              label="Notes"
              rows={3}
              value={form.values.notes}
              onChange={(e) => form.setValue("notes", e.target.value)}
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4 border-t border-ink-100">
            <Button type="submit" loading={form.submitting}>
              Book Appointment
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
