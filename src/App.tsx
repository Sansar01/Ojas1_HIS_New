import { useEffect } from "react";
import { useSelector } from "react-redux";
import { Provider } from "react-redux";
import { store } from "@/store";
import { logout, restoreSession, refreshSession } from "@/features/auth/authSlice";
import { registerRefreshHandler, startSessionWatchdog } from "@/services/apiClient";
import { fetchEntitlements } from "@/features/entitlement/entitlementSlice";
import { AppRoutes } from "@/routes";
import { TooltipProvider } from "@/components/ui/overlays";
import { ToastHost } from "@/components/ui/feedback";
import type { RootState } from "@/store";



function Root() {
  const authStatus = useSelector((state: RootState) => state.auth.status);
  const entitlements = useSelector((state: RootState) => state.entitlement.modules);
  const toasts = useSelector((state: RootState) => state.ui.toasts);

  useEffect(() => {
    store.dispatch(restoreSession() as any);

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

  useEffect(() => {
    // Sirf tabhi entitlements fetch karein jab user authenticated ho AUR pehle se load na hue hon
    if (authStatus === "authenticated" && (!entitlements || entitlements.length === 0)) {
      store.dispatch(fetchEntitlements() as any);
    }
  }, [authStatus, entitlements]);

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
