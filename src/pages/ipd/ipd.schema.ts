import type { Schema } from "@/schemas/rules";

export const admissionSchema = {
  patientId: [{ required: "Select the patient being admitted" }],
  doctorProfileId: [{ required: "Select the admitting doctor" }],
  admissionType: [{ required: "Select the admission type" }],
} satisfies Schema;

export const ADMISSION_LABELS = {
  patientId: "Patient",
  doctorProfileId: "Admitting doctor",
  admissionType: "Admission type",
} as const;

export const dischargeSchema = {
  dischargeType: [{ required: "Select the discharge type" }],
} satisfies Schema;

export const DISCHARGE_LABELS = { dischargeType: "Discharge type" } as const;
