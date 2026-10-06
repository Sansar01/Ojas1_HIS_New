import type { Appointment, Doctor, ScheduleDay } from "@/types";

/* --------------------------- formatting helpers --------------------------- */

export const formatMoney = (value: number, symbol = "₹") =>
  `${symbol}${(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const formatCompact = (value: number) =>
  Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);

export const formatDate = (
  iso?: string | null,
  opts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
  },
) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", opts);
};

export const formatDateTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · ${formatTime(d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }))}`;
};

export const relativeTime = (iso?: string | null) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 60) return mins <= 0 ? "just now" : `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
};

export const formatTime = (hhmm: string) => {
  if (!hhmm) return "—";
  const [hRaw, mRaw] = hhmm.split(":");
  const h = Number(hRaw);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${mRaw ?? "00"} ${suffix}`;
};

export const minutesToTime = (mins: number) =>
  `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(Math.round(mins % 60)).padStart(2, "0")}`;

export const timeToMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const calcAge = (
  dob: string,
  unit: "Years" | "Months" | "Days" = "Years",
) => {
  if (!dob) return "—";
  const birth = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years -= 1;
  if (unit === "Months") return `${years * 12 + Math.max(0, m)} mo`;
  if (unit === "Days")
    return `${Math.floor((now.getTime() - birth.getTime()) / 86400000)} d`;
  return `${Math.max(0, years)} yrs`;
};


export const fullName = (
  p?: { firstName?: string; lastName?: string } | null,
) => (p ? `${p.firstName} ${p.lastName}`.trim() : "Unknown");

export const toCSV = (rows: Record<string, any>[]) => {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
};

export const downloadText = (
  filename: string,
  content: string,
  type = "text/csv",
) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 400);
};

/** ISO date (YYYY-MM-DD) `days` away from `base`. */
export const addDays = (base: Date, days: number): string => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const todayISO = (): string => addDays(new Date(), 0);

/** Stable-enough local id for rows created in the UI (prescription lines, …). */
export const idGen = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

/* ------------------------- invoice & money maths ------------------------- */

/**
 * Money maths for one OPD bill, read from the fields `GET /api/opd/billing`
 * actually returns — flat totals, no line-item array. `payments[]` is summed
 * when present, otherwise `paidAmount` is used; `dueAmount` is the server's own
 * outstanding figure. Every field is optional, so a missing bill never throws.
 */
export function invoiceTotals(
  invoice: {
    subtotal?: number | string | null;
    discountAmount?: number | string | null;
    taxAmount?: number | string | null;
    totalAmount?: number | string | null;
    paidAmount?: number | string | null;
    dueAmount?: number | string | null;
    payments?: { amount?: number | string | null }[] | null;
  } = {},
) {
  const num = (v: unknown) => Number(v || 0);
  const payments = Array.isArray(invoice.payments) ? invoice.payments : [];
  const subtotal = num(invoice.subtotal);
  const discount = num(invoice.discountAmount);
  const taxable = Math.max(0, subtotal - discount);
  const tax = num(invoice.taxAmount);
  const total = num(invoice.totalAmount);
  const paid = payments.length
    ? payments.reduce((s, p) => s + num(p?.amount), 0)
    : num(invoice.paidAmount);
  return {
    subtotal,
    discount,
    taxable,
    tax,
    total,
    paid,
    remaining: Math.max(0, num(invoice.dueAmount ?? total - paid)),
  };
}

/* --------------------- appointment slot generation engine ---------------- */

export interface SlotOption {
  time: string;
  minute: number;
  state: "available" | "booked" | "past" | "unavailable";
  label: string;
}

export function generateSlots(
  doctor: Doctor | undefined,
  date: string,
  existing: Appointment[] = [],
  now = new Date(),
): SlotOption[] {
  if (!doctor) return [];
  const weekday = new Date(date).getDay();
  const day: ScheduleDay | undefined = doctor.schedule?.find(
    (s) => s.day === weekday,
  );
  if (!day || !day.enabled) return [];

  const startMin = timeToMinutes(day.start);
  const endMin = timeToMinutes(day.end);
  const step = Math.max(
    5,
    Number(doctor.slotDuration || 20) + Number(doctor.bufferTime || 0),
  );
  const booked = new Map<number, Appointment>();
  existing
    .filter(
      (a) =>
        a.date === date &&
        a.doctorId === doctor.id &&
        !["Cancelled", "No Show"].includes(a.status),
    )
    .forEach((a) => booked.set(timeToMinutes(a.time), a));
  const isToday = date === now.toISOString().slice(0, 10);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const slots: SlotOption[] = [];
  let capacity = 0;
  for (
    let m = startMin;
    m + Number(doctor.slotDuration || 20) <= endMin;
    m += step
  ) {
    const time = minutesToTime(m);
    let state: SlotOption["state"] = "available";
    if (booked.has(m)) state = "booked";
    else if (isToday && m < nowMin) state = "past";
    else if (capacity >= Number(doctor.maxPatientsPerDay || 99))
      state = "unavailable";
    if (state === "available" || state === "booked") capacity += 1;
    slots.push({
      time,
      minute: m,
      state,
      label:
        state === "booked"
          ? `Booked · ${booked.get(m)!.code}`
          : state === "past"
            ? "Elapsed"
            : state === "unavailable"
              ? "Capacity reached"
              : "Open",
    });
  }
  return slots;
}

export const range = (n: number) => Array.from({ length: n }, (_, i) => i);

