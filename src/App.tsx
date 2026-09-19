import { useEffect } from "react";
import { useSelector } from "react-redux";
import { Provider } from "react-redux";
import { store } from "@/store";
import {
  restoreSession,
  refreshSession,
  selectMustChangePassword,
} from "@/features/auth/authSlice";
import {
  registerRefreshHandler,
  registerSessionGate,
  startSessionWatchdog,
} from "@/services/apiClient";
import { fetchEntitlements } from "@/features/entitlement/entitlementSlice";
import { AppRoutes } from "@/routes";
import { TooltipProvider } from "@/components/ui/overlays";
import { ToastHost } from "@/components/ui/feedback";
import type { RootState } from "@/store";

function Root() {
  const authStatus = useSelector((state: RootState) => state.auth.status);
  const entitlements = useSelector(
    (state: RootState) => state.entitlement.modules,
  );
  const mustChangePassword = useSelector(selectMustChangePassword);
  const entitlementsReady = useSelector(
    (state: RootState) => state.entitlement.ready,
  );
  const toasts = useSelector((state: RootState) => state.ui.toasts);

  useEffect(() => {
    store.dispatch(restoreSession() as any);

    // Lets the api client decide, per request, whether the session allows it:
    // signed out, or signed in with forcePasswordChange → auth calls only.
    registerSessionGate(() => {
      const { session, status } = store.getState().auth;
      return {
        signedIn: Boolean(session) && status !== "unauthenticated",
        mustChangePassword: selectMustChangePassword(store.getState()),
      };
    });

    registerRefreshHandler(async () => {
      try {
        await store.dispatch(refreshSession() as any).unwrap();
        return true;
      } catch {
        return false;
      }
    });

    const stopWatchdog = startSessionWatchdog(60_000);
    return () => {
      if (typeof stopWatchdog === "function") stopWatchdog();
    };
  }, []);

  // AFTER
useEffect(() => {
  // While the account owes a password change the session gate blocks every
  // business API, so never fire entitlements here — the call returns a
  // cancelled (empty) envelope and this effect would refire forever.
  // `ready` also stops refetching for accounts with genuinely zero modules.
  if (
    authStatus === "authenticated" &&
    !mustChangePassword &&
    !entitlementsReady &&
    (!entitlements || entitlements.length === 0)
  ) {
    store.dispatch(fetchEntitlements() as any);
  }
}, [authStatus, entitlements, entitlementsReady, mustChangePassword]);

  return (
    <TooltipProvider>
      <AppRoutes />
      <ToastHost toasts={toasts} />
    </TooltipProvider>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <Root />
    </Provider>
  );
}
