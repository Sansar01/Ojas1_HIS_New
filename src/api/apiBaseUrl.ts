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
 * Join an endpoint path from `endpoints.ts` with the base URL.
 * Handles a trailing slash on the base and an accidental duplicate `/api`
 * segment when the base URL already ends with `/api`.
 */
export const buildApiUrl = (endpoint: string): string => {
  const base = API_BASE_URL.replace(/\/$/, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (base.endsWith("/api") && path.startsWith("/api/")) {
    return `${base}${path.substring(4)}`;
  }
  return `${base}${path}`;
};

export default API_BASE_URL;
