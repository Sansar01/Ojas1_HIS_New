import { useRootSelector } from "@/hooks";
import { canAccessModule, hasFeature } from "@/utils/permissions";
import type { ModuleKey, Permission } from "@/types";
import type { Entitlements } from "@/types/entitlement";

/**
 * Custom hook to check user permissions based on Entitlements.
 * Works with the new permission system.
 */
export function usePermission() {
  const sessionEntitlements = useRootSelector(
    (state) => state.auth.session?.entitlements ?? null,
  ) as Entitlements | null;
  const dynamicModules = useRootSelector((state) => state.entitlement.modules);
  const loading = useRootSelector((state) => state.entitlement.loading);
  const ready = useRootSelector((state) => state.entitlement.ready);
  const userType = useRootSelector((state) => {
    const session: any = state.auth.session;
    return session?.user?.userType ?? session?.userType ?? session?.role?.slug ?? session?.role?.name ?? null;
  });
  const entitlements: Entitlements | null = dynamicModules.length
    ? { userType, modules: dynamicModules }
    : sessionEntitlements ?? (userType ? { userType, modules: [] } : null);

  /**
   * Check if user can perform a specific action on a module.
   */
  const can = (module: ModuleKey | string, action: Permission = "view"): boolean => {
    return canAccessModule(entitlements, module, action);
  };

  return {
    entitlements,
    loading,
    ready,
    can,
    hasFeature: (moduleCode: string, featureCode: string) =>
      hasFeature(entitlements, moduleCode, featureCode),

    // Convenience methods
    canView: (module: ModuleKey) => can(module, "view"),
    canCreate: (module: ModuleKey) => can(module, "create"),
    canEdit: (module: ModuleKey) => can(module, "edit"),
    canDelete: (module: ModuleKey) => can(module, "delete"),

    // Role checks
    isSuperAdmin: entitlements?.userType
      ? normalizeUserType(entitlements.userType)
      : false,
    userType: entitlements?.userType ?? null,
  };
}

function normalizeUserType(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "") === "SUPERADMIN";
}
