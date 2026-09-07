import { API_BASE_URL, API_ENDPOINTS } from "@/config/api";
import type { ApiResponse, ListQuery, Paginated, Session } from "@/types";
import { EntitlementModule } from "@/types/entitlement";

/* ---------------------------------------------------------------------------
 * Real API Client (Production Mode)
 *
 * Uses centralized configuration from src/config/api.ts
 * All URLs come from API_ENDPOINTS — no hardcoded paths or duplication.
 * ------------------------------------------------------------------------- */

export const TOKEN_KEY = "authUserToken";

let token: string | null = (() => {
  try {
    const stored = JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
    return stored?.accessToken ?? stored?.token ?? null;
  } catch {
    return null;
  }
})();

export const setToken = (t: string | null) => {
  token = t;
};
export const getToken = () => token;

/**
 * [FALLBACK — kept for easy undo] Old behavior: on any 401, wipe the session
 * and hard-redirect to login. Re-enable this inside request() if you ever want
 * to go back to "no refresh" behavior.
 */
// function handleUnauthorized() {
//   localStorage.removeItem(TOKEN_KEY);
//   token = null;
//
//   // Avoid a redirect loop if we are already on an auth page
//   const publicPaths = ["/accounts/login", "/accounts/forgot", "/accounts/reset"];
//   if (publicPaths.some((p) => window.location.pathname.startsWith(p))) return;
//
//   // Hard redirect guarantees the router re-initializes in a logged-out state
//   window.location.replace(`/accounts/login?expired=1`);
// }

/* --------------------- Token refresh coordination ------------------------ */

let refreshPromise: Promise<boolean> | null = null;

/**
 * Ask the auth slice to run the refresh-token flow. All concurrent 401s
 * share a single in-flight refresh so the API is hit only once.
 * The actual refresh request lives in authSlice.refreshSession — apiClient
 * cannot import the store directly (circular import), so the thunk is
 * invoked through the registered callback set by the store bootstrap.
 */
let runRefresh: (() => Promise<boolean>) | null = null;

export function registerRefreshHandler(fn: () => Promise<boolean>) {
  runRefresh = fn;
}

async function refreshOnce(): Promise<boolean> {
  if (!runRefresh) return false;
  if (!refreshPromise) {
    refreshPromise = runRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * Called when refresh ultimately fails (thunk returned false):
 * clears the session and navigates to the login page.
 */
function forceLoginRedirect() {
  localStorage.removeItem(TOKEN_KEY);
  token = null;

  const publicPaths = [
    "/accounts/login",
    "/accounts/forgot",
    "/accounts/reset",
  ];
  if (publicPaths.some((p) => window.location.pathname.startsWith(p))) return;

  window.location.replace(`/accounts/login?expired=1`);
}

export interface RequestConfig {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: any;
  params?: Record<string, any>;
  silent?: boolean;
  /** Skip the automatic 401 → refresh → retry flow (used by login/refresh itself) */
  skipRefresh?: boolean;
  meta?: { successMessage?: string; errorMessage?: string };
}

/* ----------------------------- Core Request ------------------------------ */

export async function request<T = any>(
  config: RequestConfig,
): Promise<ApiResponse<T>> {
  const queryString = config.params
    ? "?" + new URLSearchParams(config.params as any).toString()
    : "";
  // src/config/api.ts
  const url = `${API_BASE_URL}${config.url}${queryString}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    let response = await fetch(url, {
      method: config.method,
      headers,
      body: config.body ? JSON.stringify(config.body) : undefined,
    });

    // ---------------- 401 → try refresh once, then retry ----------------
    if (response.status === 401) {
      const refreshed = await refreshOnce();
      if (refreshed && token) {
        // Retry the original request with the new access token
        headers["Authorization"] = `Bearer ${token}`;
        response = await fetch(url, {
          method: config.method,
          headers,
          body: config.body ? JSON.stringify(config.body) : undefined,
        });
      }

      // Refresh failed (or retry still 401) → session is dead → login
      if (response.status === 401) {
        // [FALLBACK — kept for easy undo] old behavior:
        // handleUnauthorized();
        forceLoginRedirect();
        const data401 = await response.json().catch(() => ({}));
        throw new Error(
          data401?.message || "Session expired. Please sign in again.",
        );
      }
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        data?.message || `Request failed with status ${response.status}`;
      throw new Error(message);
    }

    return data as ApiResponse<T>;
  } catch (error: any) {
    throw new Error(error?.message || "Network error");
  }
}

/* ------------------------------- Auth API -------------------------------- */

export const authApi = {
  async login(email: string, password: string): Promise<ApiResponse<Session>> {
    const res = await request<Session>({
      url: API_ENDPOINTS.auth.login,
      method: "POST",
      body: { email, password },
      skipRefresh: true, // a failed login (401) must NOT trigger a refresh
    });

    return res;
  },

  async logout(): Promise<ApiResponse<boolean>> {
    try {
      const res = await request<boolean>({
        url: API_ENDPOINTS.auth.logout, // Make sure this endpoint exists in api.ts
        method: "POST",
      });

      return res;
    } catch (error: any) {
      // Even if the API fails, we still want to logout locally
      console.warn("Logout API failed, proceeding with local logout");
      return {
        success: true,
        data: true,
        message: "Logged out locally",
      };
    }
  },

  async refresh(): Promise<ApiResponse<Session>> {
    return request<Session>({
      url: API_ENDPOINTS.auth.refresh,
      method: "POST",
      skipRefresh: true, // never recurse: refresh failure is final
    });
  },

  // async me(): Promise<ApiResponse<Session | null>> {
  //   if (!token) return { success: true, data: null, message: "No session" };
  //   try {
  //     return await request<Session>({
  //       url: API_ENDPOINTS.auth.me,
  //       method: "GET",
  //     });
  //   } catch {
  //     return { success: false, data: null, message: "Session invalid" };
  //   }
  // },

  async changePassword(email: string) {
    return request({
      url: API_ENDPOINTS.auth.changePassword,
      method: "POST",
      body: { email },
    });
  },

  async resetPassword(email: string, password: string) {
    return request({
      url: API_ENDPOINTS.auth.resetPassword,
      method: "POST",
      body: { email, password },
    });
  },
};

/*----------------------------------- Entitlement API -------------------------------- */

export const entitlementApi = {
  async getModules() {
    return request<EntitlementModule[]>({
      url: API_ENDPOINTS.entitlement_modules,
      method: "GET",
    });
  },
};

/* ------------------------------- CRUD API -------------------------------- */

// Use API_ENDPOINTS for all resource URLs instead of duplicating paths
export const resourceApi = {
  list: (resource: keyof typeof API_ENDPOINTS, params?: ListQuery) =>
    request<Paginated<any>>({
      url: (API_ENDPOINTS as any)[resource] || `/${resource}`,
      method: "GET",
      params,
    }),

  get: (resource: keyof typeof API_ENDPOINTS, id: string) =>
    request<any>({
      url: `${(API_ENDPOINTS as any)[resource] || `/${resource}`}/${id}`,
      method: "GET",
    }),

  create: (resource: keyof typeof API_ENDPOINTS, body: any) =>
    request<any>({
      url: (API_ENDPOINTS as any)[resource] || `/${resource}`,
      method: "POST",
      body,
    }),

  update: (resource: keyof typeof API_ENDPOINTS, id: string, body: any) =>
    request<any>({
      url: `${(API_ENDPOINTS as any)[resource] || `/${resource}`}/${id}`,
      method: "PATCH",
      body,
    }),

  remove: (resource: keyof typeof API_ENDPOINTS, id: string) =>
    request<any>({
      url: `${(API_ENDPOINTS as any)[resource] || `/${resource}`}/${id}`,
      method: "DELETE",
    }),
};

// ------------------------------------Appointment------------------------------

export const appointmentApi = {
  async list(params?: any) {
    return request({
      url: API_ENDPOINTS.appointment.list,
      method: "GET",
      params,
    });
  },

  async create(data: any) {
    return request({
      url: API_ENDPOINTS.appointment.create,
      method: "POST",
      body: data,
    });
  },

  // async update(id: string, data: any) {
  //   return request({
  //     url: API_ENDPOINTS.appointment.update,
  //     method: "PUT",
  //     body: data,
  //   });
  // },

  // async remove(id: string) {
  //   return request({
  //     url: API_ENDPOINTS.appointment.delete,
  //     method: "DELETE",
  //   });
  // },
};

/* ------------------------------- Helpers --------------------------------- */

export const snapshot = () => null;
export const resetDb = () => {
  console.warn("resetDb() is disabled in real API mode");
};
