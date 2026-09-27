// src/features/entitlement/entitlementSlice.ts
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { entitlementApi } from "@/services/apiClient";
import type { EntitlementModule } from "@/types/entitlement";
import { hideLoader, showLoader, toast } from "../ui/uiSlice";

interface EntitlementState {
  modules: EntitlementModule[];
  status: "idle" | "loading" | "succeeded" | "failed"; // 👈 Clean State Machine
  error: string | null;
}

const initialState: EntitlementState = {
  modules: [],
  status: "idle",
  error: null,
};

export const fetchEntitlements = createAsyncThunk(
  "entitlement/fetchModules",
  async (_, { dispatch, rejectWithValue }) => {
    dispatch(showLoader("Loading modules"));
    try {
      const res = await entitlementApi.getModules();
      const response: any = res;

      if (response?.cancelled) {
        dispatch(hideLoader());
        return [];
      }

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
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEntitlements.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchEntitlements.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.modules = action.payload || [];
      })
      .addCase(fetchEntitlements.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload as string;
      });
  },
});

export const { clearEntitlements } = entitlementSlice.actions;
export default entitlementSlice.reducer;