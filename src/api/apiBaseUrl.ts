/**
 * Ojas1 HIMS — API Base URL (the ONE place the backend origin is defined).
 *
 * Every request in the application resolves its URL from here:
 *   .env  →  API_BASE_URL  →  apiClient.ts  →  endpoints.ts paths
 *
 * No component, slice, hook or service may define the API base URL itself.
 * To change the backend, update VITE_API_BASE_URL in the appropriate .env
 * file — no code changes required.
 *
 *   VITE_API_BASE_URL=http://localhost:8000/api     (local)
 *   VITE_API_BASE_URL=https://your-production-api   (production)
 */

// Single source of truth for the backend origin.
export const API_BASE_URL: string =
  (import.meta.env as any).VITE_API_BASE_URL ||
  "https://cloud-his-backend.onrender.com";

/**
 * The request path relative to the base URL — used by the Axios client, whose
 * `baseURL` is `API_BASE_URL`. It applies the same duplicate-`/api` rule as
 * `buildApiUrl` below, so both produce exactly the same final URL.
 */
export const toRequestPath = (endpoint: string): string => {
  const base = API_BASE_URL.replace(/\/$/, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (base.endsWith("/api") && path.startsWith("/api/")) {
    return path.substring(4);
  }
  return path;
};

export default API_BASE_URL;
