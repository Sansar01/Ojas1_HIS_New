/* ---------------------------------------------------------------------------
 * Global domain types for the Meridian Care Hospital Management Portal
 * ------------------------------------------------------------------------- */

import { Entitlements } from "./entitlement";

export type ID = string;
export type ISODate = string; // yyyy-MM-dd
export type ISODateTime = string;

export type Permission = "view" | "create" | "edit" | "delete";

export type ModuleKey =
  | "dashboard"
  | "users"
  | "roles"
  | "patients"
  | "doctors"
  | "departments"
  | "specializations"
  | "appointments"
  | "consultations"
  | "billing"
  | "settings";

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  path: string;
  icon: string; // lucide icon name resolved in constants
  group: "Clinical" | "Operations" | "Access" | "Insights";
  description: string;
}

export type Status = "active" | "inactive";
export type Gender = "Male" | "Female" | "Other";

export interface Role {
  id: ID;
  name: string;
  slug:
    | "SUPER_ADMIN"
    | "ADMIN"
    | "DOCTOR"
    | "RECEPTIONIST"
    | "BILLING"
    | string;
  description: string;
  system: boolean;
  userCount?: number;
  permissions: Record<string, Permission[]>; // moduleId -> actions
  createdAt: ISODateTime;
}

export interface User {
  id: ID;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  roleId: ID;
  role: string; // denormalised label
  status: Status;
  gender: Gender;
  dateOfBirth: ISODate;
  password?: string;
  modules: ModuleKey[];
  permissions: Partial<Record<ModuleKey, Permission[]>>;
  title?: string;
  lastLogin: ISODateTime | null;
  createdAt: ISODateTime;
  color: string;
  userType:
    | "SUPER_ADMIN"
    | "ADMIN"
    | "DOCTOR"
    | "RECEPTIONIST"
    | "BILLING_STAFF"
    | string;
}

export interface Department {
  id: ID;
  name: string;
  code: string;
  description: string;
  headDoctorId: ID | null;
  floor: string;
  status: Status;
  createdAt: ISODateTime;
}

export interface Specialization {
  id: ID;
  name: string;
  code: string;
  departmentId: ID;
  description: string;
  status: Status;
  createdAt: ISODateTime;
}

export interface ScheduleDay {
  day: number; // 0 = Sunday
  enabled: boolean;
  start: string; // "09:00"
  end: string; // "17:00"
}

export interface Doctor {
  id: ID;
  userId: ID | null;
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
  bufferTime: number; // minutes
  maxPatientsPerDay: number;
  schedule: ScheduleDay[];
  about: string;
  mode: "In-clinic" | "Telemedicine" | "Both";
  status: Status;
  rating: number;
  joinedAt: ISODateTime;
}

export interface Patient {
  id: ID;
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
  chronicConditions: string;
  heightCm?: number;
  weightKg?: number;
  status: Status;
  createdAt: ISODateTime;
}

export type AppointmentStatus =
  | "Scheduled"
  | "Confirmed"
  | "Checked In"
  | "In Progress"
  | "Completed"
  | "Cancelled"
  | "No Show";

export interface Appointment {
  id: ID;
  code: string;
  patientId: ID;
  doctorId: ID;
  departmentId: ID;
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
  cancelledReason?: string;
}

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

export type PaymentStatus =
  | "Pending"
  | "Partially Paid"
  | "Paid"
  | "Cancelled"
  | "Refunded";

export interface InvoiceItem {
  id: ID;
  description: string;
  category:
    | "Consultation"
    | "Procedure"
    | "Lab"
    | "Pharmacy"
    | "Room & Board"
    | "Service"
    | "Other";
  quantity: number;
  unitPrice: number;
}

export interface Payment {
  id: ID;
  date: ISODate;
  amount: number;
  method: "Cash" | "Card" | "UPI" | "Insurance" | "Bank Transfer" | "Wallet";
  reference: string;
  note: string;
}

export interface Invoice {
  id: ID;
  number: string;
  patientId: ID;
  doctorId: ID | null;
  consultationId: ID | null;
  date: ISODate;
  dueDate: ISODate;
  items: InvoiceItem[];
  discountType: "Flat" | "Percent";
  discountValue: number;
  taxRate: number;
  payments: Payment[];
  paymentStatus: PaymentStatus;
  notes: string;
  insurance?: string;
  createdAt: ISODateTime;
}

export interface ActivityLog {
  id: ID;
  userName: string;
  action: string;
  entity: string;
  entityName: string;
  at: ISODateTime;
  tone: "brand" | "amber" | "coral" | "mint" | "lagoon";
}

export interface HospitalInfo {
  name: string;
  tagline: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  taxId: string;
  currency: string;
  currencySymbol: string;
  invoicePrefix: string;
  defaultTaxRate: number;
  timezone: string;
  licenseNo: string;
}

/* ---------------------------- API envelope ------------------------------- */

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface ListQuery {
  search?: string;
  filters?: Record<string, string>;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Session {
  accessToken: string;
  user: User;
  role: Role;
  expiresAt: ISODateTime;
  entitlements: Entitlements;
}
