/**
 * Doctor domain API — doctor profiles, onboarding, availability and leaves.
 *
 *   GET    /api/opd/doctors/list              doctorApi.getAll
 *   GET    /api/opd/doctors/:id               doctorApi.getById   (full profile)
 *   POST   /api/opd/doctors/create            doctorApi.create
 *   PATCH  /api/opd/doctors/:id               doctorApi.update
 *   DELETE /api/opd/doctors/:id               doctorApi.remove
 *   POST   /api/opd/doctors/:id/availability  doctorApi.saveAvailability
 *   GET    /api/opd/doctors/:id/availability  doctorApi.getAvailability
 *   GET    /api/opd/doctors/:id/leaves        doctorApi.listLeaves
 *   POST   /api/opd/doctors/:id/leaves        doctorApi.markLeave
 *
 * Owned by the doctor domain (`doctorSlice` for the shared list; the profile,
 * availability and leave calls are doctor-domain operations the doctors page
 * consumes directly — Rules 2 & 25).
 */

import { apiClient } from "./apiClient";
import { API_ENDPOINTS } from "./endpoints";
import type { Appointment, Doctor } from "@/types";

export const doctorApi = {
  getAll: (params?: Record<string, unknown>) =>
    apiClient<Doctor[]>(API_ENDPOINTS.doctors.list, { method: "GET", params }),

  /** Full doctor profile (qualifications, registration, schedule …). */
  getById: (id: string | number) =>
    apiClient<Doctor>(API_ENDPOINTS.doctors.getById(id), { method: "GET" }),

  create: (payload: unknown) =>
    apiClient<Doctor>(API_ENDPOINTS.doctors.create, {
      method: "POST",
      body: payload,
    }),

  update: (id: string | number, payload: unknown) =>
    apiClient<Doctor>(API_ENDPOINTS.doctors.update(id), {
      method: "PATCH",
      body: payload,
    }),

  remove: (id: string | number) =>
    apiClient(API_ENDPOINTS.doctors.delete(id), { method: "DELETE" }),

  /** Create/replace the weekly availability schedule of a doctor. */
  saveAvailability: (doctorId: string | number, payload: unknown) =>
    apiClient(API_ENDPOINTS.doctors.availability(doctorId), {
      method: "POST",
      body: payload,
    }),

  /** Slot availability for a given date (optionally filtered). */
  getAvailability: (doctorId: string | number, params?: Record<string, unknown>) =>
    apiClient(API_ENDPOINTS.doctors.availability(doctorId), {
      method: "GET",
      params,
    }),

  /** Leaves inside a date window. */
  listLeaves: (
    doctorId: string | number,
    params?: Record<string, unknown>,
  ) =>
    apiClient(API_ENDPOINTS.doctors.leaves(doctorId), {
      method: "GET",
      params,
    }),

  markLeave: (doctorId: string | number, payload: unknown) =>
    apiClient(API_ENDPOINTS.doctors.leaves(doctorId), {
      method: "POST",
      body: payload,
    }),
};

export type { Doctor, Appointment };
