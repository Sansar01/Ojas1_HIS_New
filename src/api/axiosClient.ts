/**
 * Ojas1 HIMS — the ONE Axios client (doc §2, §10, Phase 1).
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ axiosClient  = axios.create({ baseURL, withCredentials, … }) │
 *   │   • Authorization header          (request interceptor)      │
 *   │   • proactive + reactive refresh  (interceptors)             │
 *   │   • central error/status handling (response interceptor)     │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Axios is the transport layer only — it never decides which component needs
 * data, when a page reloads, or what may be cached (doc §2). That belongs to
 * Redux and the pages.
 *
 * Nothing outside `src/api/` may import this file (Rule 1): pages, components,
 * layouts and hooks talk to the domain modules in `src/api/*Api.ts`, which use
 * `apiClient` (the thin typed wrapper around this instance).
 */

import axios, { AxiosError, type AxiosInstance } from "axios";
import { API_BASE_URL, toRequestPath } from "./apiBaseUrl";
import { API_ENDPOINTS } from "./endpoints";

export const TOKEN_KEY = "authUserToken";
const REFRESH_KEY = "authRefreshToken";
const EXPIRY_MARGIN_MS = 30_000;
export const REQUEST_TIMEOUT_MS = 20_000;

/* --------------------------- Token storage ------------------------------- */

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
 * Wired once by `api/sessionBridge.ts` and reads live auth state:
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

export function isRequestBlocked(url: string): boolean {
  return !isSessionUsable() && !ALWAYS_ALLOWED_ENDPOINTS.includes(url);
}

/* --------------------- Token refresh coordination ------------------------ */

let refreshPromise: Promise<boolean> | null = null;
let runRefresh: (() => Promise<boolean>) | null = null;

export function registerRefreshHandler(fn: () => Promise<boolean>) {
  runRefresh = fn;
}

/** One refresh at a time, however many requests are waiting on it. */
export function refreshOnce(): Promise<boolean> {
  if (!runRefresh) return Promise.resolve(false);
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

export function forceLoginRedirect() {
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

/* ------------------------- Error normalisation --------------------------- */

/**
 * HTTP error carrying the raw response pieces (status, parsed body, raw text)
 * so screens can reproduce their exact legacy error messages.
 */
export function httpError(
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

/** Parse a raw body into JSON when possible (keeps the original text too). */
function parseBody(raw: any): { data: any; rawText: string | null } {
  if (raw === undefined || raw === null || raw === "") {
    return { data: {}, rawText: null };
  }
  if (typeof raw === "object") {
    // axios already parsed it (e.g. blob/arraybuffer) — stringify for `rawText`
    return { data: raw, rawText: JSON.stringify(raw) };
  }
  const rawText = String(raw);
  try {
    return { data: JSON.parse(rawText), rawText };
  } catch {
    return { data: {}, rawText };
  }
}

/* ---------------------------- Axios instance ----------------------------- */

/**
 * The single Axios instance of the application (doc §2, §10).
 *
 *   baseURL          → the ONE backend origin (`apiBaseUrl.ts`)
 *   withCredentials  → refresh-token cookie travels on every request
 *   timeout          → an API can never "stick" the UI
 *   transformResponse→ keep the raw body; `apiClient` does the JSON parsing
 *                      so error payloads keep their exact legacy shape
 */
export const axiosClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL.replace(/\/$/, ""),
  withCredentials: true,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  transformResponse: [(data: any) => data],
  paramsSerializer: {
    // identical query strings to the previous client (`URLSearchParams`)
    serialize: (params: Record<string, any>) =>
      new URLSearchParams(params as any).toString(),
  },
});

/**
 * Request interceptor — auth header + proactive token refresh.
 * A short-lived access token is renewed *before* the request goes out, so a
 * page load does not pay for a 401 round-trip.
 */
axiosClient.interceptors.request.use(async (config) => {
  const skipAuth = Boolean((config as any).skipAuth);
  const skipRefresh = Boolean((config as any).skipRefresh);

  if (token && !skipRefresh && isTokenExpiringSoon()) {
    const ok = await refreshOnce();
    if (!ok && isTokenExpired()) {
      forceLoginRedirect();
      throw new Error("Session expired. Please sign in again.");
    }
  }

  if (token && !skipAuth) {
    (config.headers as any).set?.("Authorization", `Bearer ${token}`);
  }
  return config;
});

/**
 * Response interceptor — one reactive retry after a 401, then a single,
 * consistent error type for every caller (status + parsed body + raw text).
 */
axiosClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config: any = error.config ?? {};
    const status = error.response?.status;

    // timeout / abort
    if (
      error.code === "ECONNABORTED" ||
      error.code === "ETIMEDOUT" ||
      error.message?.includes("timeout")
    ) {
      throw new Error("Request timeout. Server did not respond.");
    }

    // reactive refresh: the server rejected a token it considers stale even
    // though our clock did not — renew once and replay the request.
    const alreadyRetried = Boolean(config._retried);
    if (status === 401 && !config.skipRefresh && !alreadyRetried && isSessionUsable()) {
      const refreshed = await refreshOnce();
      if (refreshed && token) {
        config._retried = true;
        (config.headers as any).set?.("Authorization", `Bearer ${token}`);
        return axiosClient.request(config);
      }
      forceLoginRedirect();
      const { data } = parseBody(error.response?.data);
      throw httpError(
        data?.message || "Session expired. Please sign in again.",
        401,
        data,
        null,
      );
    }

    if (error.response) {
      const { data, rawText } = parseBody(error.response.data);
      const message =
        data?.message || `Request failed with status ${error.response.status}`;
      throw httpError(message, error.response.status, data, rawText);
    }

    // no response at all — network/CORS/aborted request
    throw new Error(error?.message || "Network error");
  },
);

/**
 * Build the axios request config for one domain-module call.
 * Kept here so every caller resolves URLs the same way (`toRequestPath`).
 */
export function buildRequestConfig(
  endpoint: string,
  config: {
    method?: string;
    body?: any;
    params?: Record<string, any>;
    skipRefresh?: boolean;
    skipAuth?: boolean;
    headers?: Record<string, string>;
  } = {},
) {
  return {
    url: toRequestPath(endpoint),
    method: (config.method ?? "GET") as any,
    params: config.params,
    data:
      config.body === undefined || config.body === null
        ? undefined
        : typeof config.body === "string"
          ? config.body
          : JSON.stringify(config.body),
    headers: config.headers ? { ...config.headers } : undefined,
    skipRefresh: config.skipRefresh,
    skipAuth: config.skipAuth,
  };
}

export default axiosClient;
