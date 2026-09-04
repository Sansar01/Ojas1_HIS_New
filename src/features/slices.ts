import { createAsyncThunk } from "@reduxjs/toolkit";
import { createCrudSlice } from "@/features/crud/createCrudSlice";
import { request } from "@/services/apiClient";
import { hideLoader, showLoader, toast } from "@/features/ui/uiSlice";
import type { HospitalInfo } from "@/types";

/* ---------------------------------------------------------------------------
 * One modular slice per domain feature (Redux Toolkit).
 * ------------------------------------------------------------------------ */

export const usersApi = createCrudSlice<import("@/types").User>({
  name: "users",
  resource: "users",
  listParams: null,
});
export const rolesApi = createCrudSlice<import("@/types").Role>({ name: "roles", resource: "roles" });
export const patientsApi = createCrudSlice<import("@/types").Patient>({ name: "patients", resource: "patients" });
export const doctorsApi = createCrudSlice<import("@/types").Doctor>({ name: "doctors", resource: "doctors" });
export const departmentsApi = createCrudSlice<import("@/types").Department>({ name: "departments", resource: "departments" });
export const specializationsApi = createCrudSlice<import("@/types").Specialization>({ name: "specializations", resource: "specializations" });
export const appointmentsApi = createCrudSlice<import("@/types").Appointment>({ name: "appointments", resource: "appointments" });
export const consultationsApi = createCrudSlice<import("@/types").Consultation>({ name: "consultations", resource: "consultations" });
export const invoicesApi = createCrudSlice<import("@/types").Invoice>({ name: "invoices", resource: "invoices" });
export const activitiesApi = createCrudSlice<import("@/types").ActivityLog>({ name: "activities", resource: "activities" });

/* --------------------------- hospital information ------------------------- */

export interface HospitalState {
  data: HospitalInfo | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
}

const hospitalInitialState: HospitalState = { data: null, status: "idle", error: null };

export const fetchHospital = createAsyncThunk("hospital/fetch", async (_, { dispatch }) => {
  dispatch(showLoader("Loading facility profile"));
  try {
    const res = await request<HospitalInfo>({ url: "/hospital", method: "GET" });
    dispatch(hideLoader());
    return res.data;
  } catch (error: any) {
    dispatch(hideLoader());
    dispatch(toast.error("Facility profile unavailable", error?.message));
    throw error;
  }
});

export const saveHospital = createAsyncThunk("hospital/save", async (data: HospitalInfo, { dispatch }) => {
  dispatch(showLoader("Saving facility profile"));
  try {
    const res = await request<HospitalInfo>({ url: "/hospital", method: "PUT", body: data });
    dispatch(hideLoader());
    dispatch(toast.success("Facility settings saved", "Invoices and documents will use the new details."));
    return res.data;
  } catch (error: any) {
    dispatch(hideLoader());
    dispatch(toast.error("Could not save settings", error?.message));
    throw error;
  }
});

import { createSlice } from "@reduxjs/toolkit";

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

export const hospitalReducer = hospitalSlice.reducer;

/** All slice bundles, used by the store and by a bootstrap helper. */
export const ALL_APIS = {
  users: usersApi,
  roles: rolesApi,
  patients: patientsApi,
  doctors: doctorsApi,
  departments: departmentsApi,
  specializations: specializationsApi,
  appointments: appointmentsApi,
  consultations: consultationsApi,
  invoices: invoicesApi,
  activities: activitiesApi,
} as const;

export type ApiKey = keyof typeof ALL_APIS;
