/**
 * Authentication session models.
 * "Who is the user?" — auth state lives in `store/slices/authSlice.ts`.
 * "What may they access?" — `moduleTypes.ts` + `permissionTypes.ts`.
 */

import type { ISODateTime } from "./commonTypes";
import type { Entitlements } from "./moduleTypes";
import type { Role } from "./roleTypes";
import type { User } from "./userTypes";

export interface Session {
  accessToken: string;
  user: User;
  role: Role;
  expiresAt: ISODateTime;
  entitlements: Entitlements;
  /** true when the backend asks the user to replace a temporary password
   *  before using the portal (login response: forcePasswordChange) */
  forcePasswordChange?: boolean;
}
