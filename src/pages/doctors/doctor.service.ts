/**
 * Doctor feature service — the ONLY place doctor endpoints are known.
 *
 *   GET    /api/opd/doctors/list              fetchDoctors(params?)
 *   GET    /api/opd/doctors/:id               fetchDoctorById(id)
 *   POST   /api/opd/doctors/create            createDoctor(payload)
 *   PATCH  /api/opd/doctors/:id               updateDoctor(id, payload)
 *   DELETE /api/opd/doctors/:id               deleteDoctor(id)
 *   GET    /api/opd/doctors/:id/availability  fetchDoctorSlots(doctorId, date)
 *   POST   /api/opd/doctors/:id/availability  saveDoctorAvailability(...)
 *   GET    /api/opd/doctors/:id/leaves        fetchDoctorLeaves(doctorId, params?)
 *   POST   /api/opd/doctors/:id/leaves        markDoctorLeave(doctorId, payload)
 *
 * Used by the doctors page, the appointment form (doctor dropdown + available
 * slots), the dashboard widgets and the billing/consultation screens. All
 * through the shared Axios client; results stay in local component state.
 */

import { axios } from "@/api/axios";
import type { ScheduleDay } from "@/types";

/** Doctor endpoints — owned by the doctor feature. */
const DOCTORS = "/api/opd/doctors";
const doctorPath = (id: string | number) => `${DOCTORS}/${id}`;

/** Optional query parameters of the doctor list (search / paging / filters). */
export interface DoctorQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string | number;
  specializationId?: string | number;
  [key: string]: unknown;
}

/**
 * Doctor write payload. The backend DTO differs from the UI model (for example
 * `qualifications` travels as a comma-separated string), so callers pass the
 * DTO they already build and the service forwards it untouched.
 */
export type DoctorPayload = Record<string, any>;

/**
 * Doctor list — the doctor dropdown of the appointment form calls this with
 * `{ search }` (debounced) instead of pulling the whole table into the browser.
 */

/** UI weekly schedule → the availability payload the API expects. */
export const mapScheduleToApi = (schedule: ScheduleDay[]) =>
  schedule.map((day) => ({
    dayOfWeek: day.day,
    isActive: day.enabled,
    ...(day.enabled && {
      startTime: day.start,
      endTime: day.end,
      breakStartTime: day.breakStartTime,
      breakEndTime: day.breakEndTime,
    }),
  }));

/* --------------------------------------------------------------------------
 * Service object — every method returns the axios request directly.
 * ----------------------------------------------------------------------- */

export const doctorService = {
  fetchDoctors: (params?: DoctorQueryParams) =>
    axios.get(DOCTORS + "/list", { params }),
  /** One doctor profile. */
  fetchDoctorById: (id: string | number) => axios.get(doctorPath(id)),
  /** Onboard a doctor. */
  createDoctor: (payload: DoctorPayload) =>
    axios.post(DOCTORS + "/create", payload),
  updateDoctor: (id: string | number, payload: DoctorPayload) =>
    axios.patch(doctorPath(id), payload),
  deleteDoctor: (id: string | number) => axios.delete(doctorPath(id)),
  /**
   * Available slots of one doctor on one date.
   *
   * The appointment form calls this whenever the doctor or the date changes and
   * keeps the answer in its own state — there is no `availableSlotsSlice`.
   */
  fetchDoctorSlots: (doctorId: string | number, date?: string) =>
    axios.get(doctorPath(doctorId) + "/availability", {
      params: date ? { date } : undefined,
    }),
  /** Weekly availability schedule of a doctor. */
  fetchDoctorAvailability: (
    doctorId: string | number,
    params?: Record<string, unknown>,
  ) => axios.get(doctorPath(doctorId) + "/availability", { params }),
  /** Create/replace the weekly availability schedule. */
  saveDoctorAvailability: (doctorId: string | number, payload: unknown) =>
    axios.post(doctorPath(doctorId) + "/availability", payload),
  /** Save a doctor's consulting policy + weekly schedule. */
  saveDoctorSchedule: (
    doctorId: string | number,
    slotDurationMins: number,
    schedule: ScheduleDay[],
  ) =>
    axios.post(doctorPath(doctorId) + "/availability", {
      slotDurationMins,
      schedule: mapScheduleToApi(schedule),
    }),
  /** Leaves inside a date window. */
  fetchDoctorLeaves: (
    doctorId: string | number,
    params?: Record<string, unknown>,
  ) => axios.get(doctorPath(doctorId) + "/leaves", { params }),
  /** Mark a leave for a doctor. */
  markDoctorLeave: (doctorId: string | number, payload: unknown) =>
    axios.post(doctorPath(doctorId) + "/leaves", payload),
};
