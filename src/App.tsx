import { useEffect } from "react";
import { useSelector, Provider } from "react-redux";
import { store } from "@/store";
import { startSessionRuntime } from "@/api/sessionBridge";
import { AppRoutes } from "@/routes";
import { TooltipProvider } from "@/components/ui/overlays";
import { ToastHost } from "@/components/ui/feedback";
import type { RootState } from "@/store";

function Root() {
  const toasts = useSelector((state: RootState) => state.ui.toasts);

  useEffect(() => {
    // Session restore + gate + refresh handler + watchdog all live in the API
    // layer (doc §8): this component only owns rendering and the toast host.
    // After a hard refresh the session resolves here and the router forwards
    // to /permission, which runs the modules → permissions bootstrap (§37-53).
    return startSessionRuntime();
  }, []);

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
