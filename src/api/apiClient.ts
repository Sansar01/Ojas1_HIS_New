/**
 * Ojas1 HIMS — the ONE API client.
 *
 * `apiClient(endpoint, config)` is the only place the application performs
 * HTTP. It owns all common behaviour so no slice, service, hook or page has
 * to reimplement it:
 *
 *   • JSON request/response handling
 *   • Authorization header + access-token refresh (proactive & reactive)
 *   • Centralised HTTP error handling (401 / 403 / 404 / 422 / 500 …)
 *   • Session gate (nothing business-critical leaves the browser while the
 *     session is closed or a forced password change is pending)
 *   • Request timeout so an API can never hang the UI forever
 *   • Credentials/cookies ("include")
 *
 * Where is the API?   → `api/endpoints.ts`
 * How do we call it?  → this file
 * What happens to state on success/failure? → `store/slices/*Slice.ts`
 */

import { buildApiUrl } from "./apiBaseUrl";
import { API_ENDPOINTS } from "./endpoints";
import type { ApiResponse } from "@/types";

export const TOKEN_KEY = "authUserToken";
const REFRESH_KEY = "authRefreshToken";
const EXPIRY_MARGIN_MS = 30_000;
const REQUEST_TIMEOUT_MS = 20_000;

/* --------------------------- Token storage ------------------------------- */

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
    const stored = JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
    return stored?.refreshToken ?? stored?.user?.refreshToken ?? null;
  } catch {
    return null;
  }
}

export function clearRefreshToken() {
  setRefreshToken(null);
}

export function setTokenExpiry(value: any) {
  expiresAtMs = parseExpiry(value);
}

export function isTokenExpired() {
  return !!token && expiresAtMs !== null && Date.now() >= expiresAtMs;
}

export function isTokenExpiringSoon() {
  return (
    !!token &&
    expiresAtMs !== null &&
    Date.now() >= expiresAtMs - EXPIRY_MARGIN_MS
  );
}

/* --------------------------- Session gate -------------------------------- */

/**
 * Single choke point for "may this request leave the browser?".
 * Wired once by <App/> (registerSessionGate) and reads live auth state:
 *   • signed out (logout)                      → only auth calls may run
 *   • signed in with forcePasswordChange: true → only auth calls may run
 *   • signed in normally                       → everything runs
 */
export interface SessionGate {
  signedIn: boolean;
  mustChangePassword: boolean;
}

/** Carried by the (empty) response of a request the gate refused to send. */
export const SESSION_CLOSED_MESSAGE = "Session closed — request skipped.";

let readSessionGate: (() => SessionGate | null) | null = null;

/** Registered once, at app start, so the client can read the auth state. */
export function registerSessionGate(fn: () => SessionGate | null) {
  readSessionGate = fn;
}

/**
 * Endpoints that stay callable while the gate is shut — sign-in, sign-out
 * and password change/reset. Everything else is skipped before the network.
 */
const ALWAYS_ALLOWED_ENDPOINTS: string[] = [
  API_ENDPOINTS.auth.login,
  API_ENDPOINTS.auth.logout,
  API_ENDPOINTS.auth.verifyOtp,
  API_ENDPOINTS.password.change,
  API_ENDPOINTS.password.forceChange,
  API_ENDPOINTS.password.forgot,
  API_ENDPOINTS.password.reset,
  API_ENDPOINTS.password.resetWithCode,
];

/** true only when ordinary (non-auth) traffic is allowed right now. */
export function isSessionUsable(): boolean {
  const gate = readSessionGate?.() ?? null;
  if (!gate) return true; // nothing wired yet → keep previous behaviour
  return Boolean(token) && gate.signedIn && !gate.mustChangePassword;
}

function isRequestBlocked(url: string): boolean {
  return !isSessionUsable() && !ALWAYS_ALLOWED_ENDPOINTS.includes(url);
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

/* ----------------------------- Core client ------------------------------- */

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
 * HTTP error carrying the raw response pieces (status, parsed body, raw text)
 * so screens can reproduce their exact legacy error messages.
 */
function httpError(
  message: string,
  status: number,
  data: any,
  rawText: string | null,
): Error {
  const err: any = new Error(message);
  err.status = status;
  err.data = data;
  err.rawText = rawText;
  return err as Error;
}

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

  const queryString = config.params
    ? "?" + new URLSearchParams(config.params as any).toString()
    : "";
  const url = `${buildApiUrl(endpoint)}${queryString}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (token && !config.skipAuth) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (config.headers) Object.assign(headers, config.headers);

  // 20s timeout so an API can never "stick" the UI
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const fetchInit = (): RequestInit => ({
    method: config.method ?? "GET",
    headers,
    body: config.body
      ? typeof config.body === "string"
        ? config.body
        : JSON.stringify(config.body)
      : undefined,
    credentials: "include", // always allow cookies (refresh-token cookie)
    signal: controller.signal,
  });

  try {
    // Proactive refresh
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

    // Reactive 401 refresh (only while the session is actually usable)
    if (response.status === 401 && !config.skipRefresh && isSessionUsable()) {
      const refreshed = await refreshOnce();
      if (refreshed && token) {
        headers["Authorization"] = `Bearer ${token}`;
        response = await fetch(url, fetchInit());
      } else {
        forceLoginRedirect();
        const data401 = await response.json().catch(() => ({}));
        throw httpError(
          data401?.message || "Session expired. Please sign in again.",
          401,
          data401,
          null,
        );
      }
    }

    const rawText = await response.text().catch(() => "");
    let data: any = {};
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = {};
      }
    }

    if (!response.ok) {
      const message =
        data?.message || `Request failed with status ${response.status}`;
      throw httpError(message, response.status, data, rawText || null);
    }

    return data as ApiResponse<T>;
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error("Request timeout. Server did not respond.");
    }
    if (error?.status != null) throw error; // enriched HTTP error — keep payload
    throw new Error(error?.message || "Network error");
  } finally {
    clearTimeout(timeoutId);
  }
};

export default apiClient;
