import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { entitlementApi } from "@/services/apiClient";
import type { EntitlementModule } from "@/types/entitlement";
import { toast } from "../ui/uiSlice";

interface EntitlementState {
  modules: EntitlementModule[];
  loading: boolean;
  error: string | null;
}

const initialState: EntitlementState = {
  modules: [],
  loading: false,
  error: null,
};

export const fetchEntitlements = createAsyncThunk(
  "entitlement/fetchModules",
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const res = await entitlementApi.getModules();
      return res.data ?? res;
    } catch (error: any) {
      dispatch(toast.error("Password reset failed", error?.message));
      return rejectWithValue(error.message);
    }
  },
);

const entitlementSlice = createSlice({
  name: "entitlement",
  initialState,
  reducers: {
    clearEntitlements: (state) => {
      state.modules = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEntitlements.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchEntitlements.fulfilled, (state, action) => {
        state.loading = false;
        state.modules = action.payload || [];
      })
      .addCase(fetchEntitlements.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearEntitlements } = entitlementSlice.actions;
export default entitlementSlice.reducer;
