/**
 * Patient slice — patient registration state.
 *
 *   patientSlice
 *       ├── items / status / error   (patients-specific list state)
 *       ├── fetchPatients() / fetchPatient()
 *       ├── createPatient() / updatePatient() / deletePatient()
 *       └── togglePatientStatus()
 *
 * Uses the centralised patients endpoints:
 *   API_ENDPOINTS.patients.list / .getById(id) / .create / .update(id) / .delete(id)
 */

import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { apiClient } from "@/api/apiClient";
import { API_ENDPOINTS } from "@/api/endpoints";
import { hideLoader, showLoader, toast } from "./uiSlice";
import type { CrudState, Patient, Status, WritePayload } from "@/types";
import type { RootState } from "@/store/types";

/** Raw API record → app shape. */
const map = (raw: any): Patient => raw as Patient;

/* ------------------------------- thunks ---------------------------------- */

export const fetchPatients = createAsyncThunk(
  "patients/fetchAll",
  async (_: void, { dispatch }) => {
    dispatch(showLoader("Loading"));
    try {
      const res = await apiClient<Patient[]>(API_ENDPOINTS.patients.list, {
        method: "GET",
      });
      dispatch(hideLoader());

      const responseData = Array.isArray(res) ? res : (res as any).data;
      const rows = Array.isArray(responseData)
        ? responseData
        : (responseData?.rows ?? []);
      return rows.map(map);
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Could not load patients", error?.message));
      throw error;
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as RootState;
      return state.patients.status !== "loading";
    },
  },
);

export const fetchPatient = createAsyncThunk(
  "patients/getOne",
  async (id: string, { dispatch }) => {
    dispatch(showLoader("Loading patients record"));
    try {
      const res = await apiClient<Patient>(API_ENDPOINTS.patients.getById(id), {
        method: "GET",
      });
      dispatch(hideLoader());
      const responseData: any = (res as any)?.data ?? res;
      return map(responseData?.data ?? responseData?.item ?? responseData);
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Could not load patients record", error?.message));
      throw error;
    }
  },
);

export const createPatient = createAsyncThunk(
  "patients/create",
  async (payload: WritePayload<Patient>, { dispatch }) => {
    dispatch(showLoader("Creating record"));
    try {
      const res = await apiClient<Patient>(API_ENDPOINTS.patients.create, {
        method: "POST",
        body: payload.data,
      });
      dispatch(hideLoader());
      dispatch(toast.success(payload.successMessage ?? "Record created"));
      return map((res as any).data ?? res);
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Creation failed", error?.message));
      throw error;
    }
  },
);

export const updatePatient = createAsyncThunk(
  "patients/update",
  async (payload: WritePayload<Patient> & { id: string }, { dispatch }) => {
    dispatch(showLoader("Saving changes"));
    try {
      const res = await apiClient<Patient>(
        API_ENDPOINTS.patients.update(payload.id),
        { method: "PATCH", body: payload.data },
      );
      dispatch(hideLoader());
      dispatch(toast.success(payload.successMessage ?? "Changes saved"));
      return map((res as any).data ?? res);
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Update failed", error?.message));
      throw error;
    }
  },
);

export const deletePatient = createAsyncThunk(
  "patients/remove",
  async (payload: { id: string; label?: string }, { dispatch }) => {
    dispatch(showLoader("Deleting record"));
    try {
      await apiClient(API_ENDPOINTS.patients.delete(payload.id), {
        method: "DELETE",
      });
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

export const togglePatientStatus = createAsyncThunk(
  "patients/toggleActive",
  async (
    payload: { id: string; status: Status; label?: string },
    { dispatch },
  ) => {
    try {
      const res = await apiClient<Patient>(
        API_ENDPOINTS.patients.update(payload.id),
        { method: "PATCH", body: { status: payload.status } },
      );
      dispatch(
        toast.info(
          payload.status === "active" ? "Marked active" : "Marked inactive",
          payload.label
            ? `${payload.label} is now ${payload.status}.`
            : undefined,
        ),
      );
      return res.data as Patient;
    } catch (error: any) {
      dispatch(toast.error("Status change failed", error?.message));
      throw error;
    }
  },
);

/* -------------------------------- slice ---------------------------------- */

const patientSlice = createSlice({
  name: "patients",
  initialState: {
    items: [],
    status: "idle",
    saving: false,
    error: null,
    lastSync: null,
  } as CrudState<Patient>,
  reducers: {
    patchPatient(s, action: PayloadAction<Partial<Patient> & { id: string }>) {
      const index = s.items.findIndex((i) => i.id === action.payload.id);
      if (index > -1) s.items[index] = { ...s.items[index], ...action.payload };
    },
    upsertPatient(s, action: PayloadAction<Patient>) {
      const index = s.items.findIndex((i) => i.id === action.payload.id);
      if (index > -1) s.items[index] = action.payload;
      else s.items.unshift(action.payload);
    },
    removePatientLocal(s, action: PayloadAction<string>) {
      s.items = s.items.filter((i) => i.id !== action.payload);
    },
    clearPatients(s) {
      s.items = [];
      s.status = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPatients.pending, (s) => {
        s.status = "loading";
        s.error = null;
      })
      .addCase(fetchPatients.fulfilled, (s, action) => {
        s.status = "ready";
        s.items = action.payload as Patient[];
        s.lastSync = new Date().toISOString();
      })
      .addCase(fetchPatients.rejected, (s, action) => {
        s.status = "error";
        s.error = (action.error.message as string) ?? "Request failed";
      })
      .addCase(fetchPatient.fulfilled, (s, action) => {
        const index = s.items.findIndex(
          (i) => i.id === (action.payload as any)?.id,
        );
        if (index > -1)
          s.items[index] = { ...s.items[index], ...(action.payload as any) };
        else s.items.unshift(action.payload as Patient);
      })
      .addCase(createPatient.fulfilled, (s, action) => {
        s.items.unshift(action.payload as Patient);
      })
      .addCase(updatePatient.fulfilled, (s, action) => {
        const index = s.items.findIndex(
          (i) => i.id === (action.payload as any)?.id,
        );
        if (index > -1)
          s.items[index] = { ...s.items[index], ...(action.payload as any) };
        else s.items.unshift(action.payload as Patient);
      })
      .addCase(deletePatient.fulfilled, (s, action) => {
        s.items = s.items.filter((i) => i.id !== action.payload);
      })
      .addCase(togglePatientStatus.fulfilled, (s, action) => {
        const index = s.items.findIndex(
          (i) => i.id === (action.payload as any)?.id,
        );
        if (index > -1)
          s.items[index] = { ...s.items[index], ...(action.payload as any) };
      });
  },
});

export const {
  patchPatient,
  upsertPatient,
  removePatientLocal,
  clearPatients,
} = patientSlice.actions;

export default patientSlice.reducer;
