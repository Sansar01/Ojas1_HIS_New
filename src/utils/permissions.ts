// src/utils/permissions.ts — tightened per cleanup plan

import type { Permission } from "@/types";
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
  module: string,
): boolean {
  const modulesList: EntitlementModule[] = Array.isArray(entitlements)
    ? entitlements
    : (entitlements?.modules ?? []);

  return Boolean(findModule(modulesList, module));
}

export function canAccessModule(
  entitlements: Entitlements | any,
  module: string,
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

/* ==========================================================================
 * ROUTE-LEVEL (strict) module resolution
 * --------------------------------------------------------------------------
 * The fuzzy matcher above (singularize / route-segment heuristics) exists for
 * UI affordances — buttons, matrixes — where a false negative only hides a
 * button. Routing must NOT be fuzzy: "users" matching an unrelated API module
 * whose code merely singularises to "USER" is exactly how a page leaks to a
 * user who was never granted it.
 *
 * Route access therefore resolves a module ONLY by exact identity:
 *   normalized(module.code) | normalized(module.route) | normalized(module.name)
 * and every accepted key must be declared in the `<Route>` list in src/routes/index.tsx.
 * ======================================================================== */

/** Canonical form used for every comparison: "/master-config" → "MASTER_CONFIG". */
export const normalizeModuleKey = (value: string = "") =>
  (value ?? "")
    .replace(/^\/+|\/+$/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");

/** Every identity string the backend may use for one module. */
const moduleIdentities = (module: EntitlementModule): string[] =>
  [module?.code, module?.route, module?.name]
    .map((value) => normalizeModuleKey(value as string))
    .filter(Boolean);

/** Accepts either `Entitlements` or a bare `EntitlementModule[]`. */
const toModulesList = (
  entitlements: Entitlements | any,
): EntitlementModule[] =>
  Array.isArray(entitlements)
    ? (entitlements as EntitlementModule[])
    : Array.isArray(entitlements?.modules)
      ? entitlements.modules
      : [];

/**
 * Strict lookup — the ONLY resolver used for routing.
 * Pass every accepted key (primary + aliases passed by ModuleRoute); a module
 * matches when ANY of its identities equals ANY of the wanted keys.
 */
export function findEntitlementModule(
  entitlements: Entitlements | any,
  keys: string | string[],
): EntitlementModule | undefined {
  const modules = toModulesList(entitlements);
  if (!modules.length) return undefined;

  const wanted = (Array.isArray(keys) ? keys : [keys])
    .map((key) => normalizeModuleKey(key))
    .filter(Boolean);
  if (!wanted.length) return undefined;

  return modules.find((module) => {
    const identities = moduleIdentities(module);
    return wanted.some((key) => identities.includes(key));
  });
}

/** Does an already-resolved module grant `action`? (empty features = all granted) */
export function moduleAllowsAction(
  module: EntitlementModule | undefined,
  action: Permission = "view",
): boolean {
  if (!module || module.isActive === false) return false;
  if (!module.features || module.features.length === 0) return true;
  return module.features.some(
    (feature) =>
      feature.isActive !== false &&
      (feature.action === action ||
        featureAllows(module, feature.code, feature.name, action)),
  );
}

export type RouteAccessStatus = "allowed" | "forbidden" | "not-found";

export interface RouteAccess {
  status: RouteAccessStatus;
  /** the entitlement module that matched, when one did */
  module?: EntitlementModule;
}

/**
 * The whole routing decision in one pure function:
 *   not-found  → the API did not hand this user the module  → render 404
 *   forbidden  → module exists but the action is not granted → render 403
 *   allowed    → render the page
 */
export function checkRouteAccess(
  entitlements: Entitlements | any,
  keys: string | string[],
  action: Permission = "view",
): RouteAccess {
  const module = findEntitlementModule(entitlements, keys);
  if (!module || module.isActive === false) return { status: "not-found" };
  if (!moduleAllowsAction(module, action))
    return { status: "forbidden", module };
  return { status: "allowed", module };
}
