// src/store/authListener.ts
import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import { logoutUser, logout } from "./slices/authSlice";
import { clearModules } from "./slices/moduleSlice";
import { clearPermissions } from "./slices/permissionSlice";

export const authListenerMiddleware = createListenerMiddleware();

// 1. Authentication success NEVER loads modules/permissions here.
//
//    `/permission` is the single bootstrap owner — login, 2FA, session restore
//    and password change all hand over to that route, which runs the
//    modules → permissions sequence itself (with its own duplicate-request
//    guards). Spreading the same work across a listener, the sidebar, the
//    guards and the pages is exactly the duplication the standard forbids.

// 2. Signing out empties the authorization state.
//
//    The only cached, session-scoped data left in Redux is the entitlement
//    snapshot, and it must die with the session — otherwise the next user
//    would inherit the previous user's module catalogue. Feature data is not
//    cached globally any more (each page owns it and dies with the route), so
//    there is nothing else to clear here.
authListenerMiddleware.startListening({
  matcher: isAnyOf(logoutUser.fulfilled, logout),
  effect: async (_, listenerApi) => {
    listenerApi.dispatch(clearModules());
    listenerApi.dispatch(clearPermissions());
  },
});
