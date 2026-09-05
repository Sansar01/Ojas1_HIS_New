import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, CircleAlert, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button, Badge, Panel, PanelHeader } from "@/components/ui/primitives";
import { usePermission, useAppDispatch } from "@/hooks";
import { FORM_INVALID } from "@/features/ui/uiSlice";
import { formRegistry } from "@/hooks/useForm";
import type { ModuleKey } from "@/types";
export { Emptyish } from "./Emptyish";

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
  module?: ModuleKey;
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

/* --------------------------- stepped inline form --------------------------- */
/* No modals: create/edit forms render inline as a guided, multi-step panel.
   Each step validates its own required fields before the next step unlocks. */

function containsSection(el: React.ReactNode): boolean {
  if (!React.isValidElement(el)) return false;
  if ((el.type as any)?.__formStep === true) return true;
  return React.Children.toArray((el.props as any)?.children ?? []).some(
    containsSection,
  );
}

function firstSection(
  el: React.ReactNode,
): { title?: string; description?: string } | null {
  if (!React.isValidElement(el)) return null;
  if ((el.type as any)?.__formStep === true) return el.props as any as any;
  for (const child of React.Children.toArray(
    (el.props as any)?.children ?? [],
  )) {
    const found = firstSection(child);
    if (found) return found;
  }
  return null;
}

function collectNames(node: React.ReactNode, acc: string[] = []): string[] {
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as any;
    if (
      typeof props.name === "string" &&
      props.name &&
      !acc.includes(props.name)
    )
      acc.push(props.name);
    if (props.children !== undefined) collectNames(props.children, acc);
  });
  return acc;
}

export function FormDialog({
  open = true,
  onOpenChange,
  title,
  description,
  children,
  submitLabel = "Save record",
  loading,
  footerNote,
  form,
  onSubmit,
}: {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  submitLabel?: string;
  loading?: boolean;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  footerNote?: React.ReactNode;
  form?: any;
  onSubmit?: (e?: any) => void;
}) {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const api = form ?? formRegistry.current;
  const rootRef = useRef<HTMLDivElement>(null);
  const kids = React.Children.toArray(children).filter((k) =>
    React.isValidElement(k),
  );
  const stepLike = kids.filter(containsSection);
  const trailing = kids.filter((k) => !containsSection(k));
  const multi = stepLike.length >= 2;
  const [step, setStep] = useState(0);
  const [doneSteps, setDoneSteps] = useState<number[]>([]);

  // Close the form only when the route changes *while* the form is open
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      if (onOpenChange) onOpenChange(false);
      prevPathRef.current = location.pathname;
    }
  }, [location.pathname, onOpenChange]);

  const steps = multi
    ? stepLike.map((el, i) => {
        const meta = firstSection(el);
        const isLast = i === stepLike.length - 1;
        return {
          index: i,
          title: meta?.title ?? `Step ${i + 1}`,
          description: meta?.description,
          node:
            isLast && trailing.length ? (
              <>
                {el}
                {trailing}
              </>
            ) : (
              el
            ),
          names: collectNames(
            isLast && trailing.length ? [el, ...trailing] : el,
          ),
        };
      })
    : [
        {
          index: 0,
          title: typeof title === "string" ? title : "Details",
          description: undefined,
          node: <>{kids}</>,
          names: collectNames(children),
        },
      ];

  const current = steps[Math.min(step, steps.length - 1)];
  const requiredIn = (names: string[]) =>
    api?.schema
      ? names.filter((n) =>
          (api.schema as any)[n]?.some(
            (r: any) =>
              r.required || r.min || r.pattern || r.email || r.validate,
          ),
        )
      : [];

  useEffect(() => {
    if (open)
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [open, multi]);

  if (!open) return null;

  /** forms dock at the top of the workspace (no modal overlay) */
  const host =
    typeof document === "undefined"
      ? null
      : document.getElementById("portal-form");

  const goNext = () => {
    if (!api) {
      setStep((s) => Math.min(steps.length - 1, s + 1));
      return;
    }
    const errs = api.validateFields(current.names);
    if (Object.keys(errs).length) {
      dispatch(FORM_INVALID());
      api.focusField(Object.keys(errs)[0]);
      return;
    }
    setDoneSteps((d) =>
      d.includes(current.index) ? d : [...d, current.index],
    );
    setStep((s) => Math.min(steps.length - 1, s + 1));
  };

  const submit = (e?: any) => {
    e?.preventDefault?.();
    if (!api || steps.length === 1) return onSubmit?.(e);
    const all = steps.flatMap((s) => s.names);
    const errs = api.validateFields(all);
    const bad = Object.keys(errs);
    if (bad.length) {
      dispatch(FORM_INVALID());
      const idx = steps.findIndex((s) => s.names.includes(bad[0]));
      if (idx > -1) setStep(idx);
      window.setTimeout(() => api.focusField(bad[0]), 120);
      return;
    }
    setDoneSteps(steps.map((s) => s.index));
    return onSubmit?.(e);
  };

  const progress =
    steps.length === 1
      ? 100
      : Math.round(
          ((doneSteps.length + (doneSteps.includes(current.index) ? 0 : 0)) /
            steps.length) *
            100,
        );
  const remaining = requiredIn(current.names).filter(
    (n) => (api?.errors as any)?.[n],
  ).length;

  const panel = (
    <div ref={rootRef} className="mb-4 scroll-mt-20">
      <Panel className="overflow-hidden border-brand-200 shadow-pop animate-fade-up">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 bg-ink-950 px-4 py-3.5 text-white">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-brand-200/80">
              {multi ? `Step ${current.index + 1} of ${steps.length}` : "Form"}
            </p>
            <h3 className="mt-1 font-display text-[17px] font-semibold leading-tight tracking-tight">
              {title}
            </h3>
            {description && (
              <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-white/55">
                {description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {multi && (
              <Badge
                tone="ink"
                size="xs"
                className="bg-white/10 text-white/80 ring-white/15"
              >
                {progress}% complete
              </Badge>
            )}
            <button
              onClick={() => onOpenChange?.(false)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/8 px-2.5 py-1.5 text-[12px] font-medium text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            >
              <X className="size-3.5" /> Close
            </button>
          </div>
        </div>

        <div
          className={cn("grid gap-0", multi && "lg:grid-cols-[14.5rem_1fr]")}
        >
          {multi && (
            <ol className="flex gap-1 overflow-x-auto border-b border-ink-100 bg-ink-25/70 p-2.5 no-scrollbar lg:flex-col lg:gap-1.5 lg:overflow-visible lg:border-b-0 lg:border-r">
              {steps.map((s) => {
                const complete = doneSteps.includes(s.index);
                const active = s.index === current.index;
                const maxDone = doneSteps.length ? Math.max(...doneSteps) : -1;
                const reachable =
                  s.index <= current.index || s.index <= maxDone + 1;
                const locked = !reachable;
                return (
                  <li key={s.index}>
                    <button
                      onClick={() => {
                        if (reachable) return setStep(s.index);
                        dispatch(FORM_INVALID());
                        api?.focusField(
                          requiredIn(
                            steps[maxDone + 1]?.names ?? current.names,
                          ).find((n) => (api?.errors as any)?.[n]) ??
                            steps[maxDone + 1]?.names[0] ??
                            current.names[0],
                        );
                        setStep(Math.min(steps.length - 1, maxDone + 1));
                      }}
                      className={cn(
                        "group flex w-full min-w-[11rem] items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all",
                        active
                          ? "bg-white shadow-card ring-1 ring-brand-200"
                          : "hover:bg-white/70",
                      )}
                    >
                      <span
                        className={cn(
                          "num mt-0.5 grid size-5.5 shrink-0 place-items-center rounded-md text-[11px] font-bold transition-colors",
                          complete
                            ? "bg-mint-500 text-white"
                            : active
                              ? "bg-brand-600 text-white"
                              : "bg-ink-100 text-ink-400",
                        )}
                      >
                        {complete ? (
                          <Check className="size-3" strokeWidth={3.5} />
                        ) : (
                          s.index + 1
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate text-[12.5px] font-semibold",
                            active ? "text-ink-900" : "text-ink-600",
                          )}
                        >
                          {s.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[10.5px] text-ink-400">
                          {requiredIn(s.names).length
                            ? `${requiredIn(s.names).length} required field${requiredIn(s.names).length > 1 ? "s" : ""}`
                            : "optional"}
                        </span>
                      </span>
                      {locked && (
                        <CircleAlert className="mt-1 size-3.5 shrink-0 text-ink-300" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="min-w-0">
            <div className="max-h-[calc(100vh-20rem)] overflow-y-auto px-4 py-4 sm:px-5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit(e);
                }}
                className="space-y-1"
              >
                {current.node}
                <button type="submit" className="sr-only">
                  Submit
                </button>
              </form>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 bg-ink-25/70 px-4 py-3">
              <p className="flex items-center gap-2 text-[11.5px] text-ink-500">
                {remaining > 0 ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-coral-600">
                    <CircleAlert className="size-3.5" /> {remaining} required
                    field{remaining > 1 ? "s" : ""} still empty in this step
                  </span>
                ) : (
                  (footerNote ?? "Fields marked with an asterisk are required.")
                )}
              </p>
              <div className="flex items-center gap-2">
                {multi && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={current.index === 0}
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    icon={<ArrowLeft />}
                  >
                    Previous
                  </Button>
                )}
                {multi && current.index < steps.length - 1 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={goNext}
                    iconRight={<ArrowRight />}
                  >
                    Next step
                  </Button>
                )}
                <Button
                  size="sm"
                  loading={loading}
                  onClick={(e) => submit(e)}
                  disabled={multi && current.index < steps.length - 1}
                >
                  {submitLabel}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );

  return host ? createPortal(panel, host) : panel;
}

export const StepForm = FormDialog;

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

export const FormStep = FormSection;
