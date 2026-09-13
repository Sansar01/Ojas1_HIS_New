import { createAsyncThunk } from "@reduxjs/toolkit";
import { createCrudSlice } from "@/features/crud/createCrudSlice";
import { request } from "@/services/apiClient";
import { API_ENDPOINTS } from "@/config/api";
import { hideLoader, showLoader, toast } from "@/features/ui/uiSlice";
import type { HospitalInfo, CreateDoctorPayload, ScheduleDay, Doctor } from "@/types";

/* ---------------------------------------------------------------------------
 * One modular slice per domain feature (Redux Toolkit).
 * ------------------------------------------------------------------------ */

export const usersApi = createCrudSlice<import("@/types").User>({
  name: "users",
  resource: "users",
  listParams: null,
});
export const rolesApi = createCrudSlice<import("@/types").Role>({ name: "roles", resource: "roles" });

export interface RoleMasterCatalogItem {
  id: number;
  name: string;
  code: string;
  isSystem: boolean;
  isActivatedInHospital: boolean;
}

export const fetchRoleMasterCatalog = createAsyncThunk(
  "roles/fetchMasterCatalog",
  async (_, { rejectWithValue }) => {
    try {
      const response: any = await request({
        url: API_ENDPOINTS.roleMasterCatalog,
        method: "GET",
      });
      const data = response?.data ?? response;
      return (Array.isArray(data) ? data : data?.rows ?? []) as RoleMasterCatalogItem[];
    } catch (error: any) {
      return rejectWithValue(error?.message ?? "Could not load role catalog");
    }
  },
);

export const createHospitalRole = createAsyncThunk(
  "roles/createHospitalRole",
  async (
    payload: {
      roleNameId?: number;
      roleName?: string;
      roleCode?: string;
      description: string;
    },
    { dispatch, rejectWithValue },
  ) => {
    dispatch(showLoader("Creating role"));
    try {
      const response = await request({
        url: API_ENDPOINTS.roles,
        method: "POST",
        body: payload,
      });
      dispatch(hideLoader());
      dispatch(toast.success("Role created"));
      return response.data;
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Could not create role", error?.message));
      return rejectWithValue(error?.message ?? "Role creation failed");
    }
  },
);

export const updateRolePermissions = createAsyncThunk(
  "roles/updatePermissions",
  async (
    payload: {
      roleId: string;
      moduleFeatures: Array<{ moduleId: number; featureId: number }>;
      successMessage?: string;
    },
    { dispatch, rejectWithValue },
  ) => {
    dispatch(showLoader("Saving role permissions"));
    try {
      const response = await request({
        url: API_ENDPOINTS.rolePermissions(payload.roleId),
        method: "PUT",
        body: { moduleFeatures: payload.moduleFeatures },
      });
      dispatch(hideLoader());
      dispatch(
        toast.success(payload.successMessage ?? "Role permissions updated"),
      );
      return response.data;
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(
        toast.error("Could not update role permissions", error?.message),
      );
      return rejectWithValue(error?.message ?? "Permission update failed");
    }
  },
);

export interface RolePermissionAssignment {
  id: number;
  hospitalRoleId: number;
  moduleId: number;
  featureId: number;
  moduleFeature?: {
    module?: { code: string };
    feature?: { code: string; name: string };
  };
}

export const fetchRolePermissions = createAsyncThunk(
  "roles/fetchPermissions",
  async (roleId: string, { rejectWithValue }) => {
    try {
      const response: any = await request({
        url: API_ENDPOINTS.rolePermissions(roleId),
        method: "GET",
      });
      const data = response?.data ?? response;
      return (Array.isArray(data) ? data : data?.rows ?? []) as RolePermissionAssignment[];
    } catch (error: any) {
      return rejectWithValue(error?.message ?? "Could not load role permissions");
    }
  },
);
export const patientsApi = createCrudSlice<import("@/types").Patient>({ name: "patients", resource: "patients" });
export const doctorsApi = createCrudSlice<import("@/types").Doctor>({ name: "doctors", resource: "doctors" });
export const departmentsApi = createCrudSlice<import("@/types").Department>({ name: "departments", resource: "departments" });
export const specializationsApi = createCrudSlice<import("@/types").Specialization>({ name: "specializations", resource: "specializations" });
export const appointmentsApi = createCrudSlice<import("@/types").Appointment>({
  name: "appointments",
  resource: "appointment",
  // map the appointment list API shape (nested patient/doctor, appointmentNo,
  // appointmentDate, slotStartTime, BOOKED/… statuses) into the app shape
  normalize: (raw: any) => ({
    ...raw,
    code: raw.appointmentNo ?? raw.code ?? "",
    patientId: raw.patient?.id ?? raw.patientId ?? "",
    doctorId: raw.doctor?.id ?? raw.doctorId ?? "",
    date: raw.appointmentDate ?? raw.date ?? "",
    time: raw.slotStartTime ?? raw.time ?? "",
    endTime: raw.slotEndTime ?? null,
    duration: raw.doctor?.slotDurationMins ?? raw.duration ?? 20,
    type: raw.appointmentType ?? raw.type ?? "Consultation",
    fee: raw.consultationFee ?? raw.fee ?? 0,
    priority: raw.priority === 1 || raw.priority === "Urgent" ? "Urgent" : "Routine",
    status: normalizeStatus(raw.status ?? raw.appointmentStatus),
    rawStatus: raw.status ?? null,
    token: raw.token ?? null,
    checkedInAt: raw.checkedInAt ?? null,
    bookedAt: raw.bookedAt ?? raw.createdAt ?? null,
    cancelledAt: raw.cancelledAt ?? null,
    cancelReason: raw.cancelReason ?? raw.cancelledReason ?? null,
    reasonForVisit: raw.reasonForVisit ?? null,
    referredByDoctorName: raw.referredByDoctorName ?? null,
    referralNote: raw.referralNote ?? null,
    departmentName: raw.departmentName ?? null,
    createdAt: raw.bookedAt ?? raw.createdAt ?? null,
    patient: raw.patient ?? null,
    doctor: raw.doctor ?? null,
  } as any),
});
export const consultationsApi = createCrudSlice<import("@/types").Consultation>({ name: "consultations", resource: "consultations" });

/* ------------------------- appointment status mapping --------------------- */

const STATUS_MAP: Record<string, string> = {
  BOOKED: "Scheduled",
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked In",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
};
const normalizeStatus = (s: any) =>
  STATUS_MAP[String(s ?? "").toUpperCase()] ?? s ?? "Scheduled";

/* ------------------------- doctor slot availability ---------------------- */

export interface DoctorSlotFetchPayload {
  doctorId: string | number;
  date?: string;
}

/**
 * Runtime call: fetch a particular doctor's available slots by doctor id.
 * Runs when the appointment form modal needs slots for a selected doctor —
 * shows the global application loader until the slots are available.
 */
export const fetchDoctorSlots = createAsyncThunk(
  "doctors/fetchSlots",
  async (
    payload: DoctorSlotFetchPayload,
    { dispatch, rejectWithValue },
  ) => {
    dispatch(showLoader("Loading available slots"));
    try {
      const response: any = await request({
        url: API_ENDPOINTS.doctors.getSlotById(payload.doctorId),
        method: "GET",
        params: payload.date ? { date: payload.date } : undefined,
      });
      dispatch(hideLoader());
      return response?.data ?? response;
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Could not load doctor slots", error?.message));
      return rejectWithValue(error?.message ?? "Failed to load slots");
    }
  },
);
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






// Helper to convert UI Schedule to API Schedule
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

// 2. Thunk: Create Profile (API 1)
export const createDoctorProfile = createAsyncThunk(
  "doctors/createProfile",
  async (payload: CreateDoctorPayload, { dispatch, rejectWithValue }) => {
    try {
      const response: any = await request({
        url: API_ENDPOINTS.createDoctor,
        method: "POST",
        body: payload,
      });
      // Return the new doctor data (must contain the generated ID)
      return response.data || response;
    } catch (error: any) {
      return rejectWithValue(error?.message || "Failed to create profile");
    }
  }
);

// 3. Thunk: Set Availability (API 2)
export const setDoctorAvailability = createAsyncThunk(
  "doctors/setAvailability",
  async (
    payload: { doctorId: string; slotDurationMins: number; schedule: ScheduleDay[] },
    { rejectWithValue }
  ) => {
    try {
      const response: any = await request({
        url: API_ENDPOINTS.doctorAvailability(payload.doctorId),
        method: "POST",
        body: {
          slotDurationMins: payload.slotDurationMins,
          schedule: mapScheduleToApi(payload.schedule),
        },
      });
      return response.data || response;
    } catch (error: any) {
      return rejectWithValue(error?.message || "Failed to save schedule");
    }
  }
);

// 4. Master Thunk: ONBOARD DOCTOR (Runs both API 1 and API 2 in sequence)
export const onboardDoctor = createAsyncThunk(
  "doctors/onboard",
  async (
    payload: { profile: CreateDoctorPayload; schedule: ScheduleDay[] },
    { dispatch, rejectWithValue }
  ) => {
    dispatch(showLoader("Setting up doctor profile..."));
    try {
      // Step A: Create Profile
      const profileResult = await dispatch(createDoctorProfile(payload.profile)).unwrap();

      const newDoctorId = profileResult.id;
      if (!newDoctorId) throw new Error("Doctor ID missing from backend response");

      // Step B: Save Schedule
      await dispatch(
        setDoctorAvailability({
          doctorId: newDoctorId,
          slotDurationMins: payload.profile.slotDurationMins,
          schedule: payload.schedule,
        })
      );

      dispatch(hideLoader());
      dispatch(toast.success("Profile Setup Complete!"));

      return { doctorId: newDoctorId, profile: profileResult };
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Setup failed", error?.message || error));
      return rejectWithValue(error);
    }
  }
);

















/* ------------------------- OPD queue token generation ------------------------- */

export interface GenerateOpdTokenPayload {
  appointmentId: string | number;
}

/**
 * Post-Booking Call: Generates an OPD queue token for walk-in appointments.
 * Dispatches standard loaders and notification toasts on success/failure.
 */
export const generateOpdToken = createAsyncThunk(
  "api/opd/generateToken",
  async (
    payload: GenerateOpdTokenPayload,
    { dispatch, rejectWithValue },
  ) => {
    dispatch(showLoader("Generating queue token..."));
    try {
      const response: any = await request({
        url: "/api/opd/queue/generate", // Adjust to "/api/v1/opd/queue/generate" if your client does not auto-prefix /api/v1
        method: "POST",
        body: payload,
      });
      dispatch(hideLoader());
      
      // Extract token details if available in response to show in the toast
      const tokenNumber = response?.data?.tokenNumber ?? response?.tokenNumber ?? "";
      dispatch(
        toast.success(
          "Token Generated Successfully",
          tokenNumber ? `Queue Token: ${tokenNumber}` : undefined
        )
      );
      return response?.data ?? response;
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Could not generate queue token", error?.message));
      return rejectWithValue(error?.message ?? "Failed to generate token");
    }
  },
);




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
