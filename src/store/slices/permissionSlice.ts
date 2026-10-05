/**
 * Permission slice — authorization for the signed-in user.
 *
 *   permissionSlice
 *       ├── userPermissions    (module → granted actions of the user)
 *       ├── loading / ready    (permission-resolution state)
 *       └── error
 *
 * Runtime lookups go through `usePermission()` (`@/hooks`), which reads
 * `selectPermissionSource` plus the module catalogue.
 *
 * Answers "what is the user allowed to access?" — built on the runtime
 * module catalogue (`moduleSlice`) and the resolved entitlements, with the
 * exact matching rules from `utils/permissions`. "Who is the user?" stays in
 * `authSlice`.
 */

import { createAsyncThunk, createSelector, createSlice } from "@reduxjs/toolkit";
import type { Permission } from "@/types";
import type { RootState } from "@/store/types";
import { Entitlements } from "@/types/moduleTypes";

interface PermissionState {
  /** module → granted actions of the signed-in user */
  userPermissions: Partial<Record<string, Permission[]>>;
  status: "idle" | "loading" | "succeeded" | "failed";
  loading: boolean;
  ready: boolean;
  error: string | null;
}

const initialState: PermissionState = {
  userPermissions: {},
  status: "idle",
  loading: false,
  ready: false,
  error: null,
};

/**
 * Snapshot the user's permission map (and resolution status) from the live
 * auth + module state. Runs after login / OTP / session restore and after
 * the module catalogue has been (re)loaded.
 */
export const loadUserPermissions = createAsyncThunk(
  "permission/load",
  async (_, { getState }) => {
    const state = getState() as RootState;
    const user = state.auth.session?.user ?? null;
    return (user?.permissions ?? {}) as Partial<Record<string, Permission[]>>;
  },
  {
    // duplicate-request protection (doc §47) — one resolve per session
    condition: (_, { getState }) => {
      const state = getState() as RootState;
      if (state.permission.loading) return false;
      if (state.permission.status === "succeeded") return false;
      return true;
    },
  },
);

const permissionSlice = createSlice({
  name: "permission",
  initialState,
  reducers: {
    clearPermissions: (state) => {
      state.userPermissions = {};
      state.status = "idle";
      state.loading = false;
      state.ready = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // The permission resolve step owns its own lifecycle (doc §44):
      // modules live in `moduleSlice`, permissions here — the bootstrap
      // sequence is what orders them (see bootstrapSlice).
      .addCase(loadUserPermissions.pending, (state) => {
        state.status = "loading";
        state.loading = true;
        state.ready = false;
        state.error = null;
      })
      .addCase(loadUserPermissions.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.loading = false;
        state.ready = true;
        state.userPermissions = action.payload ?? {};
      })
      .addCase(loadUserPermissions.rejected, (state, action) => {
        state.status = "failed";
        state.loading = false;
        state.ready = true;
        state.error =
          (action.payload as string) ?? "Unable to load permissions";
      });
  },
});

export const { clearPermissions } = permissionSlice.actions;

/* --------------------------- permission lookups --------------------------- */

/**
 * The effective entitlements used for every access decision:
 * the runtime module catalogue when loaded, otherwise the entitlements
 * snapshot embedded in the session.
 */
const selectSession = (state: RootState) => state.auth.session;
const selectAvailableModules = (state: RootState) =>
  state.modules.availableModules;

export const selectPermissionSource = createSelector(
  [selectSession, selectAvailableModules],
  (session, availableModules): Entitlements | null => {
    const dynamicModules = availableModules ?? [];
    const sessionEntitlements = session?.entitlements ?? null;

    const userType =
      session?.user?.userType ??
      (session?.user as any)?.role?.slug ??
      (session?.user as any)?.role?.name ??
      null;

    return dynamicModules.length
      ? { userType: userType ?? undefined, modules: dynamicModules }
      : (sessionEntitlements ?? (userType ? { userType, modules: [] } : null));
  },
);

export default permissionSlice.reducer;
