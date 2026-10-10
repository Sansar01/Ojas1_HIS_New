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

  /* ── Extended registration fields (all optional, Hospedia-style parity) ── */
  title?: string;
  middleName?: string;
  barcode?: string;
  countryCode?: string;
  permanentAddress?: string;
  idProofName?: string;
  idProofNo?: string;
  nationalId?: string;
  passportNo?: string;
  kraPin?: string;
  familyNumber?: string;
  staffId?: string;
  dependentId?: string;
  pregnancyDays?: number | string;
  occupation?: string;
  birthPlace?: string;
  religion?: string;
  locality?: string;
  membershipNo?: string;
  patientType?: string;
  source?: string;
  employeeReferenceId?: string;
  identityMark1?: string;
  identityMark2?: string;
  referenceType?: string;
  mlcType?: string;
  mlcNo?: string;
  isInternational?: boolean;
  internationalNo?: string;
  emergencyFirstName?: string;
  emergencyLastName?: string;
  emergencyRelation?: string;
  emergencyCountryCode?: string;
  emergencyMobile?: string;
  emergencyResidentNo?: string;
  emergencyAddress?: string;
  insuranceGroup?: string;
  insurance?: string;
  policyCardNo?: string;
  nameOnCard?: string;
  cardHolder?: string;
  approvalAmount?: number | string;
  approvalRemark?: string;
}
