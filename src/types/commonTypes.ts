/**
 * Shared primitives used across every HIMS domain.
 * Domain-specific models live in their own `types/*Types.ts` file.
 */

export type ID = string;
export type ISODate = string; // yyyy-MM-dd
export type ISODateTime = string;

export type Status = "active" | "inactive";
export type Gender = "Male" | "Female" | "Other";

/* ---------------------------- API envelope ------------------------------- */

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  /** true when the client dropped the call locally — signed out, or the
   *  session is waiting on a forced password change (no request was sent) */
  cancelled?: boolean;
}
/* ----------------------- shared list/crud state -------------------------- */

/** Shape kept by every collection slice (patients, users, appointments…). */
export interface CrudState<T = any> {
  items: T[];
  status: "idle" | "loading" | "ready" | "error";
  saving: boolean;
  error: string | null;
  lastSync: string | null;
}

export interface WritePayload<T> {
  data: Partial<T> & { id?: string };
  successMessage?: string;
}