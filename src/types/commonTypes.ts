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
