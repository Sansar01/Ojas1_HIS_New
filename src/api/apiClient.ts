/**
 * `apiClient(endpoint, config)` — the typed entry point every domain module
 * uses, now backed by the single Axios client in `./axiosClient.ts` (doc §2,
 * §10, Phase 1).
 *
 *   page/component  →  src/api/<domain>Api.ts  →  apiClient  →  axiosClient  →  backend
 *
 * It adds the two things the domain modules should not repeat:
 *   • the session gate (a request never leaves the browser while the session is
 *     closed or a forced password change is pending — it returns the empty
 *     "cancelled" envelope the slices already understand);
 *   • the legacy response contract (parsed JSON envelope, and `Error` objects
 *     carrying `status` / `data` / `rawText` on failure) that every slice and
 *     screen relies on.
 *
 * Everything transport-related — base URL, auth header, interceptors, token
 * refresh, timeouts, HTTP status handling — lives in `axiosClient.ts`.
 */

import type { ApiResponse } from "@/types";
import {
  axiosClient,
  buildRequestConfig,
  isRequestBlocked,
  SESSION_CLOSED_MESSAGE,
} from "./axiosClient";

export interface ApiRequestConfig {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON-serialised request body (pass the raw object). */
  body?: any;
  /** Query-string parameters. */
  params?: Record<string, any>;
  /** Skip the proactive/reactive token refresh (login, refresh, auth calls). */
  skipRefresh?: boolean;
  /** Do not attach the Authorization header. */
  skipAuth?: boolean;
  headers?: Record<string, string>;
}

/**
 * The application's single HTTP entry point.
 *
 *   await apiClient<Patient[]>(API_ENDPOINTS.patients.list, { method: "GET" })
 *
 * Returns the parsed JSON envelope (`ApiResponse<T>`), and throws an `Error`
 * carrying the backend message on failure — the same contract every slice
 * and service relies on.
 */
/**
 * Duplicate-request guard for concurrent identical GETs (duplicate-call
 * prevention — "do not make the same API request twice").
 *
 * React StrictMode double-invokes effects in development, and two widgets can
 * ask for the same page-level resource in the same tick. When an identical GET
 * (same endpoint + query + auth flags) is already in flight, the second caller
 * receives that promise instead of opening a second socket. Writes are never
 * shared, and the entry is dropped as soon as the request settles — so it can
 * never serve a stale response.
 */
const inFlightGets = new Map<string, Promise<any>>();

/** Stable stringify (sorted keys) so param order cannot create two keys. */
const stableKey = (value: any): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableKey).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableKey(value[k])}`)
    .join(",")}}`;
};

export const apiClient = async <T = any>(
  endpoint: string,
  config: ApiRequestConfig = {},
): Promise<ApiResponse<T>> => {
  // Logged out, or signed in but owing a password change → never hit the
  // network. Returns a cancelled envelope instead of throwing so the slices
  // do not raise "could not load …" toasts on a session the user just ended.
  if (isRequestBlocked(endpoint)) {
    return {
      success: false,
      cancelled: true,
      message: SESSION_CLOSED_MESSAGE,
    } as ApiResponse<T>;
  }

  const isGet = (config.method ?? "GET") === "GET";
  const key = isGet
    ? `${endpoint} ${stableKey(config.params ?? null)} ${
        config.skipAuth ? "anon" : "auth"
      } ${config.skipRefresh ? "norefresh" : "refresh"}`
    : "";

  if (key) {
    const pending = inFlightGets.get(key);
    if (pending) return pending as Promise<ApiResponse<T>>;
  }

  const run = async (): Promise<ApiResponse<T>> => {
    const response = await axiosClient.request<any>(
      buildRequestConfig(endpoint, config),
    );

    // `transformResponse` keeps the raw body (so error payloads stay intact);
    // the JSON parsing the rest of the app expects happens right here.
    const raw = response.data;
    if (raw === undefined || raw === null || raw === "") {
      return {} as ApiResponse<T>;
    }
    if (typeof raw !== "string") return raw as ApiResponse<T>;
    try {
      return JSON.parse(raw) as ApiResponse<T>;
    } catch {
      return {} as ApiResponse<T>;
    }
  };

  const promise = run();
  if (key) {
    inFlightGets.set(key, promise);
    const release = () => inFlightGets.delete(key);
    promise.then(release, release);
  }
  return promise;
};

export default apiClient;

/* -------------------------------------------------------------------------
 * Transport helpers re-exported for the few non-domain consumers
 * (`store/slices/authSlice.ts` token bookkeeping, `api/sessionBridge.ts`).
 * They live in `axiosClient.ts`, which stays the single owner.
 * ---------------------------------------------------------------------- */
export {
  TOKEN_KEY,
  REQUEST_TIMEOUT_MS,
  SESSION_CLOSED_MESSAGE,
  setToken,
  getToken,
  setRefreshToken,
  getRefreshToken,
  clearRefreshToken,
  setTokenExpiry,
  isTokenExpired,
  isTokenExpiringSoon,
  registerSessionGate,
  registerRefreshHandler,
  startSessionWatchdog,
  refreshOnce,
  forceLoginRedirect,
  isSessionUsable,
  isRequestBlocked,
  httpError,
  type SessionGate,
} from "./axiosClient";
