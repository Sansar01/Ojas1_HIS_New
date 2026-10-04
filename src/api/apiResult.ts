/**
 * Ojas1 HIMS — API result normalisation.
 *
 * Some screens (the OPD queue / consultation workspace, for example) only need
 * "did the call succeed, and what did it return?" — they do not want to know
 * about envelopes, `cancelled` flags or thrown HTTP errors.
 *
 * That knowledge belongs to the API layer, not to a page:
 *
 *   Rule 28 — a page must not duplicate response parsing.
 *
 * So the domain API modules expose `ApiResult<T>` for those screens:
 *
 *   const res = await consultationApi.getQueueForDoctor(doctorId, date);
 *   if (res.ok) setQueue(res.data);
 *
 * Semantics are exactly the ones the screens already used:
 *   • a request blocked by the session gate  → { ok: false, data: null }
 *   • an HTTP error thrown by `apiClient`    → { ok: false, data: null }  (safeResult)
 *   • a normal 2xx envelope                  → { ok: true, data: data ?? body }
 */

import type { ApiResponse } from "@/types";

export interface ApiResult<T> {
  ok: boolean;
  data: T | null;
  /** backend message when the request failed (best effort) */
  error?: string;
}

/** Map a raw `apiClient` envelope onto an `ApiResult`. */
export function toResult<T>(body: ApiResponse<T> | any): ApiResult<T> {
  return {
    ok: !body?.cancelled,
    data: (body?.data ?? body ?? null) as T | null,
    error: body?.message,
  };
}

/** Same as `toResult`, but never throws — HTTP failures become `{ ok: false }`. */
export async function safeResult<T>(
  request: Promise<ApiResponse<T> | any>,
): Promise<ApiResult<T>> {
  try {
    return toResult<T>(await request);
  } catch (error: any) {
    return {
      ok: false,
      data: null,
      error: error?.message ?? "Request failed",
    };
  }
}
