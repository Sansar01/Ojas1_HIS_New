import * as React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button, Panel, PanelHeader } from "@/components/ui/primitives";
import { usePermission } from "@/hooks";
export { Emptyish } from "./Emptyish";
export { PrescriptionPrintPreview } from "./PrescriptionPrintPreview";

/* ------------------------------- page header ------------------------------- */

export function PageIntro({
  title,
  description,
  module,
  actions,
  onCreate,
  createLabel = "Add record",
  meta,
  back,
}: {
  title: string;
  description?: string;
  /** module key exactly as the entitlements API spells it */
  module?: string;
  actions?: React.ReactNode;
  onCreate?: () => void;
  createLabel?: string;
  meta?: React.ReactNode;
  back?: boolean;
  cancelLabel?: string;
}) {
  const navigate = useNavigate();
  const { canCreate } = usePermission();
  return (
    <div className="mb-4">
      {back && (
        <button
          onClick={() => navigate(-1)}
          className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-500 transition-colors hover:text-brand-600"
        >
          <ArrowLeft className="size-3.5" /> Back
        </button>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[24px] font-bold leading-tight tracking-tight text-ink-900">
            {title}
          </h2>
          {description && (
            <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-ink-400">
              {description}
            </p>
          )}
          {meta && (
            <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {module && onCreate && canCreate(module) && (
            <Button icon={<PlusIcon />} onClick={onCreate}>
              {createLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const PlusIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="size-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/* ------------------------------- description ------------------------------- */

export function DetailGrid({
  items,
  columns = 3,
  className,
}: {
  items: { label: string; value: React.ReactNode; span?: number }[];
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-5 gap-y-4",
        columns === 1 && "grid-cols-1",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-ink-400">
            {item.label}
          </dt>
          <dd className="mt-1 text-[13.5px] font-medium leading-snug text-ink-800">
            {item.value ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function MiniList({
  rows,
  emptyLabel = "No records yet",
}: {
  rows: {
    title: React.ReactNode;
    meta?: React.ReactNode;
    right?: React.ReactNode;
    onClick?: () => void;
    tone?: string;
  }[];
  emptyLabel?: string;
}) {
  if (!rows.length)
    return (
      <p className="px-4 py-6 text-center text-[12.5px] text-ink-400">
        {emptyLabel}
      </p>
    );
  return (
    <ul className="divide-y divide-ink-100">
      {rows.map((row, i) => (
        <li
          key={i}
          onClick={row.onClick}
          className={cn(
            "flex items-center justify-between gap-3 px-4 py-2.5 transition-colors",
            row.onClick && "cursor-pointer hover:bg-brand-25/60",
          )}
        >
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-ink-800">
              {row.title}
            </span>
            {row.meta && (
              <span className="mt-0.5 block truncate text-[11.5px] text-ink-400">
                {row.meta}
              </span>
            )}
          </span>
          {row.right}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------ misc sections ------------------------------- */

export function StatStrip({
  items,
}: {
  items: { label: string; value: React.ReactNode; tone?: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-ink-100 bg-ink-100 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="bg-white px-4 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-ink-400">
            {i.label}
          </p>
          <p
            className={cn(
              "num mt-1 text-[18px] font-semibold text-ink-900",
              i.tone,
            )}
          >
            {i.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function SectionPanel({
  title,
  subtitle,
  icon,
  action,
  children,
  className,
  bodyClass,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <Panel className={className}>
      <PanelHeader
        title={title}
        subtitle={subtitle}
        icon={icon}
        action={action}
      />
      <div className={cn("p-4", bodyClass)}>{children}</div>
    </Panel>
  );
}

export function TagInput({
  value,
  onChange,
  placeholder = "Type and press Enter",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const list = (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...list, v].join(", "));
    setDraft("");
  };

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-2 transition-colors focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/20">
      <div className="flex flex-wrap gap-1.5">
        {list.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-ink-50 px-2 py-1 text-[12px] font-medium text-ink-700 ring-1 ring-inset ring-ink-100"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(list.filter((t) => t !== tag).join(", "))}
              className="text-ink-400 transition-colors hover:text-coral-500"
              aria-label={`Remove ${tag}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={placeholder}
          className="min-w-[9rem] flex-1 bg-transparent px-1 py-1 text-[13px] focus:outline-none"
        />
      </div>
    </div>
  );
}

export const FormRow = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
    {children}
  </div>
);

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="font-display text-[13px] font-semibold text-ink-800">
          {title}
        </span>
        <span className="h-px flex-1 bg-ink-100" />
        {description && (
          <span className="text-[11px] text-ink-400">{description}</span>
        )}
      </div>
      {children}
    </section>
  );
}
(FormSection as any).__formStep = true;

