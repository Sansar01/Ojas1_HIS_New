import { useEffect } from "react";
import { Provider } from "react-redux";
import { store } from "@/store";
import { restoreSession } from "@/features/auth/authSlice";
import { fetchHospital } from "@/features/slices";
import { AppRoutes } from "@/routes";
import { TooltipProvider } from "@/components/ui/overlays";

function Root() {
  useEffect(() => {
    store.dispatch(restoreSession() as any);
    store.dispatch(fetchHospital() as any);
  }, []);

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
