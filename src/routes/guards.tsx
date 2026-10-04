import * as React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { HeartPulse } from "lucide-react";
import { useAuthStatus, usePermission } from "@/hooks";
import {
  selectMustChangePassword,
  selectUser,
} from "@/store/slices/authSlice";
import {
  selectBootstrapReady,
  selectBootstrapStatus,
} from "@/store/slices/bootstrapSlice";
import { useAppSelector } from "@/store/hooks";
import {
  ForbiddenState,
  LoadingBlock,
  NotFoundState,
} from "@/components/ui/feedback";
import { FORCE_PASSWORD_PATH } from "@/constants";
import type { Permission } from "@/types";
import { checkRouteAccess } from "@/utils/permissions";

export function Splash({
  label = "Restoring your secure session",
}: {
  label?: string;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-950 text-white">
      <div className="flex flex-col items-center gap-4">
        <span className="relative grid size-14 place-items-center rounded-2xl bg-brand-500/15 ring-1 ring-brand-400/30">
          <HeartPulse className="size-7 text-brand-300" />
          <span className="absolute inset-0 animate-ping rounded-2xl bg-brand-400/10" />
        </span>
        <p className="text-[13px] font-medium text-white/60">{label}</p>
        <span className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <span className="block h-full w-1/3 animate-[bar_1.4s_ease-in-out_infinite] rounded-full bg-brand-400" />
        </span>
      </div>
    </div>
  );
}

/** Blocks unauthenticated visitors, remembers the attempted URL. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useAuthStatus();
  const session = useAppSelector(selectUser);
  const mustChange = useAppSelector(selectMustChangePassword);
  const location = useLocation();

  if ((status === "restoring" || status === "idle") && !session) {
    return <Splash />;
  }

  if (!session) {
    // After a voluntary sign-out there is no route to come back to: the next
    // login must open the dashboard, not the page the user happened to leave.
    return (
      <Navigate
        to="/accounts/login"
        replace
      />
    );
  }

  if (mustChange && location.pathname !== FORCE_PASSWORD_PATH) {
    return <Navigate to={FORCE_PASSWORD_PATH} replace />;
  }

  return <>{children}</>;
}

/** Redirects signed-in users away from public auth screens. */
export function PublicOnly({ children }: { children: React.ReactNode }) {
  const status = useAuthStatus();
  const user = useAppSelector(selectUser);
  const mustChange = useAppSelector(selectMustChangePassword);
  const bootstrapReady = useAppSelector(selectBootstrapReady);

  if ((status === "idle" || status === "restoring") && !user) {
    return <Splash label="Checking authentication" />;
  }

  if (user)
    return (
      <Navigate
        to={
          mustChange
            ? FORCE_PASSWORD_PATH
            : bootstrapReady
              ? "/dashboard"
              : "/permission"
        }
        replace
      />
    );
  return <>{children}</>;
}

/**
 * Guard for the force-password screen.
 */
export function RequirePasswordChange({
  children,
}: {
  children: React.ReactNode;
}) {
  const status = useAuthStatus();
  const session = useAppSelector((s) => s.auth.session) as any;
  const mustChange = useAppSelector(selectMustChangePassword);

  if ((status === "restoring" || status === "idle") && !session) {
    return <Splash label="Checking your session" />;
  }
  if (!session) {
    return <Navigate to="/accounts/login" replace />;
  }
  if (!mustChange) {
    // no forced change pending → normal path: the bootstrap stage
    return <Navigate to="/permission" replace />;
  }
  return <>{children}</>;
}

/**
 * Application bootstrap gate (doc §37–52).
 * ----------------------------------------
 * Wrap the whole protected application in it: it is the one place that
 * enforces
 *
 *   authenticated
 *   AND modules loaded
 *   AND permissions loaded
 *
 * before any protected page (or the sidebar inside it) is rendered.
 *
 * While the bootstrap stage has not reported `ready`, the visitor is sent to
 * `/permission`, which then hands over to the dashboard — no route is carried
 * across the stage. A hard refresh lands here with `bootstrap: idle`, so the
 * flow re-runs instead of trusting a token in localStorage (§41).
 */
export function RequireBootstrap({ children }: { children: React.ReactNode }) {
  const status = useAuthStatus();
  const session = useAppSelector(selectUser);
  const bootstrapStatus = useAppSelector(selectBootstrapStatus);

  if ((status === "restoring" || status === "idle") && !session) {
    return <Splash />;
  }

  if (!session) {
    return (
      <Navigate to="/accounts/login" replace />
    );
  }

  if (bootstrapStatus !== "ready") {
    return (
      <Navigate to="/permission" replace />
    );
  }

  return <>{children}</>;
}

/**
 * The only gate that can render a page — wrap every protected `<Route>` in it.
 * ---------------------------------------------------------------------------
 * Replaces the old `RequireModule`, which took a hand-picked module key and
 * looked it up with fuzzy matching. Now:
 *
 *   • `module` (+ optional `aliases`) names the entitlement module this page
 *     belongs to, spelled exactly as the API spells it;
 *   • the module is resolved STRICTLY against `entitlements.modules`
 *     (exact code / route / name). If the API did not grant the module, the
 *     user sees the 404 page — the existence of the page is not leaked;
 *   • if the module exists but the required action is missing, they see the
 *     403 "access restricted" state instead.
 *
 * A URL with no `<Route>` at all never reaches this component — the router's
 * catch-all `*` shows the 404 page. Entitlements are always awaited first, so
 * there is no flash of a protected page while permissions load, and no bypass
 * for any user type.
 *
 *   <Route path="/users" element={
 *     <ModuleRoute module="users"><UsersPage /></ModuleRoute>
 *   } />
 */
export function ModuleRoute({
  module,
  aliases,
  action = "view",
  label,
  children,
}: {
  /** module key exactly as the entitlements API spells it */
  module: string;
  /** other accepted spellings for the same module (exact match only) */
  aliases?: string[];
  action?: Permission;
  /** human label used in the 403 message */
  label?: string;
  children: React.ReactNode;
}) {
  const { entitlements, loading, ready } = usePermission();
  const globalLoaderVisible = useAppSelector((s) => s.ui.loader.count > 0);

  // Only ONE loading indicator at a time.
  // While the modules API is in flight, fetchModules has already raised
  // the global loader ("Loading modules") — rendering an inline spinner in the
  // same window reads as two loaders stacked on top of each other. So the
  // content area stays empty and the global loader does the talking.
  // The inline block is only the fallback, for the rare case where the global
  // loader is not showing (e.g. entitlements came from the login response and
  // nothing else is loading) — never a blank page with no explanation.
  if (!ready || loading) {
    return globalLoaderVisible ? null : (
      <LoadingBlock label="Loading permissions" />
    );
  }

  const access = checkRouteAccess(
    entitlements,
    [module, ...(aliases ?? [])],
    action,
  );

  if (access.status === "not-found") {
    // Module not in this user's entitlements → behave exactly like a
    // non-existent URL. Same page as the catch-all route.
    return <NotFoundState />;
  }

  if (access.status === "forbidden") {
    return <ForbiddenState module={access.module?.name ?? label ?? module} />;
  }

  return <>{children}</>;
}
