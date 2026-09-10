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

/** Refresh proactively when the token is within this window of expiring */
const EXPIRY_MARGIN_MS = 30_000;

let token: string | null = (() => {
  try {
    const stored = JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
    return stored?.accessToken ?? stored?.token ?? null;
  } catch {
    return null;
  }
})();

/** When the current accessToken expires (epoch ms). Restored from localStorage. */
let expiresAtMs: number | null = (() => {
  try {
    const stored = JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
    return parseExpiry(stored?.expiresAt);
  } catch {
    return null;
  }
})();

/** Accepts epoch seconds, epoch ms, or an ISO date string; returns epoch ms */
function parseExpiry(value: any): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return value > 1e12 ? value : value * 1000;
  if (/^\d+$/.test(String(value))) {
    const n = Number(value);
    return n > 1e12 ? n : n * 1000;
  }
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

export const setToken = (t: string | null) => {
  token = t;
};
export const getToken = () => token;

/* ------------------------- Refresh token storage ------------------------- */

/**
 * The refresh token normally lives in an httpOnly cookie, but some backends
 * return it in the login/refresh response body instead (or the cookie does
 * not survive cross-origin reloads). We persist it to localStorage so the
 * refresh call can always send it explicitly.
 */
const REFRESH_KEY = "authRefreshToken";

export function setRefreshToken(t: string | null | undefined) {
  try {
    if (t) localStorage.setItem(REFRESH_KEY, t);
    else localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function getRefreshToken(): string | null {
  try {
    const direct = localStorage.getItem(REFRESH_KEY);
    if (direct) return direct;
    // fallback: stored inside the persisted auth session object
    const stored = JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
    return stored?.refreshToken ?? stored?.user?.refreshToken ?? null;
  } catch {
    return null;
  }
}

export function clearRefreshToken() {
  setRefreshToken(null);
}

/** Keep the in-memory expiry in sync whenever login/refresh/store gives us one */
export function setTokenExpiry(value: any) {
  expiresAtMs = parseExpiry(value);
}

/** Token exists AND its expiry has passed */
export function isTokenExpired() {
  return !!token && expiresAtMs !== null && Date.now() >= expiresAtMs;
}

/** Token exists AND will expire within the margin window */
export function isTokenExpiringSoon() {
  return !!token && expiresAtMs !== null && Date.now() >= expiresAtMs - EXPIRY_MARGIN_MS;
}

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
 * Proactive watchdog: while the tab is open, refresh the token shortly before
 * it expires so active users never hit a 401 at all. If the refresh fails and
 * the token is already dead, navigate to the login screen.
 */
export function startSessionWatchdog(intervalMs = 60_000) {
  setInterval(async () => {
    if (!token) return;
    if (!isTokenExpiringSoon()) return;
    const ok = await refreshOnce();
    if (!ok && isTokenExpired()) {
      forceLoginRedirect();
    }
  }, intervalMs);
}

/**
 * Called when refresh ultimately fails (thunk returned false):
 * clears the session and navigates to the login page.
 */
function forceLoginRedirect() {
  localStorage.removeItem(TOKEN_KEY);
  clearRefreshToken();
  token = null;

  const publicPaths = [
    "/accounts/login",
    "/accounts/forgot",
    "/accounts/reset",
  ];
  if (publicPaths.some((p) => window.location.pathname.startsWith(p))) return;

  window.location.replace(`/accounts/login?expired=1`);
}
const handleUnauthorized = () => {
  token = null;
  localStorage.removeItem(TOKEN_KEY);

  if (window.location.pathname !== "/accounts/login") {
    window.location.replace("/accounts/login");
  }
};

export interface RequestConfig {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: any;
  params?: Record<string, any>;
  silent?: boolean;
  /** Skip the automatic 401 → refresh → retry flow (used by login/refresh itself) */
  skipRefresh?: boolean;
  /** Do not attach the Authorization header (cookie-based refresh call) */
  skipAuth?: boolean;
  /** Include cookies (needed when the session lives in an httpOnly cookie) */
  withCredentials?: boolean;
  /** Extra headers (e.g. x-refresh-token on the refresh call) */
  headers?: Record<string, string>;
  credentials?:string
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

  if (token && !config.skipAuth) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (config.headers) Object.assign(headers, config.headers);

  try {
    const fetchInit = (): RequestInit => ({
      method: config.method,
      headers,
      body: config.body ? JSON.stringify(config.body) : undefined,
      credentials: config.withCredentials ? "include" : "same-origin",
    });

    // -------- Proactive check: token expired or about to expire? --------
    // Refresh BEFORE sending so the request goes out with a valid token.
    if (token && !config.skipRefresh && isTokenExpiringSoon()) {
      const ok = await refreshOnce();
      if (!ok && isTokenExpired()) {
        // Refresh failed and the token is dead → login screen
        forceLoginRedirect();
        throw new Error("Session expired. Please sign in again.");
      }
      if (ok && token) headers["Authorization"] = `Bearer ${token}`;
    }

    let response = await fetch(url, fetchInit());

    // ---------------- 401 → try refresh once, then retry ----------------
    if (response.status === 401) {
      const refreshed = await refreshOnce();
      if (refreshed && token) {
        // Retry the original request with the new access token
        headers["Authorization"] = `Bearer ${token}`;
        response = await fetch(url, fetchInit());
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
      if (response.status === 401) {
        handleUnauthorized();
      }
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
      withCredentials: true, // REQUIRED: lets the browser store the httpOnly refreshToken cookie the server sets
    });

    return res;
  },

  async logout(): Promise<ApiResponse<boolean>> {
    try {
      const res = await request<boolean>({
        url: API_ENDPOINTS.auth.logout, // Make sure this endpoint exists in api.ts
        method: "POST",
        withCredentials: true, // server clears the refreshToken cookie here
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
    // Primary: the backend identifies the session via the httpOnly refreshToken
    // cookie. Fallback: if the cookie is missing (e.g. cleared on reload,
    // cross-origin port mismatch) we send the persisted refresh token in both
    // the body and the x-refresh-token header.
    const refreshToken = getRefreshToken();
    return request<Session>({
      url: API_ENDPOINTS.auth.refresh,
      method: "POST",
      skipRefresh: true, // never recurse: refresh failure is final
      skipAuth: true, // no Bearer header — this is the refresh call
      withCredentials: true, // send the refreshToken cookie when present

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
/**
 * Some endpoints are grouped objects (e.g. doctors: { create, list },
 * appointment: { list, create, getById }) — resolve the right one per verb.
 */
const resolveEndpoint = (
  resource: keyof typeof API_ENDPOINTS,
  verb: "list" | "create" | "get" | "update" | "remove",
  id?: string | number,
): string => {
  const entry: any = (API_ENDPOINTS as any)[resource];
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object") {
    if (verb === "list") return entry.list ?? `/${resource}`;
    if (verb === "create") return entry.create ?? entry.list ?? `/${resource}`;
    if (verb === "get") {
      const ep = entry.getById ?? entry.list;
      return typeof ep === "function" ? ep(id) : (ep ?? `/${resource}`);
    }
    if (verb === "update" || verb === "remove") {
      const ep = entry.update ?? entry.getById ?? entry.list;
      return typeof ep === "function" ? ep(id) : (ep ?? `/${resource}`);
    }
  }
  return `/${resource}`;
};

export const resourceApi = {
  list: (resource: keyof typeof API_ENDPOINTS, params?: ListQuery) =>
    request<Paginated<any>>({
      url: resolveEndpoint(resource, "list"),
      method: "GET",
      params,
    }),

  get: (resource: keyof typeof API_ENDPOINTS, id: string) =>
    request<any>({
      url: resolveEndpoint(resource, "get", id),
      method: "GET",
    }),

  create: (resource: keyof typeof API_ENDPOINTS, body: any) =>
    request<any>({
      url: resolveEndpoint(resource, "create"),
      method: "POST",
      body,
    }),

  update: (resource: keyof typeof API_ENDPOINTS, id: string, body: any) =>
    request<any>({
      url: resolveEndpoint(resource, "update", id),
      method: "PATCH",
      body,
    }),

  remove: (resource: keyof typeof API_ENDPOINTS, id: string) =>
    request<any>({
      url: resolveEndpoint(resource, "remove", id),
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

  async getById(id: string) {
    return request({
      url: API_ENDPOINTS.appointment.getById(id),
      method: "GET",
    });
  },

  async cancel(id: string, data: any) {
    return request({
      url: API_ENDPOINTS.appointment.cancel(id),
      method: "PATCH",
      body: data,
    });
  },
};

/* ------------------------------- Helpers --------------------------------- */

export const snapshot = () => null;
export const resetDb = () => {
  console.warn("resetDb() is disabled in real API mode");
};
