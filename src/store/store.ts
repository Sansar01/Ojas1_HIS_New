/**
 * Redux store — one store for the whole application.
 *
 * Every domain owns ONE slice under `store/slices/`:
 *
 *   auth            → who is the user? (login / OTP / session)
 *   modules         → which modules may they open? (moduleSlice)
 *   permission      → what may they do inside them? (permissionSlice)
 *   bootstrap       → did the post-login /permission stage finish?
 *   master          → shared master/reference data (services, tariffs, dropdowns)
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
import bootstrapReducer from "./slices/bootstrapSlice";
import masterReducer from "./slices/masterSlice";
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

import { fetchPatients } from "./slices/patientSlice";
import { fetchDoctors } from "./slices/doctorSlice";
import { fetchDepartments } from "./slices/departmentSlice";
import { fetchAppointments } from "./slices/appointmentSlice";
import { fetchConsultations } from "./slices/consultationSlice";
import { fetchInvoices } from "./slices/billingSlice";
import { fetchActivities } from "./slices/activitySlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    modules: moduleReducer,
    permission: permissionReducer,
    bootstrap: bootstrapReducer,
    master: masterReducer,
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

/**
 * Refresh-on-demand for the header controls — implements the API/Redux
 * data-fetching strategy rule:
 *
 *   "Use API calls for page-specific data when the page renders. Use Redux for
 *    data that genuinely needs to be shared or reused across
 *    components/workflows. Do not preload every API on startup or refresh."
 *
 * The shell therefore loads **nothing** by itself. Every page dispatches the
 * guarded thunks for the collections it renders (patients, appointments,
 * doctors, consultations, invoices, activities, departments, …) and, because
 * those thunks are cache-guarded, the same dataset is fetched at most once per
 * session no matter how many pages, modals or widgets need it.
 *
 * This helper is what the header's "Refresh data" / "Sync portal data" actions
 * call instead of a blanket bootstrap: it force-refetches **only the
 * collections that are already in memory**, so a refresh updates what the user
 * is actually looking at and never pulls in an unrelated dataset.
 */
export const refreshLoadedResources = (): AppThunk =>
  async (dispatch, getState) => {
    const s = getState() as RootState;
    const loaded = (status: string) => status !== "idle";
    if (loaded(s.patients.status)) dispatch(fetchPatients(true) as any);
    if (loaded(s.doctors.status)) dispatch(fetchDoctors(true) as any);
    if (loaded(s.departments.status)) dispatch(fetchDepartments(true) as any);
    if (loaded(s.appointments.status)) dispatch(fetchAppointments(true) as any);
    if (loaded(s.consultations.status))
      dispatch(fetchConsultations(true) as any);
    if (loaded(s.invoices.status)) dispatch(fetchInvoices(true) as any);
    if (loaded(s.activities.status)) dispatch(fetchActivities(true) as any);
  };
