import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { authApi, setToken, TOKEN_KEY } from "@/services/apiClient";
import { hideLoader, showLoader, toast } from "@/features/ui/uiSlice";
import type { ModuleKey, Permission, Session, User } from "@/types";
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

      // Set token in memory
      setToken(parsed.accessToken);

      // Return the stored session directly (no API call)
      return {
        accessToken: parsed.accessToken,
        user: parsed.user,
        role: parsed.role || { name: parsed.user.userType },
        expiresAt: parsed.expiresAt,
        entitlements: parsed.entitlements || null,
      };
    } catch (error: any) {
      localStorage.removeItem(TOKEN_KEY);
      return rejectWithValue(error?.message);
    }
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

      if (res.data) {
        // Save token
        localStorage.setItem(
          TOKEN_KEY,
          JSON.stringify({
            accessToken: res.data.accessToken,
            user: res.data.user,
            expiresAt: res.data.expiresAt,
          }),
        );
        setToken(res.data.accessToken);

        // Success toast
        dispatch(
          toast.success(
            `Welcome back, ${res.data.user.firstName}`,
            `Signed in as ${res.data.user.userType}`,
          ),
        );

        return res.data;
      }

      // If response is not successful
      const errorMessage = res.message || "Login failed";
      dispatch(toast.error("Sign in failed", errorMessage));
      return rejectWithValue(errorMessage);
    } catch (error: any) {
      const errorMessage = error?.message || "Unable to sign in.";
      dispatch(toast.error("Sign in failed", errorMessage));
      return rejectWithValue(errorMessage);
    }
  },
);

export const changePassword = createAsyncThunk(
  "auth/changePassword",
  async (email: string, { dispatch, rejectWithValue }) => {
    try {
      const res = await authApi.changePassword(email);
      dispatch(
        toast.success(
          "Reset link sent",
          `Check ${email} for the 6-digit verification code.`,
        ),
      );
      return res;
    } catch (error: any) {
      dispatch(toast.error("Could not send reset link", error?.message));
      return rejectWithValue(error?.message ?? "Unable to send reset link.");
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
      setToken(null);

      // Clear entitlements
      dispatch(clearEntitlements());

      dispatch(toast.success("Logged out successfully"));

      return true;
    } catch (error: any) {
      // Even if API fails, we still logout locally
      localStorage.removeItem(TOKEN_KEY);
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
        // action.payload is ApiResponse<any>
        const payload = action.payload as any;
        const token = payload?.data?.token ?? payload?.token ?? null;
        state.reset = { email: action.meta.arg, token };
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
