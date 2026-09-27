import * as React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { HeartPulse } from "lucide-react";
import { useAuthStatus, usePermission } from "@/hooks";
import {
  selectMustChangePassword,
  selectUser,
} from "@/features/auth/authSlice";
import { useRootSelector } from "@/hooks";
import { ForbiddenState } from "@/components/ui/feedback";
import { FORCE_PASSWORD_PATH } from "@/constants";
import type { ModuleKey, Permission } from "@/types";
import { canAccessModule } from "@/utils/permissions";

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
  const session = useRootSelector(selectUser);
  const mustChange = useRootSelector(selectMustChangePassword);
  const location = useLocation();

  if ((status === "restoring" || status === "idle") && !session) {
    return <Splash />;
  }

  if (!session) {
    return (
      <Navigate
        to="/accounts/login"
        state={{ from: location.pathname }}
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
  const user = useRootSelector(selectUser);
  const mustChange = useRootSelector(selectMustChangePassword);

  if ((status === "idle" || status === "restoring") && !user) {
    return <Splash label="Checking authentication" />;
  }

  if (user)
    return (
      <Navigate to={mustChange ? FORCE_PASSWORD_PATH : "/dashboard"} replace />
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
  const session = useRootSelector((s) => s.auth.session) as any;
  const mustChange = useRootSelector(selectMustChangePassword);

  if ((status === "restoring" || status === "idle") && !session) {
    return <Splash label="Checking your session" />;
  }
  if (!session) {
    return <Navigate to="/accounts/login" replace />;
  }
  if (!mustChange) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

/** Denies a route when the module (or a specific action) is not granted.
 *  Fully dynamic — checks the assigned modules from entitlements for EVERY user
 *  type (admin, doctor, regular, etc.). No SUPERADMIN bypass.
 *  Authorization uses entitlement state (single runtime source), not static MODULES registry.
 *  If module not in user's entitlements.modules → Forbidden for everyone.
 *  True 404s are handled by router's catch-all * route.
 */
export function RequireModule({
  module,
  action = "view",
  children,
}: {
  module: ModuleKey;
  action?: Permission;
  children: React.ReactNode;
}) {
  const { entitlements, loading, ready } = usePermission();

  // Wait for entitlements to load for all users uniformly — single source per cleanup plan
  if (!ready || loading) {
    return <Splash label="Loading permissions" />;
  }

  // User-level dynamic check: is this module assigned to current user?
  // Same logic for admin, doctor, regular user — no role-based bypass.
  // No static ALL_MODULE_KEYS check here per cleanup plan — 404 is router's job.
  if (!canAccessModule(entitlements, module, action)) {
    // Use module key as fallback label; display name comes from entitlement API when available
    const displayName =
      entitlements?.modules?.find((m: any) => {
        const code = (m.code || "").toLowerCase();
        return (
          code === module || code === `${module}s` || `${code}s` === module
        );
      })?.name || module;

    return <ForbiddenState module={displayName} />;
  }

  return <>{children}</>;
}

/** Inline permission gate for buttons, rows and menu items. */
export function PermissionGuard({
  module,
  action = "view",
  children,
  fallback = null,
}: {
  module: ModuleKey;
  action?: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { can } = usePermission();
  return <>{can(module, action) ? children : fallback}</>;
}
