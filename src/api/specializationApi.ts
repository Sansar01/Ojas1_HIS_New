/**
 * Specialization domain API — doctor specializations (masters).
 *
 *   GET    /specializations       specializationApi.getAll
 *   POST   /specializations       specializationApi.create
 *   PATCH  /specializations       specializationApi.update
 *   DELETE /specializations       specializationApi.remove
 *
 * The backend exposes these as flat routes (no :id segment); the id is still
 * accepted by the helpers so the CRUD contract stays uniform with the other
 * domains. Owned by `specializationSlice`.
 */

import { apiClient } from "./apiClient";
import { API_ENDPOINTS } from "./endpoints";
import type { Specialization } from "@/types";

export const specializationApi = {
  getAll: () =>
    apiClient<Specialization[]>(API_ENDPOINTS.specializations.list, {
      method: "GET",
    }),

  getById: (id: string | number) =>
    apiClient<Specialization>(API_ENDPOINTS.specializations.getById(id), {
      method: "GET",
    }),

  create: (payload: unknown) =>
    apiClient<Specialization>(API_ENDPOINTS.specializations.create, {
      method: "POST",
      body: payload,
    }),

  update: (id: string | number, payload: unknown) =>
    apiClient<Specialization>(API_ENDPOINTS.specializations.update(id), {
      method: "PATCH",
      body: payload,
    }),

  remove: (id: string | number) =>
    apiClient(API_ENDPOINTS.specializations.delete(id), { method: "DELETE" }),
};

