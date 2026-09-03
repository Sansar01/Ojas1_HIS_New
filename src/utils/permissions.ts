// src/utils/permissions.ts

import type { ModuleKey, Permission } from "@/types";
import { EntitlementModule, Entitlements } from "@/types/entitlement";

export function canAccessModule(
  entitlements: Entitlements | null,
  module: ModuleKey,
  action: Permission = "view",
): boolean {
  if (!entitlements) return false;

  // Super Admin bypass
  if (entitlements.userType?.toUpperCase() === "SUPER_ADMIN") {
    return true;
  }

  // //Check if module is allowed
  // if (!entitlements?.modules.includes(module)) {
  //   return false;
  // }

  return true;
}
