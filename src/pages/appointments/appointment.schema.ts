import type { Schema } from "@/schemas/rules";

export const appointmentSchema = {
  patientId: [{ required: "Patient is required" }],
  doctorId: [{ required: "Doctor is required" }],
  type: [{ required: "Appointment Type is required" }],
  visitType: [{ required: "Visit Type is required" }],
  date: [{ required: "Date is required" }],
  time: [{ required: "Time slot is required" }],
} satisfies Schema;
