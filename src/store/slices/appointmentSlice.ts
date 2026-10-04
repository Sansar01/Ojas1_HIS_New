/**
 * Appointment slice — OPD appointment bookings.
 *
 *   appointmentSlice
 *       ├── items / status / error   (appointments-specific list state)
 *       ├── fetchAppointments() / fetchAppointment()
 *       ├── createAppointment() / updateAppointment() / deleteAppointment()
 *       └── toggleAppointmentStatus()
 *
 * Uses the centralised appointments endpoints:
 *   API_ENDPOINTS.appointments.list / .getById(id) / .create / .update(id) / .delete(id)
 */

import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { appointmentApi } from "@/api/appointmentApi";
import { consultationApi } from "@/api/consultationApi";
import { hideLoader, showLoader, toast } from "./uiSlice";
import type { CrudState, Appointment, Status, WritePayload } from "@/types";
import type { RootState } from "@/store/types";

/* --------------------------- API → app mapping ---------------------------- */

/** appointment status coming from the API → UI status label */
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

/**
 * Map the appointment list API shape (nested patient/doctor, appointmentNo,
 * appointmentDate, slotStartTime, BOOKED/… statuses) into the app shape.
 */
const map = (raw: any): Appointment =>
  ({
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
    priority:
      raw.priority === 1 || raw.priority === "Urgent" ? "Urgent" : "Routine",
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
  }) as any;

/* ------------------------------- thunks ---------------------------------- */

export const fetchAppointments = createAsyncThunk(
  "appointments/fetchAll",
  async (_force: boolean | void, { dispatch }) => {
    dispatch(showLoader("Loading"));
    try {
      const res = await appointmentApi.getAll();
      dispatch(hideLoader());

      const responseData = Array.isArray(res) ? res : (res as any).data;
      const rows = Array.isArray(responseData)
        ? responseData
        : (responseData?.rows ?? []);
      return rows.map(map);
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Could not load appointments", error?.message));
      throw error;
    }
  },
  {
        condition: (force: boolean | void, { getState }) => {
      const state = getState() as RootState;
      if (state.appointments.status === "loading") return false;   // in flight
      if (force) return true;                                 // manual refresh
      // shared list: idle -> fetch, ready -> reuse (§13)
      return state.appointments.status === "idle" || state.appointments.status === "error";
    },
  },
);

export const fetchAppointment = createAsyncThunk(
  "appointments/getOne",
  async (id: string, { dispatch }) => {
    dispatch(showLoader("Loading appointments record"));
    try {
      const res = await appointmentApi.getById(id);
      dispatch(hideLoader());
      const responseData: any = (res as any)?.data ?? res;
      return map(responseData?.data ?? responseData?.item ?? responseData);
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(
        toast.error("Could not load appointments record", error?.message),
      );
      throw error;
    }
  },
);

export const createAppointment = createAsyncThunk(
  "appointments/create",
  async (payload: WritePayload<Appointment>, { dispatch }) => {
    dispatch(showLoader("Creating record"));
    try {
      const res = await appointmentApi.create(payload.data);
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

export const updateAppointment = createAsyncThunk(
  "appointments/update",
  async (payload: WritePayload<Appointment> & { id: string }, { dispatch }) => {
    dispatch(showLoader("Saving changes"));
    try {
      const res = await appointmentApi.update(payload.id, payload.data);
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

export const deleteAppointment = createAsyncThunk(
  "appointments/remove",
  async (payload: { id: string; label?: string }, { dispatch }) => {
    dispatch(showLoader("Deleting record"));
    try {
      await appointmentApi.remove(payload.id);
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

export const toggleAppointmentStatus = createAsyncThunk(
  "appointments/toggleActive",
  async (
    payload: { id: string; status: Status; label?: string },
    { dispatch },
  ) => {
    try {
      const res = await appointmentApi.update(payload.id, { status: payload.status });
      dispatch(
        toast.info(
          payload.status === "active" ? "Marked active" : "Marked inactive",
          payload.label
            ? `${payload.label} is now ${payload.status}.`
            : undefined,
        ),
      );
      return res.data as Appointment;
    } catch (error: any) {
      dispatch(toast.error("Status change failed", error?.message));
      throw error;
    }
  },
);

/* -------------------------------- slice ---------------------------------- */

const appointmentSlice = createSlice({
  name: "appointments",
  initialState: {
    items: [],
    status: "idle",
    saving: false,
    error: null,
    lastSync: null,
  } as CrudState<Appointment>,
  reducers: {
    patchAppointment(
      s,
      action: PayloadAction<Partial<Appointment> & { id: string }>,
    ) {
      const index = s.items.findIndex((i) => i.id === action.payload.id);
      if (index > -1) s.items[index] = { ...s.items[index], ...action.payload };
    },
    upsertAppointment(s, action: PayloadAction<Appointment>) {
      const index = s.items.findIndex((i) => i.id === action.payload.id);
      if (index > -1) s.items[index] = action.payload;
      else s.items.unshift(action.payload);
    },
    removeAppointmentLocal(s, action: PayloadAction<string>) {
      s.items = s.items.filter((i) => i.id !== action.payload);
    },
    clearAppointments(s) {
      s.items = [];
      s.status = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAppointments.pending, (s) => {
        s.status = "loading";
        s.error = null;
      })
      .addCase(fetchAppointments.fulfilled, (s, action) => {
        s.status = "ready";
        s.items = action.payload as Appointment[];
        s.lastSync = new Date().toISOString();
      })
      .addCase(fetchAppointments.rejected, (s, action) => {
        s.status = "error";
        s.error = (action.error.message as string) ?? "Request failed";
      })
      .addCase(fetchAppointment.fulfilled, (s, action) => {
        const index = s.items.findIndex(
          (i) => i.id === (action.payload as any)?.id,
        );
        if (index > -1)
          s.items[index] = { ...s.items[index], ...(action.payload as any) };
        else s.items.unshift(action.payload as Appointment);
      })
      .addCase(createAppointment.fulfilled, (s, action) => {
        s.items.unshift(action.payload as Appointment);
      })
      .addCase(updateAppointment.fulfilled, (s, action) => {
        const index = s.items.findIndex(
          (i) => i.id === (action.payload as any)?.id,
        );
        if (index > -1)
          s.items[index] = { ...s.items[index], ...(action.payload as any) };
        else s.items.unshift(action.payload as Appointment);
      })
      .addCase(deleteAppointment.fulfilled, (s, action) => {
        s.items = s.items.filter((i) => i.id !== action.payload);
      })
      .addCase(toggleAppointmentStatus.fulfilled, (s, action) => {
        const index = s.items.findIndex(
          (i) => i.id === (action.payload as any)?.id,
        );
        if (index > -1)
          s.items[index] = { ...s.items[index], ...(action.payload as any) };
      });
  },
});

export const {
  patchAppointment,
  upsertAppointment,
  removeAppointmentLocal,
  clearAppointments,
} = appointmentSlice.actions;

export default appointmentSlice.reducer;

/* -------------------- visit types / cancellation / OPD token -------------- */

/**
 * Fetch the global CONSULTATION_TYPE dropdown — the options for the
 * "Visit type" field on the appointment form (create + edit modal).
 */
export const fetchConsultationTypes = createAsyncThunk(
  "appointments/fetchConsultationTypes",
  async (_: void, { dispatch, rejectWithValue }) => {
    dispatch(showLoader("Loading visit types"));
    try {
      const response: any = await appointmentApi.getVisitTypes();
      dispatch(hideLoader());
      return response?.data ?? response;
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Could not load visit types", error?.message));
      return rejectWithValue(error?.message ?? "Failed to load visit types");
    }
  },
);

/**
 * Cancel one appointment. Toast-free — the appointments screen owns its
 * messaging and refreshes the list afterwards.
 */
export const cancelAppointment = createAsyncThunk(
  "appointments/cancel",
  async (payload: { id: string; cancelReason: string }) => {
    // throws on failure so the caller surfaces the backend message
    const response: any = await appointmentApi.cancel(payload);
    return response?.data ?? response;
  },
);

export interface GenerateOpdTokenPayload {
  appointmentId: string | number;
}

/**
 * Post-booking call — generate an OPD queue token for a walk-in appointment.
 * Dispatches the standard loader and notification toasts on success/failure.
 */
export const generateOpdToken = createAsyncThunk(
  "appointments/generateToken",
  async (payload: GenerateOpdTokenPayload, { dispatch, rejectWithValue }) => {
    dispatch(showLoader("Generating queue token..."));
    try {
      const response: any = await consultationApi.generateToken(payload);
      dispatch(hideLoader());

      // Extract token details if available in response to show in the toast
      const tokenNumber =
        response?.data?.tokenNumber ?? response?.tokenNumber ?? "";
      dispatch(
        toast.success(
          "Token Generated Successfully",
          tokenNumber ? `Queue Token: ${tokenNumber}` : undefined,
        ),
      );
      return response?.data ?? response;
    } catch (error: any) {
      dispatch(hideLoader());
      dispatch(toast.error("Could not generate queue token", error?.message));
      return rejectWithValue(error?.message ?? "Failed to generate token");
    }
  },
);
