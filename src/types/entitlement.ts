// src/types/entitlement.ts

export interface EntitlementFeature {
  id: number | string;
  name: string;
  code: string;
  description?: string | null;
  action?: "view" | "create" | "edit" | "delete";
  isActive?: boolean;
}

/**
 * Module structure coming from the API
 */
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

/**
 * Main Entitlements object returned after login
 */
export interface Entitlements {
  userType?: string;
  modules: EntitlementModule[];
}
