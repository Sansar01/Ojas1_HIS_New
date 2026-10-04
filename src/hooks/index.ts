import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppSelector } from "@/store/hooks";
import { selectUser } from "@/store/slices/authSlice";
import type { Permission } from "@/types";
import { canAccessModule, hasFeature } from "@/utils/permissions";
import { selectPermissionSource } from "@/store/slices/permissionSlice";
import type { Entitlements } from "@/types";

/* ------------------------------ redux plumbing ----------------------------- */
// The generic typed hooks live in `@/store/hooks` — re-exported here so the
// feature hooks below (and older call sites) can share one import.

export { useAppDispatch, useAppSelector, useRootSelector } from "@/store/hooks";

/* ----------------------- feature data (local state) ------------------------ */
// Pages own their data: they call their feature service inside a plain
// try/catch and keep the result in local state. There is no generic API hook
// and no shared cache here — only the debounce helper for API-backed inputs.

export { useDebouncedValue } from "./useDebouncedValue";

export const useCurrentUser = () => useAppSelector(selectUser);
export const useAuthStatus = () => useAppSelector((s) => s.auth.status);

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

/* ---------------------------- table interactions --------------------------- */

interface TableQuery {
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

/** Auto-collapse the sidebar on medium screens. */
export function useSidebarSync(setCollapsed: (v: boolean) => void) {
  useEffect(() => {
    const apply = () => {
      if (window.innerWidth < 1280) {
        setCollapsed(true);
      }
    };
    apply(); // mount only — resizing must not fight the user's toggle
  }, []);
}
