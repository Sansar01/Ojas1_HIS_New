// src/utils/permissions.ts

import type { ModuleKey, Permission } from "@/types";
import type { EntitlementModule, Entitlements } from "@/types/entitlement";

// Helper: Slash hatayega aur normalize karega
const normalize = (value: string = "") =>
  value
    .replace(/^\/+|\/+$/g, "") // leading/trailing slash '/' remove karega
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");

// Helper: Singular/Plural dono match karne ke liye trailing 'S' hatayega
const singularize = (value: string) => value.replace(/S$/, "");

const findModule = (modules: EntitlementModule[] = [], requested: string) => {
  if (!Array.isArray(modules)) return undefined;

  const reqClean = normalize(requested);
  const reqSingular = singularize(reqClean);

  return modules.find((item) => {
    const itemCode = normalize(item.code ?? "");
    const itemRoute = normalize(item.route ?? "");
    const itemName = normalize(item.name ?? "");

    // 1. Direct match
    if (
      itemCode === reqClean ||
      itemRoute === reqClean ||
      itemName === reqClean
    ) {
      return true;
    }

    // 2. Singular/Plural Insensitive match (e.g., CONSULTATIONS == CONSULTATION)
    if (
      singularize(itemCode) === reqSingular ||
      singularize(itemRoute) === reqSingular ||
      singularize(itemName) === reqSingular
    ) {
      return true;
    }

    return false;
  });
};

const featureAllows = (
  module: EntitlementModule,
  featureCode: string = "",
  featureName: string = "",
  action: Permission = "view",
) => {
  const code = normalize(featureCode);
  const name = normalize(featureName);
  const actionCode = normalize(action);
  const moduleCode = normalize(module.code ?? "");
  const routeCode = normalize(module.route ?? "");

  if (code === actionCode) return true;
  if (code === `${actionCode}_${moduleCode}` || code === `${actionCode}_${singularize(moduleCode)}`) return true;
  if (code === `${actionCode}_${routeCode}` || code === `${actionCode}_${singularize(routeCode)}`) return true;

  // Generic checks for common backend conventions
  if (action === "view" && (code.startsWith("VIEW_") || code.endsWith("_VIEW") || code.includes("VIEW") || code.includes("READ"))) return true;
  if (action === "create" && (code.startsWith("CREATE_") || code.endsWith("_CREATE") || code.includes("CREATE") || code.includes("ADD"))) return true;
  if (action === "edit" && (code.startsWith("EDIT_") || code.endsWith("_EDIT") || code.startsWith("UPDATE_") || code.includes("EDIT") || code.includes("DEACTIVATE"))) return true;
  if (action === "delete" && (code.startsWith("DELETE_") || code.endsWith("_DELETE") || code.includes("DELETE") || code.includes("REMOVE"))) return true;

  return name.startsWith(actionCode);
};

export function hasFeature(
  entitlements: Entitlements | any,
  moduleCode: string,
  featureCode: string,
) {
  const modulesList = Array.isArray(entitlements)
    ? entitlements
    : entitlements?.modules ?? [];

  const module = findModule(modulesList, moduleCode);
  return Boolean(
    module?.features?.some(
      (feature) =>
        feature.isActive !== false &&
        (normalize(feature.code) === normalize(featureCode) ||
          singularize(normalize(feature.code)) === singularize(normalize(featureCode))),
    ),
  );
}

export function canAccessModule(
  entitlements: Entitlements | any,
  module: ModuleKey | string,
  action: Permission = "view",
): boolean {
  if (!entitlements) return false;

  // Agar backend array bhej raha hai ya { modules: [...] } object
  const modulesList: EntitlementModule[] = Array.isArray(entitlements)
    ? entitlements
    : entitlements?.modules ?? [];

  const userType = normalize(entitlements?.userType ?? "").replace(/_/g, "");
  if (userType === "SUPERADMIN") {
    return true;
  }

  const entitlementModule = findModule(modulesList, module);
  if (!entitlementModule || entitlementModule.isActive === false) {
    return false;
  }

  // Agar module mil gaya aur features array empty hai ya features match ho gaye
  if (!entitlementModule.features || entitlementModule.features.length === 0) {
    return true;
  }

  return entitlementModule.features.some(
    (feature) =>
      feature.isActive !== false &&
      (feature.action === action ||
        featureAllows(
          entitlementModule,
          feature.code,
          feature.name,
          action,
        )),
  );
}