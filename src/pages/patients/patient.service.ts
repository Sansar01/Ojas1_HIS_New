/**
 * Patient feature service — the ONLY place patient endpoints are known.
 *
 *   GET    /api/opd/patients          fetchPatients(params?)
 *   GET    /api/opd/patients/:id      fetchPatientById(id)
 *   POST   /api/opd/patients          createPatient(payload)
 *   PATCH  /api/opd/patients/:id      updatePatient(id, payload)
 *   DELETE /api/opd/patients/:id      deletePatient(id)
 *
 * Every request goes through the shared axios instance (`@/api/axios`), so base
 * URL, auth headers, token refresh, timeouts, session gate and error
 * normalisation stay in one place. This file holds no Redux, no hooks, no UI:
 * pages keep the results in their own local state.
 */

import { axios } from "@/api/axios";
import type { Status } from "@/types";

/** Patient endpoints — owned by the patient feature. */
const PATIENTS = "/api/opd/patients";
const patientPath = (id: string | number) => `${PATIENTS}/${id}`;

/** Optional query parameters of the patient list (search / paging / filters). */
export interface PatientQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: Status | "all";
  [key: string]: unknown;
}

/** Patient write payload — the DTO as the registration/edit form builds it. */
export type PatientPayload = Record<string, any>;

/**
 * Patient list. Every variant is a parameter, never a separate method:
 *
 *   fetchPatients()                       → first page
 *   fetchPatients({ search: "Sansar" })   → dropdown / list search
 *   fetchPatients({ page: 2, limit: 20 }) → paging
 */

/* --------------------------------------------------------------------------
 * Service object — every method returns the axios request directly.
 * ----------------------------------------------------------------------- */

export const patientService = {
  fetchPatients: (params?: PatientQueryParams) =>
    axios.get(PATIENTS, { params }),
  /** One patient record (detail screen, edit form). */
  fetchPatientById: (id: string | number) => axios.get(patientPath(id)),
  /** Patient registration. */
  createPatient: (payload: PatientPayload) => axios.post(PATIENTS, payload),
  /** Update an existing patient record. */
  updatePatient: (id: string | number, payload: PatientPayload) =>
    axios.patch(patientPath(id), payload),
  /** Remove a patient record. */
  deletePatient: (id: string | number) => axios.delete(patientPath(id)),
};
