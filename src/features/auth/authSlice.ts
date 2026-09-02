import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { authApi, setToken, TOKEN_KEY } from "@/services/apiClient";
import { toast } from "@/features/ui/uiSlice";
import type { ModuleKey, Permission, Session, User } from "@/types";
import {
  clearEntitlements,
  fetchEntitlements,
} from "../entitlement/entitlementSlice";
import { store } from "@/store";
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

export const restoreSession = createAsyncThunk("auth/restore", async () => {
  const res = await authApi.me();
  return res.data;
});

export const login = createAsyncThunk(
  "auth/login",
  async (
    { email, password }: { email: string; password: string },
    { dispatch, rejectWithValue },
  ) => {
    try {
      const res = await authApi.login(email, password);
      localStorage.setItem(
        TOKEN_KEY,
        JSON.stringify({
          token: res.data.accessToken,
          user: res.data.user,
          expiresAt: res.data.expiresAt,
        }),
      );
      setToken(res.data.accessToken);
      dispatch(
        toast.success(
          `Welcome back, ${res.data.user.firstName}`,
          `Signed in as ${res.data.user.userType}`,
        ),
      );
      return res.data;
    } catch (error: any) {
      dispatch(toast.error("Sign in failed", error?.message));
      return rejectWithValue(error?.message ?? "Unable to sign in.");
    }
  },
);

export const forgotPassword = createAsyncThunk(
  "auth/forgot",
  async (email: string, { dispatch, rejectWithValue }) => {
    try {
      const res = await authApi.forgotPassword(email);
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

        // Fetch entitlements after login
        if (action.payload?.accessToken) {
          store.dispatch(fetchEntitlements());
        }
      })
      .addCase(login.rejected, (state, action) => {
        state.status = "unauthenticated";
        state.error = (action.payload as string) ?? "Unable to sign in.";
      })
      .addCase(forgotPassword.fulfilled, (state, action) => {
        // action.payload is ApiResponse<any>
        const payload = action.payload as any;
        const token = payload?.data?.token ?? payload?.token ?? null;
        state.reset = { email: action.meta.arg, token };
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.reset = { email: null, token: null };
      })
      .addCase(logout, (state) => {
        state.session = null;
        store.dispatch(clearEntitlements());
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
