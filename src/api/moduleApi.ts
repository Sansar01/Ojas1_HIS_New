/**
 * Module domain API — the module/entitlement catalogue of the signed-in user.
 *
 *   GET /api/hospital/roles/entitlements/modules     moduleApi.available
 *
 * This is the endpoint behind the "/permission" bootstrap stage: it is called
 * exactly once per authenticated session by `moduleSlice.fetchModules`, and
 * every consumer (sidebar, route guards, pages) reads the result from Redux.
 *
 * Rule 43 — `/permission` is the single bootstrap owner for this call.
 */

import { apiClient } from "./apiClient";
import { API_ENDPOINTS } from "./endpoints";
import type { EntitlementModule } from "@/types";

export const moduleApi = {
  /** Modules (+ features) the current user is entitled to open. */
  available: () =>
    apiClient<EntitlementModule[]>(API_ENDPOINTS.modules.available, {
      method: "GET",
    }),
};

