// src/types/entitlement.ts

import type { ModuleKey } from ".";

/**
 * Feature inside a module (optional - only if API returns it)
 */
export interface EntitlementFeature {
  id: string;
  name: string;
  code: string;
  action: "view" | "create" | "edit" | "delete";
  isActive?: boolean;
}

/**
 * Module structure coming from the API
 */
export interface EntitlementModule {
  id: string;
  name: string;
  code: string;
  route: string;
  icon?: string;
  isActive?: boolean;
  parentId?: string | null;
  sortOrder?: number;
  features?: EntitlementFeature[]; // Uncomment only if API returns this
}

/**
 * Main Entitlements object returned after login
 */
export interface Entitlements {
  userType: string;
  modules: EntitlementModule[]; // Now using full module objects instead of ModuleKey[]
}
