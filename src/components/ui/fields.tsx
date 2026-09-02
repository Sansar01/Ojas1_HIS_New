import * as React from "react";
import { useEffect, useRef, useState } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as LabelPrimitive from "@radix-ui/react-label";
import {
  CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Search, X,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { PERMISSIONS, WEEKDAYS_SHORT } from "@/constants";
import type { ModuleKey, Permission } from "@/types";
import { formatDate, range } from "@/utils";

/* ------------------------------- Form field -------------------------------- */

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
  action,
}: {
  label?: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {(label || action) && (
        <div className="flex items-baseline justify-between gap-2">
          {label && (
            <LabelPrimitive.Root htmlFor={htmlFor} className="text-[12.5px] font-medium text-ink-600">
              {label}
              {required && <span className="ml-0.5 text-coral-500">*</span>}
            </LabelPrimitive.Root>
          )}
          {action}
        </div>
      )}
      {children}
      {error ? (
        <p className="flex items-start gap-1 text-[11.5px] font-medium text-coral-600">
          <span className="mt-[3px] size-1 shrink-0 rounded-full bg-coral-500" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11.5px] leading-relaxed text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
}

const controlBase =
  "w-full rounded-lg border bg-white text-sm text-ink-800 transition-all duration-150 placeholder:text-ink-400 " +
  "focus:outline-none focus:ring-4 focus:ring-brand-500/20 focus:border-brand-400 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400";

export const fieldClasses = (invalid?: boolean) =>
  cn(controlBase, invalid ? "border-coral-500/70 bg-coral-50/40 focus:ring-coral-500/15" : "border-ink-200 hover:border-ink-300");

/* ---------------------------------- Input ---------------------------------- */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  prefix?: string;
  name: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, required, leadingIcon, trailingIcon, prefix, className, id, name, type = "text", ...rest },
  ref,
) {
  const inputId = id ?? `f_${name}`;
  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required}>
      <div className="relative">
        {leadingIcon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 [&>svg]:size-4">{leadingIcon}</span>}
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-medium text-ink-400">{prefix}</span>}
        <input
          ref={ref}
          id={inputId}
          name={name}
          type={type}
          aria-invalid={!!error}
          className={cn(fieldClasses(!!error), "h-10 px-3", leadingIcon && "pl-9", prefix && "pl-7", trailingIcon && "pr-9", className)}
          {...rest}
        />
        {trailingIcon && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 [&>svg]:size-4">{trailingIcon}</span>}
      </div>
    </Field>
  );
});

/* --------------------------------- Textarea -------------------------------- */

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: React.ReactNode; error?: string; hint?: React.ReactNode; required?: boolean; name: string;
}>(function Textarea({ label, error, hint, required, className, id, name, rows = 3, ...rest }, ref) {
  const inputId = id ?? `f_${name}`;
  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required}>
      <textarea
        ref={ref}
        id={inputId}
        name={name}
        rows={rows}
        aria-invalid={!!error}
        className={cn(fieldClasses(!!error), "resize-y px-3 py-2 leading-relaxed", className)}
        {...rest}
      />
    </Field>
  );
});

export const NumberInput = ({
  label, value, onValueChange, min = 0, max = 999999, step = 1, suffix, error, hint, required, className,
}: {
  label?: React.ReactNode; value: number; onValueChange: (v: number) => void; min?: number; max?: number;
  step?: number; suffix?: string; error?: string; hint?: React.ReactNode; required?: boolean; className?: string;
}) => (
  <Field label={label} required={required} error={error} hint={hint} className={className}>
    <div className={cn("flex h-10 items-center rounded-lg border bg-white", error ? "border-coral-500/70" : "border-ink-200")}>
      <button
        type="button"
        aria-label="decrease"
        onClick={() => onValueChange(Math.max(min, (Number(value) || 0) - step))}
        className="grid size-9 place-items-center rounded-l-lg text-ink-500 transition-colors hover:bg-ink-50 hover:text-brand-600"
      >
        <ChevronLeft className="size-4" />
      </button>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        onChange={(e) => onValueChange(Number(e.target.value))}
        className="num h-full w-full min-w-0 border-none bg-transparent text-center text-sm font-medium text-ink-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      {suffix && <span className="pr-1 text-[11px] font-medium uppercase text-ink-400">{suffix}</span>}
      <button
        type="button"
        aria-label="increase"
        onClick={() => onValueChange(Math.min(max, (Number(value) || 0) + step))}
        className="grid size-9 place-items-center rounded-r-lg text-ink-500 transition-colors hover:bg-ink-50 hover:text-brand-600"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  </Field>
);

/* ---------------------------------- Select --------------------------------- */

export interface Option {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  tone?: string;
}

export function Select({
  label, value, onChange, options, placeholder = "Select…", error, hint, required, name, className, disabled, size = "md", clearable,
}: {
  label?: React.ReactNode; value: string; onChange: (v: string) => void; options: Option[]; placeholder?: string;
  error?: string; hint?: React.ReactNode; required?: boolean; name?: string; className?: string; disabled?: boolean;
  size?: "sm" | "md"; clearable?: boolean;
}) {
  return (
    <Field label={label} required={required} error={error} hint={hint} className={className}>
      <SelectPrimitive.Root value={value ?? ""} onValueChange={onChange} disabled={disabled} name={name}>
        <SelectPrimitive.Trigger
          className={cn(
            fieldClasses(!!error),
            "flex items-center justify-between gap-2 px-3 text-left data-[state=open]:border-brand-400 data-[state=open]:ring-4 data-[state=open]:ring-brand-500/20",
            size === "sm" ? "h-9 text-[13px]" : "h-10",
          )}
        >
          <SelectPrimitive.Value
            placeholder={placeholder}
            className={cn("truncate", value ? "font-medium text-ink-800" : "text-ink-400")}
          />
          <span className="flex items-center gap-1">
            {clearable && value && (
              <button
                type="button"
                aria-label="Clear selection"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                className="rounded p-0.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              >
                <X className="size-3.5" />
              </button>
            )}
            <SelectPrimitive.Icon>
              <ChevronDown className="size-4 text-ink-400" />
            </SelectPrimitive.Icon>
          </span>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={6}
            className="z-[70] max-h-[19rem] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-ink-100 bg-white shadow-pop animate-fade-in"
          >
            <SelectPrimitive.Viewport className="p-1.5">
              {options.length === 0 && <div className="px-3 py-6 text-center text-[13px] text-ink-400">No options available</div>}
              {options.map((opt) => (
                <SelectPrimitive.Item
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                  className={cn(
                    "relative flex cursor-pointer select-none items-start gap-2 rounded-lg px-2.5 py-2 text-[13px] text-ink-700 outline-none",
                    "data-[highlighted]:bg-brand-25 data-[highlighted]:text-brand-800 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45",
                  )}
                >
                  <SelectPrimitive.ItemIndicator className="mt-0.5 text-brand-600">
                    <Check className="size-4" />
                  </SelectPrimitive.ItemIndicator>
                  <span className="min-w-0 flex-1">
                    <SelectPrimitive.ItemText>
                      <span className="block truncate font-medium">{opt.label}</span>
                    </SelectPrimitive.ItemText>
                    {opt.description && <span className="mt-0.5 block truncate text-[11.5px] text-ink-400">{opt.description}</span>}
                  </span>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </Field>
  );
}

/* ------------------------------- Multi select ------------------------------- */

export function MultiSelect<T extends string = string>({
  label, values, onChange, options, error, hint, required, placeholder = "Select items…", className, columns = 1,
}: {
  label?: React.ReactNode; values: T[]; onChange: (v: T[]) => void; options: Option[]; error?: string; hint?: React.ReactNode;
  required?: boolean; placeholder?: string; className?: string; columns?: 1 | 2 | 3;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (v: T) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <Field
      label={label}
      required={required}
      error={error}
      hint={hint}
      className={className}
      action={
        values.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-[11.5px] font-medium text-brand-600 hover:underline">
            Clear all
          </button>
        )
      }
    >
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(fieldClasses(!!error), "flex min-h-10 items-center justify-between gap-2 px-3 py-1.5 text-left")}
        >
          <span className="flex flex-wrap gap-1">
            {values.length === 0 && <span className="text-ink-400">{placeholder}</span>}
            {values.map((v) => (
              <span key={v} className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11.5px] font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
                {options.find((o) => o.value === v)?.label ?? v}
                <X className="size-3 opacity-60" />
              </span>
            ))}
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-ink-400 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-64 overflow-auto rounded-xl border border-ink-100 bg-white p-1.5 shadow-pop animate-fade-in">
            <div className={cn("grid gap-0.5", columns === 2 && "grid-cols-2", columns === 3 && "grid-cols-3")}>
              {options.map((opt) => {
                const checked = values.includes(opt.value as T);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggle(opt.value as T)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors",
                      checked ? "bg-brand-25 text-brand-800" : "text-ink-600 hover:bg-ink-50",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-4.5 shrink-0 place-items-center rounded border transition-all",
                        checked ? "border-brand-600 bg-brand-600 text-white" : "border-ink-300 bg-white",
                      )}
                    >
                      {checked && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="truncate font-medium">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}

/* --------------------------------- Checkbox --------------------------------- */

export function Checkbox({
  checked, onCheckedChange, label, description, disabled, className, id,
}: {
  checked: boolean; onCheckedChange: (v: boolean) => void; label?: React.ReactNode; description?: React.ReactNode;
  disabled?: boolean; className?: string; id?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-2.5 select-none",
        disabled && "cursor-not-allowed opacity-55",
        className,
      )}
    >
      <CheckboxPrimitive.Root
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className={cn(
          "mt-0.5 grid size-[17px] shrink-0 place-items-center rounded-[5px] border transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/25",
          checked ? "border-brand-600 bg-brand-600 text-white" : "border-ink-300 bg-white hover:border-brand-400",
        )}
      >
        <CheckboxPrimitive.Indicator>
          <Check className="size-3" strokeWidth={3.5} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {(label || description) && (
        <span className="min-w-0 leading-tight">
          {label && <span className="block text-[13px] font-medium text-ink-700">{label}</span>}
          {description && <span className="mt-0.5 block text-[11.5px] text-ink-400">{description}</span>}
        </span>
      )}
    </label>
  );
}

/* ---------------------------------- Switch ---------------------------------- */

export function Switch({
  checked, onCheckedChange, label, description, disabled, className,
}: {
  checked: boolean; onCheckedChange: (v: boolean) => void; label?: React.ReactNode; description?: React.ReactNode;
  disabled?: boolean; className?: string;
}) {
  return (
    <label className={cn("flex items-center justify-between gap-4", disabled && "opacity-60", className)}>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-[13px] font-medium text-ink-700">{label}</span>}
          {description && <span className="mt-0.5 block text-[11.5px] text-ink-400">{description}</span>}
        </span>
      )}
      <SwitchPrimitive.Root
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/25",
          checked ? "bg-brand-600" : "bg-ink-200",
        )}
      >
        <SwitchPrimitive.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 data-[state=checked]:translate-x-[22px]" />
      </SwitchPrimitive.Root>
    </label>
  );
}

/* -------------------------------- Radio group -------------------------------- */

export function RadioGroup({
  label, value, onChange, options, error, required, className, orientation = "horizontal",
}: {
  label?: React.ReactNode; value: string; onChange: (v: string) => void; options: Option[]; error?: string;
  required?: boolean; className?: string; orientation?: "horizontal" | "vertical";
}) {
  return (
    <Field label={label} required={required} error={error} className={className}>
      <RadioGroupPrimitive.Root value={value} onValueChange={onChange} className={cn("flex gap-2", orientation === "vertical" && "flex-col")}>
        {options.map((opt) => (
          <RadioGroupPrimitive.Item
            key={opt.value}
            value={opt.value}
            className={cn(
              "group flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-all",
              value === opt.value
                ? "border-brand-500 bg-brand-25 text-brand-800 shadow-[0_0_0_3px_rgba(30,158,144,.08)]"
                : "border-ink-200 bg-white text-ink-600 hover:border-ink-300",
            )}
          >
            <RadioGroupPrimitive.Indicator className="grid size-4 place-items-center rounded-full border border-brand-600">
              <span className="size-2 rounded-full bg-brand-600" />
            </RadioGroupPrimitive.Indicator>
            {opt.label}
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
    </Field>
  );
}

/* ------------------------------- Search input ------------------------------- */

export function SearchInput({
  value, onChange, placeholder = "Search records…", className, autoFocus,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(fieldClasses(false), "h-10 pl-9 pr-9 text-[13px]")}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------ Segmented control ---------------------------- */

export function Segmented<T extends string>({
  value, onChange, options, className, size = "md",
}: {
  value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string; size?: "sm" | "md";
}) {
  return (
    <div className={cn("inline-flex rounded-lg border border-ink-200 bg-ink-50 p-0.5", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-[7px] font-medium transition-all duration-150",
            size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3.5 py-1.5 text-[13px]",
            value === opt.value ? "bg-white text-ink-900 shadow-sm ring-1 ring-ink-200" : "text-ink-500 hover:text-ink-800",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------- Date picker -------------------------------- */

export function DatePicker({
  label, value, onChange, error, hint, required, min, max, disabled, className, placeholder = "Pick a date", clearable = true, name,
}: {
  label?: React.ReactNode; value: string; onChange: (v: string) => void; error?: string; hint?: React.ReactNode;
  required?: boolean; min?: string; max?: string; disabled?: boolean; className?: string; placeholder?: string; clearable?: boolean;
  name?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cursor = value ? new Date(value) : new Date();
  const [view, setView] = useState<{ y: number; m: number }>({ y: cursor.getFullYear(), m: cursor.getMonth() });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const first = new Date(view.y, view.m, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const monthLabel = first.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const todayKey = new Date().toISOString().slice(0, 10);

  const shift = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <Field label={label} htmlFor={name} required={required} error={error} hint={hint} className={className}>
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          id={name}
          name={name}
          disabled={disabled}
          onClick={() => {
            setOpen((o) => !o);
            setView({ y: cursor.getFullYear(), m: cursor.getMonth() });
          }}
          className={cn(fieldClasses(!!error), "flex h-10 items-center justify-between gap-2 px-3 text-left")}
        >
          <span className={cn("flex items-center gap-2 text-[13px]", !value && "text-ink-400")}>
            <CalendarDays className="size-4 text-ink-400" />
            {value ? formatDate(value, { weekday: "short", day: "2-digit", month: "short", year: "numeric" }) : placeholder}
          </span>
          {clearable && value ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear date"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              <X className="size-3.5" />
            </span>
          ) : (
            <ChevronDown className={cn("size-4 text-ink-400 transition-transform", open && "rotate-180")} />
          )}
        </button>

        {open && (
          <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[284px] rounded-xl border border-ink-100 bg-white p-3 shadow-pop animate-fade-in">
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={() => shift(-1)} className="grid size-7 place-items-center rounded-lg text-ink-500 hover:bg-ink-50 hover:text-brand-600">
                <ChevronLeft className="size-4" />
              </button>
              <span className="font-display text-[13.5px] font-semibold text-ink-900">{monthLabel}</span>
              <button type="button" onClick={() => shift(1)} className="grid size-7 place-items-center rounded-lg text-ink-500 hover:bg-ink-50 hover:text-brand-600">
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {WEEKDAYS_SHORT.map((d) => (
                <span key={d} className="py-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
                  {d[0]}
                </span>
              ))}
              {range(startPad).map((i) => (
                <span key={`pad${i}`} />
              ))}
              {range(daysInMonth).map((i) => {
                const iso = new Date(Date.UTC(view.y, view.m, i + 1)).toISOString().slice(0, 10);
                const disabledDay = (min && iso < min) || (max && iso > max);
                const active = iso === value;
                return (
                  <button
                    key={iso + i}
                    type="button"
                    disabled={!!disabledDay}
                    onClick={() => {
                      onChange(iso);
                      setOpen(false);
                    }}
                    className={cn(
                      "num h-8 rounded-lg text-[12.5px] font-medium transition-all",
                      active
                        ? "bg-brand-600 text-white shadow-[0_6px_14px_-8px_rgba(13,105,97,.9)]"
                        : disabledDay
                          ? "cursor-not-allowed text-ink-200"
                          : "text-ink-700 hover:bg-brand-50",
                      !active && iso === todayKey && "ring-1 ring-inset ring-brand-400",
                    )}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-ink-100 pt-2">
              <button type="button" onClick={() => { onChange(todayKey); setOpen(false); }} className="text-[12px] font-semibold text-brand-600 hover:underline">
                Today
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-[12px] font-medium text-ink-500 hover:text-ink-800">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}

/* --------------------- Module × permission matrix (RBAC) ------------------- */

export function PermissionMatrix({
  modules, permissions, onToggle, readOnly,
}: {
  modules: ModuleKey[];
  permissions: Partial<Record<ModuleKey, Permission[]>>;
  onToggle: (module: ModuleKey, permission: Permission) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-ink-100">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-ink-50/80 text-left">
            <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">Module</th>
            {PERMISSIONS.map((p) => (
              <th key={p} className="w-[74px] px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modules.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-[12.5px] text-ink-400">
                Assign at least one module to configure permissions.
              </td>
            </tr>
          )}
          {modules.map((m) => (
            <tr key={m} className="border-t border-ink-100 hover:bg-brand-25/40">
              <td className="px-3 py-2 font-medium capitalize text-ink-700">{m.replace(/([A-Z])/g, " $1").toLowerCase()}</td>
              {PERMISSIONS.map((p) => {
                const checked = (permissions[m] ?? []).includes(p);
                return (
                  <td key={p} className="px-2 py-2 text-center">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => onToggle(m, p)}
                      className={cn(
                        "mx-auto grid size-6 place-items-center rounded-md border transition-all",
                        checked ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 bg-white text-transparent hover:border-brand-300",
                        readOnly && "cursor-not-allowed opacity-60",
                      )}
                      aria-label={`${m} ${p}`}
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
