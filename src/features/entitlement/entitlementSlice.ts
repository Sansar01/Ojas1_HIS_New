import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { entitlementApi } from "@/services/apiClient";
import type { EntitlementModule } from "@/types/entitlement";
import { hideLoader, showLoader, toast } from "../ui/uiSlice";

interface EntitlementState {
  modules: EntitlementModule[];
  loading: boolean;
  ready: boolean;
  error: string | null;
}

const initialState: EntitlementState = {
  modules: [],
  loading: false,
  ready: false,
  error: null,
};

export const fetchEntitlements = createAsyncThunk(
  "entitlement/fetchModules",
  async (_, { dispatch, rejectWithValue }) => {
    dispatch(showLoader("Loading modules"));
    try {
      const res = await entitlementApi.getModules();
      const response: any = res;
      // Session closed mid-flight (logout / forced change) — stay quiet.
      if (response?.cancelled) {
        dispatch(hideLoader());
        return [];
      }
      // A 200 with an empty/unreadable body parses to {} — never valid here,
      // so fail loudly instead of silently showing an empty portal.
      // (A genuinely empty module list arrives as [], which stays valid.)
      if (!Array.isArray(response) && (!response || Object.keys(response).length === 0)) {
        throw new Error("Server returned an empty response (200 with no data).");
      }
      if (response?.success === false) {
        throw new Error(response?.message || "Server refused the modules request.");
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
);

const entitlementSlice = createSlice({
  name: "entitlement",
  initialState,
  reducers: {
    clearEntitlements: (state) => {
      state.modules = [];
      state.ready = false;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEntitlements.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEntitlements.fulfilled, (state, action) => {
        state.loading = false;
        state.ready = true;
        state.modules = action.payload || [];
      })
      .addCase(fetchEntitlements.rejected, (state, action) => {
        state.loading = false;
        state.ready = true;
        state.error = action.payload as string;
      });
  },
});

export const { clearEntitlements } = entitlementSlice.actions;
export default entitlementSlice.reducer;
