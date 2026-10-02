/**
 * User model — a portal account (staff member) of a hospital.
 * Authentication state that references users lives in `authTypes.ts`.
 */

import type { ID, ISODate, ISODateTime, Status, Gender } from "./commonTypes";
import type { Permission } from "./permissionTypes";

export interface User {
  id: ID;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  roleId: ID;
  role: string; // denormalised label
  status: Status;
  gender: Gender;
  dateOfBirth: ISODate;
  password?: string;
  modules: string[];
  permissions: Partial<Record<string, Permission[]>>;
  title?: string;
  lastLogin: ISODateTime | null;
  createdAt: ISODateTime;
  color: string;
  userType:
    | "SUPER_ADMIN"
    | "ADMIN"
    | "DOCTOR"
    | "RECEPTIONIST"
    | "BILLING_STAFF"
    | string;
  /** set by the login response when the account must replace a temporary
   *  password before using the portal */
  forcePasswordChange?: boolean;
}
