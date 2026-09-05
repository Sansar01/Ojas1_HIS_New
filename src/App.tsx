import { useEffect } from "react";
import { useSelector } from "react-redux";
import { Provider } from "react-redux";
import { store } from "@/store";
import { restoreSession } from "@/features/auth/authSlice";
import { fetchEntitlements } from "@/features/entitlement/entitlementSlice";
import { fetchHospital } from "@/features/slices";
import { AppRoutes } from "@/routes";
import { TooltipProvider } from "@/components/ui/overlays";
import type { RootState } from "@/store";

function Root() {
  const authStatus = useSelector((state: RootState) => state.auth.status);

  useEffect(() => {
    store.dispatch(restoreSession() as any);
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") {
      store.dispatch(fetchEntitlements() as any);
      store.dispatch(fetchHospital() as any);
    }
  }, [authStatus]);

  return (
    <TooltipProvider>
      <AppRoutes />
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
