/**
 * Hospital slice — facility profile (settings / invoice header details).
 *
 *   hospitalSlice
 *       ├── data        (HospitalInfo)
 *       ├── status / error
 *       ├── fetchHospital()
 *       └── saveHospital()
 *
 * Uses the centralised hospital endpoints:
 *   API_ENDPOINTS.hospitals.profile
 */

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { hospitalApi } from "@/api/hospitalApi";
import { hideLoader, showLoader, toast } from "./uiSlice";
import type { RootState } from "@/store/types";
import type { HospitalInfo } from "@/types";

export interface HospitalState {
  data: HospitalInfo | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
}

const hospitalInitialState: HospitalState = {
  data: null,
  status: "idle",
  error: null,
};

/** Load the facility profile. */
export const fetchHospital = createAsyncThunk(
  "hospital/fetch",
  async (_force: boolean | void, { dispatch }) => {
    dispatch(showLoader("Loading facility profile"));
    try {
      const res = await hospitalApi.getProfile();
      dispatch(hideLoader());
      return res.data;
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Facility profile unavailable", error?.message));
      throw error;
    }
  },
  {
    // Duplicate-request protection (doc §13): the facility profile is shared
    // reference data — load once per session, `force` to refresh on demand.
    condition: (force: boolean | void, { getState }) => {
      const state = getState() as RootState;
      if (state.hospital.status === "loading") return false;
      if (force) return true;
      return state.hospital.status === "idle" || state.hospital.status === "error";
    },
  },
);

/** Save the facility profile. */
export const saveHospital = createAsyncThunk(
  "hospital/save",
  async (data: HospitalInfo, { dispatch }) => {
    dispatch(showLoader("Saving facility profile"));
    try {
      const res = await hospitalApi.saveProfile(data);
      dispatch(hideLoader());
      dispatch(
        toast.success(
          "Facility settings saved",
          "Invoices and documents will use the new details.",
        ),
      );
      return res.data;
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Could not save settings", error?.message));
      throw error;
    }
  },
);

const hospitalSlice = createSlice({
  name: "hospital",
  initialState: hospitalInitialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchHospital.pending, (s) => {
        s.status = "loading";
      })
      .addCase(fetchHospital.fulfilled, (s, action) => {
        s.status = "ready";
        s.data = action.payload;
      })
      .addCase(fetchHospital.rejected, (s, action) => {
        s.status = "error";
        s.error = (action.error.message as string) ?? null;
      })
      .addCase(saveHospital.fulfilled, (s, action) => {
        s.data = action.payload;
      });
  },
});

export default hospitalSlice.reducer;
