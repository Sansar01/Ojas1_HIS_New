 import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { request } from "@/services/apiClient";
import { API_ENDPOINTS } from "@/config/api";
import { hideLoader, showLoader, toast } from "@/features/ui/uiSlice";
import type { Consultation } from "@/types";

/* ---------------------------------------------------------------------------
 * Dedicated Consultation slice.
 *
 * Holds the per-patient history tab state (`patientHistory`), fetched through
 * the `getPatientHistorybyId` endpoint. New consultation-related endpoints can
 * be added here as further thunks and keep their state on this same slice, so
 * they are reusable across pages without touching the generic CRUD slice.
 * ------------------------------------------------------------------------ */

/**
 * Fetch all past consultations for a patient via the history endpoint
 * (`/api/opd/consultations/patient/{id}/history`).
 */
export const fetchPatientHistory = createAsyncThunk(
  "consultationsHistory/fetchPatientHistory",
  async (patientId: string | number, { dispatch, rejectWithValue }) => {
    dispatch(showLoader("Loading patient history"));
    try {
      const response: any = await request({
        url: API_ENDPOINTS.consultations.getPatientHistorybyId(patientId),
        method: "GET",
      });
      dispatch(hideLoader());
      const data = response?.data ?? response;
      return (Array.isArray(data) ? data : (data?.rows ?? [])) as any[];
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Could not load patient history", error?.message));
      return rejectWithValue(
        error?.message ?? "Failed to load patient history",
      );
    }
  },
);

/* -------------------------------- slice ----------------------------------- */

const initialState = {
  patientHistory: {
    items: [] as Consultation[],
    status: "idle" as "idle" | "loading" | "ready" | "error",
    error: null as string | null,
  },
};

const consultationSlice = createSlice({
  name: "consultationsHistory",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPatientHistory.pending, (state) => {
        state.patientHistory = {
          items: state.patientHistory.items,
          status: "loading",
          error: null,
        };
      })
      .addCase(fetchPatientHistory.fulfilled, (state, action) => {
        state.patientHistory = {
          items: action.payload ?? [],
          status: "ready",
          error: null,
        };
      })
      .addCase(fetchPatientHistory.rejected, (state, action) => {
        state.patientHistory = {
          items: state.patientHistory.items,
          status: "error",
          error: (action.payload as string) ?? "Failed to load patient history",
        };
      });
  },
});

export default consultationSlice.reducer;
