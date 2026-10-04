/**
 * Doctor models — clinician profile, weekly schedule and onboarding payload.
 */

import type { ID, ISODate, ISODateTime, Status, Gender } from "./commonTypes";

export type ScheduleDay = {
  day: number;
  enabled: boolean;
  start: string;
  end: string;
  breakStartTime?: string;
  breakEndTime?: string;
};

export interface CreateDoctorPayload {
  hospitalUserId: string;
  specialization: string;
  qualifications: string;
  consultationFee: number;
  slotDurationMins: number;
  bufferTimeMins: number;
  maxPatientsPerDay: number;
  isActive: boolean;
}

export interface Doctor {
  id: ID;
  userId: ID | null;
  hospitalUserId: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  gender: Gender;
  dateOfBirth: ISODate;
  departmentId: ID;
  specializationId: ID;
  qualifications: string[];
  experienceYears: number;
  registrationNumber: string;
  consultationFee: number;
  slotDuration: number; // minutes
  specialization: string;
  bufferTime: number; // minutes
  maxPatientsPerDay: number;
  schedule: ScheduleDay[];
  about: string;
  mode: "In-clinic" | "Telemedicine" | "Both";
  status: Status;
  rating: number;
  joinedAt: ISODateTime;
}
