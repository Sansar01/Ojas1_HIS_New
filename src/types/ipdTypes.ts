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
/**
 * One row of `GET /masters/beds/:bedId/status-history` — the bed's state-machine
 * audit trail (who moved it, from where to where and why).
 */
export interface BedStatusHistoryRow {
  id: string;
  bedId: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  changedBy: string | null;
  changedAt: string;
  createdAt: string;
}

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

/* ------------------------------ clinical chart ----------------------------- */
/* Phase 3.3 endpoints (backend branch `new_features/sansar`,
   src/hospital/ipd/clinical). Schema mirrors ipd_vitals / ipd_rounds /
   ipd_medications / ipd_diet_orders. */

export interface IpdVitalRow {
  id: string;
  admissionId: string;
  recordedAt: string;
  recordedBy: string | null;
  /** Decimal -> string over JSON */
  temperature: string | number | null;
  pulse: number | null;
  respiratoryRate: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  spo2: number | null;
  painScore: number | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateVitalsPayload {
  admissionId: string;
  recordedAt?: string;
  temperature?: number;
  pulse?: number;
  respiratoryRate?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  spo2?: number;
  painScore?: number;
  notes?: string;
}

export interface IpdRoundRow {
  id: string;
  admissionId: string;
  roundAt: string;
  doctorProfileId: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  nextRoundAt: string | null;
  recordedBy: string | null;
  createdAt: string;
}

export interface CreateRoundPayload {
  admissionId: string;
  doctorProfileId?: string;
  roundAt?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  nextRoundAt?: string;
}

export type MedicationRoute =
  | "ORAL" | "IV" | "IM" | "SC" | "TOPICAL" | "INHALATION" | "OTHER";

export type MedicationFrequency =
  | "OD" | "BD" | "TDS" | "QID" | "HS" | "SOS" | "STAT" | "WEEKLY";

export interface IpdMedicationRow {
  id: string;
  admissionId: string;
  drugName: string;
  dose: string;
  route: string;
  frequency: string;
  startDate: string;
  endDate: string | null;
  status: "ACTIVE" | "STOPPED";
  stoppedAt: string | null;
  stoppedBy: string | null;
  stopReason: string | null;
  notes: string | null;
  orderedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMedicationPayload {
  admissionId: string;
  drugName: string;
  dose: string;
  route?: MedicationRoute;
  frequency?: MedicationFrequency;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export type DietType =
  | "NORMAL" | "SOFT" | "LIQUID" | "SEMI_SOLID" | "DIABETIC" | "RENAL"
  | "CARDIAC" | "NPO" | "TUBE_FEED" | "OTHER";

export interface IpdDietOrderRow {
  id: string;
  admissionId: string;
  dietType: string;
  details: string | null;
  effectiveFrom: string;
  isActive: boolean;
  orderedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDietOrderPayload {
  admissionId: string;
  dietType: DietType;
  details?: string;
  effectiveFrom?: string;
}

/* ------------------------------ billing ledger ----------------------------- */

export type ChargeCategory =
  | "ROOM" | "NURSING" | "SERVICE" | "PROCEDURE" | "PHARMACY" | "LAB" | "OTHER";

export type PaymentMode =
  | "CASH" | "CARD" | "UPI" | "NEFT" | "CHEQUE" | "INSURANCE" | "OTHER";

export interface IpdChargeRow {
  id: string;
  admissionId: string;
  chargeDate: string;
  category: string;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  amount: string | number;
  source: "MANUAL" | "DAILY_ACCRUAL";
  accrualKey: string | null;
  notes: string | null;
  postedBy: string | null;
  createdAt: string;
}

export interface CreateChargePayload {
  admissionId: string;
  description: string;
  unitPrice: number;
  quantity?: number;
  category?: ChargeCategory;
  chargeDate?: string;
  notes?: string;
}

export interface IpdPaymentRow {
  id: string;
  admissionId: string;
  amount: string | number;
  mode: string;
  reference: string | null;
  notes: string | null;
  receivedAt: string;
  receivedBy: string | null;
  createdAt: string;
}

export interface CreatePaymentPayload {
  amount: number;
  mode?: PaymentMode;
  reference?: string;
  notes?: string;
  receivedAt?: string;
}

/** Phase 1.4 threshold verdict returned with every charge write. */
export interface IpdThresholdCheck {
  status: "OK" | "ALERT" | "WARNING" | "BLOCKED";
  message?: string;
  usagePercent?: number;
  maxAmount?: number;
  currentBillTotal?: number;
  thresholdId?: string;
  actionOnBreach?: "SOFT" | "HARD";
}

export interface IpdProvisionalTotals {
  chargesTotal: number;
  paymentsTotal: number;
  /** Positive = the patient still owes; negative = credit with the hospital. */
  balance: number;
  advancePaid: number;
  provisionalTotal: number;
  dayCount: number;
  roomRatePerDay: number;
  nursingChargePerDay: number;
  expectedAtCurrentRate: number;
}

export interface IpdProvisionalBill {
  admission: {
    id: string;
    admissionNo: string;
    status: string;
    admissionDate: string;
    dischargeDate: string | null;
    advancePaid: string | number;
    provisionalTotal: string | number;
    thresholdBreached: boolean;
    panelId: string | null;
    patient?: { id: string; uhid: string; firstName: string; lastName: string; gender: string };
    panel?: { id: string; panelCode: string; panelName: string } | null;
    bed?: {
      id: string;
      bedIdentifier: string;
      room?: { roomNumber: string; roomType?: { id: string; name: string; code: string } };
    } | null;
  };
  charges: IpdChargeRow[];
  payments: IpdPaymentRow[];
  totals: IpdProvisionalTotals;
  threshold: IpdThresholdCheck;
}

export interface IpdChargePostResult {
  charge: IpdChargeRow;
  threshold: IpdThresholdCheck;
  totals: { chargesTotal: number };
}

export interface IpdDailyAccrualResult {
  date: string;
  posted: number;
  skipped: number;
  blocked: number;
  admissions: {
    admissionId: string;
    admissionNo: string;
    posted: number;
    amount: number;
    status: "POSTED" | "SKIPPED" | "BLOCKED";
    reason?: string;
    thresholdStatus?: string;
  }[];
}
