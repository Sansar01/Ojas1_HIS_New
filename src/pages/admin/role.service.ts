/**
 * Role feature service — hospital roles, the RBAC matrix and the module
 * catalogue used to build it.
 *
 *   GET    /api/hospital/roles                          fetchRoles(params?)
 *   GET    /api/hospital/roles/:id                      fetchRoleById(id)
 *   POST   /api/hospital/roles                          createRole(payload)
 *   PATCH  /api/hospital/roles/:id                      updateRole(id, payload)
 *   DELETE /api/hospital/roles/:id                      deleteRole(id)
 *   GET    /api/hospital/roles/master-catalog           fetchRoleMasterCatalog()
 *   GET    /api/hospital/roles/:roleId/permissions      fetchRolePermissions(roleId)
 *   PUT    /api/hospital/roles/:roleId/permissions      updateRolePermissions(roleId, refs)
 *
 * Note on scope: reading the *current user's* module entitlements is global
 * authorization state and stays in Redux (`moduleSlice` / `permissionSlice`).
 * This service is about **managing** roles from the admin screens.
 */

import { axios } from "@/api/axios";

const ROLES = "/api/hospital/roles";
const rolePath = (id: string | number) => `${ROLES}/${id}`;
const rolePermissions = (roleId: string | number) =>
  `${rolePath(roleId)}/permissions`;

export interface RoleQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  [key: string]: unknown;
}

/** Module/feature pair assigned to a role (RBAC matrix payload). */
export interface ModuleFeatureRef {
  moduleId: number;
  featureId: number;
}

/* --------------------------------------------------------------------------
 * Service object — every method returns the axios request directly.
 * ----------------------------------------------------------------------- */

export const roleService = {
  fetchRoles: (params?: RoleQueryParams) => axios.get(ROLES, { params }),
  fetchRoleById: (id: string | number) => axios.get(rolePath(id)),
  createRole: (payload: Record<string, unknown>) => axios.post(ROLES, payload),
  updateRole: (id: string | number, payload: Record<string, unknown>) =>
    axios.patch(rolePath(id), payload),
  deleteRole: (id: string | number) => axios.delete(rolePath(id)),
  /** Module catalogue used to render the permission matrix. */
  fetchRoleMasterCatalog: () => axios.get(ROLES + "/master-catalog"),
  /** Modules/features currently granted to one role. */
  fetchRolePermissions: (roleId: string | number) =>
    axios.get(rolePermissions(roleId)),
  /** Save the module/feature assignment of one role. */
  updateRolePermissions: (
    roleId: string | number,
    moduleFeatures: ModuleFeatureRef[],
  ) => axios.put(rolePermissions(roleId), { moduleFeatures }),
};
