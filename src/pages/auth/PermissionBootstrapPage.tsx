/**
 * `/permission` — the application bootstrap stage (doc §37–53).
 *
 *   Login → 2FA → /permission → Load Modules → Load Permissions → Dashboard
 *
 * This page is the *single owner* of the bootstrap sequence. Nothing else in
 * the app calls the modules or permissions API:
 *
 *   /permission
 *       ├── moduleApi.available      (via moduleSlice.fetchModules)
 *       ├── permission resolve       (via permissionSlice.loadUserPermissions)
 *       └── Redux store              ← dashboard / sidebar / guards / pages
 *
 * Behaviour required by the standard:
 *   • The Dashboard is never rendered before modules *and* permissions are
 *     loaded (§38) — the route guard sends every protected page back here
 *     until the bootstrap reports `ready` (§46).
 *   • A browser refresh goes through the same flow (§41) — the bootstrap
 *     state lives in Redux (in memory), so a refresh starts from `idle` and
 *     the sequence runs again; the thunks' `condition` guards (§47) still
 *     stop StrictMode/remount duplicates.
 *   • Failure shows the global error/retry state instead of an empty
 *     dashboard (§42, §51).
 *   • The route the user originally asked for is preserved and restored
 *     once bootstrap completes (§49).
 */

import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchModules } from "@/store/slices/moduleSlice";
import { loadUserPermissions } from "@/store/slices/permissionSlice";
import {
  resetBootstrap,
  selectBootstrapError,
  selectBootstrapStatus,
} from "@/store/slices/bootstrapSlice";
import { isDeliberateLogout } from "@/store/slices/authSlice";
import { Splash } from "@/routes/guards";
import { Button } from "@/components/ui/primitives";

/** Where login sent the user, when they were bounced off a protected route. */
function useIntendedRoute(): string {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  // a voluntary sign-out has no route to restore; and we never bounce back
  // into the auth screens or into the bootstrap itself
  if (
    isDeliberateLogout() ||
    !from ||
    from === "/" ||
    from.startsWith("/accounts") ||
    from.startsWith("/permission")
  ) {
    return "/dashboard";
  }
  return from;
}

export function PermissionBootstrapPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const status = useAppSelector(selectBootstrapStatus);
  const error = useAppSelector(selectBootstrapError);
  const target = useIntendedRoute();

  /**
   * One effect, one owner (§48): the status drives the whole sequence.
   *
   *   idle              → step 1: modules
   *   loading-modules   → (loader on screen, nothing to do)
   *   loading-permissions → step 2: permissions
   *   ready             → hand over to the protected application
   *   failed            → error + retry (rendered below)
   */
  useEffect(() => {
    if (status === "idle") {
      dispatch(fetchModules());
    } else if (status === "loading-permissions") {
      dispatch(loadUserPermissions());
    } else if (status === "ready") {
      navigate(target, { replace: true });
    }
  }, [status, dispatch, navigate, target]);

  const label = useMemo(() => {
    switch (status) {
      case "loading-modules":
        return "Loading...";
      case "loading-permissions":
        return "Loading permissions...";
      case "ready":
        return "Access ready — opening your workspace";
      default:
        return "Preparing your secure workspace";
    }
  }, [status]);

  if (status === "failed") {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-950 px-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center shadow-pop backdrop-blur">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber-400/15 ring-1 ring-amber-300/30">
            <AlertTriangle className="size-6 text-amber-300" />
          </span>
          <h1 className="mt-4 font-display text-lg font-semibold">
            We couldn&rsquo;t load your access
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-white/60">
            {error ||
              "The modules and permissions for your account could not be loaded."}
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Button
              onClick={() => dispatch(resetBootstrap())}
              icon={<RefreshCw className="size-4" />}
            >
              Try again
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/accounts/login", { replace: true })}
            >
              Sign out
            </Button>
          </div>
          <p className="mt-4 inline-flex items-center gap-1.5 text-[11.5px] text-white/40">
            <ShieldCheck className="size-3.5" />
            Access is only granted after modules and permissions load.
          </p>
        </div>
      </div>
    );
  }

  // The application's global loader, with the messages from §39.
  return <Splash label={label} />;
}

export default PermissionBootstrapPage;
