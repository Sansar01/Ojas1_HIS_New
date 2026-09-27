// src/store/authListener.ts
import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import { login, restoreSession, changePassword, logoutUser, logout } from "@/features/auth/authSlice";
import { fetchEntitlements, clearEntitlements } from "@/features/entitlement/entitlementSlice";
import type { RootState, AppDispatch } from "./index";

export const authListenerMiddleware = createListenerMiddleware();

// 1. Trigger fetchEntitlements on Login, Restore, or Password Change
authListenerMiddleware.startListening({
  matcher: isAnyOf(login.fulfilled, restoreSession.fulfilled, changePassword.fulfilled),
  effect: async (action, listenerApi) => {
    const state = listenerApi.getState() as RootState;
    const session = state.auth.session;
    const status = state.auth.status;

    // Check: User signed in hai aur temporary password ka chakkar nahi hai?
    const isAuthenticated = Boolean(session) && status === "authenticated";
    const mustChangePassword = Boolean(
      session?.forcePasswordChange || session?.user?.forcePasswordChange
    );

    if (isAuthenticated && !mustChangePassword) {
      // Background me entitlements fetch karo (agar already loading nahi hai)
      if (state.entitlement.status !== "loading") {
        listenerApi.dispatch(fetchEntitlements() as any);
      }
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