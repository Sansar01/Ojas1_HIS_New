/**
 * Consultation models — OPD encounter, vitals and prescription lines.
 */

import type { ID, ISODate } from "./commonTypes";

export type ConsultationStatus =
  | "Scheduled"
  | "In Progress"
  | "Completed"
  | "Cancelled";

export interface PrescriptionLine {
  id: ID;
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface Consultation {
  id: ID;
  code: string;
  appointmentId: ID | null;
  patientId: ID;
  doctorId: ID;
  date: ISODate;
  startTime: string;
  endTime: string | null;
  chiefComplaint: string;
  symptoms: string;
  examination: string;
  diagnosis: string;
  notes: string;
  vitals: {
    bp: string;
    pulse: string;
    temp: string;
    spo2: string;
    weight: string;
  };
  prescriptions: PrescriptionLine[];
  advice: string;
  followUpDate: ISODate | null;
  status: ConsultationStatus;
}
