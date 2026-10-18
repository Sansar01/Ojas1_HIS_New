import { Badge } from "@/components/ui/primitives";

/**
 * Status badge for OPD bill / payment statuses (spec colour map):
 *   PAID = green · GENERATED / PENDING = blue · PARTIALLY_PAID = amber ·
 *   CANCELLED = red · REFUNDED / DRAFT / WAIVED = neutral
 *
 * Kept local to billing so the shared `STATUS_TONE` map (used by
 * appointments, users, masters…) keeps its own colouring.
 */
const BILL_TONES: Record<
  string,
  "mint" | "lagoon" | "amber" | "coral" | "neutral"
> = {
  PAID: "mint",
  GENERATED: "lagoon",
  PENDING: "lagoon",
  PARTIALLY_PAID: "amber",
  CANCELLED: "coral",
  REFUNDED: "neutral",
  DRAFT: "neutral",
  WAIVED: "neutral",
};

/** `PARTIALLY_PAID` → `Partially Paid` */
export const statusLabel = (status?: string | null) =>
  String(status ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

export function BillStatusBadge({
  status,
  className,
}: {
  status?: string | null;
  className?: string;
}) {
  const raw = String(status ?? "");
  if (!raw) return <span className="text-ink-300">—</span>;
  return (
    <Badge tone={BILL_TONES[raw] ?? "neutral"} dot className={className}>
      {statusLabel(raw)}
    </Badge>
  );
}
