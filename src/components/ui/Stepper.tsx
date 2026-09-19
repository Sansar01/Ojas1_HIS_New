/* --------------------------------- stepper -------------------------------- */

import { cn } from "@/utils/cn";
import { Check, Ban, Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Panel } from "./primitives";

/** One entry in the wizard. `icon` is a lucide component, not a name. */
export type StepItem = {
  id: number;
  label: string;
  hint: string;
  icon: LucideIcon;
};

/**
 * `T` keeps the caller's literal step shape (e.g. the `as const` STEPS in the
 * page) so `onSelect` receives the exact union of its steps.
 */
export function Stepper<T extends StepItem>({
  STEPS,
  current,
  completed,
  isLocked,
  onSelect,
}: {
  STEPS: readonly T[];
  current: number;
  completed: number[];
  isLocked: (id: number) => boolean;
  onSelect: (step: T) => void;
}) {
  const progress = STEPS.length
    ? Math.round((completed.length / STEPS.length) * 100)
    : 0;

  return (
    <Panel className="overflow-hidden">
      <span className="sr-only" aria-label={`Progress ${progress}%`} />
      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:gap-3">
        {STEPS.map((step, index) => {
          const isActive = current === step.id;
          const isCompleted = completed.includes(step.id);
          const locked = isLocked(step.id);

          const Icon: LucideIcon = step.icon;
          const circle = cn(
            "grid size-10 shrink-0 place-items-center rounded-full border transition-all duration-200",
            isCompleted
              ? "border-mint-500 bg-mint-500 text-white"
              : isActive
                ? "border-brand-600 bg-brand-600 text-white ring-4 ring-brand-500/20"
                : locked
                  ? "border-dashed border-ink-200 bg-ink-50 text-ink-300"
                  : "border-ink-200 bg-white text-ink-500",
            locked &&
              "group-hover:border-coral-300 group-hover:bg-coral-50 group-hover:text-coral-500",
          );

          return (
            <div
              key={step.id}
              className="flex min-w-0 items-center gap-2 sm:flex-1 sm:last:flex-none"
            >
              <button
                type="button"
                onClick={() => onSelect(step)}
                aria-current={isActive ? "step" : undefined}
                aria-disabled={locked || undefined}
                title={locked ? "Complete step 1 to unlock" : step.hint}
                className={cn(
                  "group flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-all duration-150 sm:flex-none",
                  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20",
                  locked
                    ? "cursor-not-allowed"
                    : isActive
                      ? "bg-brand-25 ring-1 ring-inset ring-brand-200"
                      : "cursor-pointer hover:bg-ink-25",
                )}
              >
                <span className={circle}>
                  {isCompleted ? (
                    <Check className="size-5" strokeWidth={2.6} />
                  ) : locked ? (
                    <>
                      <Icon className="size-4.5 group-hover:hidden" />
                      <Ban className="hidden size-4.5 group-hover:block" />
                    </>
                  ) : (
                    <Icon className="size-4.5" />
                  )}
                </span>

                <span className="min-w-0">
                  <span
                    className={cn(
                      "flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.13em]",
                      locked
                        ? "text-ink-300"
                        : isActive
                          ? "text-brand-600"
                          : "text-ink-400",
                    )}
                  >
                    Step {step.id}
                    {locked && (
                      <>
                        <Lock className="size-3 group-hover:hidden" />
                        <Ban className="hidden size-3 group-hover:block" />
                      </>
                    )}
                  </span>
                  <span
                    className={cn(
                      "block truncate text-[13.5px] font-semibold",
                      locked
                        ? "text-ink-400"
                        : isActive
                          ? "text-ink-900"
                          : "text-ink-600",
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="hidden truncate text-[11px] text-ink-400 sm:block">
                    {locked ? "Locked — finish step 1" : step.hint}
                  </span>
                </span>
              </button>

              {index < STEPS.length - 1 && (
                <span className="hidden h-0.5 flex-1 overflow-hidden rounded-full bg-ink-100 sm:block">
                  <span
                    className={cn(
                      "block h-full rounded-full bg-mint-500 transition-all duration-500",
                      isCompleted ? "w-full" : "w-0",
                    )}
                  />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
