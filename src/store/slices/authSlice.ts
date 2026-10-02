/**
 * Authentication slice — "who is the user?".
 *
 *   authSlice
 *       ├── login()
 *       ├── verifyOtp()
 *       ├── logout() / logoutUser()
 *       ├── refreshSession()
 *       ├── changePassword() / resetPassword()
 *       └── sendResetCode() / resetPasswordWithCode()
 *
 * Manages login, 2FA OTP verification, the current session/user, token
 * state, logout and the forced-password-change flag. Password operations
 * stay here too (they are small and tightly coupled to the session):
 *
 *   API_ENDPOINTS.auth.*       → login / verifyOtp / logout / refreshToken
 *   API_ENDPOINTS.password.*   → change / forceChange / forgot / reset
 *
 * Authorization ("what may they access?") is NOT handled here — see
 * `moduleSlice` and `permissionSlice`.
 */

import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import {
  apiClient,
  getRefreshToken,
  setToken,
  setTokenExpiry,
  TOKEN_KEY,
} from "@/api/apiClient";
import { API_ENDPOINTS } from "@/api/endpoints";
import { hideLoader, showLoader, toast } from "./uiSlice";
import type { Permission, Session, User } from "@/types";
import { clearModules } from "./moduleSlice";

/* --------------------------------------------------------------------------- */

interface AuthState {
  session: Session | null;
  status:
    | "idle"
    | "restoring"
    | "authenticating"
    | "authenticated"
    | "unauthenticated";
  error: string | null;
  reset: { email: string | null; token: string | null };
}

const initialState: AuthState = {
  session: null,
  status: "idle",
  error: null,
  reset: { email: null, token: null },
};

// ==================== RESTORE SESSION ====================
export const restoreSession = createAsyncThunk(
  "auth/restoreSession",
  async (_, { rejectWithValue }) => {
    try {
      const stored = localStorage.getItem(TOKEN_KEY);
      if (!stored) return null;

      const parsed = JSON.parse(stored);

      if (!parsed?.accessToken || !parsed?.user) {
        localStorage.removeItem(TOKEN_KEY);
        return null;
      }

      // Set accessToken in memory
      setToken(parsed.accessToken);
      setTokenExpiry(parsed.expiresAt);

      return {
        accessToken: parsed.accessToken,
        user: parsed.user,
        role: parsed.role || { name: parsed.user.userType },
        expiresAt: parsed.expiresAt,
        entitlements: parsed.entitlements || null,
        // keep the flag across reloads so the guard can still divert
        // (read both shapes, exactly like selectMustChangePassword does)
        forcePasswordChange: Boolean(
          parsed.forcePasswordChange || parsed.user?.forcePasswordChange,
        ),
      };
    } catch (error: any) {
      localStorage.removeItem(TOKEN_KEY);
      return rejectWithValue(error?.message);
    }
  },
);

/**
 * Shared "credentials accepted" step for both login and 2FA verification:
 * persist the session, arm the token, welcome the user.
 * Returns the payload the reducers store as the session.
 */
const establishSession = (data: any, dispatch: any) => {
  // backend flag - the user must replace a temporary password first
  const forcePasswordChange = Boolean(
    data?.forcePasswordChange ?? data?.user?.forcePasswordChange,
  );

  // Save accessToken + user (+ the flag) in localStorage
  localStorage.setItem(
    TOKEN_KEY,
    JSON.stringify({
      accessToken: data.accessToken,
      user: data.user,
      expiresAt: data.expiresAt,
      ...(forcePasswordChange ? { forcePasswordChange: true } : {}),
    }),
  );

  setToken(data.accessToken);
  setTokenExpiry(data.expiresAt);

  dispatch(
    toast.success(
      `Welcome back, ${data.user.firstName}`,
      forcePasswordChange
        ? "Set a new password to finish signing in."
        : `Signed in as ${data.user.userType}`,
    ),
  );

  // The login screen routes on this: true -> /accounts/force-password-change
  return { ...data, forcePasswordChange };
};

/**
 * Locate the 2FA challenge wherever the backend puts it. Deployments differ:
 * some nest it under `data` (or twice over) and some use snake_case keys, so
 * walk the payload instead of guessing one exact shape.
 */
const findOtpChallenge = (payload: any) => {
  const visited = new Set<object>();

  const search = (node: any): any => {
    if (!node || typeof node !== "object" || visited.has(node)) return null;
    visited.add(node);

    const tokenKey = Object.keys(node).find((k) => /^otp[-_]?token$/i.test(k));
    if (tokenKey) {
      const idKey = Object.keys(node).find((k) => /^user[-_]?id$/i.test(k));
      return {
        otpToken: node[tokenKey],
        userId: idKey ? node[idKey] : undefined,
        message: node.message,
      };
    }

    for (const value of Object.values(node)) {
      const found = search(value);
      if (found) return found;
    }
    return null;
  };

  return search(payload);
};

// ==================== LOGIN ====================
export const login = createAsyncThunk(
  "auth/login",
  async (
    { email, password }: { email: string; password: string },
    { dispatch, rejectWithValue },
  ) => {
    try {
      const res = await apiClient<Session>(API_ENDPOINTS.auth.login, {
        method: "POST",
        body: { email, password },
        skipRefresh: true,
      });
      const data = (res.data ?? {}) as any;

      if (data.accessToken && data.user) {
        return establishSession(data, dispatch);
      }

      // 2FA: credentials were fine, but the account owes a one-time code.
      // Not an error - hand the challenge back to the login screen.
      const challenge = findOtpChallenge(res);
      if (challenge?.otpToken) {
        return {
          requiresOtp: true,
          otpToken: challenge.otpToken,
          userId: challenge.userId,
          message:
            challenge.message ??
            res?.message ??
            "Enter the verification code to continue.",
        };
      }

      const errorMessage =
        res.message || "The email or password is incorrect. Please try again.";
      return rejectWithValue(errorMessage);
    } catch (error: any) {
      // Some backends signal the challenge with a non-2xx status and still
      // send the otpToken in the body - treat that as 2FA, not a failure.
      const challenge = findOtpChallenge((error as any)?.body);
      if (challenge?.otpToken) {
        return {
          requiresOtp: true,
          otpToken: challenge.otpToken,
          userId: challenge.userId,
          message:
            challenge.message ??
            error?.message ??
            "Enter the verification code to continue.",
        };
      }

      const errorMessage =
        error?.message === "Failed to fetch"
          ? "Unable to reach the server. Please check your connection and try again."
          : error?.message || "Unable to sign in. Please try again.";
      return rejectWithValue(errorMessage);
    }
  },
);

// ==================== 2FA - VERIFY OTP ====================
export const verifyOtp = createAsyncThunk(
  "auth/verifyOtp",
  async (
    { otpToken, code }: { otpToken: string; code: string },
    { dispatch, rejectWithValue },
  ) => {
    try {
      const res = await apiClient<Session>(API_ENDPOINTS.auth.verifyOtp, {
        method: "POST",
        body: { otpToken, code },
        skipRefresh: true,
      });
      const raw = (res ?? {}) as any;
      const data = (raw.data ?? raw) as any;

      if (data.accessToken && data.user) {
        return establishSession(data, dispatch);
      }

      return rejectWithValue(
        res.message || "That code is invalid or has expired. Please try again.",
      );
    } catch (error: any) {
      const errorMessage =
        error?.message === "Failed to fetch"
          ? "Unable to reach the server. Please check your connection and try again."
          : error?.message || "Unable to verify the code. Please try again.";
      return rejectWithValue(errorMessage);
    }
  },
);

// ==================== CHANGE / RESET PASSWORD ====================

export const changePassword = createAsyncThunk(
  "auth/changePassword",
  async (
    payload: string | { oldPassword: string; newPassword: string },
    { dispatch, rejectWithValue },
  ) => {
    const isForcedChange =
      typeof payload === "object" && "oldPassword" in payload;

    try {
      const res = await apiClient(
        isForcedChange
          ? API_ENDPOINTS.password.forceChange
          : API_ENDPOINTS.password.change,
        {
          method: "POST",
          body: payload,
          skipRefresh: true,
        },
      );

      if (isForcedChange) {
        // temporary-password requirement satisfied → drop the flag
        const stored = localStorage.getItem(TOKEN_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            localStorage.setItem(
              TOKEN_KEY,
              JSON.stringify({
                ...parsed,
                forcePasswordChange: false,
                user: parsed.user
                  ? { ...parsed.user, forcePasswordChange: false }
                  : parsed.user,
              }),
            );
          } catch {
            /* ignore corrupt storage */
          }
        }

        dispatch(
          toast.success(
            "Password updated",
            "You can now continue to the dashboard",
          ),
        );
        return { changed: true };
      }

      const email =
        typeof payload === "string" ? payload : (payload as any).email;
      dispatch(
        toast.success(
          "Reset link sent",
          `Check ${email} for the 6-digit verification code.`,
        ),
      );
      return res;
    } catch (error: any) {
      const message =
        error?.message === "Failed to fetch"
          ? "Unable to reach the server. Please try again."
          : error?.message ||
            (isForcedChange
              ? "Could not update the password."
              : "Unable to send reset link.");
      dispatch(
        toast.error(
          isForcedChange
            ? "Password change failed"
            : "Could not send reset link",
          message,
        ),
      );
      return rejectWithValue(message);
    }
  },
);

export const resetPassword = createAsyncThunk(
  "auth/reset",
  async (
    { email, password }: { email: string; password: string },
    { dispatch, rejectWithValue },
  ) => {
    try {
      await apiClient(API_ENDPOINTS.password.reset, {
        method: "POST",
        body: { email, password },
        skipRefresh: true,
      });
      dispatch(
        toast.success(
          "Password updated",
          "You can now sign in with your new password.",
        ),
      );
      return true;
    } catch (error: any) {
      dispatch(toast.error("Password reset failed", error?.message));
      return rejectWithValue(error?.message ?? "Unable to reset password.");
    }
  },
);

/**
 * Account recovery, step 1 — email a one-time reset code.
 * Toast-free: the recovery screen owns its messaging and error handling.
 */
export const sendResetCode = createAsyncThunk(
  "auth/sendResetCode",
  async (email: string) => {
    return apiClient(API_ENDPOINTS.password.forgot, {
      method: "POST",
      body: { email },
      skipRefresh: true,
    });
  },
);

/**
 * Account recovery, step 2 — trade the code for a new password.
 * Toast-free: the recovery screen owns its messaging and error handling.
 */
export const resetPasswordWithCode = createAsyncThunk(
  "auth/resetPasswordWithCode",
  async (payload: { email: string; code: string; newPassword: string }) => {
    return apiClient(API_ENDPOINTS.password.resetWithCode, {
      method: "POST",
      body: payload,
      skipRefresh: true,
    });
  },
);

// ==================== REFRESH TOKEN THUNK ====================
export const refreshSession = createAsyncThunk(
  "auth/refreshSession",
  async (_, { rejectWithValue }) => {
    try {
      const refreshToken = getRefreshToken();

      const res = await apiClient<Session>(API_ENDPOINTS.auth.refreshToken, {
        method: "POST",
        skipRefresh: true, // crucial: prevents a refresh loop on failure
        skipAuth: true, // expired Bearer token must not be sent
        // fallback: send the token explicitly when the cookie is missing
        body: refreshToken ? { refreshToken } : undefined,
      });
      const payload: any = res?.data ?? res;
      const accessToken = payload?.accessToken ?? payload?.token;

      if (accessToken) {
        // Update the access token and expiry in localStorage
        const stored = localStorage.getItem(TOKEN_KEY);
        const parsed = stored ? JSON.parse(stored) : {};

        localStorage.setItem(
          TOKEN_KEY,
          JSON.stringify({
            ...parsed,
            accessToken,
            expiresAt: payload?.expiresAt ?? parsed.expiresAt,
          }),
        );

        // Update in-memory token and expiry
        setToken(accessToken);
        setTokenExpiry(payload?.expiresAt ?? parsed.expiresAt);

        return { ...parsed, ...payload, accessToken };
      }

      return rejectWithValue(res?.message || "Unable to refresh session");
    } catch (error: any) {
      return rejectWithValue(error?.message || "Session expired");
    }
  },
);

// ==================== LOGOUT THUNKS ====================

/** Full logout: tell the backend, then tear the local session down. */
export const logoutUser = createAsyncThunk(
  "auth/logoutUser",
  async (_, { dispatch }) => {
    dispatch(showLoader("Signing out..."));

    try {
      // Backend clears the httpOnly cookie
      await apiClient(API_ENDPOINTS.auth.logout, {
        method: "POST",
        skipRefresh: true,
      });
      dispatch(toast.success("Logged out successfully"));
    } catch (error: any) {
      console.warn("Server logout failed, clearing local session");
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setTokenExpiry(null);
      dispatch(clearModules());
      dispatch(hideLoader());
    }

    return true;
  },
);

/**
 * Best-effort server logout only (clears the refresh cookie) — no toasts,
 * no state changes, never rejects. Used when the local session is already
 * being cleared by hand (e.g. the force-password-change sign-out).
 */
export const logoutRequest = createAsyncThunk(
  "auth/logoutRequest",
  async () => {
    try {
      await apiClient(API_ENDPOINTS.auth.logout, {
        method: "POST",
        skipRefresh: true,
      });
    } catch {
      /* best-effort only */
    }
    return true;
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      state.session = null;
      state.status = "unauthenticated";
      state.error = null;
      state.reset = { email: null, token: null };
      setToken(null);
      setTokenExpiry(null);
      localStorage.removeItem(TOKEN_KEY);
    },
    syncUser(state, action: PayloadAction<User>) {
      if (state.session && state.session.user.id === action.payload.id) {
        state.session = { ...state.session, user: action.payload };
      }
    },
    setResetEmail(state, action: PayloadAction<string>) {
      state.reset.email = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // RESTORE
      .addCase(restoreSession.pending, (state) => {
        state.status = "restoring";
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        if (action.payload) {
          state.session = action.payload as Session;
          state.status = "authenticated";
        } else {
          state.session = null;
          state.status = "unauthenticated";
        }
      })
      .addCase(restoreSession.rejected, (state) => {
        state.session = null;
        state.status = "unauthenticated";
      })
      // REFRESH
      .addCase(refreshSession.fulfilled, (state, action) => {
        if (state.session) {
          state.session = {
            ...state.session,
            accessToken:
              action.payload.accessToken ?? state.session.accessToken,
            expiresAt: action.payload.expiresAt ?? state.session.expiresAt,
          } as Session;
        }
        state.status = "authenticated";
        state.error = null;
      })
      .addCase(refreshSession.rejected, (state) => {
        state.session = null;
        state.status = "unauthenticated";
      })
      // LOGIN
      .addCase(login.pending, (state) => {
        state.status = "authenticating";
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        // A 2FA challenge is not a session - stay signed out; the login screen
        // collects the code and verifyOtp finishes the job.
        if ((action.payload as any)?.requiresOtp) {
          state.session = null;
          state.status = "unauthenticated";
          return;
        }
        state.status = "authenticated";
        state.session = action.payload;
      })
      .addCase(login.rejected, (state, action) => {
        state.status = "unauthenticated";
        state.error = (action.payload as string) ?? "Unable to sign in.";
      })
      // 2FA
      .addCase(verifyOtp.pending, (state) => {
        state.status = "authenticating";
        state.error = null;
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.status = "authenticated";
        state.session = action.payload;
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.status = "unauthenticated";
        state.error =
          (action.payload as string) ?? "Unable to verify the code.";
      })
      // PASSWORD
      .addCase(changePassword.fulfilled, (state, action) => {
        const arg: any = action.meta.arg;

        // forced change (HospitalChangePasswordDto) → flag satisfied
        if (arg && typeof arg === "object" && "oldPassword" in arg) {
          if (state.session) {
            state.session = {
              ...state.session,
              forcePasswordChange: false,
              user: state.session.user
                ? { ...state.session.user, forcePasswordChange: false }
                : state.session.user,
            };
          }
          state.error = null;
          return;
        }

        // recovery → remember the email + verification token
        const payload = action.payload as any;
        const token = payload?.data?.token ?? payload?.token ?? null;
        state.reset = { email: arg as string, token };
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.reset = { email: null, token: null };
      })
      // LOGOUT
      .addCase(logoutUser.fulfilled, (state) => {
        state.session = null;
        state.status = "unauthenticated";
        state.error = null;
        state.reset = { email: null, token: null };
      });
  },
});

export const { logout, syncUser, setResetEmail } = authSlice.actions;

export const selectSession = (s: { auth: AuthState }) => s.auth.session;
export const selectUser = (s: { auth: AuthState }) =>
  s.auth.session?.user ?? null;
export const selectIsAuthenticated = (s: { auth: AuthState }) =>
  !!s.auth.session;

/**
 * Single source of truth for "this account must change its password first".
 * The flag can arrive on the session or on the user (login response), so every
 * guard / gate reads it from here instead of re-checking both shapes.
 */
export const selectMustChangePassword = (s: { auth: AuthState }) => {
  const session = s.auth.session;
  return Boolean(
    session?.forcePasswordChange || session?.user?.forcePasswordChange,
  );
};

export function canAccess(
  user: User | null,
  module: string,
  action: Permission = "view",
) {
  if (!user) return false;
  if (!user.modules?.includes(module)) return false;
  const granted = user.permissions?.[module];
  if (!granted || !granted.length) return action === "view";
  return granted.includes(action);
}

export default authSlice.reducer;
