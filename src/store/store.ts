/**
 * Redux store — deliberately minimal.
 *
 * Only three things are application-wide state:
 *
 *   auth        → who is the user? (login / OTP / session / logout)
 *   modules     → which modules may they open?   (moduleSlice)
 *   permission  → what may they do inside them?  (permissionSlice)
 *   bootstrap   → did the post-login /permission stage finish?
 *   ui          → toasts, global loader, sidebar (the app's existing global
 *                 UI mechanism — shared chrome, not feature data)
 *
 * Every FEATURE dataset (patients, doctors, appointments, consultations,
 * invoices, departments, specializations, users, roles, masters, activities,
 * facility profile) now lives in the page that renders it and is fetched
 * through the corresponding feature service (`*.service.ts`) with the shared
 * Axios client. There is no feature slice to dispatch to and nothing is
 * preloaded at start-up — the shell loads only auth + entitlements.
 */

import { configureStore } from "@reduxjs/toolkit";

import authReducer from "./slices/authSlice";
import moduleReducer from "./slices/moduleSlice";
import permissionReducer from "./slices/permissionSlice";
import bootstrapReducer from "./slices/bootstrapSlice";
import uiReducer from "./slices/uiSlice";

import { authListenerMiddleware } from "./authListener";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    modules: moduleReducer,
    permission: permissionReducer,
    bootstrap: bootstrapReducer,
    ui: uiReducer,
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
