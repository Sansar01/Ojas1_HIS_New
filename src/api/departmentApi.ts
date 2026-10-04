/**
 * Department domain API — hospital departments (masters).
 *
 *   GET    /api/hospital/masters/departments        departmentApi.getAll
 *   GET    /api/hospital/masters/departments/:id    departmentApi.getById
 *   POST   /api/hospital/masters/departments        departmentApi.create
 *   PATCH  /api/hospital/masters/departments/:id    departmentApi.update
 *   DELETE /api/hospital/masters/departments/:id    departmentApi.remove
 *
 * Owned by `departmentSlice`. Reference data used by patient registration,
 * the doctor form, the appointment form and the user form — so it lives in
 * Redux, loaded once per session (Rules 5, 9, 21).
 */

import { apiClient } from "./apiClient";
import { API_ENDPOINTS } from "./endpoints";
import type { Department } from "@/types";

export const departmentApi = {
  getAll: () =>
    apiClient<Department[]>(API_ENDPOINTS.departments.list, { method: "GET" }),

  getById: (id: string | number) =>
    apiClient<Department>(API_ENDPOINTS.departments.getById(id), {
      method: "GET",
    }),

  create: (payload: unknown) =>
    apiClient<Department>(API_ENDPOINTS.departments.create, {
      method: "POST",
      body: payload,
    }),

  update: (id: string | number, payload: unknown) =>
    apiClient<Department>(API_ENDPOINTS.departments.update(id), {
      method: "PATCH",
      body: payload,
    }),

  remove: (id: string | number) =>
    apiClient(API_ENDPOINTS.departments.delete(id), { method: "DELETE" }),
};

