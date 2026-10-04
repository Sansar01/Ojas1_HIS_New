/**
 * Permission domain API — module/feature assignments of a role.
 *
 *   GET  /api/hospital/roles/:roleId/permissions    permissionApi.getByRole
 *   PUT  /api/hospital/roles/:roleId/permissions    permissionApi.updateByRole
 *
 * Owned by `roleSlice` (the RBAC matrix screen). Nothing else calls it.
 */

import { apiClient } from "./apiClient";
import { API_ENDPOINTS } from "./endpoints";

export interface ModuleFeatureRef {
  moduleId: number;
  featureId: number;
}

export const permissionApi = {
  getByRole: (roleId: string | number) =>
    apiClient(API_ENDPOINTS.permissions.byRole(roleId), { method: "GET" }),

  updateByRole: (roleId: string | number, moduleFeatures: ModuleFeatureRef[]) =>
    apiClient(API_ENDPOINTS.permissions.byRole(roleId), {
      method: "PUT",
      body: { moduleFeatures },
    }),
};

