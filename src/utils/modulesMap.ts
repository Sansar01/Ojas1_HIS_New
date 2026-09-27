/**
 * @deprecated — use moduleIcons.ts instead.
 * This file now re-exports icon-only mapping to avoid duplication.
 * Labels/routes should come from entitlement API (module.name / module.route).
 */
export { moduleIcons as moduleMap, getModuleIconByCode as getModuleInfoByLabel, getModuleIconByCode } from "./moduleIcons";

// Legacy helper kept for backward compat — now delegates to icon-only lookup
// New code should use getModuleIconByCode(code) and module.name / module.route directly.
import { getModuleIconByCode } from "./moduleIcons";
export function getModuleInfoByLabelCompat(label: string) {
  return getModuleIconByCode(label);
}
