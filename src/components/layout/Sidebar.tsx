import { NavLink } from "react-router-dom";
import { ChevronLeft, HeartPulse, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { APP_NAME, APP_SUBTITLE } from "@/constants";
import { useAppDispatch } from "@/hooks";
import { setMobileNav, toggleSidebar } from "@/features/ui/uiSlice";
import { useRootSelector } from "@/hooks";
import { getModuleInfoByLabel } from "@/utils/modulesMap";

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const dispatch = useAppDispatch();
  const entitlements = useRootSelector((s) => s.entitlement);

  const allowedModules = entitlements?.modules || [];

  return (
    <aside
      className={cn(
        "relative z-40 flex h-full flex-col bg-ink-950 text-ink-100",
        "bg-[radial-gradient(circle_at_18%_0%,rgba(30,158,144,.34),transparent_46%),radial-gradient(circle_at_82%_100%,rgba(61,111,209,.24),transparent_52%)]",
        "transition-[width] duration-300 ease-[cubic-bezier(.22,1,.36,1)]",
        collapsed ? "w-[78px]" : "w-[262px]",
      )}
    >
      {/* Logo */}
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

      {/* Navigation */}
      <nav className="nav-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 py-3">
        <ul className="space-y-0.5">
          {allowedModules.map((module) => {
            // Get icon and label from moduleMap using module name
            const moduleInfo = getModuleInfoByLabel(module.name);
            const Icon = moduleInfo?.icon || HeartPulse;
            const label = moduleInfo?.label || module.name;
            const path = module.route;

            return (
              <li key={module.id}>
                <NavLink
                  to={path}
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
                      {!collapsed && <span className="truncate">{label}</span>}
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div
        className={cn(
          "shrink-0 border-t border-white/8 p-2.5",
          collapsed && "flex flex-col items-center gap-2",
        )}
      >
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
