import { useState } from "react";
import { Outlet } from "react-router-dom";
import { cn } from "@/utils/cn";
import { useAppDispatch, useRootSelector, useSidebarSync } from "@/hooks";
import { setMobileNav, setSidebar } from "@/features/ui/uiSlice";
import { bootstrapResources } from "@/store";
import { useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { GlobalSearch, Header } from "@/components/layout/Header";
import { LoaderOverlay } from "@/components/ui/feedback";
import { createPortal } from "react-dom";

export function DashboardLayout() {
  const dispatch = useAppDispatch();
  const collapsed = useRootSelector((s) => s.ui.sidebarCollapsed);
  const mobileNavOpen = useRootSelector((s) => s.ui.mobileNavOpen);
  const loaderCount = useRootSelector((s) => s.ui.loader.count);
  const loaderLabel = useRootSelector((s) => s.ui.loader.label);
  const [searchOpen, setSearchOpen] = useState(false);

  useSidebarSync((v) => dispatch(setSidebar(v)));
  useEffect(() => {
    dispatch(bootstrapResources() as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  return (
    <div className="app-grid-bg flex h-screen overflow-hidden bg-ink-25 text-ink-800">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-[13px]"
      >
        Skip to content
      </a>

      <div
        className={cn(
          "hidden h-full lg:block",
          collapsed ? "lg:w-[78px]" : "lg:w-[262px]",
        )}
      >
        <Sidebar collapsed={collapsed} />
      </div>

      {mobileNavOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px] animate-fade-in"
              onClick={() => dispatch(setMobileNav(false))}
            />
            <div className="absolute inset-y-0 left-0 w-[262px] animate-slide-in">
              <Sidebar collapsed={false} />
            </div>
          </div>,
          document.body,
        )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenSearch={() => setSearchOpen(true)} />
        <main
          id="main"
          className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-12 pt-4 sm:px-5 lg:px-6"
        >
          <div className="mx-auto w-full max-w-[1600px]">
            {/* inline (non-modal) create/edit forms are mounted here */}
            <div id="portal-form" />
            <Outlet />
          </div>
        </main>
      </div>

      <LoaderOverlay visible={loaderCount > 0} label={loaderLabel} />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
