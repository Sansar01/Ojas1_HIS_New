import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import {
  authApi,
  clearRefreshToken,
  setRefreshToken,
  setToken,
  setTokenExpiry,
  TOKEN_KEY,
} from "@/services/apiClient";
import { hideLoader, showLoader, toast } from "@/features/ui/uiSlice";
import type { ModuleKey, Permission, Role, Session, User } from "@/types";
import { clearEntitlements } from "../entitlement/entitlementSlice";
import { Entitlements } from "@/types/entitlement";

/* ---------------------------------------------------------------------------
 * Authentication + current-user permissions (RBAC source of truth)
 * ------------------------------------------------------------------------ */

interface AuthState {
  session: Session | null;
  entitlements: Entitlements | null;
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
  entitlements: null,
  status: "idle",
  error: null,
  reset: { email: null, token: null },
};

/* ========================= session storage ===============================
 * Everything about the signed-in session lives in ONE localStorage JSON blob
 * (TOKEN_KEY = "authUserToken"). All reads/writes go through the helpers below
 * so login / restoreSession / refreshSession / logout can never disagree on
 * the stored shape.
 * ------------------------------------------------------------------------- */

interface StoredSession {
  accessToken?: string;
  /** Persisted only when the backend exposes it. In httpOnly-cookie mode the
   *  refresh token never reaches JS, so this stays absent and the refresh
   *  request simply relies on the cookie. */
  refreshToken?: string;
  user?: User;
  role?: Role;
  expiresAt?: string;
  entitlements?: Entitlements | null;
  /** login response flag — user must set a new password first */
  forcePasswordChange?: boolean;
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

/** Single writer for the session blob — never throws (private mode, quota). */
function writeStoredSession(session: StoredSession): void {
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(session));
  } catch {
    /* storage unavailable — the session stays in memory only */
  }
}

/** Single remover for the session blob. */
function clearStoredSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* nothing to clear */
  }
}


/**
 * Defensive token extraction — accepts the key variants real backends use
 * (accessToken/token, refreshToken/refresh). Returns undefined for fields the
 * backend did not include, so callers can decide what to persist/rotate.
 */
function pickTokens(data: any): {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
} {
  return {
    accessToken: data?.accessToken ?? data?.token,
    refreshToken: data?.refreshToken ?? data?.refresh, // undefined ⇒ no rotation
    expiresAt: data?.expiresAt,
  };
}

export const restoreSession = createAsyncThunk(
  "auth/restoreSession",
  async (_, { rejectWithValue }) => {
    const stored = readStoredSession();
    if (!stored?.accessToken || !stored?.user) {
      clearStoredSession();
      setToken(null);
      return null;
    }

    // Bring the access token back into memory for the apiClient.
    setToken(stored.accessToken);

    const user = stored.user;
    const role = stored.role;
    let { accessToken, refreshToken, expiresAt } = stored;
    const entitlements = stored.entitlements ?? null;

    // Fast path: the stored access token is still valid (or the backend did
    // not send an expiresAt) → restore from localStorage with NO API call.
    // This is the common reload case and stays synchronous-fast.
    //
    // Slow path: the access token is already expired but the refresh-token
    // httpOnly cookie may still be alive → silently refresh once before
    // restoring, otherwise the very first API call would 401. If the refresh
    // fails the session is genuinely gone → unauthenticated (login screen).
    const isExpired =
      !!expiresAt && new Date(expiresAt).getTime() <= Date.now();

    if (isExpired) {
      try {
        const res = await authApi.refresh(); // cookie travels automatically
        // Accept both shapes: envelope { data: { accessToken } } (login style)
        // and a bare { accessToken } body (the refresh controller returns data
        // directly) — whichever the backend uses.
        const body = res as any;
        const payload = body?.data ?? res;
        const tokens = pickTokens(payload);

        if (!tokens.accessToken) {
          clearStoredSession();
          setToken(null);
          return null;
        }

        accessToken = tokens.accessToken;
        refreshToken = tokens.refreshToken ?? refreshToken;
        expiresAt = tokens.expiresAt ?? expiresAt;

        // spread the stored record first so nothing is lost on rotation
        // (forcePasswordChange, and any field a future backend adds)
        writeStoredSession({
          ...stored,
          accessToken,
          ...(refreshToken ? { refreshToken } : {}),
          user,
          role,
          entitlements,
          ...(expiresAt ? { expiresAt } : {}),
        });
        setToken(accessToken);
      } catch (error: any) {
        // Dead access token + failed refresh ⇒ the session cannot be restored.
        clearStoredSession();
        setToken(null);
        return rejectWithValue(error?.message ?? "Session expired");
      }
    }

    return {
      accessToken,
      user,
      role: role ?? ({ name: user.userType } as Role),
      expiresAt,
      entitlements,
      forcePasswordChange: Boolean(stored.forcePasswordChange),
    } as Session;
  },
);

export const login = createAsyncThunk(
  "auth/login",
  async (
    { email, password }: { email: string; password: string },
    { dispatch, rejectWithValue },
  ) => {
    try {
      const res = await authApi.login(email, password);
      const data = (res.data ?? {}) as any;
      const accessToken = data.accessToken ?? data.token;
      const user = data.user;

      if (accessToken && user) {
        const { refreshToken, expiresAt } = pickTokens(data);
        // backend flag from the login response
        const forcePasswordChange = Boolean(
          data?.forcePasswordChange ?? data?.user?.forcePasswordChange,
        );

        // Persist the whole session. With an httpOnly-cookie backend the
        // refresh token is NOT part of the response — the browser stored the
        // cookie from the Set-Cookie header of this same login request. When
        // the backend *does* return one we persist it as well (rotation-ready,
        // token-in-body backends).
        writeStoredSession({
          accessToken,
          ...(refreshToken ? { refreshToken } : {}),
          user,
          role: data.role,
          entitlements: data.entitlements ?? null,
          ...(expiresAt ? { expiresAt } : {}),
          ...(forcePasswordChange ? { forcePasswordChange: true } : {}),
        });
        setToken(accessToken);

        // Success toast
        dispatch(
          toast.success(
            `Welcome back, ${user.firstName}`,
            forcePasswordChange
              ? "Set a new password to finish signing in."
              : `Signed in as ${user.userType}`,
          ),
        );

        // `forcePasswordChange` lets the login screen route to the
        // force-password page instead of the dashboard.
        return { ...(res.data as any), forcePasswordChange };
      }

      // If response is not successful
      const errorMessage =
        res.message || "The email or password is incorrect. Please try again.";
      return rejectWithValue(errorMessage);
    } catch (error: any) {
      const errorMessage =
        error?.message === "Failed to fetch"
          ? "Unable to reach the server. Please check your connection and try again."
          : error?.message || "Unable to sign in. Please try again.";
      return rejectWithValue(errorMessage);
    }
  },
);

// export const login = createAsyncThunk(
//   "auth/login",
//   async (
//     { email, password }: { email: string; password: string },
//     { dispatch, rejectWithValue },
//   ) => {
//     try {
//       const res = await authApi.login(email, password);

//       if (res.data?.accessToken && res.data?.user) {
//         // Save token (persist refreshToken too so it survives page reloads
//         // and can be sent explicitly on /auth/refresh if the cookie is lost)
//         localStorage.setItem(
//           TOKEN_KEY,
//           JSON.stringify({
//             accessToken: res.data.accessToken,
//             user: res.data.user,
//             expiresAt: res.data.expiresAt,
//             refreshToken: (res.data as any).refreshToken ?? null,
//           }),
//         );
//         setRefreshToken((res.data as any).refreshToken);
//         setToken(res.data.accessToken);
//         setTokenExpiry(res.data.expiresAt);

//         // Success toast
//         dispatch(
//           toast.success(
//             `Welcome back, ${res.data.user.firstName}`,
//             `Signed in as ${res.data.user.userType}`,
//           ),
//         );

//         return res.data;
//       }

//       // If response is not successful
//       const errorMessage =
//         res.message || "The email or password is incorrect. Please try again.";
//       return rejectWithValue(errorMessage);
//     } catch (error: any) {
//       const errorMessage =
//         error?.message === "Failed to fetch"
//           ? "Unable to reach the server. Please check your connection and try again."
//           : error?.message || "Unable to sign in. Please try again.";
//       return rejectWithValue(errorMessage);
//     }
//   },
// );

/**
 * changePassword — one thunk for both password flows.
 *
 *   changePassword("user@mail.com")                     → recovery (pre-auth):
 *        emails the verification code.  ({ email } also accepted)
 *
 *   changePassword({ oldPassword, newPassword })         → forced change for the
 *        signed-in user, i.e. the backend's HospitalChangePasswordDto. On
 *        success the session's forcePasswordChange flag is cleared (stored
 *        session included) and the user re-signs in with the new password.
 */
export const changePassword = createAsyncThunk(
  "auth/changePassword",
  async (
    payload:
      | string
      | { oldPassword: string; newPassword: string },
    { dispatch, rejectWithValue },
  ) => {
    const isForcedChange =
      typeof payload === "object" && "oldPassword" in payload;

    try {
      const res = await authApi.changePassword(payload as any);

      if (isForcedChange) {
        // password replaced → the temporary-password requirement is satisfied
        const data: any = (res as any)?.data ?? {};
        const { accessToken, refreshToken, expiresAt } = pickTokens(data);
        const stored = readStoredSession() ?? {};
        const nextUser = stored.user
          ? { ...stored.user, forcePasswordChange: false }
          : stored.user;

        writeStoredSession({
          ...stored,
          ...(nextUser ? { user: nextUser } : {}),
          ...(accessToken ? { accessToken } : {}),
          ...(refreshToken ? { refreshToken } : {}),
          ...(expiresAt ? { expiresAt } : {}),
          forcePasswordChange: false,
        });
        if (accessToken) setToken(accessToken);

        dispatch(
          toast.success(
            "Password updated",
            "Sign in again with your new password.",
          ),
        );
        return { ...data, forcePasswordChange: false };
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
          isForcedChange ? "Password change failed" : "Could not send reset link",
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
      await authApi.resetPassword(email, password);
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

// ==================== REFRESH TOKEN THUNK ====================
/**
 * Called by apiClient when a request returns 401.
 * Tries POST /auth/refresh to get a new accessToken.
 * - Success → updates localStorage + Redux session, apiClient retries the
 *   original request transparently. User never sees a login screen.
 * - Failure → returns false to apiClient, which clears the session and
 *   navigates to /accounts/login.
 * Uses skipRefresh on the underlying request so it can never recurse.
 */





export const refreshSession = createAsyncThunk(
  "auth/refreshSession",
  async (_, { rejectWithValue }) => {
    try {
      const res = await authApi.refresh();
      // Handle both { data: { accessToken } } and direct { accessToken } formats
      const payload: any = res?.data ?? res;
      const accessToken = payload?.accessToken ?? payload?.token;

      if (accessToken) {
        const stored = localStorage.getItem(TOKEN_KEY);
        const parsed = stored ? JSON.parse(stored) : {};
        const rotatedRefresh = payload?.refreshToken ?? null;

        localStorage.setItem(
          TOKEN_KEY,
          JSON.stringify({
            ...parsed,
            accessToken,
            expiresAt: payload?.expiresAt ?? parsed.expiresAt,
            refreshToken: rotatedRefresh ?? parsed.refreshToken ?? null,
          }),
        );

        if (rotatedRefresh) setRefreshToken(rotatedRefresh);
        setToken(accessToken);
        setTokenExpiry(payload?.expiresAt ?? parsed.expiresAt);

        return payload;
      }

      return rejectWithValue(res?.message || "Unable to refresh session");
    } catch (error: any) {
      return rejectWithValue(error?.message || "Session expired");
    }
  },
);
// ==================== LOGOUT THUNK ====================
export const logoutUser = createAsyncThunk(
  "auth/logoutUser",
  async (_, { dispatch }) => {
    dispatch(showLoader("Signing out..."));

    try {
      // Call logout API
      await authApi.logout();

      // Clear local storage and token
      localStorage.removeItem(TOKEN_KEY);
      clearRefreshToken();
      setToken(null);

      // Clear entitlements
      dispatch(clearEntitlements());

      dispatch(toast.success("Logged out successfully"));

      return true;
    } catch (error: any) {
      // Even if API fails, we still logout locally
      localStorage.removeItem(TOKEN_KEY);
      clearRefreshToken();
      setToken(null);
      dispatch(clearEntitlements());

      dispatch(
        toast.warning(error?.message || "Logged out (server error ignored)"),
      );
      return true;
    } finally {
      dispatch(hideLoader());
    }
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
      localStorage.removeItem(TOKEN_KEY);
    },
    /** keeps the active session in sync after a profile / user edit */
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
      .addCase(restoreSession.pending, (state) => {
        state.status = "restoring";
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        if (action.payload) {
          state.session = action.payload;
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
      // ==================== REFRESH HANDLERS ====================
      .addCase(refreshSession.fulfilled, (state, action) => {
        // Keep the existing user in place, just swap the fresh token in
        if (state.session) {
          state.session = {
            ...state.session,
            accessToken: action.payload.accessToken,
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
      .addCase(login.pending, (state) => {
        state.status = "authenticating";
        state.error = null;
      })
      // In login.fulfilled
      .addCase(login.fulfilled, (state, action) => {
        state.status = "authenticated";
        state.session = action.payload;
      })
      .addCase(login.rejected, (state, action) => {
        state.status = "unauthenticated";
        state.error = (action.payload as string) ?? "Unable to sign in.";
      })
      .addCase(changePassword.fulfilled, (state, action) => {
        const arg: any = action.meta.arg;
        const payload = action.payload as any;

        // forced change (HospitalChangePasswordDto) → flag is satisfied
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
        const email =
          typeof arg === "string" ? arg : (arg?.email ?? null);
        const token = payload?.data?.token ?? payload?.token ?? null;
        state.reset = { email, token };
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.reset = { email: null, token: null };
      })
      // ==================== LOGOUT THUNK HANDLERS ====================
      .addCase(logoutUser.fulfilled, (state) => {
        state.session = null;
        state.status = "unauthenticated";
        state.error = null;
        state.reset = { email: null, token: null };
      });
  },
});

export const { logout, syncUser, setResetEmail } = authSlice.actions;

/* ------------------------------- selectors ------------------------------- */

export const selectSession = (s: { auth: AuthState }) => s.auth.session;
export const selectUser = (s: { auth: AuthState }) =>
  s.auth.session?.user ?? null;
export const selectIsAuthenticated = (s: { auth: AuthState }) =>
  !!s.auth.session;

export function canAccess(
  user: User | null,
  module: ModuleKey,
  action: Permission = "view",
) {
  if (!user) return false;
  if (!user.modules?.includes(module)) return false;
  const granted = user.permissions?.[module];
  if (!granted || !granted.length) return action === "view";
  return granted.includes(action);
}

export default authSlice.reducer;
