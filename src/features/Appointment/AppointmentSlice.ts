import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { appointmentApi } from "@/services/apiClient";
import { hideLoader, showLoader, toast } from "@/features/ui/uiSlice";
import type { Appointment } from "@/types";

/* ---------------------------------------------------------------------------
 * Appointment Slice with Error Handling & Toast Messages
 * ------------------------------------------------------------------------- */

interface AppointmentState {
  items: Appointment[];
  loading: boolean;
  error: string | null;
  selectedAppointment: Appointment | null;
}

const initialState: AppointmentState = {
  items: [],
  loading: false,
  error: null,
  selectedAppointment: null,
};

// ==================== FETCH ALL APPOINTMENTS ====================
export const fetchAppointments = createAsyncThunk(
  "appointments/fetchAll",
  async (payload: { params?: any } = {}, { dispatch, rejectWithValue }) => {
    dispatch(showLoader("Loading appointments"));
    try {
      const response: any = await appointmentApi.list(payload?.params);
      dispatch(hideLoader());
      const data = Array.isArray(response)
        ? response
        : (response.data?.rows ?? []);
      return data as Appointment[];
    } catch (error: any) {
      dispatch(hideLoader());
      const errorMessage = error?.message || "Failed to load appointments";
      dispatch(toast.error("Error", errorMessage));
      return rejectWithValue(errorMessage);
    }
  },
);

// ==================== CREATE APPOINTMENT ====================
export const createAppointment = createAsyncThunk(
  "appointments/create",
  async (data: any, { dispatch, rejectWithValue }) => {
    dispatch(showLoader("Creating appointment"));
    try {
      const response: any = await appointmentApi.create(data);
      dispatch(hideLoader());
      dispatch(toast.success("Success", "Appointment created successfully"));
      return response.data as Appointment;
    } catch (error: any) {
      dispatch(hideLoader());
      const errorMessage = error?.message || "Failed to create appointment";
      dispatch(toast.error("Error", errorMessage));
      return rejectWithValue(errorMessage);
    }
  },
);

// ==================== UPDATE APPOINTMENT ====================
export const updateAppointment = createAsyncThunk(
  "appointments/update",
  async (payload: { id: string; data: any }, { dispatch, rejectWithValue }) => {
    dispatch(showLoader("Updating appointment"));
    try {
      // You can add update API here if needed
      dispatch(hideLoader());
      dispatch(toast.success("Success", "Appointment updated successfully"));
      return payload.data;
    } catch (error: any) {
      dispatch(hideLoader());
      const errorMessage = error?.message || "Failed to update appointment";
      dispatch(toast.error("Error", errorMessage));
      return rejectWithValue(errorMessage);
    }
  },
);

// ==================== DELETE APPOINTMENT ====================
export const deleteAppointment = createAsyncThunk(
  "appointments/delete",
  async (id: string, { dispatch, rejectWithValue }) => {
    dispatch(showLoader("Deleting appointment"));
    try {
      // You can add delete API here if needed
      dispatch(hideLoader());
      dispatch(toast.success("Success", "Appointment deleted successfully"));
      return id;
    } catch (error: any) {
      dispatch(hideLoader());
      const errorMessage = error?.message || "Failed to delete appointment";
      dispatch(toast.error("Error", errorMessage));
      return rejectWithValue(errorMessage);
    }
  },
);

// ==================== SLICE ====================
const appointmentSlice = createSlice({
  name: "appointments",
  initialState,
  reducers: {
    clearAppointments: (state) => {
      state.items = [];
      state.error = null;
    },
    setSelectedAppointment: (state, action) => {
      state.selectedAppointment = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // FETCH ALL
      .addCase(fetchAppointments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAppointments.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchAppointments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // CREATE
      .addCase(createAppointment.pending, (state) => {
        state.loading = true;
      })
      .addCase(createAppointment.fulfilled, (state, action) => {
        state.loading = false;
        state.items.unshift(action.payload);
      })
      .addCase(createAppointment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // UPDATE
      .addCase(updateAppointment.fulfilled, (state, action) => {
        const index = state.items.findIndex(
          (item) => item.id === action.payload.id,
        );
        if (index !== -1) {
          state.items[index] = { ...state.items[index], ...action.payload };
        }
      })

      // DELETE
      .addCase(deleteAppointment.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item.id !== action.payload);
      });
  },
});

export const { clearAppointments, setSelectedAppointment } =
  appointmentSlice.actions;

export default appointmentSlice.reducer;
