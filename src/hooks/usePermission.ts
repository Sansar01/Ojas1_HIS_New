/**
 * Re-export canonical permission hook to avoid duplicate logic.
 * All RBAC checks are dynamic based on assigned modules from entitlements API,
 * with no hard-coded SUPERADMIN bypass (see utils/permissions.ts).
 */
export { usePermission } from "./index";
