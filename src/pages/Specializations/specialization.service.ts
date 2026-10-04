/**
 * Specialization feature service — doctor specializations (masters).
 *
 *   GET    /specializations     fetchSpecializations(params?)
 *   POST   /specializations     createSpecialization(payload)
 *   PATCH  /specializations     updateSpecialization(id, payload)
 *   DELETE /specializations     deleteSpecialization(id)
 *
 * The backend exposes these as flat routes (no `:id` segment); the id is still
 * accepted so the CRUD contract stays uniform with every other feature.
 */

import { axios } from "@/api/axios";

/** Legacy flat path kept byte-identical to the current integration. */
const SPECIALIZATIONS = "/specializations";

export interface SpecializationQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  [key: string]: unknown;
}

/** Specialization write payload — the DTO as the form builds it. */
export type SpecializationPayload = Record<string, any>;

/* --------------------------------------------------------------------------
 * Service object — every method returns the axios request directly.
 * ----------------------------------------------------------------------- */

export const specializationService = {
  fetchSpecializations: (params?: SpecializationQueryParams) =>
    axios.get(SPECIALIZATIONS, { params }),
  /**
   * One specialization. The backend serves the whole collection from this flat
   * route, so the id is accepted for a uniform CRUD contract but — exactly like
   * the previous integration — is not sent as a path segment.
   */
  fetchSpecializationById: (_id: string | number) => axios.get(SPECIALIZATIONS),
  createSpecialization: (payload: SpecializationPayload) =>
    axios.post(SPECIALIZATIONS, payload),
  /** PATCH /specializations — the record id travels inside the payload. */
  updateSpecialization: (
    _id: string | number,
    payload: SpecializationPayload,
  ) => axios.patch(SPECIALIZATIONS, payload),
  deleteSpecialization: (_id: string | number) => axios.delete(SPECIALIZATIONS),
};
