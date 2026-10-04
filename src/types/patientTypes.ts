/**
 * Patient model — OPD registration record.
 */

import type { ID, ISODate, ISODateTime, Status, Gender } from "./commonTypes";

export interface Patient {
  id: ID;
  uhid: ID;
  mrn: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  dateOfBirth: ISODate;
  ageUnit: "Years" | "Months" | "Days";
  mobile: string;
  altMobile?: string;
  email: string;
  bloodGroup: string;
  maritalStatus: "Single" | "Married" | "Divorced" | "Widowed";
  address: string;
  city: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  allergies: string;
  chronicDiseases: string;
  heightCm?: number;
  weightKg?: number;
  status: Status;
  createdAt: ISODateTime;
}
