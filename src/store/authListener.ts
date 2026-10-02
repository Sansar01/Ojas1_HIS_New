// src/store/authListener.ts
import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import {
  login,
  verifyOtp,
  restoreSession,
  changePassword,
  logoutUser,
  logout,
} from "./slices/authSlice";
import { fetchModules, clearModules } from "./slices/moduleSlice";
import {
  loadUserPermissions,
  clearPermissions,
} from "./slices/permissionSlice";
import type { RootState } from "./types";

export const authListenerMiddleware = createListenerMiddleware();

// 1. Keep authorization data (modules + permissions) in sync with the session:
//    fire on Login, 2FA Verify, Restore and Password Change.
authListenerMiddleware.startListening({
  // verifyOtp included: a 2FA sign-in must load modules exactly like a normal one
  matcher: isAnyOf(
    login.fulfilled,
    verifyOtp.fulfilled,
    restoreSession.fulfilled,
    changePassword.fulfilled,
  ),
  effect: async (action, listenerApi) => {
    const state = listenerApi.getState() as RootState;
    const session = state.auth.session;

    // Check: User signed in hai aur temporary password ka chakkar nahi hai?
    // A usable session is enough on its own: `status` can still read
    // "authenticating" for a tick after a 2FA sign-in, and that used to make
    // the modules request silently never fire.
    const mustChangePassword = Boolean(
      session?.forcePasswordChange || session?.user?.forcePasswordChange,
    );

    if (session && !mustChangePassword && !state.modules.loading) {
      // Background me modules fetch karo (agar already loading nahi hai)
      listenerApi.dispatch(fetchModules() as any);
    }
    // snapshot the user's permission map for permissionSlice
    listenerApi.dispatch(loadUserPermissions() as any);
  },
});

// 2. Clear authorization data automatically on Logout
authListenerMiddleware.startListening({
  matcher: isAnyOf(logoutUser.fulfilled, logout),
  effect: async (_, listenerApi) => {
    listenerApi.dispatch(clearModules());
    listenerApi.dispatch(clearPermissions());
  },
});
