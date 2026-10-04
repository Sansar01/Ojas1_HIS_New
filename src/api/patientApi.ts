/**
 * Patient domain API — patient records (shared by registration, billing,
 * consultations and the doctor workspace).
 *
 *   GET    /api/opd/patients          patientApi.getAll
 *   GET    /api/opd/patients/:id      patientApi.getById
 *   POST   /api/opd/patients          patientApi.create
 *   PATCH  /api/opd/patients/:id      patientApi.update
 *   DELETE /api/opd/patients/:id      patientApi.remove
 *
 * Owned by `patientSlice` — one source of truth for every screen that needs
 * patient data (Rule 24: billing must not re-implement patient fetching).
 */

import { apiClient } from "./apiClient";
import { API_ENDPOINTS } from "./endpoints";
import type { Patient } from "@/types";

export const patientApi = {
  getAll: (params?: Record<string, unknown>) =>
    apiClient<Patient[]>(API_ENDPOINTS.patients.list, { method: "GET", params }),

  getById: (id: string | number) =>
    apiClient<Patient>(API_ENDPOINTS.patients.getById(id), { method: "GET" }),

  create: (payload: unknown) =>
    apiClient<Patient>(API_ENDPOINTS.patients.create, {
      method: "POST",
      body: payload,
    }),

  update: (id: string | number, payload: unknown) =>
    apiClient<Patient>(API_ENDPOINTS.patients.update(id), {
      method: "PATCH",
      body: payload,
    }),

  remove: (id: string | number) =>
    apiClient(API_ENDPOINTS.patients.delete(id), { method: "DELETE" }),
};

