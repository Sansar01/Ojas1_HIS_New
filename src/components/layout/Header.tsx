import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronRight,
  ExternalLink,
  LifeBuoy,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { MODULES, APP_NAME } from "@/constants";
import { useAppDispatch, useCurrentUser, useRootSelector } from "@/hooks";
import { setMobileNav } from "@/features/ui/uiSlice";
import { bootstrapResources } from "@/store";
import { Badge, Button, IconButton } from "@/components/ui/primitives";
import {
  DropdownMenu,
  MenuLabel,
  MenuItem,
  Tooltip,
  menuItemClass,
} from "@/components/ui/overlays";
import { Avatar } from "@/components/ui/primitives";
import { relativeTime } from "@/utils";
import { logoutUser } from "@/features/auth/authSlice";
import { usePermission } from "@/hooks";

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function Header({ onOpenSearch }: { onOpenSearch: () => void }) {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const activities = useRootSelector((s) => s.activities.items);
  const { isSuperAdmin } = usePermission();
  const now = useClock();

  const trail = useMemo(() => {
    const segments = location.pathname.split("/").filter(Boolean);
    const trail: { label: string; to: string }[] = [
      { label: "Portal", to: "/dashboard" },
    ];
    let path = "";
    segments.forEach((seg) => {
      path += `/${seg}`;
      const module = MODULES.find((m) => m.path === path);
      if (module) trail.push({ label: module.label, to: module.path });
      else if (seg !== "app")
        trail.push({ label: labelFromSegment(seg), to: path });
    });
    return trail;
  }, [location.pathname]);

  const pageTitle = trail[trail.length - 1]?.label ?? "Dashboard";
  const unread = activities.slice(0, 6);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-ink-100 bg-white/88 px-3 backdrop-blur-md sm:px-5">
      <IconButton
        label="Open navigation"
        className="lg:hidden"
        variant="ghost"
        onClick={() => dispatch(setMobileNav(true))}
      >
        <Menu />
      </IconButton>

      <div className="min-w-0 flex-1">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-[11.5px] font-medium text-ink-400"
        >
          {/* {trail.map((crumb, i) => (
            <span key={crumb.to} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3 opacity-60" />}
              {i === trail.length - 1 ? (
                <span className="text-ink-600">{crumb.label}</span>
              ) : (
                <Link
                  to={crumb.to}
                  className="transition-colors hover:text-brand-600"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          ))} */}
        </nav>
        <h1 className="mt-0.5 truncate font-display text-[19px] font-semibold leading-tight text-ink-900">
          {pageTitle}
        </h1>
      </div>

      <button
        onClick={onOpenSearch}
        className="group hidden h-9.5 w-64 items-center gap-2 rounded-lg border border-ink-200 bg-ink-25/80 px-3 text-left text-[12.5px] text-ink-400 transition-all hover:border-brand-300 hover:bg-white md:flex xl:w-80"
      >
        <Search className="size-4 transition-colors group-hover:text-brand-600" />
        <span className="flex-1 truncate">
          Find patients, doctors, invoices…
        </span>
        <kbd className="num rounded border border-ink-200 bg-white px-1 py-0.5 text-[10px] font-semibold text-ink-500">
          /
        </kbd>
      </button>

      <div className="hidden items-center gap-2 xl:flex">
        <Tooltip
          content={`Server time · ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · data refreshed on sign-in`}
        >
          <span className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-ink-500">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-2 animate-ping rounded-full bg-mint-500/70" />
              <span className="relative inline-flex size-2 rounded-full bg-mint-500" />
            </span>
            {now.toLocaleDateString("en-GB", {
              weekday: "short",
              day: "2-digit",
              month: "short",
            })}
          </span>
        </Tooltip>
      </div>

      <IconButton
        label="Refresh data"
        variant="ghost"
        onClick={() => dispatch(bootstrapResources() as any)}
      >
        <RefreshCw />
      </IconButton>

      <DropdownMenu
        align="end"
        trigger={
          <button
            className="relative grid size-9.5 place-items-center rounded-lg text-ink-600 transition-colors hover:bg-ink-50"
            aria-label="Notifications"
          >
            <Bell className="size-4.5" />
            {unread.length > 0 && (
              <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-coral-500 px-1 text-[9.5px] font-bold text-white">
                {unread.length}
              </span>
            )}
          </button>
        }
      >
        <MenuLabel>Recent activity</MenuLabel>
        <div className="max-h-80 w-80 overflow-y-auto">
          {unread.length === 0 && (
            <p className="px-2.5 py-6 text-center text-[12.5px] text-ink-400">
              No new notifications
            </p>
          )}
          {unread.map((a: any) => (
            <MenuItem
              key={a.id}
              onSelect={() => navigate("/dashboard")}
              className={cn(menuItemClass(), "items-start")}
            >
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-400" />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium leading-snug text-ink-700">
                  {a.userName} {a.action}{" "}
                  <span className="text-brand-700">{a.entityName}</span>
                </span>
                <span className="mt-0.5 block text-[11px] text-ink-400">
                  {a.entity} · {relativeTime(a.at)}
                </span>
              </span>
            </MenuItem>
          ))}
        </div>
        <div className="mt-1 border-t border-ink-100 pt-1.5">
          <Link to="/dashboard" className={cn(menuItemClass(), "w-full")}>
            <ExternalLink className="size-4" /> Open activity feed
          </Link>
        </div>
      </DropdownMenu>

      <DropdownMenu
        align="end"
        trigger={
          <button
            className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-ink-50"
            aria-label="Account menu"
          >
            <Avatar
              name={`${user?.firstName} ${user?.lastName}`}
              color={user?.color}
              size="sm"
            />
            <span className="hidden text-left leading-tight lg:block">
              <span className="block text-[12.5px] font-semibold text-ink-800">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="block text-[10.5px] text-ink-400">
                {user?.role}
              </span>
            </span>
            <ChevronRight className="hidden size-3.5 rotate-90 text-ink-400 lg:block" />
          </button>
        }
      >
        <div className="border-b border-ink-100 px-2.5 pb-2.5 pt-1">
          <p className="text-[13px] font-semibold text-ink-900">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="mt-0.5 truncate text-[11.5px] text-ink-400">
            {user?.email}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="brand" size="xs">
              {user?.role}
            </Badge>
            {isSuperAdmin && (
              <Badge tone="ink" size="xs">
                Full control
              </Badge>
            )}
            <Badge
              tone={user?.status === "active" ? "mint" : "neutral"}
              size="xs"
              dot
            >
              {user?.status}
            </Badge>
          </div>
        </div>
        <div className="pt-1.5">
          <MenuItem
            onSelect={() => navigate("/app/settings")}
            className={menuItemClass()}
          >
            <UserRound className="size-4" /> Profile & facility
          </MenuItem>
          <MenuItem
            onSelect={() => dispatch(bootstrapResources() as any)}
            className={menuItemClass()}
          >
            <LifeBuoy className="size-4" /> Sync portal data
          </MenuItem>
          <MenuItem
            onSelect={async () => {
              await dispatch(logoutUser()).unwrap();
              window.setTimeout(
                () => navigate("/accounts/login", { replace: true }),
                3000,
              );
            }}
            className={cn(menuItemClass("danger"), "border-t border-ink-100")}
          >
            <LogOut className="size-4" /> Sign out
          </MenuItem>
        </div>
      </DropdownMenu>
      <span className="sr-only">{APP_NAME}</span>
    </header>
  );
}

const labelFromSegment = (seg: string) =>
  seg.length > 18
    ? `${seg.slice(0, 18)}…`
    : /^[a-z]{2,4}_?\d*$/i.test(seg)
      ? "Record"
      : seg.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function GlobalSearch({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [term, setTerm] = useState("");
  const navigate = useNavigate();
  const patients = useRootSelector((s) => s.patients.items);
  const doctors = useRootSelector((s) => s.doctors.items);
  const invoices = useRootSelector((s) => s.invoices.items);
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    if (!term.trim()) return setResults([]);
    const q = term.toLowerCase();
    const out: any[] = [];
    patients
      .filter((p: any) =>
        `${p.firstName} ${p.lastName} ${p.mrn}`.toLowerCase().includes(q),
      )
      .slice(0, 4)
      .forEach((p: any) =>
        out.push({
          label: `${p.firstName} ${p.lastName}`,
          meta: `Patient · ${p.mrn}`,
          to: `/app/patients/${p.id}`,
        }),
      );
    doctors
      .filter((d: any) =>
        `${d.firstName} ${d.lastName}`.toLowerCase().includes(q),
      )
      .slice(0, 4)
      .forEach((d: any) =>
        out.push({
          label: `Dr. ${d.firstName} ${d.lastName}`,
          meta: `Doctor · ${d.registrationNumber}`,
          to: `/app/doctors/${d.id}`,
        }),
      );
    invoices
      .filter((i: any) => i.number.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((i: any) =>
        out.push({
          label: i.number,
          meta: `Invoice · ${i.paymentStatus}`,
          to: `/app/billing?invoice=${i.id}`,
        }),
      );
    setResults(out);
  }, [term, patients, doctors, invoices]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !open &&
        (e.target as HTMLElement)?.tagName !== "INPUT" &&
        (e.target as HTMLElement)?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-start justify-center bg-ink-950/45 p-4 pt-[12vh] backdrop-blur-[2px] animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-pop animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3">
          <Search className="size-4 text-ink-400" />
          <input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search patients, doctors, invoices…"
            className="flex-1 bg-transparent text-[14px] text-ink-800 focus:outline-none"
          />
          <Button size="xs" variant="ghost" onClick={onClose}>
            ESC
          </Button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {term && results.length === 0 && (
            <p className="px-3 py-8 text-center text-[13px] text-ink-400">
              No matches for “{term}”
            </p>
          )}
          {!term && (
            <p className="px-3 py-8 text-center text-[13px] text-ink-400">
              Type at least two characters to search the hospital directory.
            </p>
          )}
          {results.map((r) => (
            <button
              key={r.to}
              onClick={() => {
                navigate(r.to);
                onClose();
              }}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-brand-25"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-medium text-ink-800">
                  {r.label}
                </span>
                <span className="block truncate text-[11.5px] text-ink-400">
                  {r.meta}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-ink-300" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
