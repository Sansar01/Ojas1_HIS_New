// src/utils/permissions.ts — tightened per cleanup plan

import type { ModuleKey, Permission } from "@/types";
import type { EntitlementModule, Entitlements } from "@/types/entitlement";

const normalize = (value: string = "") =>
  value
    .replace(/^\/+|\/+$/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");

const singularize = (value: string) => value.replace(/S$/, "");

const findModule = (modules: EntitlementModule[] = [], requested: string) => {
  if (!Array.isArray(modules)) return undefined;
  const reqClean = normalize(requested);
  const reqSingular = singularize(reqClean);

  return modules.find((item) => {
    const itemCode = normalize(item.code ?? "");
    const itemRoute = normalize(item.route ?? "");
    const itemName = normalize(item.name ?? "");
    const itemRouteModule = itemRoute.split("_")[0];

    if (
      itemCode === reqClean ||
      itemRoute === reqClean ||
      itemName === reqClean ||
      itemRouteModule === reqClean
    ) {
      return true;
    }
    if (
      singularize(itemCode) === reqSingular ||
      singularize(itemRoute) === reqSingular ||
      singularize(itemName) === reqSingular ||
      singularize(itemRouteModule) === reqSingular
    ) {
      return true;
    }
    return false;
  });
};

// Tightened: explicit action matching only, no broad includes('VIEW') that can accidentally match
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
  const moduleSingular = singularize(moduleCode);
  const routeSingular = singularize(routeCode);

  // Direct explicit matches
  if (code === actionCode) return true;
  if (name === actionCode) return true;

  // Exact prefixed/suffixed patterns: ACTION_MODULE, MODULE_ACTION
  const exactPatterns = [
    `${actionCode}_${moduleCode}`,
    `${moduleCode}_${actionCode}`,
    `${actionCode}_${routeCode}`,
    `${routeCode}_${actionCode}`,
    `${actionCode}_${moduleSingular}`,
    `${moduleSingular}_${actionCode}`,
    `${actionCode}_${routeSingular}`,
    `${routeSingular}_${actionCode}`,
  ];
  if (exactPatterns.includes(code)) return true;
  if (exactPatterns.includes(name)) return true;

  // Explicit aliases — no substring includes()
  if (action === "view") {
    // READ is explicit alias for VIEW
    if (
      code === "READ" ||
      code === `READ_${moduleCode}` ||
      code === `${moduleCode}_READ`
    )
      return true;
    if (code === "VIEW") return true;
  }
  if (action === "edit") {
    // UPDATE is explicit alias for EDIT
    if (
      code === "UPDATE" ||
      code === `UPDATE_${moduleCode}` ||
      code === `${moduleCode}_UPDATE`
    )
      return true;
    if (code === "EDIT") return true;
  }
  if (action === "create") {
    if (code === "CREATE" || code === `ADD`) return true;
  }
  if (action === "delete") {
    if (code === "DELETE" || code === "REMOVE") return true;
  }

  // Name-based explicit start: e.g., VIEW_PATIENTS
  if (name.startsWith(`${actionCode}_`)) return true;

  return false;
};

export function hasFeature(
  entitlements: Entitlements | any,
  moduleCode: string,
  featureCode: string,
) {
  const modulesList = Array.isArray(entitlements)
    ? entitlements
    : (entitlements?.modules ?? []);

  const module = findModule(modulesList, moduleCode);
  return Boolean(
    module?.features?.some(
      (feature) =>
        feature.isActive !== false &&
        (normalize(feature.code) === normalize(featureCode) ||
          singularize(normalize(feature.code)) ===
            singularize(normalize(featureCode))),
    ),
  );
}

export function isModuleRegistered(
  entitlements: Entitlements | any,
  module: ModuleKey | string,
): boolean {
  const modulesList: EntitlementModule[] = Array.isArray(entitlements)
    ? entitlements
    : (entitlements?.modules ?? []);

  return Boolean(findModule(modulesList, module));
}

export function canAccessModule(
  entitlements: Entitlements | any,
  module: ModuleKey | string,
  action: Permission = "view",
): boolean {
  if (!entitlements) return false;

  // Single runtime source: entitlementSlice.modules — no SUPERADMIN bypass
  const modulesList: EntitlementModule[] = Array.isArray(entitlements)
    ? entitlements
    : (entitlements?.modules ?? []);

  const entitlementModule = findModule(modulesList, module);
  if (!entitlementModule || entitlementModule.isActive === false) {
    return false;
  }

  if (!entitlementModule.features || entitlementModule.features.length === 0) {
    return true;
  }

  return entitlementModule.features.some(
    (feature) =>
      feature.isActive !== false &&
      (feature.action === action ||
        featureAllows(entitlementModule, feature.code, feature.name, action)),
  );
}
