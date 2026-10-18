/**
 * Ward master service — the ONLY place the ward / room / bed MASTER endpoints
 * of `src/hospital/masters/ward-room` are known.
 *
 *   ROOM TYPES
 *     GET    /api/hospital/masters/room-types            fetchRoomTypes()
 *     POST   /api/hospital/masters/room-types            createRoomType(payload)
 *     PATCH  /api/hospital/masters/room-types/:id        updateRoomType(id, patch)
 *     DELETE /api/hospital/masters/room-types/:id        deleteRoomType(id)
 *
 *   ROOMS
 *     GET    /api/hospital/masters/rooms                 fetchRooms(params?)
 *     GET    /api/hospital/masters/rooms/:id             fetchRoom(id)
 *     GET    /api/hospital/masters/rooms/:id/occupancy   fetchRoomOccupancy(roomId)
 *     POST   /api/hospital/masters/rooms                 createRoom(payload)
 *     PATCH  /api/hospital/masters/rooms/:id             updateRoom(id, patch)
 *     DELETE /api/hospital/masters/rooms/:id             deleteRoom(id)
 *     PUT    /api/hospital/masters/rooms/:id/amenities   setRoomAmenities(roomId, amenityIds)
 *
 *   BEDS
 *     GET    /api/hospital/masters/beds                  fetchBeds(params?)
 *     POST   /api/hospital/masters/beds                  createBed(payload)
 *     POST   /api/hospital/masters/beds/bulk             bulkCreateBeds(payload)
 *     DELETE /api/hospital/masters/beds/:id              deleteBed(id)
 *
 *   AMENITIES
 *     GET    /api/hospital/masters/bed-amenities         fetchAmenities(params?)
 *     POST   /api/hospital/masters/bed-amenities         createAmenity(payload)
 *     PATCH  /api/hospital/masters/bed-amenities/:id     updateAmenity(id, patch)
 *     DELETE /api/hospital/masters/bed-amenities/:id     deleteAmenity(id)
 *
 * Owned by the Master Configuration feature (`WardSetupPage`, reached at
 * `/master-config/ward-setup`). IPD screens import the read half from here
 * (bed picker, ward board filters) while their OPERATIONAL calls — bed status
 * moves, bed status history, BOR dashboard, housekeeping queue — stay in
 * `@/pages/ipd/ipd.service`.
 *
 * Every method returns the axios request directly; callers own try…catch,
 * loading state and error copy.
 */

import { axios, compactQuery } from "@/api/axios";
import type {
  AmenityRow,
  BedRow,
  BedStatusType,
  BulkBedsPayload,
  BulkBedsResult,
  CreateAmenityPayload,
  CreateBedPayload,
  CreateRoomPayload,
  CreateRoomTypePayload,
  RoomOccupancy,
  RoomRow,
  RoomTypeRow,
  UpdateAmenityPayload,
  UpdateRoomPayload,
  UpdateRoomTypePayload,
} from "@/types/ipdTypes";

/* ------------------------------ endpoints -------------------------------- */

const MASTERS = "/api/hospital/masters";
const ROOMS = `${MASTERS}/rooms`;
const BEDS = `${MASTERS}/beds`;

/* --------------------------------- types ---------------------------------- */

/** Query parameters of the bed list (all optional). */
export interface BedQueryParams {
  roomId?: string;
  roomTypeId?: string;
  status?: BedStatusType;
  gender?: string;
  isActive?: boolean;
  [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */

export const wardMasterService = {
  /* ------------------------------- room types ------------------------------ */

  fetchRoomTypes: () => axios.get<RoomTypeRow[]>(`${MASTERS}/room-types`),

  createRoomType: (payload: CreateRoomTypePayload) =>
    axios.post<RoomTypeRow>(`${MASTERS}/room-types`, payload),

  updateRoomType: (id: string, patch: UpdateRoomTypePayload) =>
    axios.patch<RoomTypeRow>(`${MASTERS}/room-types/${id}`, patch),

  /** 400 while rooms are still linked to the type. */
  deleteRoomType: (id: string) =>
    axios.delete<{ deleted: boolean }>(`${MASTERS}/room-types/${id}`),

  /* ---------------------------------- rooms -------------------------------- */

  fetchRooms: (params?: {
    roomTypeId?: string;
    gender?: string;
    search?: string;
    isActive?: boolean;
  }) => axios.get<RoomRow[]>(ROOMS, { params: compactQuery(params) }),

  /** Room detail — includes the room's amenity join rows. */
  fetchRoom: (id: string) => axios.get<RoomRow>(`${ROOMS}/${id}`),

  fetchRoomOccupancy: (roomId: string) =>
    axios.get<RoomOccupancy>(`${ROOMS}/${roomId}/occupancy`),

  createRoom: (payload: CreateRoomPayload) =>
    axios.post<RoomRow>(ROOMS, payload),

  updateRoom: (id: string, patch: UpdateRoomPayload) =>
    axios.patch<RoomRow>(`${ROOMS}/${id}`, patch),

  /** 400 while beds are still linked to the room. */
  deleteRoom: (id: string) =>
    axios.delete<{ deleted: boolean }>(`${ROOMS}/${id}`),

  /** Atomic replace of the room's amenity mapping. */
  setRoomAmenities: (roomId: string, amenityIds: string[]) =>
    axios.put<RoomRow>(`${ROOMS}/${roomId}/amenities`, { amenityIds }),

  /* ---------------------------------- beds --------------------------------- */

  fetchBeds: (params?: BedQueryParams) =>
    axios.get<BedRow[]>(BEDS, { params: compactQuery(params) }),

  createBed: (payload: CreateBedPayload) =>
    axios.post<BedRow>(BEDS, payload),

  /** Generates `startNumber..endNumber` (≤ 500) and skips existing numbers. */
  bulkCreateBeds: (payload: BulkBedsPayload) =>
    axios.post<BulkBedsResult>(`${BEDS}/bulk`, payload),

  /** 409 BED_DELETE_BLOCKED while OCCUPIED / RESERVED. */
  deleteBed: (id: string) =>
    axios.delete<{ deleted: boolean }>(`${BEDS}/${id}`),

  /* -------------------------------- amenities ------------------------------- */

  fetchAmenities: (params?: { active?: boolean }) =>
    axios.get<AmenityRow[]>(`${MASTERS}/bed-amenities`, {
      params:
        typeof params?.active === "boolean" ? { active: params.active } : undefined,
    }),

  createAmenity: (payload: CreateAmenityPayload) =>
    axios.post<AmenityRow>(`${MASTERS}/bed-amenities`, payload),

  updateAmenity: (id: string, patch: UpdateAmenityPayload) =>
    axios.patch<AmenityRow>(`${MASTERS}/bed-amenities/${id}`, patch),

  /** 400 while the amenity is still mapped to rooms — prefer isActive:false. */
  deleteAmenity: (id: string) =>
    axios.delete<{ deleted: boolean }>(`${MASTERS}/bed-amenities/${id}`),
};
