/**
 * Auth domain API — the ONE owner of the authentication endpoints.
 *
 *   POST /api/hospital/auth/login          authApi.login
 *   POST /api/hospital/auth/verify-otp     authApi.verifyOtp
 *   POST /api/hospital/auth/refresh        authApi.refresh
 *   POST /api/hospital/auth/logout         authApi.logout
 *   POST /api/hospital/auth/change-password authApi.changePassword
 *   POST /api/hospital/auth/send-reset-code authApi.sendResetCode
 *   POST /api/hospital/auth/reset-password  authApi.resetPassword
 *   POST /api/hospital/auth/reset-password-with-code authApi.resetPasswordWithCode
 *
 * Only `authSlice` (and the recovery screens through it) may call these.
 * No page or component talks to the auth endpoints directly.
 */

import { axios } from "./axios";

/**
 * Auth + password endpoints. They live next to the calls that use them (there
 * is no central endpoint table any more) and are only ever called by
 * `authSlice` and the recovery screens through it — no page talks to them.
 */
const AUTH = {
  login: "/api/hospital/auth/login",
  verifyOtp: "/api/hospital/auth/verify-otp",
  refresh: "/api/hospital/auth/refresh",
  logout: "/api/hospital/auth/logout",
  changePassword: "/api/hospital/auth/change-password",
  sendResetCode: "/api/hospital/auth/send-reset-code",
  resetPassword: "/api/hospital/auth/reset-password",
  resetPasswordWithCode: "/api/hospital/auth/reset-password-with-code",
} as const;

export interface LoginPayload {
  email: string;
  password: string;
}

export interface VerifyOtpPayload {
  otpToken: string;
  code: string;
}

export interface ChangePasswordPayload {
  email?: string;
  oldPassword?: string;
  currentPassword?: string;
  newPassword: string;
}

export const authApi = {
  login: (payload: LoginPayload | { email: string; password: string }) =>
    axios.post(AUTH.login, payload, { skipRefresh: true }),

  verifyOtp: (payload: VerifyOtpPayload) =>
    axios.post(AUTH.verifyOtp, payload, { skipRefresh: true }),

  /**
   * Exchange the refresh cookie (or an explicit refresh token) for a new
   * access token. `skipAuth` keeps an expired Bearer token off the request —
   * vital to avoid a refresh loop.
   */
  refresh: (
    body?: Record<string, unknown>,
    options: { skipAuth?: boolean } = {},
  ) =>
    axios.post(AUTH.refresh, body, {
      skipRefresh: true,
      skipAuth: options.skipAuth,
    }),

  /** Best-effort: clears the httpOnly cookie on the server. */
  logout: () => axios.post(AUTH.logout, undefined, { skipRefresh: true }),

  /**
   * Password change. `forced` routes to the same backend endpoint with the
   * forced-change DTO — the distinction is part of the auth domain, not the
   * page's business.
   */
  changePassword: (
    payload:
      | ChangePasswordPayload
      | { oldPassword: string; newPassword: string }
      | { email?: string; newPassword: string },
    forced = false,
  ) =>
    axios.post(forced ? AUTH.changePassword : AUTH.changePassword, payload, {
      skipRefresh: true,
    }),

  /** Step 1 of account recovery — email a reset code. */
  sendResetCode: (email: string) =>
    axios.post(AUTH.sendResetCode, { email }, { skipRefresh: true }),

  /** Step 2 of account recovery — trade the code for a new password. */
  resetPasswordWithCode: (payload: {
    email: string;
    code: string;
    newPassword: string;
  }) => axios.post(AUTH.resetPasswordWithCode, payload, { skipRefresh: true }),

  /** Signed-in password reset (no code). */
  resetPassword: (payload: { email: string; password: string }) =>
    axios.post(AUTH.resetPassword, payload, { skipRefresh: true }),
};
