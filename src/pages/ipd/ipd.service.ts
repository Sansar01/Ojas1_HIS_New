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
 *   WARD SETUP (the write half of the same module — `IpdWardSetupPage`)
 *     POST   /api/hospital/masters/room-types                   createRoomType(payload)
 *     PATCH  /api/hospital/masters/room-types/:id               updateRoomType(id, patch)
 *     DELETE /api/hospital/masters/room-types/:id               deleteRoomType(id)
 *     POST   /api/hospital/masters/rooms                        createRoom(payload)
 *     PATCH  /api/hospital/masters/rooms/:id                    updateRoom(id, patch)
 *     DELETE /api/hospital/masters/rooms/:id                    deleteRoom(id)
 *     PUT    /api/hospital/masters/rooms/:roomId/amenities       setRoomAmenities(roomId, amenityIds)
 *     POST   /api/hospital/masters/beds                         createBed(payload)
 *     POST   /api/hospital/masters/beds/bulk                    bulkCreateBeds(payload)
 *     DELETE /api/hospital/masters/beds/:id                     deleteBed(id)
 *     GET    /api/hospital/masters/bed-amenities                fetchAmenities(params?)
 *     POST   /api/hospital/masters/bed-amenities                createAmenity(payload)
 *     PATCH  /api/hospital/masters/bed-amenities/:id            updateAmenity(id, patch)
 *     DELETE /api/hospital/masters/bed-amenities/:id            deleteAmenity(id)
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
 *
 *   Verified 2026-10-13 on the connected backend: every /api/ipd/* and
 *   /api/hospital/masters/{room-types,rooms,beds,ward-room} path answers 404,
 *   while a known master (e.g. /masters/departments) answers 401 — i.e. the
 *   route does not exist yet, it is not a permission problem. The backend code
 *   is ready on the backend repo's `hims-v2` branch (the PR #48 merge of
 *   `new_features/sansar`): `src/hospital/ipd/admission` for the nine
 *   admission routes and `src/hospital/masters/ward-room` for room types,
 *   rooms, beds (one + bulk), bed status, amenities, BOR and housekeeping —
 *   nothing else IPD (no vitals/rounds/medications/billing there either).
 */

import { axios } from "@/api/axios";
import type {
  AmenityRow,
  BedRow,
  BedStatusChangeResult,
  BedStatusType,
  BorDashboard,
  BulkBedsPayload,
  BulkBedsResult,
  CreateAdmissionPayload,
  CreateAmenityPayload,
  CreateBedPayload,
  CreateRoomPayload,
  CreateRoomTypePayload,
  HousekeepingQueue,
  InitiateDischargePayload,
  IpdAdmission,
  IpdAdmissionListResponse,
  PanelDropdownRow,
  ReferDoctorRow,
  RoomOccupancy,
  RoomRow,
  RoomTypeRow,
  UpdateAmenityPayload,
  UpdateRoomPayload,
  UpdateRoomTypePayload,
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

  /* --------------------------- ward setup (write) -------------------------- */

  /** Room detail — includes the room's amenity join rows. */
  fetchRoom: (id: string) => axios.get<RoomRow>(`${ROOMS}/${id}`),

  createRoomType: (payload: CreateRoomTypePayload) =>
    axios.post<RoomTypeRow>(`${MASTERS}/room-types`, payload),

  updateRoomType: (id: string, patch: UpdateRoomTypePayload) =>
    axios.patch<RoomTypeRow>(`${MASTERS}/room-types/${id}`, patch),

  /** 400 while rooms are still linked to the type. */
  deleteRoomType: (id: string) =>
    axios.delete<{ deleted: boolean }>(`${MASTERS}/room-types/${id}`),

  createRoom: (payload: CreateRoomPayload) =>
    axios.post<RoomRow>(ROOMS, payload),

  updateRoom: (id: string, patch: UpdateRoomPayload) =>
    axios.patch<RoomRow>(`${ROOMS}/${id}`, patch),

  /** 400 while beds are still linked to the room. */
  deleteRoom: (id: string) => axios.delete<{ deleted: boolean }>(`${ROOMS}/${id}`),

  /** Atomic replace of the room's amenity mapping. */
  setRoomAmenities: (roomId: string, amenityIds: string[]) =>
    axios.put<RoomRow>(`${ROOMS}/${roomId}/amenities`, { amenityIds }),

  createBed: (payload: CreateBedPayload) =>
    axios.post<BedRow>(BEDS, payload),

  /** Generates `startNumber..endNumber` (≤ 500) and skips existing numbers. */
  bulkCreateBeds: (payload: BulkBedsPayload) =>
    axios.post<BulkBedsResult>(`${BEDS}/bulk`, payload),

  /** 409 BED_DELETE_BLOCKED while OCCUPIED / RESERVED. */
  deleteBed: (id: string) => axios.delete<{ deleted: boolean }>(`${BEDS}/${id}`),

  fetchAmenities: (params?: { active?: boolean }) =>
    axios.get<AmenityRow[]>(`${MASTERS}/bed-amenities`, {
      params: typeof params?.active === "boolean" ? { active: params.active } : undefined,
    }),

  createAmenity: (payload: CreateAmenityPayload) =>
    axios.post<AmenityRow>(`${MASTERS}/bed-amenities`, payload),

  updateAmenity: (id: string, patch: UpdateAmenityPayload) =>
    axios.patch<AmenityRow>(`${MASTERS}/bed-amenities/${id}`, patch),

  /** 400 while the amenity is still mapped to rooms — prefer isActive:false. */
  deleteAmenity: (id: string) =>
    axios.delete<{ deleted: boolean }>(`${MASTERS}/bed-amenities/${id}`),

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
