import * as React from "react";
import { useState } from "react";
import { createPortal } from "react-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button, IconButton } from "@/components/ui/primitives";

/* ---------------------------------- Dialog --------------------------------- */

export function Dialog({
  open, onOpenChange, title, description, children, footer, size = "md", trigger, className,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  trigger?: React.ReactNode;
  className?: string;
}) {
  const widths = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl", full: "max-w-[min(96rem,96vw)]" }[size];
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-ink-950/45 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <div className={cn("fixed inset-0 z-[61] flex items-start justify-center overflow-y-auto p-4 sm:p-6", "items-center")}>
          <DialogPrimitive.Content
            className={cn(
              "print-sheet relative w-full rounded-2xl border border-ink-100 bg-white shadow-pop",
              "data-[state=open]:animate-fade-up",
              widths,
              className,
            )}
          >
            <header className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 no-print">
              <div className="min-w-0">
                <DialogPrimitive.Title className="text-[17px] font-semibold tracking-tight text-ink-900">{title}</DialogPrimitive.Title>
                {description && <DialogPrimitive.Description className="mt-1 text-[12.5px] text-ink-400">{description}</DialogPrimitive.Description>}
              </div>
              <DialogPrimitive.Close asChild>
                <IconButton label="Close dialog" variant="ghost" size="sm">
                  <X />
                </IconButton>
              </DialogPrimitive.Close>
            </header>
            <div className="max-h-[calc(100vh-13rem)] overflow-y-auto px-5 py-4">{children}</div>
            {footer && <footer className="no-print flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 bg-ink-25/60 px-5 py-3.5">{footer}</footer>}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ----------------------------------- Sheet ---------------------------------- */

export function Sheet({
  open, onOpenChange, title, description, children, footer, side = "right", width = "max-w-xl",
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
              <DialogPrimitive.Title className="text-[16px] font-semibold text-ink-900">{title}</DialogPrimitive.Title>
              {description && <DialogPrimitive.Description className="mt-1 text-[12.5px] text-ink-400">{description}</DialogPrimitive.Description>}
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton label="Close panel" variant="ghost" size="sm">
                <X />
              </IconButton>
            </DialogPrimitive.Close>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-25/60 px-5 py-3.5">{footer}</footer>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ------------------------------ Confirm dialog ------------------------------ */

export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel = "Confirm", tone = "danger", onConfirm, loading,
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
                  tone === "danger" ? "bg-coral-50 text-coral-600" : tone === "warn" ? "bg-amberly-50 text-amberly-600" : "bg-brand-50 text-brand-600",
                )}
              >
                !
              </span>
              <div className="min-w-0">
                <DialogPrimitive.Title className="text-[15.5px] font-semibold text-ink-900">{title}</DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-[13px] leading-relaxed text-ink-500">{description}</DialogPrimitive.Description>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button variant={tone === "danger" ? "danger" : tone === "warn" ? "secondary" : "primary"} size="sm" loading={loading} onClick={onConfirm}>
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
  }>({ open: false, title: "", description: "", confirmLabel: "Confirm", tone: "danger" });

  const ask = (opts: { title: string; description: string; confirmLabel?: string; tone?: "danger" | "brand" | "warn"; action?: () => void | Promise<void> }) =>
    setState({ open: true, loading: false, confirmLabel: opts.confirmLabel ?? "Confirm", tone: opts.tone ?? "danger", title: opts.title, description: opts.description, action: opts.action });

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
  trigger, children, align = "end", className, sideOffset = 8,
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
    tone === "danger" ? "text-coral-600 data-[highlighted]:bg-coral-50" : "text-ink-600",
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-400">{children}</div>;
}

/* ---------------------------------- Tabs ------------------------------------ */

export function Tabs({
  tabs, value, onValueChange, className, variant = "underline", content,
}: {
  tabs: { value: string; label: React.ReactNode; count?: number }[];
  value: string;
  onValueChange: (v: string) => void;
  className?: string;
  variant?: "underline" | "pill";
  content?: React.ReactNode;
}) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange} className={cn("flex flex-col", className)}>
      <TabsPrimitive.List
        className={cn(
          "flex gap-1 overflow-x-auto no-scrollbar",
          variant === "underline" ? "border-b border-ink-100 px-1" : "rounded-xl bg-ink-50 p-1",
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
              <span className="num rounded-full bg-ink-100 px-1.5 py-px text-[10.5px] font-semibold text-ink-600 group-data-[state=active]:bg-brand-50">{tab.count}</span>
            )}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {content}
    </TabsPrimitive.Root>
  );
}

export const TabsContent = TabsPrimitive.Content;

/* --------------------------------- Tooltip ---------------------------------- */

export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "right" | "bottom" | "left" }) {
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
  return <TooltipPrimitive.Provider delayDuration={200}>{children}</TooltipPrimitive.Provider>;
}
