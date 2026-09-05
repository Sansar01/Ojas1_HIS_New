import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

/* --------------------------------- Button -------------------------------- */

type Variant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "success"
  | "subtle";
type Size = "xs" | "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 shadow-[0_10px_20px_-14px_rgba(13,105,97,.95)] disabled:bg-brand-600/60",
  secondary:
    "bg-ink-900 text-white hover:bg-ink-800 shadow-[0_10px_20px_-14px_rgba(10,23,28,.9)]",
  outline:
    "border border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-25 hover:text-brand-700",
  ghost: "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
  danger:
    "bg-coral-500 text-white hover:bg-coral-600 shadow-[0_10px_20px_-14px_rgba(217,74,74,.9)]",
  success:
    "bg-mint-500 text-white hover:bg-mint-600 shadow-[0_10px_20px_-14px_rgba(31,157,99,.9)]",
  subtle:
    "bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-100",
};

const SIZES: Record<Size, string> = {
  xs: "h-7 px-2.5 text-[12px] gap-1.5 rounded-md",
  sm: "h-8.5 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "h-12 px-6 text-[15px] gap-2.5 rounded-xl",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  block?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      icon,
      iconRight,
      block,
      children,
      disabled,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex cursor-pointer select-none items-center justify-center font-medium transition-all duration-150",
          "active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/25",
          VARIANTS[variant],
          SIZES[size],
          block && "w-full",
          className,
        )}
        {...rest}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : icon ? (
          <span className="[&>svg]:size-4">{icon}</span>
        ) : null}
        {children}
        {iconRight ? <span className="[&>svg]:size-4">{iconRight}</span> : null}
      </button>
    );
  },
);

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: Variant;
  size?: "sm" | "md";
  loading?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { label, variant = "ghost", size = "md", className, loading, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex items-center justify-center rounded-lg transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/25 disabled:opacity-50",
          "[&>svg]:size-4",
          size === "sm" ? "size-8" : "size-9.5",
          VARIANTS[variant],
          className,
        )}
        {...rest}
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : rest.children}
      </button>
    );
  },
);

/* ------------------------------- Status badge ------------------------------ */

export type Tone =
  | "brand"
  | "neutral"
  | "mint"
  | "amber"
  | "coral"
  | "lagoon"
  | "ink";

const TONES: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700 ring-brand-200/70",
  mint: "bg-mint-50 text-mint-600 ring-mint-500/20",
  amber: "bg-amberly-50 text-amberly-600 ring-amberly-500/25",
  coral: "bg-coral-50 text-coral-600 ring-coral-500/20",
  lagoon: "bg-lagoon-50 text-lagoon-600 ring-lagoon-500/20",
  neutral: "bg-ink-50 text-ink-600 ring-ink-200/70",
  ink: "bg-ink-900 text-white ring-ink-900",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  dot,
  size = "sm",
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
  size?: "xs" | "sm";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset whitespace-nowrap",
        size === "xs"
          ? "px-2 py-0.5 text-[10.5px]"
          : "px-2.5 py-1 text-[11.5px]",
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

export const STATUS_TONE: Record<string, Tone> = {
  active: "mint",
  inactive: "neutral",
  Scheduled: "lagoon",
  Confirmed: "brand",
  "Checked In": "amber",
  "In Progress": "amber",
  Completed: "mint",
  Cancelled: "coral",
  "No Show": "neutral",
  Pending: "amber",
  "Partially Paid": "lagoon",
  Paid: "mint",
  Refunded: "coral",
};

export const StatusBadge = ({
  status,
  className,
}: {
  status: string;
  className?: string;
}) => (
  <Badge
    tone={STATUS_TONE[status?.toLowerCase()] ?? "neutral"}
    dot
    className={className}
  >
    {status}
  </Badge>
);

/* ---------------------------------- Avatar --------------------------------- */

export function Avatar({
  name,
  color = "bg-brand-500",
  size = "md",
  className,
  ring,
}: {
  name: string;
  color?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  ring?: boolean;
}) {
  const dims = {
    xs: "size-6 text-[10px]",
    sm: "size-8 text-[11px]",
    md: "size-10 text-[13px]",
    lg: "size-14 text-base",
    xl: "size-20 text-2xl",
  }[size];
  const parts = name.trim().split(/\s+/);
  const text = `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl font-display font-semibold text-white",
        dims,
        color,
        ring && "ring-2 ring-white outline outline-1 outline-ink-100",
        className,
      )}
      aria-hidden
    >
      {text || "•"}
    </span>
  );
}

/* ----------------------------------- Card ---------------------------------- */

export function Panel({
  children,
  className,
  as: As = "section",
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}) {
  return (
    <As
      className={cn(
        "rounded-xl border border-ink-100 bg-white shadow-card",
        className,
      )}
    >
      {children}
    </As>
  );
}

export function PanelHeader({
  title,
  subtitle,
  action,
  icon,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="mt-0.5 grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-600 [&>svg]:size-4.5">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-ink-900">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-400">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

/* --------------------------------- Progress -------------------------------- */

export function Progress({
  value,
  tone = "brand",
  className,
}: {
  value: number;
  tone?: "brand" | "amber" | "coral" | "mint";
  className?: string;
}) {
  const bg = {
    brand: "bg-brand-500",
    amber: "bg-amberly-500",
    coral: "bg-coral-500",
    mint: "bg-mint-500",
  }[tone];
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-ink-100",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-700 ease-out",
          bg,
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function Divider({
  className,
  vertical,
}: {
  className?: string;
  vertical?: boolean;
}) {
  return (
    <div
      className={cn(
        vertical ? "w-px self-stretch" : "h-px w-full",
        "bg-ink-100",
        className,
      )}
    />
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone = "ink",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-400">
        {label}
      </span>
      <span
        className={cn(
          "num text-xl font-semibold",
          tone === "coral"
            ? "text-coral-600"
            : tone === "mint"
              ? "text-mint-600"
              : "text-ink-900",
        )}
      >
        {value}
      </span>
      {hint && <span className="text-[12px] text-ink-400">{hint}</span>}
    </div>
  );
}
