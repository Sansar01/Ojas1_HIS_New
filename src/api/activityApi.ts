/**
 * Activity domain API — audit log / activity feed.
 *
 *   GET    /activities      activityApi.getAll
 *   GET    /activities      activityApi.getById
 *   POST   /activities      activityApi.create
 *   PATCH  /activities      activityApi.update
 *   DELETE /activities      activityApi.remove
 *
 * The backend keeps the flat legacy route (id travels in the payload), which
 * is why the endpoint helpers in `endpoints.ts` intentionally ignore the id —
 * the paths stay byte-identical to the current integration.
 * Owned by `activitySlice`.
 */

import { apiClient } from "./apiClient";
import { API_ENDPOINTS } from "./endpoints";
import type { ActivityLog as Activity } from "@/types";

export const activityApi = {
  getAll: () =>
    apiClient<Activity[]>(API_ENDPOINTS.activities.list, { method: "GET" }),

  getById: (id: string | number) =>
    apiClient<Activity>(API_ENDPOINTS.activities.getById(id), {
      method: "GET",
    }),

  create: (payload: unknown) =>
    apiClient<Activity>(API_ENDPOINTS.activities.create, {
      method: "POST",
      body: payload,
    }),

  update: (id: string | number, payload: unknown) =>
    apiClient<Activity>(API_ENDPOINTS.activities.update(id), {
      method: "PATCH",
      body: payload,
    }),

  remove: (id: string | number) =>
    apiClient(API_ENDPOINTS.activities.delete(id), { method: "DELETE" }),
};

