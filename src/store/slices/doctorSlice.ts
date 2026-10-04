/**
 * Doctor slice — doctor roster + onboarding state.
 *
 *   doctorSlice
 *       ├── items / status / error   (doctors-specific list state)
 *       ├── fetchDoctors() / fetchDoctor()
 *       ├── createDoctor() / updateDoctor() / deleteDoctor()
 *       └── toggleDoctorStatus()
 *
 * Uses the centralised doctors endpoints:
 *   API_ENDPOINTS.doctors.list / .getById(id) / .create / .update(id) / .delete(id)
 */

import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { doctorApi } from "@/api/doctorApi";
import { hideLoader, showLoader, toast } from "./uiSlice";
import type {
  CreateDoctorPayload,
  CrudState,
  Doctor,
  ScheduleDay,
  Status,
  WritePayload,
} from "@/types";
import type { RootState } from "@/store/types";

/** Raw API record → app shape. */
const map = (raw: any): Doctor => raw as Doctor;

/* ------------------------------- thunks ---------------------------------- */

export const fetchDoctors = createAsyncThunk(
  "doctors/fetchAll",
  async (_force: boolean | void, { dispatch }) => {
    dispatch(showLoader("Loading"));
    try {
      const res = await doctorApi.getAll();
      dispatch(hideLoader());

      const responseData = Array.isArray(res) ? res : (res as any).data;
      const rows = Array.isArray(responseData)
        ? responseData
        : (responseData?.rows ?? []);
      return rows.map(map);
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Could not load doctors", error?.message));
      throw error;
    }
  },
  {
    condition: (force: boolean | void, { getState }) => {
      const state = getState() as RootState;
      if (state.doctors.status === "loading") return false;
      if (force) return true;
      return (
        state.doctors.status === "idle" || state.doctors.status === "error"
      );
    },
  },
);

export const fetchDoctor = createAsyncThunk(
  "doctors/getOne",
  async (id: string, { dispatch }) => {
    dispatch(showLoader("Loading doctors record"));
    try {
      const res = await doctorApi.getById(id);
      dispatch(hideLoader());
      const responseData: any = (res as any)?.data ?? res;
      return map(responseData?.data ?? responseData?.item ?? responseData);
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Could not load doctors record", error?.message));
      throw error;
    }
  },
);

export const createDoctor = createAsyncThunk(
  "doctors/create",
  async (payload: WritePayload<Doctor>, { dispatch }) => {
    dispatch(showLoader("Creating record"));
    try {
      const res = await doctorApi.create(payload.data);
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

export const updateDoctor = createAsyncThunk(
  "doctors/update",
  async (payload: WritePayload<Doctor> & { id: string }, { dispatch }) => {
    dispatch(showLoader("Saving changes"));
    try {
      const res = await doctorApi.update(payload.id, payload.data);
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

export const deleteDoctor = createAsyncThunk(
  "doctors/remove",
  async (payload: { id: string; label?: string }, { dispatch }) => {
    dispatch(showLoader("Deleting record"));
    try {
      await doctorApi.remove(payload.id);
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

export const toggleDoctorStatus = createAsyncThunk(
  "doctors/toggleActive",
  async (
    payload: { id: string; status: Status; label?: string },
    { dispatch },
  ) => {
    try {
      const res = await doctorApi.update(payload.id, { status: payload.status });
      dispatch(
        toast.info(
          payload.status === "active" ? "Marked active" : "Marked inactive",
          payload.label
            ? `${payload.label} is now ${payload.status}.`
            : undefined,
        ),
      );
      return res.data as Doctor;
    } catch (error: any) {
      dispatch(toast.error("Status change failed", error?.message));
      throw error;
    }
  },
);

/* -------------------------------- slice ---------------------------------- */

const doctorSlice = createSlice({
  name: "doctors",
  initialState: {
    items: [],
    status: "idle",
    saving: false,
    error: null,
    lastSync: null,
  } as CrudState<Doctor>,
  reducers: {
    patchDoctor(s, action: PayloadAction<Partial<Doctor> & { id: string }>) {
      const index = s.items.findIndex((i) => i.id === action.payload.id);
      if (index > -1) s.items[index] = { ...s.items[index], ...action.payload };
    },
    upsertDoctor(s, action: PayloadAction<Doctor>) {
      const index = s.items.findIndex((i) => i.id === action.payload.id);
      if (index > -1) s.items[index] = action.payload;
      else s.items.unshift(action.payload);
    },
    removeDoctorLocal(s, action: PayloadAction<string>) {
      s.items = s.items.filter((i) => i.id !== action.payload);
    },
    clearDoctors(s) {
      s.items = [];
      s.status = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDoctors.pending, (s) => {
        s.status = "loading";
        s.error = null;
      })
      .addCase(fetchDoctors.fulfilled, (s, action) => {
        s.status = "ready";
        s.items = action.payload as Doctor[];
        s.lastSync = new Date().toISOString();
      })
      .addCase(fetchDoctors.rejected, (s, action) => {
        s.status = "error";
        s.error = (action.error.message as string) ?? "Request failed";
      })
      .addCase(fetchDoctor.fulfilled, (s, action) => {
        const index = s.items.findIndex(
          (i) => i.id === (action.payload as any)?.id,
        );
        if (index > -1)
          s.items[index] = { ...s.items[index], ...(action.payload as any) };
        else s.items.unshift(action.payload as Doctor);
      })
      .addCase(createDoctor.fulfilled, (s, action) => {
        s.items.unshift(action.payload as Doctor);
      })
      .addCase(updateDoctor.fulfilled, (s, action) => {
        const index = s.items.findIndex(
          (i) => i.id === (action.payload as any)?.id,
        );
        if (index > -1)
          s.items[index] = { ...s.items[index], ...(action.payload as any) };
        else s.items.unshift(action.payload as Doctor);
      })
      .addCase(deleteDoctor.fulfilled, (s, action) => {
        s.items = s.items.filter((i) => i.id !== action.payload);
      })
      .addCase(toggleDoctorStatus.fulfilled, (s, action) => {
        const index = s.items.findIndex(
          (i) => i.id === (action.payload as any)?.id,
        );
        if (index > -1)
          s.items[index] = { ...s.items[index], ...(action.payload as any) };
      });
  },
});

export const { patchDoctor, upsertDoctor, removeDoctorLocal, clearDoctors } =
  doctorSlice.actions;

export default doctorSlice.reducer;

/* ------------------- doctor onboarding & slot availability ---------------- */

/** Convert the UI weekly schedule to the API availability payload. */
export const mapScheduleToApi = (schedule: ScheduleDay[]) => {
  return schedule.map((s) => ({
    dayOfWeek: s.day,
    isActive: s.enabled,
    ...(s.enabled && {
      startTime: s.start,
      endTime: s.end,
      breakStartTime: s.breakStartTime,
      breakEndTime: s.breakEndTime,
    }),
  }));
};

export interface DoctorSlotFetchPayload {
  doctorId: string | number;
  date?: string;
}

/** Step 1 of onboarding — create the doctor profile. */
export const createDoctorProfile = createAsyncThunk(
  "doctors/createProfile",
  async (payload: CreateDoctorPayload, { rejectWithValue }) => {
    try {
      const response: any = await doctorApi.create(payload);
      // Return the new doctor data (must contain the generated ID)
      return response.data || response;
    } catch (error: any) {
      return rejectWithValue(error?.message || "Failed to create profile");
    }
  },
);

/** Step 2 of onboarding — save the weekly availability/schedule. */
export const setDoctorAvailability = createAsyncThunk(
  "doctors/setAvailability",
  async (
    payload: {
      doctorId: string;
      slotDurationMins: number;
      schedule: ScheduleDay[];
    },
    { rejectWithValue },
  ) => {
    try {
      const response: any = await doctorApi.saveAvailability(payload.doctorId, {
        slotDurationMins: payload.slotDurationMins,
        schedule: mapScheduleToApi(payload.schedule),
      });
      return response.data || response;
    } catch (error: any) {
      return rejectWithValue(error?.message || "Failed to save schedule");
    }
  },
);

/** Master onboarding thunk — runs profile creation and schedule save in order. */
export const onboardDoctor = createAsyncThunk(
  "doctors/onboard",
  async (
    payload: { profile: CreateDoctorPayload; schedule: ScheduleDay[] },
    { dispatch, rejectWithValue },
  ) => {
    dispatch(showLoader("Setting up doctor profile..."));
    try {
      // Step A: Create Profile
      const profileResult = await dispatch(
        createDoctorProfile(payload.profile),
      ).unwrap();

      const newDoctorId = profileResult.id;
      if (!newDoctorId)
        throw new Error("Doctor ID missing from backend response");

      // Step B: Save Schedule
      await dispatch(
        setDoctorAvailability({
          doctorId: newDoctorId,
          slotDurationMins: payload.profile.slotDurationMins,
          schedule: payload.schedule,
        }),
      );

      dispatch(hideLoader());
      dispatch(toast.success("Profile Setup Complete!"));

      return { doctorId: newDoctorId, profile: profileResult };
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Setup failed", error?.message || error));
      return rejectWithValue(error);
    }
  },
);

/**
 * Fetch a doctor's available slots by id (appointment form needs the slots
 * for the selected doctor) — shows the global loader until they arrive.
 */
export const fetchDoctorSlots = createAsyncThunk(
  "doctors/fetchSlots",
  async (payload: DoctorSlotFetchPayload, { dispatch, rejectWithValue }) => {
    dispatch(showLoader("Loading available slots"));
    try {
      const response: any = await doctorApi.getAvailability(
        payload.doctorId,
        payload.date ? { date: payload.date } : undefined,
      );
      dispatch(hideLoader());
      return response?.data ?? response;
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Could not load doctor slots", error?.message));
      return rejectWithValue(error?.message ?? "Failed to load slots");
    }
  },
);
