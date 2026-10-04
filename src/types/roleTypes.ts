/**
 * Role model — RBAC role assigned to users, carrying per-module actions.
 */

import type { ID, ISODateTime } from "./commonTypes";
import type { Permission } from "./permissionTypes";

export interface Role {
  id: ID;
  name: string;
  slug:
    | "SUPER_ADMIN"
    | "ADMIN"
    | "DOCTOR"
    | "RECEPTIONIST"
    | "BILLING"
    | string;
  description: string;
  system: boolean;
  userCount?: number;
  permissions: Record<string, Permission[]>; // moduleId -> actions
  createdAt: ISODateTime;
}

/** One row of the system role catalogue offered when creating a role. */
export interface RoleMasterCatalogItem {
  id: number;
  name: string;
  code: string;
  isSystem: boolean;
  isActivatedInHospital: boolean;
}

/** A module/feature assignment stored against one role. */
export interface RolePermissionAssignment {
  id: number;
  hospitalRoleId: number;
  moduleId: number;
  featureId: number;
  moduleFeature?: {
    module?: { code: string };
    feature?: { code: string; name: string };
  };
}
