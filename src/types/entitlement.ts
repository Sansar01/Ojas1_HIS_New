import { ModuleKey } from ".";

// src/types/entitlement.ts
export interface EntitlementFeature {
  id: string;
  name: string;
  code: string;
  action: "view" | "create" | "edit" | "delete";
  isActive?: boolean;
}

export interface EntitlementModule {
  id: string;
  name: string;
  code: string;
  route: string;
  icon?: string;
  isActive?: boolean;
  parentId?: string | null;
  sortOrder?: number;
  features: EntitlementFeature[];
}

export interface Entitlements {
  userType: string;
  modules: ModuleKey[];
}
