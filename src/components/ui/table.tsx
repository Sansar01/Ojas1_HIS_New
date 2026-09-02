import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsLeft, ChevronsRight, ChevronsUpDown, MoreHorizontal, Search, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button, IconButton } from "@/components/ui/primitives";
import { EmptyState, ErrorState, TableSkeleton, Skeleton } from "@/components/ui/feedback";
import { DropdownMenu, MenuItem, menuItemClass } from "@/components/ui/overlays";
import { PAGE_SIZES } from "@/constants";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
  hideBelow?: "sm" | "md" | "lg" | "xl";
  width?: string;
}

const HIDE: Record<string, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  status?: "idle" | "loading" | "ready" | "error";
  error?: string | null;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  sort?: { sortBy: string; sortDir: "asc" | "desc"; onSort: (key: string) => void };
  actions?: (row: T) => React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  dense?: boolean;
  rowKey?: (row: T, i: number) => string;
  clickRowHint?: boolean;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  status = "ready",
  error,
  onRetry,
  onRowClick,
  sort,
  actions,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  header,
  footer,
  dense,
  rowKey,
  clickRowHint = true,
}: DataTableProps<T>) {
  const loading = status === "loading" || status === "idle";
  const hasFilters = rows.length > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card">
      {header}
      {status === "error" ? (
        <ErrorState message={error ?? undefined} onRetry={onRetry} compact />
      ) : loading ? (
        <div>
          <div className="flex gap-3 border-b border-ink-100 bg-ink-25/60 px-4 py-2.5">
            {columns.slice(0, 4).map((c) => (
              <Skeleton key={c.key} className="h-3 w-24" />
            ))}
          </div>
          <TableSkeleton rows={6} cols={columns.length + (actions ? 1 : 0)} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No matching records" : emptyTitle}
          description={hasFilters ? "Try adjusting search text or clearing active filters." : emptyDescription}
          action={emptyAction}
        />
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <thead>
              <tr className="bg-ink-25/70 text-[11px] uppercase tracking-[0.11em] text-ink-500">
                {columns.map((col) => {
                  const active = sort?.sortBy === col.key;
                  return (
                    <th
                      key={col.key}
                      className={cn(
                        "border-b border-ink-100 px-4 py-2.5 font-semibold whitespace-nowrap",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        col.hideBelow && HIDE[col.hideBelow],
                        col.width,
                      )}
                    >
                      {col.sortable && sort ? (
                        <button
                          type="button"
                          onClick={() => sort.onSort(col.key)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded transition-colors hover:text-brand-700",
                            active && "text-brand-700",
                            col.align === "right" && "flex-row-reverse",
                          )}
                        >
                          {col.header}
                          {active ? (
                            sort.sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                          ) : (
                            <ChevronsUpDown className="size-3 opacity-45" />
                          )}
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  );
                })}
                {actions && <th className="w-16 border-b border-ink-100 px-4 py-2.5 text-right font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((row, index) => (
                <tr
                  key={rowKey ? rowKey(row, index) : String(row.id ?? index)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "group transition-colors",
                    onRowClick && clickRowHint && "cursor-pointer hover:bg-brand-25/60",
                    !onRowClick && "hover:bg-ink-25/70",
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        dense ? "px-4 py-2" : "px-4 py-3",
                        "text-[13px] align-middle text-ink-700",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        col.hideBelow && HIDE[col.hideBelow],
                        col.className,
                      )}
                    >
                      {col.render ? col.render(row, index) : String(row[col.key] ?? "—")}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {footer && <div className="border-t border-ink-100 bg-white">{footer}</div>}
    </div>
  );
}

/** Compact ⋯ menu for row actions (permission-aware entries are filtered upstream). */
export function RowActions({
  items,
  className,
}: {
  items: { label: string; icon?: React.ReactNode; onClick: () => void; tone?: "danger" | "brand"; hidden?: boolean }[];
  className?: string;
}) {
  const visible = items.filter((i) => !i.hidden);
  if (!visible.length) return <span className="text-[12px] text-ink-300">—</span>;
  return (
    <div className={cn("flex items-center justify-end gap-1", className)}>
      {visible.slice(0, 2).map((item) => (
        <IconButton key={item.label} label={item.label} size="sm" variant="ghost" onClick={item.onClick} className={cn(item.tone === "danger" && "text-coral-600 hover:bg-coral-50 [&>svg]:size-3.5")}>
          {item.icon}
        </IconButton>
      ))}
      {visible.length > 2 && (
        <DropdownMenu
          trigger={
            <IconButton label="More actions" size="sm" variant="ghost">
              <MoreHorizontal />
            </IconButton>
          }
        >
          {visible.slice(2).map((item) => (
            <MenuItem key={item.label} onSelect={item.onClick} className={menuItemClass(item.tone)}>
              {item.icon}
              {item.label}
            </MenuItem>
          ))}
        </DropdownMenu>
      )}
    </div>
  );
}

/* ------------------------------- Pagination -------------------------------- */

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
  onPageSize,
  label = "records",
  loading,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize?: (s: number) => void;
  label?: string;
  loading?: boolean;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const numbers: number[] = [];
  const push = (n: number) => !numbers.includes(n) && n >= 1 && n <= pageCount && numbers.push(n);
  push(1);
  for (let i = page - 1; i <= page + 1; i++) push(i);
  push(pageCount);
  numbers.sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-3 border-t border-ink-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 text-[12.5px] text-ink-500">
        {loading ? (
          <Skeleton className="h-3.5 w-40" />
        ) : (
          <span>
            Showing <span className="num font-semibold text-ink-800">{from}</span>–<span className="num font-semibold text-ink-800">{to}</span> of{" "}
            <span className="num font-semibold text-ink-800">{total}</span> {label}
          </span>
        )}
        {onPageSize && (
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="num h-8 rounded-lg border border-ink-200 bg-white px-2 text-[12px] font-medium text-ink-600 transition-colors hover:border-brand-300 focus:outline-none focus:ring-4 focus:ring-brand-500/20"
            aria-label="Rows per page"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} / page
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1">
        <IconButton label="First page" size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(1)}>
          <ChevronsLeft />
        </IconButton>
        {numbers.map((n, i) => (
          <React.Fragment key={n}>
            {i > 0 && n - numbers[i - 1] > 1 && <span className="px-1 text-ink-300">…</span>}
            <button
              onClick={() => onPage(n)}
              className={cn(
                "num size-8 rounded-lg text-[12.5px] font-semibold transition-all",
                n === page ? "bg-brand-600 text-white shadow-[0_8px_16px_-10px_rgba(13,105,97,.9)]" : "text-ink-600 hover:bg-ink-50",
              )}
            >
              {n}
            </button>
          </React.Fragment>
        ))}
        <IconButton label="Last page" size="sm" variant="outline" disabled={page >= pageCount} onClick={() => onPage(pageCount)}>
          <ChevronsRight />
        </IconButton>
      </div>
    </div>
  );
}

/* --------------------------------- Toolbar ---------------------------------- */

export function TableToolbar({
  search,
  onSearch,
  searchPlaceholder,
  filters,
  actions,
  className,
}: {
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2.5 border-b border-ink-100 bg-white px-4 py-3", className)}>
      <div className="relative min-w-[12rem] flex-1 sm:max-w-[19rem]">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={searchPlaceholder ?? "Search…"}
          className="h-9.5 w-full rounded-lg border border-ink-200 bg-white pl-9 pr-8 text-[13px] text-ink-700 transition-colors hover:border-ink-300 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/20"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearch("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {filters}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export const ToolbarGhostButton = (props: React.ComponentProps<typeof Button>) => <Button variant="outline" size="sm" {...props} />;
