/**
 * Session bridge — wires the API client to the Redux session.
 *
 * The root component must not know how the HTTP layer talks to the store
 * (doc §8/§10: Axios stays behind the API layer). This module is the single
 * place that connects:
 *
 *   • the session gate   → nothing business-critical leaves the browser while
 *                          the session is closed or a forced password change
 *                          is pending;
 *   • the refresh handler→ transparently refreshes an expiring access token;
 *   • the watchdog       → keeps a long-lived tab's session alive.
 *
 * `startSessionRuntime()` returns a stop function for the caller's effect
 * cleanup. It also restores the session once, which is where the
 * `Login → 2FA → /permission` flow begins after a browser refresh (doc §41).
 */

import { store } from "@/store";
import {
  restoreSession,
  refreshSession,
  selectMustChangePassword,
} from "@/store/slices/authSlice";
import {
  registerRefreshHandler,
  registerSessionGate,
  startSessionWatchdog,
} from "./axios";

export function startSessionRuntime(): () => void {
  // 1. Session restore — the auth listener no longer fetches modules; the
  //    `/permission` route does that after the session is known (doc §43).
  store.dispatch(restoreSession() as any);

  // 2. Session gate
  registerSessionGate(() => {
    const { session, status } = store.getState().auth;
    return {
      signedIn: Boolean(session) && status !== "unauthenticated",
      mustChangePassword: selectMustChangePassword(store.getState()),
    };
  });

  // 3. Token refresh
  registerRefreshHandler(async () => {
    try {
      await store.dispatch(refreshSession() as any).unwrap();
      return true;
    } catch {
      return false;
    }
  });

  // 4. Keep-alive watchdog
  const stopWatchdog = startSessionWatchdog(60_000);
  return () => {
    if (typeof stopWatchdog === "function") stopWatchdog();
  };
}
