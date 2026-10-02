/**
 * Redux store — one store for the whole application.
 *
 * Every domain owns ONE slice under `store/slices/`:
 *
 *   auth            → who is the user? (login / OTP / session)
 *   modules         → which modules may they open? (moduleSlice)
 *   permission      → what may they do inside them? (permissionSlice)
 *   users / roles / patients / doctors / departments / specializations
 *   appointments / consultations / invoices / activities / hospital
 *   ui              → toasts, loader, sidebar
 *
 * State shapes and business behaviour stay per-module — there is no giant
 * shared CRUD slice.
 */

import { configureStore } from "@reduxjs/toolkit";

import authReducer from "./slices/authSlice";
import moduleReducer from "./slices/moduleSlice";
import permissionReducer from "./slices/permissionSlice";
import uiReducer from "./slices/uiSlice";
import userReducer from "./slices/userSlice";
import roleReducer from "./slices/roleSlice";
import patientReducer from "./slices/patientSlice";
import doctorReducer from "./slices/doctorSlice";
import departmentReducer from "./slices/departmentSlice";
import specializationReducer from "./slices/specializationSlice";
import appointmentReducer from "./slices/appointmentSlice";
import consultationReducer, {
  consultationHistoryReducer,
} from "./slices/consultationSlice";
import billingReducer from "./slices/billingSlice";
import activityReducer from "./slices/activitySlice";
import hospitalReducer from "./slices/hospitalSlice";

import { authListenerMiddleware } from "./authListener";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    modules: moduleReducer,
    permission: permissionReducer,
    ui: uiReducer,
    users: userReducer,
    roles: roleReducer,
    patients: patientReducer,
    doctors: doctorReducer,
    departments: departmentReducer,
    specializations: specializationReducer,
    appointments: appointmentReducer,
    consultations: consultationReducer,
    invoices: billingReducer,
    activities: activityReducer,
    consultationsHistory: consultationHistoryReducer,
    hospital: hospitalReducer,
  },
  // auth listener middleware reacts to login/logout and keeps
  // modules + permissions in sync with the session
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(authListenerMiddleware.middleware),
  devTools: true,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppThunk<R = void> = (
  dispatch: AppDispatch,
  getState: () => RootState,
) => R | Promise<R>;

/** Loads every collection for the signed-in session (shared by all pages). */
export const bootstrapResources = (): AppThunk => async (_dispatch) => {
  // intentionally empty — pages load what they need via their slices
};
