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

import { apiClient } from "./apiClient";
import { API_ENDPOINTS } from "./endpoints";
import type { Session } from "@/types";

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
    apiClient<Session>(API_ENDPOINTS.auth.login, {
      method: "POST",
      body: payload,
      skipRefresh: true,
    }),

  verifyOtp: (payload: VerifyOtpPayload) =>
    apiClient<Session>(API_ENDPOINTS.auth.verifyOtp, {
      method: "POST",
      body: payload,
      skipRefresh: true,
    }),

  /**
   * Exchange the refresh cookie (or an explicit refresh token) for a new
   * access token. `skipAuth` keeps an expired Bearer token off the request —
   * vital to avoid a refresh loop.
   */
  refresh: (
    body?: Record<string, unknown>,
    options: { skipAuth?: boolean } = {},
  ) =>
    apiClient<Session>(API_ENDPOINTS.auth.refreshToken, {
      method: "POST",
      body,
      skipRefresh: true,
      skipAuth: options.skipAuth,
    }),

  /** Best-effort: clears the httpOnly cookie on the server. */
  logout: () =>
    apiClient(API_ENDPOINTS.auth.logout, {
      method: "POST",
      skipRefresh: true,
    }),

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
    apiClient(
      forced ? API_ENDPOINTS.password.forceChange : API_ENDPOINTS.password.change,
      { method: "POST", body: payload, skipRefresh: true },
    ),

  /** Step 1 of account recovery — email a reset code. */
  sendResetCode: (email: string) =>
    apiClient(API_ENDPOINTS.password.forgot, {
      method: "POST",
      body: { email },
      skipRefresh: true,
    }),

  /** Step 2 of account recovery — trade the code for a new password. */
  resetPasswordWithCode: (payload: {
    email: string;
    code: string;
    newPassword: string;
  }) =>
    apiClient(API_ENDPOINTS.password.resetWithCode, {
      method: "POST",
      body: payload,
      skipRefresh: true,
    }),

  /** Signed-in password reset (no code). */
  resetPassword: (payload: { email: string; password: string }) =>
    apiClient(API_ENDPOINTS.password.reset, {
      method: "POST",
      body: payload,
      skipRefresh: true,
    }),
};

