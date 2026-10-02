/**
 * Module / entitlement models.
 *
 * Modules are a RUNTIME value: they arrive from the modules API
 * (`/api/hospital/roles/entitlements/modules`) as { id, name, code, route }.
 * There is deliberately NO closed union of module keys — the single source
 * of truth is the runtime catalogue (see `store/slices/moduleSlice.ts`).
 */

export interface EntitlementFeature {
  id: number | string;
  name: string;
  code: string;
  description?: string | null;
  action?: "view" | "create" | "edit" | "delete";
  isActive?: boolean;
}

/** Module structure coming from the API. */
export interface EntitlementModule {
  id: number | string;
  name: string;
  code: string;
  route: string;
  icon?: string;
  isActive?: boolean;
  parentId?: number | string | null;
  sortOrder?: number;
  features?: EntitlementFeature[];
}

/** Main entitlements object returned after login. */
export interface Entitlements {
  userType?: string;
  modules: EntitlementModule[];
}

/** Static description of a module in the front-end route table. */
export interface ModuleDef {
  key: string;
  label: string;
  path: string;
  icon: string; // lucide icon name resolved in constants
  group: "Clinical" | "Operations" | "Access" | "Insights";
  description: string;
}
