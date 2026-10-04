/**
 * Bootstrap slice — the application's post-login initialisation state.
 *
 *   Login → 2FA → /permission → modules → permissions → Dashboard
 *
 * This slice holds *only* the status of that sequence (doc §51). The data
 * itself stays in its own slices — `moduleSlice.availableModules` and
 * `permissionSlice.userPermissions` — which remain the single source of truth
 * (doc §44). Nothing here triggers a request: `/permission` is the single
 * bootstrap *owner* (doc §43, §48) and the thunks it dispatches are guarded
 * (doc §47).
 *
 *   idle ──► loading-modules ──► loading-permissions ──► ready
 *                 │                       │
 *                 └────────► failed ◄─────┘
 */

import { createSlice } from "@reduxjs/toolkit";
import type { RootState } from "@/store/types";
import { fetchModules, clearModules } from "./moduleSlice";
import { loadUserPermissions, clearPermissions } from "./permissionSlice";

export type BootstrapStatus =
  | "idle"
  | "loading-modules"
  | "loading-permissions"
  | "ready"
  | "failed";

interface BootstrapState {
  status: BootstrapStatus;
  error: string | null;
}

const initialState: BootstrapState = {
  status: "idle",
  error: null,
};

const bootstrapSlice = createSlice({
  name: "bootstrap",
  initialState,
  reducers: {
    /**
     * Put the bootstrap back to `idle` so `/permission` retries.
     * Used by the error/retry state — nothing else should call it.
     */
    resetBootstrap: (state) => {
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      /* step 1 — modules */
      .addCase(fetchModules.pending, (state) => {
        state.status = "loading-modules";
        state.error = null;
      })
      /* step 1 done → step 2 — permissions */
      .addCase(fetchModules.fulfilled, (state) => {
        state.status = "loading-permissions";
        state.error = null;
      })
      .addCase(fetchModules.rejected, (state, action) => {
        state.status = "failed";
        state.error = (action.payload as string) ?? "Unable to load modules";
      })
      /* step 2 done → ready */
      .addCase(loadUserPermissions.fulfilled, (state) => {
        state.status = "ready";
        state.error = null;
      })
      .addCase(loadUserPermissions.rejected, (state, action) => {
        state.status = "failed";
        state.error =
          (action.payload as string) ?? "Unable to load permissions";
      })
      /* signing out puts the bootstrap back to its very first state */
      .addCase(clearModules, (state) => {
        state.status = "idle";
        state.error = null;
      })
      .addCase(clearPermissions, (state) => {
        state.status = "idle";
        state.error = null;
      });
  },
});

export const { resetBootstrap } = bootstrapSlice.actions;

/* ------------------------------- selectors -------------------------------- */

export const selectBootstrapStatus = (state: RootState): BootstrapStatus =>
  state.bootstrap.status;

export const selectBootstrapError = (state: RootState): string | null =>
  state.bootstrap.error;

/** True only when modules *and* permissions finished loading (doc §38). */
export const selectBootstrapReady = (state: RootState): boolean =>
  state.bootstrap.status === "ready" &&
  state.modules.ready &&
  state.permission.ready;

export default bootstrapSlice.reducer;
