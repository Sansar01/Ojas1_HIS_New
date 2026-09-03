import * as React from "react";
import { useEffect } from "react";
import {
  AlertTriangle,
  ArchiveX,
  CheckCircle2,
  Info,
  RefreshCw,
  SearchX,
  X,
  XCircle,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useAppDispatch } from "@/hooks";
import { dismissToast, type Toast } from "@/features/ui/uiSlice";
import { Button } from "@/components/ui/primitives";
import { ShieldAlert } from "lucide-react";

/* ------------------------------- Skeletons --------------------------------- */

export const Skeleton = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "animate-pulse-soft rounded-md bg-gradient-to-r from-ink-100 via-ink-50 to-ink-100",
      className,
    )}
  />
);

export function TableSkeleton({
  rows = 6,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="divide-y divide-ink-100">
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid items-center gap-4 px-4 py-3.5"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
        >
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton
              key={c}
              className={cn(
                "h-4",
                c === 0 ? "w-3/4" : c === cols - 1 ? "w-10" : "w-2/3",
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-ink-100 bg-white p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
          <Skeleton className="mt-4 h-7 w-28" />
          <Skeleton className="mt-3 h-2.5 w-full" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Empty / errors ------------------------------ */

export function EmptyState({
  title,
  description,
  icon,
  action,
  compact,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 text-center",
        compact ? "py-10" : "py-16",
      )}
    >
      <span className="relative grid size-14 place-items-center rounded-2xl bg-brand-25 text-brand-500 ring-1 ring-brand-100">
        <span className="absolute inset-0 rounded-2xl bg-brand-100/50 blur-md" />
        <span className="relative [&>svg]:size-6">{icon ?? <SearchX />}</span>
      </span>
      <p className="mt-4 font-display text-[15px] font-semibold text-ink-800">
        {title}
      </p>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-400">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>
      )}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  compact,
}: {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-coral-500/20 bg-coral-50/50 text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
      )}
    >
      <span className="grid size-11 place-items-center rounded-xl bg-white text-coral-500 shadow-sm ring-1 ring-coral-500/20">
        <AlertTriangle className="size-5" />
      </span>
      <p className="mt-3 font-display text-[15px] font-semibold text-ink-900">
        Something went wrong
      </p>
      <p className="mt-1 max-w-md text-[13px] leading-relaxed text-ink-500">
        {message ??
          "The request could not be completed. Please retry or contact support."}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          icon={<RefreshCw />}
          onClick={onRetry}
        >
          Retry request
        </Button>
      )}
    </div>
  );
}

export function ForbiddenState({ module }: { module?: string }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-coral-50 text-coral-500 ring-1 ring-coral-500/20">
          <ShieldAlert className="size-7" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink-900">
          Access restricted
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">
          Your role does not include the{" "}
          {module ? (
            <strong className="text-ink-700">{module}</strong>
          ) : (
            "requested"
          )}{" "}
          module. Ask a Super Admin to grant
          <em className="not-italic text-brand-700"> View </em> access, then
          sign in again.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------- Spinner ----------------------------------- */

export function Spinner({
  className,
  size = 18,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn(
        "inline-block animate-ring rounded-full border-2 border-current border-t-transparent",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}

/* ------------------------------ Global loader ------------------------------- */

export function LoaderOverlay({
  visible,
  label,
}: {
  visible: boolean;
  label?: string | null;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[90] flex items-center justify-center bg-ink-950/25 backdrop-blur-[1px] transition-opacity duration-200",
        visible
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0",
      )}
      aria-live="polite"
      aria-busy={visible}
    >
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border border-ink-100 bg-white/95 px-4 py-3 shadow-pop transition-transform",
          visible ? "scale-100" : "scale-95",
        )}
      >
        <span className="relative grid size-8 place-items-center">
          <Spinner className="text-brand-600" size={26} />
        </span>
        <span className="text-[13px] font-medium text-ink-700">
          {label ?? "Working…"}
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------- Toasts ---------------------------------- */

const TOAST_STYLE: Record<
  Toast["variant"],
  { ring: string; icon: React.ReactNode; bar: string }
> = {
  success: {
    ring: "ring-mint-500/25",
    icon: <CheckCircle2 className="size-5 text-mint-500" />,
    bar: "bg-mint-500",
  },
  error: {
    ring: "ring-coral-500/25",
    icon: <XCircle className="size-5 text-coral-500" />,
    bar: "bg-coral-500",
  },
  warning: {
    ring: "ring-amberly-500/30",
    icon: <AlertTriangle className="size-5 text-amberly-500" />,
    bar: "bg-amberly-500",
  },
  info: {
    ring: "ring-brand-500/25",
    icon: <Info className="size-5 text-brand-500" />,
    bar: "bg-brand-500",
  },
};

function ToastCard({ toast }: { toast: Toast }) {
  const dispatch = useAppDispatch();
  const style = TOAST_STYLE[toast.variant];

  useEffect(() => {
    const t = setTimeout(
      () => dispatch(dismissToast(toast.id)),
      toast.duration,
    );
    return () => clearTimeout(t);
  }, [dispatch, toast.id, toast.duration]);

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto relative w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-ink-100 bg-white/97 pl-3.5 pr-3 py-3 shadow-pop ring-1 animate-fade-up backdrop-blur",
        style.ring,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{style.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold leading-snug text-ink-900">
            {toast.title}
          </p>
          {toast.description && (
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">
              {toast.description}
            </p>
          )}
        </div>
        <button
          onClick={() => dispatch(dismissToast(toast.id))}
          aria-label="Dismiss notification"
          className="-mr-1 -mt-1 rounded-md p-1 text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-700"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <span
        className={cn("absolute bottom-0 left-0 h-0.5 origin-left", style.bar)}
        style={{
          animation: `bar ${toast.duration}ms linear forwards`,
          width: "30%",
        }}
      />
    </div>
  );
}

export function ToastHost({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[95] flex flex-col items-end gap-2.5 p-4 sm:inset-x-auto sm:right-4 sm:top-0 sm:bottom-auto sm:items-end sm:p-5">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  );
}

/** Inline banner used inside forms & detail panels. */
export function Banner({
  tone = "brand",
  title,
  children,
  action,
  className,
}: {
  tone?: "brand" | "warn" | "danger" | "info";
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const tones = {
    brand: "border-brand-100 bg-brand-25 text-brand-800",
    warn: "border-amberly-500/25 bg-amberly-50 text-amberly-600",
    danger: "border-coral-500/20 bg-coral-50 text-coral-600",
    info: "border-lagoon-500/20 bg-lagoon-50 text-lagoon-600",
  }[tone];
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-3",
        tones,
        className,
      )}
    >
      <div className="min-w-0 text-[12.5px] leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
      {action}
    </div>
  );
}

export const NoResults = ArchiveX;
