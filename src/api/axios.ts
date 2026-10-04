/**
 * Ojas1 HIMS — the ONE Axios instance of the application.
 *
 * Feature services import it and call the endpoints directly, exactly like
 * plain axios:
 *
 *   import { axios } from "@/api/axios";
 *
 *   axios.get("/api/opd/patients", { params })      // list
 *   axios.post("/api/opd/patients", payload)        // create
 *   axios.patch(`/api/opd/patients/${id}`, payload) // update
 *   axios.delete(`/api/opd/patients/${id}`)         // delete
 *
 * Everything transport-related lives here and nowhere else:
 *   • baseURL           → the backend origin (`VITE_API_BASE_URL`)
 *   • Authorization     → request interceptor
 *   • proactive/reactive token refresh + 401 replay
 *   • session gate      → a request never leaves the browser while signed out
 *                         or while a forced password change is pending
 *   • duplicate-request guard for concurrent identical GETs
 *   • timeout + one consistent error shape (`status`, `data`, `rawText`)
 *
 * No page, component, hook or service creates its own axios instance, and no
 * service knows the backend origin — it only knows its own "/api/..." paths.
 */

import axiosPackage, {
  type AxiosAdapter,
  type AxiosError,
  type AxiosInstance,
} from "axios";

/* ------------------------------ Base URL --------------------------------- */

/**
 * The backend origin. `VITE_API_BASE_URL` may be written with or without the
 * trailing `/api` — service paths already start with `/api/...`, so a trailing
 * `/api` is trimmed once, here, instead of in every call.
 *
 *   VITE_API_BASE_URL=http://localhost:8000        (local backend)
 *   VITE_API_BASE_URL=https://your-api-host        (production)
 */
export const API_BASE_URL: string = String(
  (import.meta.env as any).VITE_API_BASE_URL ||
    "https://cloud-his-backend.onrender.com",
)
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

export const TOKEN_KEY = "authUserToken";
const REFRESH_KEY = "authRefreshToken";
const EXPIRY_MARGIN_MS = 30_000;
export const REQUEST_TIMEOUT_MS = 20_000;

/** Extra per-request flags this app understands (type-checked on call sites). */
declare module "axios" {
  export interface AxiosRequestConfig {
    /** Skip the proactive/reactive token refresh (login, refresh, auth calls). */
    skipRefresh?: boolean;
    /** Do not attach the Authorization header. */
    skipAuth?: boolean;
    /** Internal: this request already replayed once after a 401. */
    _retried?: boolean;
  }
}

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
  "/api/hospital/auth/login",
  "/api/hospital/auth/logout",
  "/api/hospital/auth/verify-otp",
  "/api/hospital/auth/change-password",
  "/api/hospital/auth/send-reset-code",
  "/api/hospital/auth/reset-password",
  "/api/hospital/auth/reset-password-with-code",
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
    // axios already parsed it — stringify for `rawText`
    return { data: raw, rawText: JSON.stringify(raw) };
  }
  const rawText = String(raw);
  try {
    return { data: JSON.parse(rawText), rawText };
  } catch {
    return { data: {}, rawText };
  }
}

/** Marker thrown by the session gate — turned into a cancelled response below. */
const SESSION_CLOSED = "__session_closed__";

/* ------------------- Duplicate-request guard (GET only) ------------------ */

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

const defaultAdapter: AxiosAdapter = axiosPackage.getAdapter([
  "xhr",
  "http",
  "fetch",
]);

/**
 * React StrictMode double-invokes effects, and two widgets can ask for the same
 * page-level resource in the same tick. When an identical GET is already in
 * flight, the second caller receives that promise instead of opening a second
 * socket. Writes are never shared, and the entry is dropped as soon as the
 * request settles — so a stale response can never be served.
 */
const dedupAdapter: AxiosAdapter = (config) => {
  if ((config.method ?? "get").toLowerCase() !== "get") {
    return defaultAdapter(config);
  }
  const key = `${config.baseURL ?? ""}${config.url ?? ""}?${stableKey(
    config.params ?? null,
  )}${config.skipAuth ? "|anon" : ""}`;
  const pending = inFlightGets.get(key);
  if (pending) return pending;

  const promise = defaultAdapter(config).finally(() => {
    if (inFlightGets.get(key) === promise) inFlightGets.delete(key);
  });
  inFlightGets.set(key, promise);
  return promise;
};

/* ---------------------------- Axios instance ----------------------------- */

export const axios: AxiosInstance = axiosPackage.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  paramsSerializer: {
    // identical query strings to the previous client (`URLSearchParams`)
    serialize: (params: Record<string, any>) =>
      new URLSearchParams(params as any).toString(),
  },
  adapter: dedupAdapter,
});

/**
 * Request interceptor — session gate, auth header, proactive token refresh.
 * A short-lived access token is renewed *before* the request goes out, so a
 * page load does not pay for a 401 round-trip.
 */
axios.interceptors.request.use(async (config) => {
  // Signed out / password change pending: answer locally, never hit the network.
  if (isRequestBlocked(config.url ?? "")) {
    throw Object.assign(new Error(SESSION_CLOSED_MESSAGE), {
      [SESSION_CLOSED]: true,
      config,
    });
  }

  const skipAuth = Boolean(config.skipAuth);
  const skipRefresh = Boolean(config.skipRefresh);

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
 * Response interceptor — the gate's "skipped" answer, one reactive retry after
 * a 401, then a single, consistent error type for every caller
 * (status + parsed body + raw text).
 */
axios.interceptors.response.use(
  (response) => response,
  async (error: AxiosError | any) => {
    // the session gate refused to send — resolve with the cancelled envelope
    // so screens show "nothing loaded" instead of an error toast on logout
    if (error?.[SESSION_CLOSED]) {
      return {
        data: {
          success: false,
          cancelled: true,
          message: SESSION_CLOSED_MESSAGE,
        },
        status: 200,
        statusText: "OK",
        headers: {},
        config: error.config,
        request: null,
      };
    }

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
    if (
      status === 401 &&
      !config.skipRefresh &&
      !alreadyRetried &&
      isSessionUsable()
    ) {
      const refreshed = await refreshOnce();
      if (refreshed && token) {
        config._retried = true;
        (config.headers as any).set?.("Authorization", `Bearer ${token}`);
        return axios.request(config);
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

export default axios;
