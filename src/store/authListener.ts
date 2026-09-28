// src/store/authListener.ts
import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import {
  login,
  verifyOtp,
  restoreSession,
  changePassword,
  logoutUser,
  logout,
} from "@/features/auth/authSlice";
import {
  fetchEntitlements,
  clearEntitlements,
} from "@/features/entitlement/entitlementSlice";
import type { RootState } from "./index";

export const authListenerMiddleware = createListenerMiddleware();

// 1. Trigger fetchEntitlements on Login, Restore, or Password Change
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

    if (session && !mustChangePassword && !state.entitlement.loading) {
      // Background me entitlements fetch karo (agar already loading nahi hai)
      listenerApi.dispatch(fetchEntitlements() as any);
    }
  },
});

// 2. Clear entitlements automatically on Logout
authListenerMiddleware.startListening({
  matcher: isAnyOf(logoutUser.fulfilled, logout),
  effect: async (_, listenerApi) => {
    listenerApi.dispatch(clearEntitlements());
  },
});
