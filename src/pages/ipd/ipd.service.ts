/**
 * IPD feature service — the ONLY place the IPD operational endpoints are known.
 *
 *   ADMISSIONS (module `src/hospital/ipd/admission`)
 *     GET    /api/ipd/admissions                                fetchAdmissions(filters?)
 *     GET    /api/ipd/admissions/active                         fetchActiveAdmissions()
 *     GET    /api/ipd/admissions/:id                            fetchAdmissionById(id)
 *     POST   /api/ipd/admissions                                createAdmission(payload)
 *     POST   /api/ipd/admissions/:id/assign-bed                 assignBed(id, bedId)
 *     POST   /api/ipd/admissions/:id/transfer-bed               transferBed(id, newBedId, reason?)
 *     POST   /api/ipd/admissions/:id/initiate-discharge         initiateDischarge(id, payload)
 *     POST   /api/ipd/admissions/:id/complete-discharge         completeDischarge(id)
 *     POST   /api/ipd/admissions/:id/cancel                     cancelAdmission(id, reason?)
 *
 *   BED BOARD — OPERATIONAL MOVES (module `src/hospital/masters/ward-room`)
 *     POST   /api/hospital/masters/beds/:bedId/status           changeBedStatus(bedId, payload)
 *     GET    /api/hospital/masters/beds/:bedId/status-history   fetchBedStatusHistory(bedId)
 *     GET    /api/hospital/masters/ward-room/bor-dashboard      fetchBorDashboard()
 *     GET    /api/hospital/masters/ward-room/housekeeping-queue fetchHousekeepingQueue()
 *
 *   CLINICAL CHART (Phase 3.3 — `src/hospital/ipd/clinical`)
 *     POST/GET /api/ipd/vitals                    recordIpdVitals() · fetchIpdVitals(id)
 *     POST/GET /api/ipd/rounds                    recordIpdRound() · fetchIpdRounds(id)
 *     POST/GET /api/ipd/medications               orderIpdMedication() · fetchIpdMedications(id)
 *     POST     /api/ipd/medications/:id/stop      stopIpdMedication(id, reason?)
 *     POST/GET /api/ipd/diet-orders                orderIpdDiet() · fetchIpdDietOrders(id)
 *     GET      /api/ipd/diet-orders/active        fetchActiveIpdDiet(id)
 *     POST     /api/ipd/diet-orders/:id/stop      stopIpdDiet(id)
 *
 *   RUNNING BILL (Phase 3.3 — `src/hospital/ipd/billing`)
 *     POST   /api/ipd/billing/charges             postIpdCharge(payload)
 *     GET    /api/ipd/billing/charges             fetchIpdCharges(id)
 *     POST   /api/ipd/billing/daily-accrual       runIpdDailyAccrual(payload)
 *     GET    /api/ipd/billing/provisional/:id     fetchProvisionalBill(id)
 *     POST   /api/ipd/admissions/:id/payments     recordIpdPayment(id, payload)
 *     GET    /api/ipd/admissions/:id/payments     fetchIpdPayments(id)
 *
 *   DROPDOWN REFERENCE (existing masters)
 *     GET    /api/hospital/masters/panels/dropdown              fetchPanelDropdown()
 *     GET    /api/hospital/masters/refer-doctors                fetchReferDoctors(params?)
 *
 * WARD / ROOM / BED **MASTER DATA** (room types, rooms, beds, amenities — the
 * reads the bed picker and ward board filters use, plus every create/update/
 * delete) lives in `@/pages/masterConfiguration/wardMaster.service` — this file
 * never re-declares those endpoints.
 *
 * Screens import `patientService`, `doctorService` and `appointmentService`
 * from their own features — this file never re-declares those endpoints either.
 *
 *   Verified 2026-10-13 on the connected backend: every /api/ipd/* and
 *   /api/hospital/masters/{room-types,rooms,beds,ward-room} path answers 404,
 *   while a known master (e.g. /masters/departments) answers 401 — i.e. the
 *   route does not exist yet, it is not a permission problem. The backend code
 *   is ready on the backend repo's `new_features/sansar` branch: `src/hospital/
 *   ipd/admission`, the Phase 3.3 `ipd/clinical` + `ipd/billing` slices, and
 *   `src/hospital/masters/ward-room` for the master data.
 */

import { axios, compactQuery } from "@/api/axios";
import type {
  BedStatusChangeResult,
  BedStatusHistoryRow,
  BedStatusType,
  BorDashboard,
  CreateAdmissionPayload,
  CreateChargePayload,
  CreateDietOrderPayload,
  CreateMedicationPayload,
  CreatePaymentPayload,
  CreateRoundPayload,
  CreateVitalsPayload,
  HousekeepingQueue,
  InitiateDischargePayload,
  IpdAdmission,
  IpdAdmissionListResponse,
  IpdChargePostResult,
  IpdChargeRow,
  IpdDailyAccrualResult,
  IpdDietOrderRow,
  IpdMedicationRow,
  IpdPaymentRow,
  IpdProvisionalBill,
  IpdRoundRow,
  IpdVitalRow,
  PanelDropdownRow,
  ReferDoctorRow,
} from "@/types/ipdTypes";

/* ------------------------------ endpoints -------------------------------- */

const MASTERS = "/api/hospital/masters";
const WARD = `${MASTERS}/ward-room`;
const BEDS = `${MASTERS}/beds`;

/* --------------------------------- types ---------------------------------- */

/** Query parameters of the admission list (all optional). */
export interface AdmissionQueryParams {
  status?: string;
  patientId?: string;
  doctorProfileId?: string;
  panelId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */

export const ipdService = {
  /* ------------------------------ admissions ------------------------------ */

  fetchAdmissions: (params?: AdmissionQueryParams) =>
    axios.get<IpdAdmissionListResponse>("/api/ipd/admissions", {
      params: compactQuery(params),
    }),

  /** Shorthand server-side: status IN (ADMITTED, DISCHARGE_ORDERED). */
  fetchActiveAdmissions: () =>
    axios.get<IpdAdmission[]>("/api/ipd/admissions/active"),

  fetchAdmissionById: (id: string) =>
    axios.get<IpdAdmission>(`/api/ipd/admissions/${id}`),

  createAdmission: (payload: CreateAdmissionPayload) =>
    axios.post<IpdAdmission>("/api/ipd/admissions", payload),

  assignBed: (id: string, bedId: string) =>
    axios.post<IpdAdmission>(`/api/ipd/admissions/${id}/assign-bed`, { bedId }),

  transferBed: (id: string, newBedId: string, reason?: string) =>
    axios.post<IpdAdmission>(`/api/ipd/admissions/${id}/transfer-bed`, {
      newBedId,
      ...(reason?.trim() ? { reason: reason.trim() } : {}),
    }),

  initiateDischarge: (id: string, payload: InitiateDischargePayload) =>
    axios.post<IpdAdmission>(
      `/api/ipd/admissions/${id}/initiate-discharge`,
      payload,
    ),

  completeDischarge: (id: string) =>
    axios.post<IpdAdmission>(`/api/ipd/admissions/${id}/complete-discharge`),

  cancelAdmission: (id: string, reason?: string) =>
    axios.post<IpdAdmission>(`/api/ipd/admissions/${id}/cancel`, {
      ...(reason?.trim() ? { reason: reason.trim() } : {}),
    }),

  /* --------------------- bed board — operational moves --------------------- */

  /** Bed state machine — illegal transitions answer 400 INVALID_STATUS_TRANSITION. */
  changeBedStatus: (
    bedId: string,
    payload: {
      status: BedStatusType;
      patientId?: string;
      ipdAdmissionId?: string;
      reason?: string;
    },
  ) => axios.post<BedStatusChangeResult>(`${BEDS}/${bedId}/status`, payload),

  fetchBedStatusHistory: (bedId: string) =>
    axios.get<BedStatusHistoryRow[]>(`${BEDS}/${bedId}/status-history`),

  fetchBorDashboard: () => axios.get<BorDashboard>(`${WARD}/bor-dashboard`),

  fetchHousekeepingQueue: () =>
    axios.get<HousekeepingQueue>(`${WARD}/housekeeping-queue`),

  /* ----------------------------- clinical chart --------------------------- */

  fetchIpdVitals: (admissionId: string, limit?: number) =>
    axios.get<IpdVitalRow[]>("/api/ipd/vitals", {
      params: compactQuery({ admissionId, limit }),
    }),

  recordIpdVitals: (payload: CreateVitalsPayload) =>
    axios.post<IpdVitalRow>("/api/ipd/vitals", payload),

  fetchIpdRounds: (admissionId: string, limit?: number) =>
    axios.get<IpdRoundRow[]>("/api/ipd/rounds", {
      params: compactQuery({ admissionId, limit }),
    }),

  recordIpdRound: (payload: CreateRoundPayload) =>
    axios.post<IpdRoundRow>("/api/ipd/rounds", payload),

  fetchIpdMedications: (admissionId: string, status?: "ACTIVE" | "STOPPED") =>
    axios.get<IpdMedicationRow[]>("/api/ipd/medications", {
      params: compactQuery({ admissionId, status }),
    }),

  orderIpdMedication: (payload: CreateMedicationPayload) =>
    axios.post<IpdMedicationRow>("/api/ipd/medications", payload),

  stopIpdMedication: (id: string, reason?: string) =>
    axios.post<IpdMedicationRow>(`/api/ipd/medications/${id}/stop`, {
      ...(reason?.trim() ? { reason: reason.trim() } : {}),
    }),

  fetchIpdDietOrders: (admissionId: string) =>
    axios.get<IpdDietOrderRow[]>("/api/ipd/diet-orders", {
      params: { admissionId },
    }),

  /** The diet the kitchen is working from — null when none is set. */
  fetchActiveIpdDiet: (admissionId: string) =>
    axios.get<IpdDietOrderRow | null>("/api/ipd/diet-orders/active", {
      params: { admissionId },
    }),

  orderIpdDiet: (payload: CreateDietOrderPayload) =>
    axios.post<IpdDietOrderRow>("/api/ipd/diet-orders", payload),

  stopIpdDiet: (id: string) =>
    axios.post<IpdDietOrderRow>(`/api/ipd/diet-orders/${id}/stop`, {}),

  /* ------------------------------ running bill ---------------------------- */

  fetchIpdCharges: (admissionId: string, limit?: number) =>
    axios.get<IpdChargeRow[]>("/api/ipd/billing/charges", {
      params: compactQuery({ admissionId, limit }),
    }),

  /** 400 THRESHOLD_BLOCKED when the panel cap is a HARD breach. */
  postIpdCharge: (payload: CreateChargePayload) =>
    axios.post<IpdChargePostResult>("/api/ipd/billing/charges", payload),

  /** Idempotent per admission + day + component — safe to press twice. */
  runIpdDailyAccrual: (payload: { date?: string; admissionId?: string } = {}) =>
    axios.post<IpdDailyAccrualResult>("/api/ipd/billing/daily-accrual", payload),

  fetchProvisionalBill: (admissionId: string) =>
    axios.get<IpdProvisionalBill>(`/api/ipd/billing/provisional/${admissionId}`),

  fetchIpdPayments: (admissionId: string) =>
    axios.get<IpdPaymentRow[]>(`/api/ipd/admissions/${admissionId}/payments`),

  recordIpdPayment: (admissionId: string, payload: CreatePaymentPayload) =>
    axios.post<{ payment: IpdPaymentRow; advancePaid: number }>(
      `/api/ipd/admissions/${admissionId}/payments`,
      payload,
    ),

  /* ------------------------------- reference ------------------------------ */

  fetchPanelDropdown: () =>
    axios.get<PanelDropdownRow[]>(`${MASTERS}/panels/dropdown`),

  fetchReferDoctors: (params?: Record<string, unknown>) =>
    axios.get<ReferDoctorRow[]>(`${MASTERS}/refer-doctors`, {
      params: compactQuery(params),
    }),
};

export type { ReferDoctorRow };
