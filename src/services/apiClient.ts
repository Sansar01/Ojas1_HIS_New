import { API_BASE_URL, API_ENDPOINTS } from "@/config/api";
import type { ApiResponse, ListQuery, Paginated, Session } from "@/types";
import { EntitlementModule } from "@/types/entitlement";

export const TOKEN_KEY = "authUserToken";
const EXPIRY_MARGIN_MS = 30_000;

// Sirf Access Token aur Expiry manage karein (Refresh Token browser cookie me rahega)
let token: string | null = (() => {
  try {
    const stored = JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
    return stored?.accessToken ?? stored?.token ?? null;
  } catch {
    return null;
  }
})();

let expiresAtMs: number | null = (() => {
  try {
    const stored = JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
    return parseExpiry(stored?.expiresAt);
  } catch {
    return null;
  }
})();

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

export function setTokenExpiry(value: any) {
  expiresAtMs = parseExpiry(value);
}

export function isTokenExpired() {
  return !!token && expiresAtMs !== null && Date.now() >= expiresAtMs;
}

export function isTokenExpiringSoon() {
  return !!token && expiresAtMs !== null && Date.now() >= expiresAtMs - EXPIRY_MARGIN_MS;
}

/* --------------------- Token refresh coordination ------------------------ */

let refreshPromise: Promise<boolean> | null = null;
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

export function startSessionWatchdog(intervalMs = 60_000) {
  const timer = setInterval(async () => {
    if (!token) return;
    if (!isTokenExpiringSoon()) return;
    const ok = await refreshOnce();
    if (!ok && isTokenExpired()) {
      forceLoginRedirect();
    }
  }, intervalMs);
  return () => clearInterval(timer);
}

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
  skipRefresh?: boolean;
  skipAuth?: boolean;
  headers?: Record<string, string>;
  meta?: { successMessage?: string; errorMessage?: string };
}

/* ----------------------------- Core Request ------------------------------ */

export async function request<T = any>(
  config: RequestConfig,
): Promise<ApiResponse<T>> {
  const queryString = config.params
    ? "?" + new URLSearchParams(config.params as any).toString()
    : "";
  const url = `${API_BASE_URL}${config.url}${queryString}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (token && !config.skipAuth) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (config.headers) Object.assign(headers, config.headers);

  // 10s timeout to prevent API hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  const fetchInit = (): RequestInit => ({
    method: config.method,
    headers,
    body: config.body ? JSON.stringify(config.body) : undefined,
    credentials: "include", // ALWAYS include cookies automatically
    signal: controller.signal,
  });

  try {
    // 1. Proactive Refresh Check
    if (token && !config.skipRefresh && isTokenExpiringSoon()) {
      const ok = await refreshOnce();
      if (!ok && isTokenExpired()) {
        forceLoginRedirect();
        throw new Error("Session expired. Please sign in again.");
      }
      if (ok && token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    let response = await fetch(url, fetchInit());

    // 2. 401 Reactive Refresh Check
    if (response.status === 401 && !config.skipRefresh) {
      const refreshed = await refreshOnce();
      if (refreshed && token) {
        // Retry with fresh token
        headers["Authorization"] = `Bearer ${token}`;
        response = await fetch(url, fetchInit());
      } else {
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
    if (error.name === "AbortError") {
      throw new Error("Request timeout. Server did not respond.");
    }
    throw new Error(error?.message || "Network error");
  } finally {
    clearTimeout(timeoutId);
  }
}

/* ------------------------------- Auth API -------------------------------- */

export const authApi = {
  async login(email: string, password: string): Promise<ApiResponse<Session>> {
    return request<Session>({
      url: API_ENDPOINTS.auth.login,
      method: "POST",
      body: { email, password },
      skipRefresh: true,
    });
  },

  async logout(): Promise<ApiResponse<boolean>> {
    try {
      return await request<boolean>({
        url: API_ENDPOINTS.auth.logout,
        method: "POST",
        skipRefresh: true,
      });
    } catch {
      return { success: true, data: true, message: "Logged out locally" };
    }
  },

  async refresh(): Promise<ApiResponse<Session>> {
    // Refresh token browser ke cookie se automatic jayega (credentials: "include")
    return request<Session>({
      url: API_ENDPOINTS.auth.refresh,
      method: "POST",
      skipRefresh: true, // Prevents recursive 401 loop
      skipAuth: true,    // Purana expired Bearer header mat bhejo
    });
  },

  async changePassword(email: string) {
    return request({
      url: API_ENDPOINTS.auth.changePassword,
      method: "POST",
      body: { email },
      skipRefresh: true,
    });
  },

  async resetPassword(email: string, password: string) {
    return request({
      url: API_ENDPOINTS.auth.resetPassword,
      method: "POST",
      body: { email, password },
      skipRefresh: true,
    });
  },
};

/* --------------------------------- Modules API --------------------------- */

export const entitlementApi = {
  async getModules() {
    return request<EntitlementModule[]>({
      url: API_ENDPOINTS.entitlement_modules,
      method: "GET",
    });
  },
};

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