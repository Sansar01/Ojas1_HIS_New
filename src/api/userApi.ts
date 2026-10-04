/**
 * User domain API — staff accounts.
 *
 *   GET    /api/hospital/users          userApi.list
 *   GET    /api/hospital/users/:id      userApi.getById
 *   POST   /api/hospital/users          userApi.create
 *   PATCH  /api/hospital/users/:id      userApi.update
 *   DELETE /api/hospital/users/:id      userApi.remove
 *
 * Owned by `userSlice`.
 */

import { apiClient } from "./apiClient";
import { API_ENDPOINTS } from "./endpoints";
import type { User } from "@/types/userTypes";

export const userApi = {
  getAll: () => apiClient<User[]>(API_ENDPOINTS.users.list, { method: "GET" }),

  getById: (id: string | number) =>
    apiClient<User>(API_ENDPOINTS.users.getById(id), { method: "GET" }),

  create: (payload: unknown) =>
    apiClient<User>(API_ENDPOINTS.users.create, { method: "POST", body: payload }),

  update: (id: string | number, payload: unknown) =>
    apiClient<User>(API_ENDPOINTS.users.update(id), {
      method: "PATCH",
      body: payload,
    }),

  remove: (id: string | number) =>
    apiClient(API_ENDPOINTS.users.delete(id), { method: "DELETE" }),
};

