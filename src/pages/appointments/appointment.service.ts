/**
 * Appointment feature service — the ONLY place appointment endpoints are known.
 *
 *   GET    /api/opd/appointments                    fetchAppointments(params?)
 *   GET    /api/opd/appointments/:id                fetchAppointmentById(id)
 *   POST   /api/opd/appointments                    createAppointment(payload)
 *   PATCH  /api/opd/appointments/:id                updateAppointment(id, payload)
 *   DELETE /api/opd/appointments/:id                deleteAppointment(id)
 *   PATCH  /api/opd/appointments/:id/cancel         cancelAppointment(id, reason)
 *   PATCH  /api/opd/appointments/:id/check-in       checkInAppointment(id)
 *   GET    .../masters/global/dropdown/CONSULTATION_TYPE   fetchConsultationTypes()
 *
 * Appointment list, booking, rescheduling and cancellation all live here; the
 * booking form additionally uses `patient.service`, `doctor.service` and
 * `consultation.service` for its dropdowns — no Redux involved.
 */

import { axios } from "@/api/axios";

/** Appointment endpoints — owned by the appointment feature. */
const APPOINTMENTS = "/api/opd/appointments";
const appointmentPath = (id: string | number) => `${APPOINTMENTS}/${id}`;
const CONSULTATION_TYPES =
  "/api/hospital/masters/global/dropdown/CONSULTATION_TYPE";

/** Optional query parameters of the appointment list (date / status / paging). */
export interface AppointmentQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  date?: string;
  from?: string;
  to?: string;
  status?: string;
  doctorId?: string | number;
  patientId?: string | number;
  [key: string]: unknown;
}

/**
 * Appointment write payload. The backend DTO uses its own field names
 * (`appointmentDate`, `slotStartTime`, `doctorProfileId`, …), so the caller
 * passes the DTO it already builds and the service forwards it untouched.
 */
export type AppointmentPayload = Record<string, any>;

/** Appointment list — filters/paging are optional parameters, not new methods. */

/* --------------------------------------------------------------------------
 * Service object — every method returns the axios request directly.
 * ----------------------------------------------------------------------- */

export const appointmentService = {
  fetchAppointments: (params?: AppointmentQueryParams) =>
    axios.get(APPOINTMENTS, { params }),
  /** Today's appointments of the signed-in doctor / facility. */
  fetchTodayAppointments: (params?: AppointmentQueryParams) =>
    axios.get(APPOINTMENTS + "/today", { params }),
  fetchAppointmentById: (id: string | number) => axios.get(appointmentPath(id)),
  /** One appointment prepared for editing (server-side edit payload). */
  fetchAppointmentForEdit: (id: string | number) =>
    axios.get(appointmentPath(id) + "/edit"),
  createAppointment: (payload: AppointmentPayload) =>
    axios.post(APPOINTMENTS, payload),
  updateAppointment: (id: string | number, payload: AppointmentPayload) =>
    axios.patch(appointmentPath(id), payload),
  deleteAppointment: (id: string | number) => axios.delete(appointmentPath(id)),
  /** Cancel with a reason (non-destructive on the server). */
  cancelAppointment: (id: string | number, cancelReason: string) =>
    axios.patch(appointmentPath(id) + "/cancel", { cancelReason }),
  /** Move a booked appointment to "checked in" (nurse station / front desk). */
  checkInAppointment: (id: string | number) =>
    axios.patch(appointmentPath(id) + "/check-in", undefined),
  /** Available slot of a doctor — reference lookup used while booking. */
  fetchAppointmentSlot: (params: Record<string, unknown>) =>
    axios.get(APPOINTMENTS + "/slot", { params }),
  /**
   * Visit/consultation types of the booking form (global master dropdown).
   * One method for the dropdown — no per-type duplicates.
   */
  fetchConsultationTypes: () => axios.get(CONSULTATION_TYPES),
};
