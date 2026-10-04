/**
 * Consultation slice — OPD consultations.
 *
 *   consultationSlice
 *       ├── items / status / error   (consultations-specific list state)
 *       ├── fetchConsultations() / fetchConsultation()
 *       ├── createConsultation() / updateConsultation() / deleteConsultation()
 *       └── toggleConsultationStatus()
 *
 * Uses the centralised consultations endpoints:
 *   API_ENDPOINTS.consultations.list / .getById(id) / .create / .update(id) / .delete(id)
 */

import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { consultationApi } from "@/api/consultationApi";
import { hideLoader, showLoader, toast } from "./uiSlice";
import type { CrudState, Consultation, Status, WritePayload } from "@/types";
import type { RootState } from "@/store/types";

/** Raw API record → app shape. */
const map = (raw: any): Consultation => raw as Consultation;

/* ------------------------------- thunks ---------------------------------- */

export const fetchConsultations = createAsyncThunk(
  "consultations/fetchAll",
  async (_force: boolean | void, { dispatch }) => {
    dispatch(showLoader("Loading"));
    try {
      const res = await consultationApi.list();
      if (!res.ok) throw new Error(res.error ?? "Could not load consultations");
      dispatch(hideLoader());

      const responseData: any = res.data;
      const rows = Array.isArray(responseData)
        ? responseData
        : (responseData?.rows ?? []);
      return rows.map(map);
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Could not load consultations", error?.message));
      throw error;
    }
  },
  {
        condition: (force: boolean | void, { getState }) => {
      const state = getState() as RootState;
      if (state.consultations.status === "loading") return false;   // in flight
      if (force) return true;                                 // manual refresh
      // shared list: idle -> fetch, ready -> reuse (§13)
      return state.consultations.status === "idle" || state.consultations.status === "error";
    },
  },
);

export const fetchConsultation = createAsyncThunk(
  "consultations/getOne",
  async (id: string, { dispatch }) => {
    dispatch(showLoader("Loading consultations record"));
    try {
      const res = await consultationApi.getById(id);
      if (!res.ok) throw new Error(res.error ?? "Could not load consultation");
      dispatch(hideLoader());
      const responseData: any = res.data;
      return map(responseData?.data ?? responseData?.item ?? responseData);
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Could not load consultations record", error?.message));
      throw error;
    }
  },
);

export const createConsultation = createAsyncThunk(
  "consultations/create",
  async (payload: WritePayload<Consultation>, { dispatch }) => {
    dispatch(showLoader("Creating record"));
    try {
      const res = await consultationApi.create(payload.data as any);
      if (!res.ok) throw new Error(res.error ?? "Creation failed");
      dispatch(hideLoader());
      dispatch(toast.success(payload.successMessage ?? "Record created"));
      return map(res.data);
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Creation failed", error?.message));
      throw error;
    }
  },
);

export const updateConsultation = createAsyncThunk(
  "consultations/update",
  async (
    payload: WritePayload<Consultation> & { id: string },
    { dispatch },
  ) => {
    dispatch(showLoader("Saving changes"));
    try {
      const res = await consultationApi.updateNote(payload.id, payload.data);
      if (!res.ok) throw new Error(res.error ?? "Update failed");
      dispatch(hideLoader());
      dispatch(toast.success(payload.successMessage ?? "Changes saved"));
      return map(res.data);
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Update failed", error?.message));
      throw error;
    }
  },
);

export const deleteConsultation = createAsyncThunk(
  "consultations/remove",
  async (
    payload: { id: string; label?: string },
    { dispatch },
  ) => {
    dispatch(showLoader("Deleting record"));
    try {
      const removed = await consultationApi.remove(payload.id);
      if (!removed.ok) throw new Error(removed.error ?? "Delete failed");
      dispatch(hideLoader());
      dispatch(
        toast.success(
          "Record deleted",
          payload.label
            ? `${payload.label} was removed from the portal.`
            : undefined,
        ),
      );
      return payload.id;
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Delete failed", error?.message));
      throw error;
    }
  },
);

export const toggleConsultationStatus = createAsyncThunk(
  "consultations/toggleActive",
  async (
    payload: { id: string; status: Status; label?: string },
    { dispatch },
  ) => {
    try {
      const res = await consultationApi.updateNote(payload.id, {
        status: payload.status,
      });
      if (!res.ok) throw new Error(res.error ?? "Status change failed");
      dispatch(
        toast.info(
          payload.status === "active" ? "Marked active" : "Marked inactive",
          payload.label
            ? `${payload.label} is now ${payload.status}.`
            : undefined,
        ),
      );
      return res.data as Consultation;
    } catch (error: any) {
      dispatch(toast.error("Status change failed", error?.message));
      throw error;
    }
  },
);

/* -------------------------------- slice ---------------------------------- */

const consultationSlice = createSlice({
  name: "consultations",
  initialState: {
    items: [],
    status: "idle",
    saving: false,
    error: null,
    lastSync: null,
  } as CrudState<Consultation>,
  reducers: {
    patchConsultation(s, action: PayloadAction<Partial<Consultation> & { id: string }>) {
      const index = s.items.findIndex((i) => i.id === action.payload.id);
      if (index > -1) s.items[index] = { ...s.items[index], ...action.payload };
    },
    upsertConsultation(s, action: PayloadAction<Consultation>) {
      const index = s.items.findIndex((i) => i.id === action.payload.id);
      if (index > -1) s.items[index] = action.payload;
      else s.items.unshift(action.payload);
    },
    removeConsultationLocal(s, action: PayloadAction<string>) {
      s.items = s.items.filter((i) => i.id !== action.payload);
    },
    clearConsultations(s) {
      s.items = [];
      s.status = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConsultations.pending, (s) => {
        s.status = "loading";
        s.error = null;
      })
      .addCase(fetchConsultations.fulfilled, (s, action) => {
        s.status = "ready";
        s.items = action.payload as Consultation[];
        s.lastSync = new Date().toISOString();
      })
      .addCase(fetchConsultations.rejected, (s, action) => {
        s.status = "error";
        s.error = (action.error.message as string) ?? "Request failed";
      })
      .addCase(fetchConsultation.fulfilled, (s, action) => {
        const index = s.items.findIndex((i) => i.id === (action.payload as any)?.id);
        if (index > -1)
          s.items[index] = { ...s.items[index], ...(action.payload as any) };
        else s.items.unshift(action.payload as Consultation);
      })
      .addCase(createConsultation.fulfilled, (s, action) => {
        s.items.unshift(action.payload as Consultation);
      })
      .addCase(updateConsultation.fulfilled, (s, action) => {
        const index = s.items.findIndex((i) => i.id === (action.payload as any)?.id);
        if (index > -1)
          s.items[index] = { ...s.items[index], ...(action.payload as any) };
        else s.items.unshift(action.payload as Consultation);
      })
      .addCase(deleteConsultation.fulfilled, (s, action) => {
        s.items = s.items.filter((i) => i.id !== action.payload);
      })
      .addCase(toggleConsultationStatus.fulfilled, (s, action) => {
        const index = s.items.findIndex((i) => i.id === (action.payload as any)?.id);
        if (index > -1)
          s.items[index] = { ...s.items[index], ...(action.payload as any) };
      });
  },
});

export const {
  patchConsultation,
  upsertConsultation,
  removeConsultationLocal,
  clearConsultations,
} = consultationSlice.actions;

export default consultationSlice.reducer;

/* ------------------------ per-patient consultation history ---------------- */

/**
 * Fetch all past consultations of one patient via the history endpoint
 * (`/api/opd/consultations/patient/{id}/history`).
 */
export const fetchPatientHistory = createAsyncThunk(
  "consultationsHistory/fetchPatientHistory",
  async (patientId: string | number, { dispatch, rejectWithValue }) => {
    dispatch(showLoader("Loading patient history"));
    try {
      const response: any = await consultationApi.patientHistory(patientId);
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

const consultationHistoryInitialState = {
  patientHistory: {
    items: [] as Consultation[],
    status: "idle" as "idle" | "loading" | "ready" | "error",
    error: null as string | null,
  },
};

const consultationHistorySlice = createSlice({
  name: "consultationsHistory",
  initialState: consultationHistoryInitialState,
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

export const consultationHistoryReducer = consultationHistorySlice.reducer;
