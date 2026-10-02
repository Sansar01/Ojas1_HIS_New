/**
 * Permission slice — authorization for the signed-in user.
 *
 *   permissionSlice
 *       ├── userPermissions    (module → granted actions of the user)
 *       ├── loading / ready    (permission-resolution state)
 *       └── error
 *
 * Lookup helpers (selector factories):
 *
 *   const canAccessPatients = useAppSelector(selectCanAccess("patients"));
 *   const canSeeReports     = useAppSelector(selectHasFeature("reports", "EXPORT"));
 *
 * Answers "what is the user allowed to access?" — built on the runtime
 * module catalogue (`moduleSlice`) and the resolved entitlements, with the
 * exact matching rules from `utils/permissions`. "Who is the user?" stays in
 * `authSlice`.
 */

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { Permission } from "@/types";
import type { RootState } from "@/store/types";
import { canAccessModule, hasFeature } from "@/utils/permissions";
import { fetchModules } from "./moduleSlice";
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
      // permission resolution follows the module catalogue lifecycle
      .addCase(fetchModules.pending, (state) => {
        state.status = "loading";
        state.loading = true;
        state.ready = false;
        state.error = null;
      })
      .addCase(fetchModules.fulfilled, (state) => {
        state.status = "succeeded";
        state.loading = false;
        state.ready = true;
      })
      .addCase(fetchModules.rejected, (state, action) => {
        state.status = "failed";
        state.loading = false;
        state.ready = true;
        state.error =
          (action.payload as string) ?? "Unable to load permissions";
      })
      .addCase(loadUserPermissions.fulfilled, (state, action) => {
        state.userPermissions = action.payload ?? {};
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
export const selectPermissionSource = (
  state: RootState,
): Entitlements | null => {
  const session = state.auth.session;
  const dynamicModules = state.modules.availableModules ?? [];
  const sessionEntitlements = session?.entitlements ?? null;

  const userType =
    session?.user?.userType ??
    (session?.user as any)?.role?.slug ??
    (session?.user as any)?.role?.name ??
    null;

  return dynamicModules.length
    ? { userType: userType ?? undefined, modules: dynamicModules }
    : (sessionEntitlements ?? (userType ? { userType, modules: [] } : null));
};

/** Can the user run `action` on `module`? */
export const selectCanAccess =
  (module: string, action: Permission = "view") =>
  (state: RootState): boolean =>
    canAccessModule(selectPermissionSource(state), module, action);

/** Does the user's module carry a specific feature code? */
export const selectHasFeature =
  (moduleCode: string, featureCode: string) =>
  (state: RootState): boolean =>
    hasFeature(selectPermissionSource(state), moduleCode, featureCode);

export default permissionSlice.reducer;
