import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { entitlementApi } from "@/services/apiClient";
import type { EntitlementModule } from "@/types/entitlement";
import { toast } from "../ui/uiSlice";

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
    try {
      const res = await entitlementApi.getModules();
      const response: any = res;
      const data = response?.data ?? response;
      const modules = Array.isArray(data)
        ? data
        : Array.isArray(data?.modules)
          ? data.modules
          : data?.id && data?.features
            ? [data]
            : [];
      return modules as EntitlementModule[];
    } catch (error: any) {
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
