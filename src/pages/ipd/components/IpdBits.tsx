/**
 * Small IPD presentation bits — status badge, chip, info row, pending-backend
 * note. Purely presentational, no API calls. Used by the ward board, census,
 * admission form, patient chart and discharge screens.
 *
 * Lives in the IPD feature folder (`src/pages/ipd/components/`) because the
 * statuses it renders are IPD statuses; it still builds on the app-wide UI kit
 * (`@/components/ui/primitives`) instead of its own primitives.
 */

import type { ReactNode } from "react";
import { Construction } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/primitives";
import { admissionStatusMeta, bedStatusOf } from "@/constants/ipd.constants";

/* --------------------------------- badges ---------------------------------- */

/** ADMITTED / DISCHARGE_ORDERED / DISCHARGED / CANCELLED pill. */
export function AdmissionStatusBadge({ status }: { status?: string | null }) {
  const meta = admissionStatusMeta(status);
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

/** One of the 7 bed states (AVAILABLE, OCCUPIED, HOUSEKEEPING, …). */
export function BedStatusBadge({ status }: { status?: string | null }) {
  const meta = bedStatusOf(status);
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

/** Small tinted chip used inside cards (ward, panel, admission type…). */
export function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <Badge tone={tone} size="xs">
      {children}
    </Badge>
  );
}

/* ----------------------------- backend-pending ----------------------------- */

/**
 * Honest placeholder for an IPD feature whose backend endpoint has not shipped
 * yet (vitals, rounds, MAR, running bill…).
 *
 * The screen is fully wired; this block names the exact endpoints it will call
 * once they exist, so the gap is visible in the UI instead of being hidden
 * behind fake data. Delete the block when the endpoint lands.
 */
export function PendingBackendNote({
  title,
  endpoints,
  children,
}: {
  title: string;
  /** exact endpoint strings, e.g. "POST /api/ipd/vitals" */
  endpoints: string[];
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-amberly-500/40 bg-amberly-50/40 px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-amberly-50 text-amberly-600">
          <Construction className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-ink-800">{title}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">
            {children ??
              "This screen is ready. It starts showing live data as soon as the backend endpoint below ships — no frontend change will be needed."}
          </p>
          <ul className="mt-2.5 space-y-1">
            {endpoints.map((endpoint) => (
              <li
                key={endpoint}
                className="num rounded-md bg-white/70 px-2 py-1 text-[11.5px] font-medium text-amberly-700 ring-1 ring-inset ring-amberly-500/20"
              >
                {endpoint}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- layout ---------------------------------- */

/** Label + value row used in the chart's overview column. */
export function InfoRow({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-ink-100 py-2 last:border-0">
      <span className="text-[12px] text-ink-400">{label}</span>
      <span className="text-right text-[13px] font-medium text-ink-800">
        {value}
      </span>
    </div>
  );
}
