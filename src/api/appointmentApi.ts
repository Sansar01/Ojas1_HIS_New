/**
 * Appointment domain API — OPD appointments.
 *
 *   GET    /api/opd/appointments                  appointmentApi.getAll
 *   GET    /api/opd/appointments/:id              appointmentApi.getById
 *   POST   /api/opd/appointments                  appointmentApi.create
 *   PATCH  /api/opd/appointments/:id              appointmentApi.update
 *   PATCH  /api/opd/appointments/:id/cancel       appointmentApi.cancel
 *   PATCH  /api/opd/appointments/:id/check-in     appointmentApi.checkIn
 *   GET    /api/hospital/masters/global/dropdown/:type  appointmentApi.getVisitTypes
 *
 * Owned by `appointmentSlice` — appointments are shared by the appointments
 * page, the billing screen and the OPD queue, so the domain is the single
 * owner (Rule 24: the billing page must not fetch appointments itself).
 */

import { apiClient } from "./apiClient";
import { API_ENDPOINTS } from "./endpoints";
import type { Appointment } from "@/types";

export interface CancelAppointmentPayload {
  id: string | number;
  cancelReason: string;
}

export const appointmentApi = {
  getAll: (params?: Record<string, unknown>) =>
    apiClient<Appointment[]>(API_ENDPOINTS.appointments.list, {
      method: "GET",
      params,
    }),

  getById: (id: string | number) =>
    apiClient<Appointment>(API_ENDPOINTS.appointments.getById(id), {
      method: "GET",
    }),

  create: (payload: unknown) =>
    apiClient<Appointment>(API_ENDPOINTS.appointments.create, {
      method: "POST",
      body: payload,
    }),

  update: (id: string | number, payload: unknown) =>
    apiClient<Appointment>(API_ENDPOINTS.appointments.update(id), {
      method: "PATCH",
      body: payload,
    }),

  remove: (id: string | number) =>
    apiClient(API_ENDPOINTS.appointments.delete(id), { method: "DELETE" }),

  /** Cancel with a reason — throws on failure so the caller sees the message. */
  cancel: ({ id, cancelReason }: CancelAppointmentPayload) =>
    apiClient(API_ENDPOINTS.appointments.cancel(id), {
      method: "PATCH",
      body: { cancelReason },
    }),

  /** Move a booked appointment to "checked in" (used by the nurse station). */
  checkIn: (id: string | number) =>
    apiClient(API_ENDPOINTS.appointments.checkIn(id), { method: "PATCH" }),

  /**
   * Visit/consultation types for the booking form — master/reference data
   * served by the global-master dropdown endpoint.
   */
  getVisitTypes: () =>
    apiClient(API_ENDPOINTS.appointments.getConsultationType("CONSULTATION_TYPE"), {
      method: "GET",
    }),
};

