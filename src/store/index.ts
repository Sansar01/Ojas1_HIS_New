import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/features/auth/authSlice";
import uiReducer from "@/features/ui/uiSlice";
import { authListenerMiddleware } from "@/store/authListener";
import entitlementReducer from "@/features/entitlement/entitlementSlice";
import {
  ALL_APIS,
  appointmentsApi,
  activitiesApi,
  consultationsApi,
  departmentsApi,
  doctorsApi,
  hospitalReducer,
  invoicesApi,
  patientsApi,
  rolesApi,
  specializationsApi,
  usersApi,
} from "@/features/slices";
import type { AppThunk } from "@/store/types";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    entitlement: entitlementReducer,
    ui: uiReducer,
    users: usersApi.reducer,
    roles: rolesApi.reducer,
    patients: patientsApi.reducer,
    doctors: doctorsApi.reducer,
    departments: departmentsApi.reducer,
    specializations: specializationsApi.reducer,
    appointments: appointmentsApi.reducer,
    consultations: consultationsApi.reducer,
    invoices: invoicesApi.reducer,
    activities: activitiesApi.reducer,
    hospital: hospitalReducer,
  },
  // 👇 YEH ADD KAREIN (Listener ko store ke sath attach karna zaroori hai)
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(authListenerMiddleware.middleware),
  devTools: true,
});

export type { RootState, AppDispatch } from "@/store/types";

/** Loads every collection for the signed-in session (shared by all pages). */
export const bootstrapResources = (): AppThunk => async (dispatch) => {
  // ...
};