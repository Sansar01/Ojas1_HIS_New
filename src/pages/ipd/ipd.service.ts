/**
 * IPD feature service — the ONLY place IPD + ward/bed endpoints are known.
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
 *   WARD / BED BOARD (module `src/hospital/masters/ward-room`)
 *     GET    /api/hospital/masters/room-types                   fetchRoomTypes()
 *     GET    /api/hospital/masters/rooms                        fetchRooms(params?)
 *     GET    /api/hospital/masters/rooms/:id/occupancy          fetchRoomOccupancy(roomId)
 *     GET    /api/hospital/masters/beds                         fetchBeds(params?)
 *     POST   /api/hospital/masters/beds/:bedId/status           changeBedStatus(bedId, payload)
 *     GET    /api/hospital/masters/beds/:bedId/status-history   fetchBedStatusHistory(bedId)
 *     GET    /api/hospital/masters/ward-room/bor-dashboard      fetchBorDashboard()
 *     GET    /api/hospital/masters/ward-room/housekeeping-queue fetchHousekeepingQueue()
 *
 *   DROPDOWN REFERENCE (existing masters)
 *     GET    /api/hospital/masters/panels/dropdown              fetchPanelDropdown()
 *     GET    /api/hospital/masters/refer-doctors                fetchReferDoctors(params?)
 *
 * Screens import `patientService`, `doctorService` and `appointmentService`
 * from their own features — this file never re-declares those endpoints.
 *
 * ENDPOINTS NOT YET SHIPPED (no call site here on purpose — the screens that
 * will consume them render a "backend pending" note instead of guessing):
 *   POST/GET /api/ipd/vitals · /rounds · /medications · /diet-orders
 *   POST /api/ipd/billing/charges · daily-accrual · /billing/provisional/:id
 *   POST /api/ipd/admissions/:id/payments
 */

import { axios } from "@/api/axios";
import type {
  BedRow,
  BedStatusChangeResult,
  BedStatusType,
  BorDashboard,
  CreateAdmissionPayload,
  HousekeepingQueue,
  InitiateDischargePayload,
  IpdAdmission,
  IpdAdmissionListResponse,
  PanelDropdownRow,
  ReferDoctorRow,
  RoomOccupancy,
  RoomRow,
  RoomTypeRow,
} from "../../types/ipdTypes";

/* ------------------------------ endpoints -------------------------------- */
const MASTERS = "/api/hospital/masters";
const WARD = `${MASTERS}/ward-room`;
const BEDS = `${MASTERS}/beds`;
const ROOMS = `${MASTERS}/rooms`;

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

export interface BedQueryParams {
  roomId?: string;
  roomTypeId?: string;
  status?: BedStatusType;
  gender?: string;
  isActive?: boolean;
  [key: string]: unknown;
}

/** Drop empty / "all" values so the query string stays clean. */
export const compactQuery = (
  params: Record<string, unknown> = {},
): Record<string, unknown> | undefined => {
  const entries = Object.entries(params).filter(
    ([, value]) =>
      value !== undefined &&
      value !== null &&
      value !== "" &&
      value !== "all" &&
      value !== false,
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
};

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

  /* ------------------------- rooms / beds / board ------------------------- */

  fetchRoomTypes: () => axios.get<RoomTypeRow[]>(`${MASTERS}/room-types`),

  fetchRooms: (params?: {
    roomTypeId?: string;
    gender?: string;
    search?: string;
    isActive?: boolean;
  }) => axios.get<RoomRow[]>(ROOMS, { params: compactQuery(params) }),

  fetchRoomOccupancy: (roomId: string) =>
    axios.get<RoomOccupancy>(`${ROOMS}/${roomId}/occupancy`),

  fetchBeds: (params?: BedQueryParams) =>
    axios.get<BedRow[]>(BEDS, { params: compactQuery(params) }),

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
    axios.get<any[]>(`${BEDS}/${bedId}/status-history`),

  fetchBorDashboard: () => axios.get<BorDashboard>(`${WARD}/bor-dashboard`),

  fetchHousekeepingQueue: () =>
    axios.get<HousekeepingQueue>(`${WARD}/housekeeping-queue`),

  /* ------------------------------- reference ------------------------------ */

  fetchPanelDropdown: () =>
    axios.get<PanelDropdownRow[]>(`${MASTERS}/panels/dropdown`),

  fetchReferDoctors: (params?: Record<string, unknown>) =>
    axios.get<any>(`${MASTERS}/refer-doctors`, {
      params: compactQuery(params),
    }),
};

export type { ReferDoctorRow };
