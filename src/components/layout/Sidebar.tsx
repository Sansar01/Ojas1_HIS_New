import * as React from "react";
import { NavLink } from "react-router-dom";
import {
  Activity,
  Building2,
  CalendarClock,
  ChevronLeft,
  ClipboardList,
  HeartPulse,
  LayoutDashboard,
  ReceiptIndianRupee,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { APP_NAME, APP_SUBTITLE, MODULES } from "@/constants";
import { useAppDispatch, useCurrentUser, usePermission } from "@/hooks";
import { setMobileNav, toggleSidebar } from "@/features/ui/uiSlice";
import { Tooltip } from "@/components/ui/overlays";
import { Avatar, Badge } from "@/components/ui/primitives";
import type { ModuleKey } from "@/types";
import { useEntitlements } from "@/hooks/useEntitlements";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Users,
  Stethoscope,
  ClipboardList,
  CalendarClock,
  ReceiptIndianRupee,
  Building2,
  Sparkles,
  UserCog,
  ShieldCheck,
  Settings,
  UserPlus,
};

const GROUP_ORDER: { label: string; hint: string }[] = [
  { label: "Insights", hint: "Live hospital picture" },
  { label: "Clinical", hint: "Care delivery" },
  { label: "Operations", hint: "Scheduling & revenue" },
  { label: "Access", hint: "RBAC & facility" },
];

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const dispatch = useAppDispatch();
  const user = useCurrentUser();
  const { can } = usePermission();
  const modules = MODULES.filter((m) => can(m.key, "view"));
  // With:
  const { modules: entitlementModules } = useEntitlements();

  const visibleModules = entitlementModules
    .filter((m: any) => m.isActive)
    .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const counts: Partial<Record<ModuleKey, number>> = {};

  return (
    <aside
      className={cn(
        "relative z-40 flex h-full flex-col bg-ink-950 text-ink-100",
        "bg-[radial-gradient(circle_at_18%_0%,rgba(30,158,144,.34),transparent_46%),radial-gradient(circle_at_82%_100%,rgba(61,111,209,.24),transparent_52%)]",
        "transition-[width] duration-300 ease-[cubic-bezier(.22,1,.36,1)]",
        collapsed ? "w-[78px]" : "w-[262px]",
      )}
    >
      {/* logo / brand — fixed while the nav list scrolls */}
      <div
        className={cn(
          "relative flex h-16 shrink-0 items-center gap-2.5 border-b border-white/8 px-4",
          collapsed && "justify-center px-2",
        )}
      >
        <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-brand-500/90 text-white shadow-[0_10px_24px_-12px_rgba(64,190,174,.9)]">
          <HeartPulse className="size-5" />
          <span className="absolute -inset-1 rounded-xl ring-1 ring-white/15" />
        </span>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="font-display text-[15px] font-bold tracking-tight text-white">
              {APP_NAME}
            </p>
            <p className="truncate text-[10px] uppercase tracking-[0.16em] text-brand-200/80">
              {APP_SUBTITLE}
            </p>
          </div>
        )}
        <button
          onClick={() => dispatch(setMobileNav(false))}
          aria-label="Close navigation"
          className="ml-auto rounded-lg p-1.5 text-white/70 hover:bg-white/10 lg:hidden"
        >
          <X className="size-4.5" />
        </button>
      </div>

      {/* scrolling navigation */}
      <nav className="nav-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 py-3">
        {GROUP_ORDER.map((group) => {
          const items = modules.filter((m) => m.group === group.label);
          if (!items.length) return null;
          return (
            <div key={group.label} className="mb-4 last:mb-0">
              {!collapsed && (
                <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {items.map((m) => {
                  const Icon = ICONS[m.icon] ?? LayoutDashboard;
                  const link = (
                    <NavLink
                      to={m.path}
                      className={({ isActive }) =>
                        cn(
                          "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-150",
                          isActive
                            ? "bg-brand-500/16 text-white ring-1 ring-inset ring-brand-400/35"
                            : "text-white/62 hover:bg-white/7 hover:text-white",
                          collapsed && "justify-center px-0",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={cn(
                              "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-300 transition-all",
                              isActive ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <Icon
                            className={cn(
                              "size-4.5 shrink-0 transition-transform duration-200",
                              !isActive && "group-hover:scale-110",
                            )}
                          />
                          {!collapsed && (
                            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                              <span className="truncate">{m.label}</span>
                              {!!counts[m.key] && (
                                <span className="num rounded bg-white/10 px-1.5 text-[10px] font-semibold text-white/80">
                                  {counts[m.key]}
                                </span>
                              )}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                  return (
                    <li key={m.key}>
                      {collapsed ? (
                        <Tooltip content={m.label} side="right">
                          <div>{link}</div>
                        </Tooltip>
                      ) : (
                        link
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {!collapsed && (
          <div className="mt-2 rounded-xl border border-white/8 bg-white/4 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
              <Activity className="size-3.5 text-brand-300" /> Session scope
            </p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/45">
              {modules.length} of {MODULES.length} modules unlocked for{" "}
              <span className="text-white/70">{user?.role}</span>.
            </p>
            <svg viewBox="0 0 220 34" className="mt-2 h-6 w-full" aria-hidden>
              <path
                className="ekg-line"
                d="M0 17h34l6-11 7 22 6-11h28l5-8 6 16 5-8h40l6-11 7 22 6-11h32"
                fill="none"
                stroke="rgb(113 216 202)"
                strokeWidth="1.6"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}
      </nav>

      {/* footer — pinned */}
      <div
        className={cn(
          "shrink-0 border-t border-white/8 p-2.5",
          collapsed && "flex flex-col items-center gap-2",
        )}
      >
        {user && (
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-lg bg-white/6 p-2",
              collapsed && "justify-center",
            )}
          >
            <Avatar
              name={`${user.firstName} ${user.lastName}`}
              color={user.color}
              size="sm"
            />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-white">
                  {user.firstName} {user.lastName}
                </p>
                <p className="truncate text-[10.5px] text-white/45">
                  {user.title ?? user.role}
                </p>
              </div>
            )}
            {!collapsed && (
              <Badge
                tone="ink"
                size="xs"
                className="uppercase tracking-wide text-brand-100"
              >
                {user.status}
              </Badge>
            )}
          </div>
        )}
        <button
          onClick={() => dispatch(toggleSidebar())}
          className={cn(
            "mt-2 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium text-white/55 transition-colors hover:bg-white/8 hover:text-white",
            collapsed && "justify-center px-0",
          )}
        >
          <ChevronLeft
            className={cn(
              "size-4 transition-transform duration-300",
              collapsed && "rotate-180",
            )}
          />
          {!collapsed && "Collapse sidebar"}
        </button>
      </div>
    </aside>
  );
}
