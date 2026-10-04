/**
 * Role domain API — hospital roles and the role permission matrix.
 *
 *   GET    /api/hospital/roles                    roleApi.list
 *   GET    /api/hospital/roles/:id                roleApi.getById
 *   POST   /api/hospital/roles                    roleApi.create
 *   PATCH  /api/hospital/roles/:id                roleApi.update
 *   DELETE /api/hospital/roles/:id                roleApi.delete
 *   GET    /api/hospital/roles/master-catalog     roleApi.masterCatalog
 *
 * Owned by `roleSlice`. Pages dispatch thunks, never these functions.
 */

import { apiClient } from "./apiClient";
import { API_ENDPOINTS } from "./endpoints";

export const roleApi = {
  list: () => apiClient(API_ENDPOINTS.roles.list, { method: "GET" }),

  getById: (id: string | number) =>
    apiClient(API_ENDPOINTS.roles.getById(id), { method: "GET" }),

  create: (payload: unknown) =>
    apiClient(API_ENDPOINTS.roles.create, { method: "POST", body: payload }),

  update: (id: string | number, payload: unknown) =>
    apiClient(API_ENDPOINTS.roles.update(id), {
      method: "PATCH",
      body: payload,
    }),

  remove: (id: string | number) =>
    apiClient(API_ENDPOINTS.roles.delete(id), { method: "DELETE" }),

  /** Module catalogue used to build the permission matrix UI. */
  masterCatalog: () =>
    apiClient(API_ENDPOINTS.roles.masterCatalog, { method: "GET" }),
};

