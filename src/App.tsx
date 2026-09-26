// src/Root.tsx
import { useEffect } from "react";
import { useSelector, Provider } from "react-redux";
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
import { AppRoutes } from "@/routes";
import { TooltipProvider } from "@/components/ui/overlays";
import { ToastHost } from "@/components/ui/feedback";
import type { RootState } from "@/store";

function Root() {
  const toasts = useSelector((state: RootState) => state.ui.toasts);

  useEffect(() => {
    // 1. Sirf session restore trigger karo (Listener khud fetchEntitlements call karega)
    store.dispatch(restoreSession() as any);

    // 2. Session gate register
    registerSessionGate(() => {
      const { session, status } = store.getState().auth;
      return {
        signedIn: Boolean(session) && status !== "unauthenticated",
        mustChangePassword: selectMustChangePassword(store.getState()),
      };
    });

    // 3. Refresh handler register
    registerRefreshHandler(async () => {
      try {
        await store.dispatch(refreshSession() as any).unwrap();
        return true;
      } catch {
        return false;
      }
    });

    // 4. Session watchdog
    const stopWatchdog = startSessionWatchdog(60_000);
    return () => {
      if (typeof stopWatchdog === "function") stopWatchdog();
    };
  }, []);

  // ❌ Sabhi fragile useEffects yahan se permanently delete ho gaye!

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