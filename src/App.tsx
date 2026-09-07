import { useEffect } from "react";
import { useSelector } from "react-redux";
import { Provider } from "react-redux";
import { store } from "@/store";
import { logout, restoreSession, refreshSession } from "@/features/auth/authSlice";
import { registerRefreshHandler } from "@/services/apiClient";
import { fetchEntitlements } from "@/features/entitlement/entitlementSlice";
import { AppRoutes } from "@/routes";
import { TooltipProvider } from "@/components/ui/overlays";
import { ToastHost } from "@/components/ui/feedback";
import type { RootState } from "@/store";

function Root() {
  const authStatus = useSelector((state: RootState) => state.auth.status);
  const toasts = useSelector((state: RootState) => state.ui.toasts);
  const entitlementError = useSelector(
    (state: RootState) => state.entitlement.error,
  );

  useEffect(() => {
    store.dispatch(restoreSession() as any);

    // 401 anywhere in the app → refresh the token once and retry.
    // If refresh fails, apiClient clears the session and navigates to login.
    registerRefreshHandler(async () => {
      try {
        await store.dispatch(refreshSession() as any).unwrap();
        return true;
      } catch {
        return false;
      }
    });
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") {
      store.dispatch(fetchEntitlements() as any);
    }
  }, [authStatus]);

  // useEffect(() => {
  //   if (authStatus === "authenticated" && entitlementError) {
  //     store.dispatch(logout());
  //   }
  // }, [authStatus, entitlementError]);

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
