import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RootState } from "@/store/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectUser } from "@/store/slices/authSlice";
import {
  hideLoader,
  pushToast,
  showLoader,
  toast,
  type ToastVariant,
} from "@/store/slices/uiSlice";
import type { Permission } from "@/types";
import { canAccessModule, hasFeature } from "@/utils/permissions";
import { selectPermissionSource } from "@/store/slices/permissionSlice";
import type { Entitlements } from "@/types";

/* ------------------------------ redux plumbing ----------------------------- */
// The generic typed hooks live in `@/store/hooks` — re-exported here so the
// feature hooks below (and older call sites) can share one import.

export { useAppDispatch, useAppSelector, useRootSelector } from "@/store/hooks";

export const useSession = () => useAppSelector((s) => s.auth.session);
export const useCurrentUser = () => useAppSelector(selectUser);
export const useAuthStatus = () => useAppSelector((s) => s.auth.status);

/* ------------------------------ notifications ------------------------------ */

export function useToast() {
  const dispatch = useAppDispatch();
  return useMemo(
    () => ({
      success: (title: string, description?: string) =>
        dispatch(toast.success(title, description)),
      error: (title: string, description?: string) =>
        dispatch(toast.error(title, description)),
      warning: (title: string, description?: string) =>
        dispatch(toast.warning(title, description)),
      info: (title: string, description?: string) =>
        dispatch(toast.info(title, description)),
      push: (payload: {
        title: string;
        description?: string;
        variant?: ToastVariant;
        duration?: number;
      }) => dispatch(pushToast(payload)),
    }),
    [dispatch],
  );
}

export function useLoader() {
  const dispatch = useAppDispatch();
  const visible = useAppSelector((s) => s.ui.loader.count > 0);
  const label = useAppSelector((s) => s.ui.loader.label);
  return {
    visible,
    label,
    show: useCallback(
      (text?: string) => dispatch(showLoader(text)),
      [dispatch],
    ),
    hide: useCallback(() => dispatch(hideLoader()), [dispatch]),
  };
}

/* --------------------------------- RBAC ----------------------------------- */

/* --------------------------------- RBAC ----------------------------------- */

export function usePermission() {
  const user = useCurrentUser();
  // Single runtime source: permissionSlice resolves the effective
  // entitlements (module catalogue + session). auth/session is for
  // authentication only, not permissions.
  const entitlements = useAppSelector(selectPermissionSource);
  const error = useAppSelector((state) => state.modules.error);
  const status = useAppSelector((state) => state.modules.status);
  const sessionEntitlements = useAppSelector(
    (state) => state.auth.session?.entitlements ?? null,
  ) as Entitlements | null;

  const loading = status === "loading";
  // Succeeded ho gaya, ya error aa gayi, ya session me data hai toh ready = true
  const ready =
    status === "succeeded" ||
    status === "failed" ||
    sessionEntitlements !== null;

  const userType =
    user?.userType ??
    (user as any)?.role?.slug ??
    (user as any)?.role?.name ??
    null;

  const can = useCallback(
    (module: string, action: Permission = "view") =>
      canAccessModule(entitlements, module, action),
    [entitlements],
  );

  return {
    user,
    can,
    entitlements,
    loading,
    ready,
    error,
    status,
    hasFeature: (moduleCode: string, featureCode: string) =>
      hasFeature(entitlements, moduleCode, featureCode),
    canView: (m: string) => can(m, "view"),
    canCreate: (m: string) => can(m, "create"),
    canEdit: (m: string) => can(m, "edit"),
    canDelete: (m: string) => can(m, "delete"),
    isSuperAdmin: userType
      ? userType.toUpperCase().replace(/[^A-Z0-9]/g, "") === "SUPERADMIN"
      : false,
    userType,
  };
}

/* ----------------------------- data fetching ------------------------------- */

/** Fetches a slice's collection once per session (and refreshes on `deps`). */
export function useResource<T>(
  fetchThunk: any,
  ...deps: any[]
): {
  items: T[];
  status: RootState["patients"]["status"];
  error: string | null;
  refresh: () => void;
} {
  const dispatch = useAppDispatch();
  const [nonce, setNonce] = useState(0);
  const done = useRef<Set<string>>(new Set());
  const key = String(fetchThunk?.typePrefix ?? "");
  const items = useAppSelector((s: RootState) => {
    const sliceName = key.split("/")[0];
    return ((s as any)[sliceName]?.items ?? []) as T[];
  });
  const status = useAppSelector((s: RootState) => {
    const sliceName = key.split("/")[0];
    return (s as any)[sliceName]?.status ?? "idle";
  });
  const error = useAppSelector(
    (s: RootState) => (s as any)[key.split("/")[0]]?.error ?? null,
  );

  useEffect(() => {
    if (!key) return;
    const token = `${key}:${deps.join("|")}:${nonce}`;
    if (done.current.has(token)) return;
    done.current.add(token);
    dispatch(fetchThunk as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce, ...deps]);

  return { items, status, error, refresh: () => setNonce((n) => n + 1) };
}

/* ---------------------------- table interactions --------------------------- */

export interface TableQuery {
  search: string;
  page: number;
  pageSize: number;
  sortBy: string;
  sortDir: "asc" | "desc";
}

export function useTable<T extends Record<string, any>>(
  rows: T[],
  options: {
    searchFields?: (keyof T | ((row: T) => string))[];
    pageSize?: number;
    filters?: Record<string, string | string[]>;
    sortAccessors?: Record<string, (row: T) => string | number>;
  } = {},
) {
  const [query, setQuery] = useState<TableQuery>({
    search: "",
    page: 1,
    pageSize: options.pageSize ?? 8,
    sortBy: "",
    sortDir: "desc",
  });

  const filtered = useMemo(() => {
    const search = query.search.trim().toLowerCase();
    let out = rows;
    if (search && options.searchFields?.length) {
      out = out.filter((row) =>
        options.searchFields!.some((field) => {
          const value = typeof field === "function" ? field(row) : row[field];
          return String(value ?? "")
            .toLowerCase()
            .includes(search);
        }),
      );
    }
    const activeFilters = Object.entries(options.filters ?? {}).filter(
      ([, v]) => v && (Array.isArray(v) ? !v.includes("all") : v !== "all"),
    );
    if (activeFilters.length) {
      out = out.filter((row) =>
        activeFilters.every(([key, value]) => {
          const cell = (row as any)[key];
          const values = Array.isArray(value) ? value : [value];
          if (Array.isArray(cell))
            return values.some((filterValue) => cell.includes(filterValue));
          return values.some(
            (filterValue) =>
              String(cell ?? "").toLowerCase() ===
              String(filterValue).toLowerCase(),
          );
        }),
      );
    }
    if (query.sortBy) {
      const accessor =
        options.sortAccessors?.[query.sortBy] ??
        ((row: T) => row[query.sortBy as keyof T]);
      const dir = query.sortDir === "asc" ? 1 : -1;
      out = [...out].sort((a, b) => {
        const av = accessor(a) as any;
        const bv = accessor(b) as any;
        if (av === bv) return 0;
        if (typeof av === "number" && typeof bv === "number")
          return (av - bv) * dir;
        return (
          String(av ?? "").localeCompare(String(bv ?? ""), undefined, {
            numeric: true,
          }) * dir
        );
      });
    }
    return out;
  }, [rows, query.search, query.sortBy, query.sortDir, options]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, pageCount);
  const paged = filtered.slice(
    (page - 1) * query.pageSize,
    page * query.pageSize,
  );

  return {
    rows: paged,
    allRows: filtered,
    total,
    page,
    pageCount,
    pageSize: query.pageSize,
    query,
    setSearch: (search: string) => setQuery((q) => ({ ...q, search, page: 1 })),
    setPage: (p: number) => setQuery((q) => ({ ...q, page: Math.max(1, p) })),
    setPageSize: (size: number) =>
      setQuery((q) => ({ ...q, pageSize: size, page: 1 })),
    toggleSort: (column: string) =>
      setQuery((q) => ({
        ...q,
        sortBy: column,
        sortDir: q.sortBy === column && q.sortDir === "desc" ? "asc" : "desc",
        page: 1,
      })),
    reset: () => setQuery((q) => ({ ...q, search: "", page: 1 })),
  };
}

/* -------------------------------- utilities -------------------------------- */

export function useDebounced<T>(value: T, delay = 280) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · OJAS1 Hospital Management Portal`;
  }, [title]);
}

/** Auto-collapse the sidebar on medium screens, expand on wide. */
// export function useSidebarSync(setCollapsed: (v: boolean) => void) {
//   const location = useLocation();
//   useEffect(() => {
//     const apply = () => setCollapsed(window.innerWidth < 1280);
//     apply();
//     window.addEventListener("resize", apply);
//     return () => window.removeEventListener("resize", apply);
//   }, [setCollapsed, location.pathname]);
// }
export function useSidebarSync(setCollapsed: (v: boolean) => void) {
  useEffect(() => {
    const apply = () => {
      if (window.innerWidth < 1280) {
        setCollapsed(true);
      }
    };
    apply(); // only on mount
    // Remove resize listener if you don't want it to auto-collapse on resize
  }, []);
}
