import * as React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { HeartPulse } from "lucide-react";
import { useAuthStatus, usePermission } from "@/hooks";
import { canAccess, selectUser } from "@/features/auth/authSlice";
import { useRootSelector } from "@/hooks";
import { ForbiddenState } from "@/components/ui/feedback";
import { MODULE_LABEL } from "@/constants";
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
  const location = useLocation();

  if (status === "restoring" || status === "idle") return <Splash />;
  if (!session)
    return (
      <Navigate to="/accounts/login" state={{ from: location.pathname }} />
    );
  return <>{children}</>;
}

/** Redirects signed-in users away from public auth screens. */
export function PublicOnly({ children }: { children: React.ReactNode }) {
  const status = useAuthStatus();
  const user = useRootSelector(selectUser);
  if (status === "restoring" || status === "idle")
    return <Splash label="Checking authentication" />;
  if (user) return <Navigate to="/dashboard" />;
  return <>{children}</>;
}

/** Denies a route when the module (or a specific action) is not granted. */
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
  const user = useRootSelector(selectUser) as any;
  const isSuperAdmin = [user?.userType, user?.role?.slug, user?.role?.name]
    .filter(Boolean)
    .some(
      (value) =>
        String(value).toUpperCase().replace(/[^A-Z0-9]/g, "") ===
        "SUPERADMIN",
    );

  if (!isSuperAdmin && (!ready || loading)) {
    return <Splash label="Loading permissions" />;
  }

  if (!canAccessModule(entitlements, module, action)) {
    return <ForbiddenState module={MODULE_LABEL[module]} />;
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
