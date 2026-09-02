import { useRootSelector } from "@/hooks";
import { canAccessModule } from "@/utils/permissions";
import type { ModuleKey, Permission } from "@/types";
import type { Entitlements } from "@/types/entitlement";

/**
 * Custom hook to check user permissions based on Entitlements.
 * Works with the new permission system.
 */
export function usePermission() {
  const entitlements = useRootSelector(
    (state) => state.auth.session?.entitlements ?? null,
  ) as Entitlements | null;

  /**
   * Check if user can perform a specific action on a module.
   */
  const can = (module: ModuleKey, action: Permission = "view"): boolean => {
    return canAccessModule(entitlements, module, action);
  };

  return {
    entitlements,
    can,

    // Convenience methods
    canView: (module: ModuleKey) => can(module, "view"),
    canCreate: (module: ModuleKey) => can(module, "create"),
    canEdit: (module: ModuleKey) => can(module, "edit"),
    canDelete: (module: ModuleKey) => can(module, "delete"),

    // Role checks
    isSuperAdmin: entitlements?.userType?.toUpperCase() === "SUPER_ADMIN",
    userType: entitlements?.userType ?? null,
  };
}
