/**
 * Appointment models — OPD booking, slot and queue token shapes.
 */

import type { ID, ISODate, ISODateTime } from "./commonTypes";
import type { Doctor } from "./doctorTypes";
import type { Patient } from "./patientTypes";

export type AppointmentStatus =
  | "Scheduled"
  | "Confirmed"
  | "Checked In"
  | "In Progress"
  | "Completed"
  | "Cancelled"
  | "No Show";

export interface OpdToken {
  tokenNumber: string | number;
  status?: string | null;
  estimatedTime?: string | null;
  roomNo?: string | number | null;
}

export interface Appointment {
  id: ID;
  code: string;
  patientId: ID;
  doctorId: ID;
  departmentId: ID;
  departmentName: string;
  specializationId: ID;
  date: ISODate;
  time: string; // "10:30"
  duration: number;
  type:
    | "Consultation"
    | "Follow-up"
    | "Procedure"
    | "Emergency"
    | "Telemedicine";
  fee: number;
  priority: "Routine" | "Urgent";
  status: AppointmentStatus;
  notes: string;
  createdAt: ISODateTime;
  bookedAt: ISODateTime;
  cancelledReason?: string;
  reasonForVisit?: string;
  slotEndTime?: string;
  referredByDoctorName?: string;
  cancelReason?: string;
  slotStartTime?: string;
  visitType: string;
  token?: OpdToken | string | null;
  patient: Patient;
  doctor: Doctor;
}
