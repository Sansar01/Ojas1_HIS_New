/**
 * IPD feature types — local to the IPD module.
 *
 * Deliberately NOT added to the shared `@/types` barrel: the IPD domain is new
 * and still growing (vitals / rounds / billing types will land here as their
 * endpoints ship). Keeping them beside the screens that use them means no
 * existing shared type is touched by this feature.
 *
 * Every shape below mirrors what today's backend actually returns
 * (`src/hospital/ipd/admission` + `src/hospital/masters/ward-room`), NOT the
 * planned endpoints. Decimal columns arrive from Prisma as strings — all money
 * fields are typed `number | string | null` and read through `num()`.
 */

/* ------------------------------- admissions ------------------------------- */

export const IPD_ADMISSION_TYPES = [
  "EMERGENCY",
  "PLANNED",
  "TRANSFER",
  "DAYCARE",
] as const;
export type IpdAdmissionType = (typeof IPD_ADMISSION_TYPES)[number];

export const IPD_ADMISSION_STATUSES = [
  "ADMITTED",
  "DISCHARGE_ORDERED",
  "DISCHARGED",
  "CANCELLED",
] as const;
export type IpdAdmissionStatus = (typeof IPD_ADMISSION_STATUSES)[number];

export const IPD_DISCHARGE_TYPES = [
  "NORMAL",
  "LAMA",
  "TRANSFERRED",
  "EXPIRED",
] as const;
export type IpdDischargeType = (typeof IPD_DISCHARGE_TYPES)[number];

/** Patient slice the admission endpoints embed. */
export interface IpdPatientRef {
  id: string;
  uhid: string;
  firstName: string;
  lastName: string | null;
  gender: string;
  mobile: string | null;
  dateOfBirth: string | null;
  ageAtRegistration: number | null;
  ageUnit: string | null;
}

/** Doctor slice the admission endpoints embed. */
export interface IpdDoctorRef {
  id: string;
  specialization: string | null;
  hospitalUser?: { firstName: string | null; lastName: string | null } | null;
  clinicalDepartment?: { id: string; name: string } | null;
}

/** Bed → room → roomType slice the admission endpoints embed. */
export interface IpdBedRef {
  id: string;
  bedIdentifier: string;
  room: {
    roomNumber: string;
    floor: string | null;
    wing: string | null;
    gender: string;
    roomType: {
      id: string;
      name: string;
      code: string;
      defaultRate: number | string | null;
      nursingCharge: number | string | null;
      isDaycare: boolean;
      isDialysis: boolean;
      isEmergency: boolean;
    };
  };
}

export interface IpdAdmission {
  id: string;
  tenantId: string;
  admissionNo: string;
  patientId: string;
  doctorProfileId: string;
  bedId: string | null;
  panelId: string | null;
  referDoctorId: string | null;

  admissionDate: string;
  admissionType: IpdAdmissionType | string;
  provisionalDiagnosis: string | null;
  reasonForAdmission: string | null;
  expectedDischargeDate: string | null;

  dischargeDate: string | null;
  dischargeType: IpdDischargeType | string | null;
  dischargeSummary: string | null;
  dischargedBy: string | null;

  advancePaid: number | string | null;
  provisionalTotal: number | string | null;
  thresholdBreached: boolean;
  thresholdAlertSent: boolean;

  status: IpdAdmissionStatus | string;
  isActive: boolean;

  patient?: IpdPatientRef;
  doctorProfile?: IpdDoctorRef;
  bed?: IpdBedRef | null;
  panel?: { id: string; panelCode: string; panelName: string } | null;

  createdAt: string;
  updatedAt: string;
}

/** `GET /api/ipd/admissions` — paginated envelope. */
export interface IpdAdmissionListResponse {
  data: IpdAdmission[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

/* --------------------------------- beds ----------------------------------- */

export const BED_STATUSES = [
  "AVAILABLE",
  "RESERVED",
  "OCCUPIED",
  "DISCHARGE_PENDING",
  "HOUSEKEEPING",
  "MAINTENANCE",
  "OUT_OF_SERVICE",
] as const;
export type BedStatusType = (typeof BED_STATUSES)[number];

/** One row of `GET /api/hospital/masters/beds` (BED_INCLUDE shape). */
export interface BedRow {
  id: string;
  bedNumber: string;
  bedIdentifier: string;
  isActive: boolean;
  room: {
    id: string;
    roomNumber: string;
    floor: string | null;
    wing: string | null;
    gender: string;
    roomType: { id: string; name: string; code: string; isCount: boolean };
  };
  statusHistory: {
    status: BedStatusType;
    patientId: string | null;
    ipdAdmissionId: string | null;
    effectiveFrom?: string;
    reason?: string | null;
  }[];
}

/** `GET /api/hospital/masters/rooms` (room rows + linked type + bed count). */
export interface RoomRow {
  id: string;
  roomNumber: string;
  floor: string | null;
  wing: string | null;
  gender: string;
  isActive: boolean;
  /** join rows of GET /rooms — the amenities mapped to this room */
  amenities?: { id: string; amenity: AmenityRef }[];
  roomType: {
    id: string;
    name: string;
    code: string;
    defaultRate: number | string | null;
    nursingCharge: number | string | null;
    isCount: boolean;
    isEmergency: boolean;
    isDaycare: boolean;
    isDialysis: boolean;
  };
  _count?: { beds: number };
}

export interface RoomTypeRow {
  id: string;
  name: string;
  code: string;
  defaultRate: number | string | null;
  nursingCharge: number | string | null;
  isCount: boolean;
  isEmergency: boolean;
  isDaycare: boolean;
  isDialysis: boolean;
  sortOrder: number;
  isActive: boolean;
  _count?: { rooms: number };
}

/** `GET /api/hospital/masters/rooms/:id/occupancy`. */
export interface RoomOccupancy {
  room: RoomRow;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  reservedBeds: number;
  beds: {
    id: string;
    bedNumber: string;
    bedIdentifier: string;
    status: BedStatusType;
    patientId: string | null;
  }[];
}

/** `GET /api/hospital/masters/ward-room/bor-dashboard`. */
export interface BorDashboard {
  totalBeds: number;
  countableBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  reservedBeds: number;
  borPercent: number;
  byRoomType: { roomType: string; total: number; occupied: number; bor: number }[];
  byGender: { gender: string; total: number; occupied: number }[];
}

/** `GET /api/hospital/masters/ward-room/housekeeping-queue`. */
export interface HousekeepingQueue {
  total: number;
  items: {
    bedId: string;
    bedIdentifier: string;
    roomNumber: string;
    floor: string | null;
    wing: string | null;
    gender: string;
    roomType: { id: string; name: string; code: string };
    pendingSince: string;
    reason: string | null;
    reportedBy: string | null;
  }[];
}

/** `POST /api/hospital/masters/beds/:bedId/status` answer. */
export interface BedStatusChangeResult {
  bedId: string;
  bedIdentifier: string;
  previousStatus: BedStatusType;
  currentStatus: BedStatusType;
  patientId: string | null;
  reason: string | null;
  effectiveFrom: string;
}

/* ------------------------------- dropdowns -------------------------------- */

export interface PanelDropdownRow {
  id: string;
  panelCode: string;
  panelName: string;
  groupType?: { value: string } | null;
  panelType?: { value: string } | null;
}

export interface ReferDoctorRow {
  id: string;
  doctorName?: string | null;
  name?: string | null;
  isActive?: boolean;
  [key: string]: unknown;
}

/* -------------------------------- payloads -------------------------------- */

/** Mirrors `CreateAdmissionDto` exactly — unknown fields are rejected (400). */
export interface CreateAdmissionPayload {
  patientId: string;
  doctorProfileId: string;
  bedId?: string;
  panelId?: string;
  referDoctorId?: string;
  admissionType?: IpdAdmissionType;
  provisionalDiagnosis?: string;
  reasonForAdmission?: string;
  expectedDischargeDate?: string;
  advancePaid?: number;
}

/** Mirrors `InitiateDischargeDto`. */
export interface InitiateDischargePayload {
  dischargeType: IpdDischargeType;
  dischargeSummary?: string;
}

/* -------------------------------- utilities ------------------------------- */

/** Prisma `Decimal` arrives as a string — read money through this. */
export const num = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** "Ramesh Kumar" from the embedded patient slice. */
export const patientName = (admission?: IpdAdmission | null): string => {
  const p = admission?.patient;
  if (!p) return "Unknown patient";
  return `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "Unknown patient";
};

/** "Dr. Gupta" from the embedded doctor slice. */
export const doctorName = (admission?: IpdAdmission | null): string => {
  const u = admission?.doctorProfile?.hospitalUser;
  if (!u) return "—";
  const name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return name ? `Dr. ${name}` : "—";
};

/** "ICU-2 / Bed-3" — the label every IPD screen shows for a bed. */
export const bedLabel = (admission?: IpdAdmission | null): string =>
  admission?.bed?.bedIdentifier ?? "Bed not assigned";

/** Whole days between admission and now (day 1 = admission day). */
export const stayDays = (admission?: IpdAdmission | null): number => {
  if (!admission?.admissionDate) return 0;
  const start = new Date(admission.admissionDate).getTime();
  if (Number.isNaN(start)) return 0;
  const end = admission.dischargeDate
    ? new Date(admission.dischargeDate).getTime()
    : Date.now();
  const days = Math.floor((end - start) / 86_400_000) + 1;
  return Math.max(1, days);
};

/* ------------------------------ ward setup --------------------------------- */
/* Write payloads of the ward & bed master (backend branch `hims-v2`,
   `src/hospital/masters/ward-room`). Field names mirror the DTOs 1:1. */

/** Ward gender accepted by rooms (`WardGender` on the server). */
export type WardGender = "ANY" | "MALE_ONLY" | "FEMALE_ONLY" | "PEDIATRIC";

export interface CreateRoomTypePayload {
  name: string;
  /** letters, digits, underscore and hyphen only; stored upper-case */
  code: string;
  description?: string;
  isEmergency?: boolean;
  isDaycare?: boolean;
  isDialysis?: boolean;
  isCount?: boolean;
  defaultRate?: number;
  nursingCharge?: number;
  sortOrder?: number;
  isActive?: boolean;
}

export type UpdateRoomTypePayload = Partial<CreateRoomTypePayload>;

export interface CreateRoomPayload {
  roomTypeId: string;
  roomNumber: string;
  floor?: string;
  wing?: string;
  gender?: WardGender;
  maxBeds?: number;
  hasAC?: boolean;
  hasAttachedBath?: boolean;
  hasTV?: boolean;
  hasOxygen?: boolean;
  hasMonitor?: boolean;
  notes?: string;
  isActive?: boolean;
}

export type UpdateRoomPayload = Partial<CreateRoomPayload>;

export interface AmenityRef {
  id: string;
  name: string;
  code: string;
  icon?: string | null;
  isActive?: boolean;
}

export interface AmenityRow extends AmenityRef {
  isActive: boolean;
  _count?: { rooms: number };
}

export interface CreateAmenityPayload {
  name: string;
  /** letters, digits, underscore and hyphen only; stored upper-case */
  code: string;
  icon?: string;
  isActive?: boolean;
}

export type UpdateAmenityPayload = Partial<CreateAmenityPayload>;

export interface CreateBedPayload {
  roomId: string;
  /** e.g. "01", "A" — bedIdentifier is generated by the server */
  bedNumber: string;
  isActive?: boolean;
}

export interface BulkBedsPayload {
  roomId: string;
  startNumber: number;
  /** <= 500 per call (server limit) */
  endNumber: number;
  prefix?: string;
}

export interface BulkBedsResult {
  created: number;
  skipped: number;
  errors: { bedNumber?: string; message?: string }[];
}
