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

export interface RequestConfig {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: any;
  params?: Record<string, any>;
  silent?: boolean;
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
    const response = await fetch(url, {
      method: config.method,
      headers,
      body: config.body ? JSON.stringify(config.body) : undefined,
    });

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

  async me(): Promise<ApiResponse<Session | null>> {
    if (!token) return { success: true, data: null, message: "No session" };
    try {
      return await request<Session>({
        url: API_ENDPOINTS.auth.me,
        method: "GET",
      });
    } catch {
      return { success: false, data: null, message: "Session invalid" };
    }
  },

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
export const  resourceApi = {
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
      method: "PUT",
      body,
    }),

  remove: (resource: keyof typeof API_ENDPOINTS, id: string) =>
    request<any>({
      url: `${(API_ENDPOINTS as any)[resource] || `/${resource}`}/${id}`,
      method: "DELETE",
    }),
};

/* ------------------------------- Helpers --------------------------------- */

export const snapshot = () => null;
export const resetDb = () => {
  console.warn("resetDb() is disabled in real API mode");
};
