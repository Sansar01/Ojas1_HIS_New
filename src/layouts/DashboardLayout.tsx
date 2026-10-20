import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { cn } from "@/utils/cn";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useSidebarSync } from "@/hooks";
import { setMobileNav, setSidebar } from "@/store/slices/uiSlice";
import { Sidebar } from "@/components/layout/Sidebar";
import { GlobalSearch, Header } from "@/components/layout/Header";
import {
  DashboardSkeleton,
  LoaderOverlay,
  PageSkeleton,
} from "@/components/ui/feedback";
import { createPortal } from "react-dom";

export function DashboardLayout() {
  const dispatch = useAppDispatch();
  const collapsed = useAppSelector((s) => s.ui.sidebarCollapsed);
  const mobileNavOpen = useAppSelector((s) => s.ui.mobileNavOpen);
  const [searchOpen, setSearchOpen] = useState(false);

  /**
   * Stable handlers for the shell. The header is memoized (it renders a lot of
   * small nodes and owns a 30s clock), so an inline arrow here would hand it a
   * new prop on every layout render — a collapsed sidebar toggle would then
   * re-render the whole top bar for nothing.
   */
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const syncSidebar = useCallback(
    (v: boolean) => dispatch(setSidebar(v)),
    [dispatch],
  );

  useSidebarSync(syncSidebar);

  // `main` is the one scroller and it outlives every page, so without this the
  // next page opens at the previous page's scroll offset.
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  /**
   * The dashboard is a lazy chunk AND it loads its own data, so it has two
   * loading moments. Both must show the same skeleton: if the Suspense
   * fallback were the generic `PageSkeleton` (title line + list rows), the page
   * would paint a line skeleton and then swap to its banner/KPI skeleton.
   * Every other route keeps the generic fallback.
   */
  const isDashboard = pathname === "/dashboard";
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);
  // The shell owns no page data (API/Redux strategy): every page fetches what
  // it renders through its own feature service, when it renders. The header's
  // refresh action simply re-mounts/reloads the active page.

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
              className="absolute inset-0 bg-ink-950/55 animate-fade-in"
              onClick={() => dispatch(setMobileNav(false))}
            />
            <div className="absolute inset-y-0 left-0 w-[262px] animate-slide-in">
              <Sidebar collapsed={false} />
            </div>
          </div>,
          document.body,
        )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenSearch={openSearch} />
        <main
          id="main"
          ref={mainRef}
          className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-12 pt-4 [overflow-anchor:auto] [scrollbar-gutter:stable] sm:px-5 lg:px-6"
          style={
            {
              willChange: "transform",
              transform: "translateZ(0)",
              "-webkit-overflow-scrolling": "touch",
            } as React.CSSProperties
          }
        >
          <div className="mx-auto w-full max-w-[1600px]">
            {/* a lazy page suspends here, so the sidebar and header stay put */}
            <Suspense
              fallback={
                isDashboard ? (
                  <div
                    className="space-y-4"
                    role="status"
                    aria-label="Loading dashboard"
                  >
                    <DashboardSkeleton />
                  </div>
                ) : (
                  <PageSkeleton />
                )
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      <LoaderOverlay />
      <GlobalSearch open={searchOpen} onClose={closeSearch} />
    </div>
  );
}
