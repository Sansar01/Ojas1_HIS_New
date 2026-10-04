// src/store/authListener.ts
import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import { logoutUser, logout } from "./slices/authSlice";
import { clearModules } from "./slices/moduleSlice";
import { clearPermissions } from "./slices/permissionSlice";
import { clearDepartments } from "./slices/departmentSlice";
import { clearSpecializations } from "./slices/specializationSlice";
import { clearDoctors } from "./slices/doctorSlice";
import { clearPatients } from "./slices/patientSlice";
import { clearUsers } from "./slices/userSlice";
import { clearRoles } from "./slices/roleSlice";
import { clearAppointments } from "./slices/appointmentSlice";
import { clearConsultations } from "./slices/consultationSlice";
import { clearInvoices } from "./slices/billingSlice";
import { clearActivities } from "./slices/activitySlice";
import { clearMasters } from "./slices/masterSlice";

export const authListenerMiddleware = createListenerMiddleware();

// 1. Authentication success NEVER loads modules/permissions here.
//
//    Doc §43/§48: `/permission` is the single bootstrap owner — login, 2FA,
//    session restore and password change all hand over to that route, which
//    runs the modules → permissions sequence itself (with its own
//    duplicate-request guards). Spreading the same work across a listener,
//    the sidebar, the guards and the pages is exactly the duplication the
//    standard forbids.

// 2. Signing out empties every shared dataset.
//
//    Shared reference data is cached for the session (doc §13: idle → fetch,
//    succeeded → reuse). That cache is only safe if it dies with the session,
//    otherwise the next user would see the previous user's departments,
//    doctors, patients, invoices… So logout clears every domain slice, and the
//    slices return to `idle` — the next sign-in refetches exactly once.
authListenerMiddleware.startListening({
  matcher: isAnyOf(logoutUser.fulfilled, logout),
  effect: async (_, listenerApi) => {
    // authorization
    listenerApi.dispatch(clearModules());
    listenerApi.dispatch(clearPermissions());
    // shared domain data
    listenerApi.dispatch(clearDepartments());
    listenerApi.dispatch(clearSpecializations());
    listenerApi.dispatch(clearDoctors());
    listenerApi.dispatch(clearPatients());
    listenerApi.dispatch(clearUsers());
    listenerApi.dispatch(clearRoles());
    listenerApi.dispatch(clearAppointments());
    listenerApi.dispatch(clearConsultations());
    listenerApi.dispatch(clearInvoices());
    listenerApi.dispatch(clearActivities());
    // shared master/reference data (services, tariffs, dropdown lists)
    listenerApi.dispatch(clearMasters());
  },
});
