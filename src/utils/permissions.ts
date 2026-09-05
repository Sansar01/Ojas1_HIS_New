// src/utils/permissions.ts

import type { ModuleKey, Permission } from "@/types";
import type { EntitlementModule, Entitlements } from "@/types/entitlement";

const normalize = (value: string) =>
  value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");

const findModule = (modules: EntitlementModule[], requested: string) => {
  const key = normalize(requested);
  const exactRoute = modules.find(
    (item) => normalize(item.route ?? "") === key,
  );
  if (exactRoute) return exactRoute;

  return modules.find((item) => {
    const route = item.route?.replace(/^\//, "").split("/")[0] ?? "";
    return (
      normalize(item.code) === key ||
      normalize(route) === key ||
      normalize(item.name) === key
    );
  });
};

const featureAllows = (
  module: EntitlementModule,
  featureCode: string,
  featureName: string,
  action: Permission,
) => {
  const code = normalize(featureCode);
  const name = normalize(featureName);
  const actionCode = normalize(action);
  const moduleCode = normalize(module.code);
  const routeCode = normalize(module.route?.replace(/^\//, "") ?? "");

  if (featureCode && code === actionCode) return true;
  if (code === `${actionCode}_${moduleCode}`) return true;
  if (code === `${actionCode}_${routeCode}`) return true;
  if (action === "view" && (code.endsWith("_VIEW") || code.startsWith("VIEW_"))) return true;
  if (action === "create" && (code.endsWith("_CREATE") || code.startsWith("CREATE_"))) return true;
  if (action === "edit" && (code.endsWith("_EDIT") || code.startsWith("EDIT_") || code.includes("DEACTIVATE"))) return true;
  if (action === "delete" && (code.endsWith("_DELETE") || code.startsWith("DELETE_"))) return true;
  return name.startsWith(actionCode);
};

export function hasFeature(
  entitlements: Entitlements | null,
  moduleCode: string,
  featureCode: string,
) {
  const module = entitlements?.modules
    ? findModule(entitlements.modules, moduleCode)
    : undefined;
  return Boolean(
    module?.features?.some(
      (feature) =>
        feature.isActive !== false &&
        normalize(feature.code) === normalize(featureCode),
    ),
  );
}

export function canAccessModule(
  entitlements: Entitlements | null,
  module: ModuleKey | string,
  action: Permission = "view",
): boolean {
  if (!entitlements) return false;

  const userType = normalize(entitlements.userType ?? "").replace(/_/g, "");
  if (userType === "SUPERADMIN") {
    return true;
  }

  const entitlementModule = findModule(entitlements.modules, module);
  if (!entitlementModule || entitlementModule.isActive === false) return false;

  return entitlementModule.features?.some(
    (feature) =>
      feature.isActive !== false &&
      (feature.action === action ||
        featureAllows(
          entitlementModule,
          feature.code,
          feature.name,
          action,
        )),
  ) ?? false;
}
