/**
 * Module slice — which modules the signed-in user is entitled to.
 *
 *   moduleSlice
 *       ├── availableModules   (runtime catalogue: { id, name, code, route })
 *       ├── loading / ready    (initialisation state)
 *       └── error
 *
 * Answers "which modules may this user open?" — authorization data only.
 * "Who is the user?" stays in `authSlice`; fine-grained access checks live
 * in `permissionSlice`. Uses the centralised modules endpoints:
 *
 *   API_ENDPOINTS.modules.available
 */

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { moduleApi } from "@/api/moduleApi";
import type { RootState } from "@/store/types";
import { hideLoader, showLoader, toast } from "./uiSlice";
import { EntitlementModule } from "@/types/moduleTypes";

interface ModuleState {
  availableModules: EntitlementModule[];
  status: "idle" | "loading" | "succeeded" | "failed";
  loading: boolean;
  ready: boolean;
  error: string | null;
}

const initialState: ModuleState = {
  availableModules: [],
  status: "idle",
  loading: false,
  ready: false,
  error: null,
};

/**
 * Load the module catalogue (+ features) granted to the current user.
 *
 * Dispatched by `/permission` — the single bootstrap owner (doc §43, §48).
 * The `condition` guard (doc §47) makes StrictMode double-mounts, route
 * transitions and refreshes harmless:
 *
 *   already loading?  -> stop
 *   already loaded?   -> stop
 *   idle / failed?    -> request
 *
 * A browser refresh starts from a fresh store, so the guard is `idle` and the
 * flow runs again — exactly what doc §41 requires.
 */
export const fetchModules = createAsyncThunk(
  "modules/fetch",
  async (_, { dispatch, rejectWithValue }) => {
    dispatch(showLoader("Loading"));
    try {
      const response: any = await moduleApi.available();

      if (response?.cancelled) {
        dispatch(hideLoader());
        return [];
      }

      if (
        !Array.isArray(response) &&
        (!response || Object.keys(response).length === 0)
      ) {
        throw new Error(
          "Server returned an empty response (200 with no data).",
        );
      }
      if (response?.success === false) {
        throw new Error(
          response?.message || "Server refused the modules request.",
        );
      }

      const data = response?.data ?? response;
      const modules = Array.isArray(data)
        ? data
        : Array.isArray(data?.modules)
          ? data.modules
          : data?.id && data?.features
            ? [data]
            : [];

      dispatch(hideLoader());
      return modules as EntitlementModule[];
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Could not load permissions", error?.message));
      return rejectWithValue(error?.message ?? "Unable to load permissions");
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as RootState;
      if (state.modules.loading) return false; // already in flight
      if (state.modules.status === "succeeded") return false; // already loaded
      return true; // idle or failed → (re)try
    },
  },
);

const moduleSlice = createSlice({
  name: "modules",
  initialState,
  reducers: {
    clearModules: (state) => {
      state.availableModules = [];
      state.status = "idle";
      state.loading = false;
      state.ready = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchModules.pending, (state) => {
        state.status = "loading";
        state.loading = true;
        state.ready = false;
        state.error = null;
      })
      .addCase(fetchModules.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.loading = false;
        state.ready = true;
        state.availableModules = action.payload || [];
      })
      .addCase(fetchModules.rejected, (state, action) => {
        state.status = "failed";
        state.loading = false;
        // Mark ready even on failure so guards don't spin forever.
        // The empty module list will cause the Forbidden fallback.
        state.ready = true;
        state.error = action.payload as string;
      });
  },
});

export const { clearModules } = moduleSlice.actions;
export default moduleSlice.reducer;
