import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { ArrowLeft, ArrowRight, Check, CircleAlert, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button, IconButton } from "@/components/ui/primitives";
import { useAppDispatch } from "@/store/hooks";
import { FORM_INVALID } from "@/store/slices/uiSlice";
import { formRegistry } from "@/hooks/useForm";

/* ------------------- stepped form section detection ------------------------ */
/* Record forms group their fields in <FormSection>; when a dialog body holds
   two or more of those sections it is presented as a guided, multi-step form.
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
  if ((el.type as any)?.__formStep === true) return el.props as any;
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
    if (typeof props.name === "string" && props.name) acc.push(props.name);
    if (props.children !== undefined) collectNames(props.children, acc);
  });
  return acc;
}

/* ---------------------------------- Dialog --------------------------------- */


export function Dialog({
  open = true,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "lg",
  trigger,
  className,
  height,
  submitLabel,
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
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  trigger?: React.ReactNode;
  className?: string;
  /** Optional body height, e.g. "36rem" or "calc(100vh - 12rem)". Defaults to the standard dialog height. */
  height?: string;
  /**
   * Record forms: when `onSubmit` (or `form`) is given the dialog switches to
   * form mode — a <form> wrapper, a submit button with `submitLabel`, and the
   * stepped navigation for `<FormSection>`-based layouts. Plain dialogs pass
   * none of these and keep the simple `footer`.
   */
  submitLabel?: string;
  loading?: boolean;
  footerNote?: React.ReactNode;
  form?: any;
  onSubmit?: (e?: any) => void;
}) {
  const widths = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
    full: "max-w-[min(96rem,96vw)]",
  }[size];

  /* ------------------------------ form mode ------------------------------ */
  // Record forms keep the established stepped-form behaviour: the fields
  // stay at the call site, the dialog owns the step engine and the footer.
  const dispatch = useAppDispatch();
  const location = useLocation();
  const api = form ?? formRegistry.current;
  const kids = React.Children.toArray(children).filter((k) =>
    React.isValidElement(k),
  );
  const isForm = Boolean(onSubmit || form);
  const stepLike = kids.filter(containsSection);
  const trailing = kids.filter((k) => !containsSection(k));
  const multi = isForm && stepLike.length >= 2;
  const [step, setStep] = useState(0);
  const [doneSteps, setDoneSteps] = useState<number[]>([]);

  // Close the form only when the route changes *while* the form is open
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (!isForm) return;
    if (prevPathRef.current !== location.pathname) {
      onOpenChange?.(false);
      prevPathRef.current = location.pathname;
    }
  }, [isForm, location.pathname, onOpenChange]);

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
    setDoneSteps((d) => (d.includes(current.index) ? d : [...d, current.index]));
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
    steps.length === 1 ? 100 : Math.round((doneSteps.length / steps.length) * 100);
  const remaining = requiredIn(current.names).filter(
    (n) => (api?.errors as any)?.[n],
  ).length;

  const formFooter = (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-[11.5px] text-ink-500">
        {remaining > 0 ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-coral-600">
            <CircleAlert className="size-3.5" /> {remaining} required field
            {remaining > 1 ? "s" : ""} still empty in this step
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
          {submitLabel ?? "Save record"}
        </Button>
      </div>
    </div>
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger && (
        <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      )}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="no-print fixed inset-0 z-[60] bg-ink-950/45 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <div
          className={cn(
            "print-dialog-shell fixed inset-0 z-[61] flex items-start justify-center overflow-y-auto p-4 sm:p-6",
            "items-center",
          )}
        >
          <DialogPrimitive.Content
            className={cn(
              "print-sheet relative z-10 w-full rounded-2xl border border-ink-100 bg-white shadow-pop",
              "data-[state=open]:animate-fade-up",
              height &&
                "flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden sm:max-h-[calc(100vh-3rem)]",
              widths,
              className,
            )}
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 no-print">
              <div className="min-w-0">
                <DialogPrimitive.Title className="text-[17px] font-semibold tracking-tight text-ink-900">
                  {title}
                </DialogPrimitive.Title>
                {description && (
                  <DialogPrimitive.Description className="mt-1 text-[12.5px] text-ink-400">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close asChild>
                <IconButton label="Close dialog" variant="ghost" size="sm">
                  <X />
                </IconButton>
              </DialogPrimitive.Close>
            </header>
            <div
              className={cn(
                "px-5 py-4",
                height
                  ? "min-h-0 flex-1 overflow-y-auto"
                  : "max-h-[calc(100vh-13rem)] overflow-y-auto",
              )}
              style={height ? { height } : undefined}
              data-height={height ? "custom" : undefined}
            >
              {isForm ? (
                <>
                  {multi && (
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-brand-700">
                        Step {current.index + 1} of {steps.length}
                      </span>
                      <span className="text-ink-300">&middot;</span>
                      <span className="text-[11px] text-ink-400">
                        {progress}% complete
                      </span>
                    </div>
                  )}

                  {multi && (
                    <ol className="mb-4 flex gap-1.5 overflow-x-auto border-b border-ink-100 pb-2.5 no-scrollbar">
                      {steps.map((s) => {
                        const complete = doneSteps.includes(s.index);
                        const active = s.index === current.index;
                        const maxDone = doneSteps.length
                          ? Math.max(...doneSteps)
                          : -1;
                        const reachable =
                          s.index <= current.index || s.index <= maxDone + 1;
                        const locked = !reachable;
                        const required = requiredIn(s.names).length;
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
                                  {required
                                    ? `${required} required field${required > 1 ? "s" : ""}`
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
                </>
              ) : (
                children
              )}
            </div>
            {isForm ? (
              <footer className="no-print flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-ink-100 bg-ink-25/60 px-5 py-3.5">
                {formFooter}
              </footer>
            ) : (
              footer && (
                <footer className="no-print flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-ink-100 bg-ink-25/60 px-5 py-3.5">
                  {footer}
                </footer>
              )
            )}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ----------------------------------- Sheet ---------------------------------- */

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = "right",
  width = "max-w-xl",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: "right" | "left";
  width?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-ink-950/45 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 z-[61] flex w-full flex-col border-ink-100 bg-white shadow-pop",
            side === "right" ? "right-0 border-l" : "left-0 border-r",
            width,
            "animate-slide-in",
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-[16px] font-semibold text-ink-900">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-1 text-[12.5px] text-ink-400">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton label="Close panel" variant="ghost" size="sm">
                <X />
              </IconButton>
            </DialogPrimitive.Close>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <footer className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-25/60 px-5 py-3.5">
              {footer}
            </footer>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ------------------------------ Confirm dialog ------------------------------ */

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "danger",
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: "danger" | "brand" | "warn";
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-ink-950/50 backdrop-blur-[2px]" />
        <div className="fixed inset-0 z-[71] grid place-items-center p-4">
          <DialogPrimitive.Content className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-5 shadow-pop animate-fade-up">
            <div className="flex gap-3.5">
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-xl text-lg font-bold",
                  tone === "danger"
                    ? "bg-coral-50 text-coral-600"
                    : tone === "warn"
                      ? "bg-amberly-50 text-amberly-600"
                      : "bg-brand-50 text-brand-600",
                )}
              >
                !
              </span>
              <div className="min-w-0">
                <DialogPrimitive.Title className="text-[15.5px] font-semibold text-ink-900">
                  {title}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-[13px] leading-relaxed text-ink-500">
                  {description}
                </DialogPrimitive.Description>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant={
                  tone === "danger"
                    ? "danger"
                    : tone === "warn"
                      ? "secondary"
                      : "primary"
                }
                size="sm"
                loading={loading}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Small hook to drive a confirm dialog from any component (no context needed). */
export function useConfirmDialog() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    tone: "danger" | "brand" | "warn";
    loading?: boolean;
    action?: () => void | Promise<void>;
  }>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    tone: "danger",
  });

  const ask = (opts: {
    title: string;
    description: string;
    confirmLabel?: string;
    tone?: "danger" | "brand" | "warn";
    action?: () => void | Promise<void>;
  }) =>
    setState({
      open: true,
      loading: false,
      confirmLabel: opts.confirmLabel ?? "Confirm",
      tone: opts.tone ?? "danger",
      title: opts.title,
      description: opts.description,
      action: opts.action,
    });

  const node = state.action
    ? createPortal(
        <ConfirmDialog
          open={state.open}
          onOpenChange={(v) => setState((s) => ({ ...s, open: v }))}
          title={state.title}
          description={state.description}
          confirmLabel={state.confirmLabel}
          tone={state.tone}
          loading={state.loading}
          onConfirm={async () => {
            await state.action?.();
            setState((s) => ({ ...s, open: false }));
          }}
        />,
        document.body,
      )
    : null;

  return { ask, confirmNode: node };
}

/* -------------------------------- Dropdown ---------------------------------- */

export function DropdownMenu({
  trigger,
  children,
  align = "end",
  className,
  sideOffset = 8,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
  sideOffset?: number;
}) {
  return (
    <DropdownPrimitive.Root>
      <DropdownPrimitive.Trigger asChild>{trigger}</DropdownPrimitive.Trigger>
      <DropdownPrimitive.Portal>
        <DropdownPrimitive.Content
          align={align}
          sideOffset={sideOffset}
          className={cn(
            "z-[70] min-w-[13rem] overflow-hidden rounded-xl border border-ink-100 bg-white p-1.5 shadow-pop",
            "data-[state=open]:animate-fade-up",
            className,
          )}
        >
          {children}
        </DropdownPrimitive.Content>
      </DropdownPrimitive.Portal>
    </DropdownPrimitive.Root>
  );
}

export const MenuItem = DropdownPrimitive.Item;

export function menuItemClass(tone?: "danger" | "brand") {
  return cn(
    "flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium outline-none transition-colors",
    "data-[highlighted]:bg-ink-50 data-[highlighted]:text-ink-900",
    tone === "danger"
      ? "text-coral-600 data-[highlighted]:bg-coral-50"
      : "text-ink-600",
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-400">
      {children}
    </div>
  );
}

/* ---------------------------------- Tabs ------------------------------------ */

export function Tabs({
  tabs,
  value,
  onValueChange,
  className,
  variant = "underline",
  content,
}: {
  tabs: { value: string; label: React.ReactNode; count?: number }[];
  value: string;
  onValueChange: (v: string) => void;
  className?: string;
  variant?: "underline" | "pill";
  content?: React.ReactNode;
}) {
  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      className={cn("flex flex-col", className)}
    >
      <TabsPrimitive.List
        className={cn(
          "flex gap-1 overflow-x-auto no-scrollbar",
          variant === "underline"
            ? "border-b border-ink-100 px-1"
            : "rounded-xl bg-ink-50 p-1",
        )}
      >
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.value}
            value={tab.value}
            className={cn(
              "relative flex shrink-0 items-center gap-2 whitespace-nowrap text-[13px] font-medium transition-all",
              variant === "underline"
                ? "border-b-2 border-transparent px-3 py-2.5 text-ink-500 hover:text-ink-800 data-[state=active]:border-brand-500 data-[state=active]:text-brand-700"
                : "rounded-lg px-3 py-1.5 text-ink-500 hover:text-ink-800 data-[state=active]:bg-white data-[state=active]:text-ink-900 data-[state=active]:shadow-sm",
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="num rounded-full bg-ink-100 px-1.5 py-px text-[10.5px] font-semibold text-ink-600 group-data-[state=active]:bg-brand-50">
                {tab.count}
              </span>
            )}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {content}
    </TabsPrimitive.Root>
  );
}


/* --------------------------------- Tooltip ---------------------------------- */

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <TooltipPrimitive.Root delayDuration={200}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-[80] max-w-[16rem] rounded-lg bg-ink-900 px-2.5 py-1.5 text-[11.5px] font-medium leading-snug text-white shadow-pop animate-fade-in"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-ink-900" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      {children}
    </TooltipPrimitive.Provider>
  );
}
