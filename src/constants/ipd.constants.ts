/**
 * IPD presentation constants — bed/ward colours, status labels, option lists.
 *
 * Local to the IPD feature so the shared `@/constants` file stays untouched.
 */

import type { Tone } from "@/components/ui/primitives";
import type { BedStatusType, IpdAdmissionStatus } from "../types/ipdTypes";
import { IPD_ADMISSION_TYPES, IPD_DISCHARGE_TYPES } from "../types/ipdTypes";

/* ------------------------------- bed states -------------------------------- */

export interface BedStatusMeta {
  label: string;
  short: string;
  tone: Tone;
  /** bed tile surface — the ward board legend uses exactly these classes */
  tile: string;
  dot: string;
  /** emoji used in the compact legend / print view */
  glyph: string;
}

/**
 * The 7 bed states of the state machine (`ALLOWED_TRANSITIONS` in
 * `masters/ward-room/services/bed-status.service.ts`).
 */
export const BED_STATUS_META: Record<BedStatusType, BedStatusMeta> = {
  AVAILABLE: {
    label: "Available",
    short: "AVAIL",
    tone: "mint",
    tile: "border-mint-500/40 bg-mint-50 text-mint-700 hover:border-mint-500",
    dot: "bg-mint-500",
    glyph: "🟢",
  },
  RESERVED: {
    label: "Reserved",
    short: "RSVD",
    tone: "lagoon",
    tile: "border-lagoon-500/40 bg-lagoon-50 text-lagoon-700 hover:border-lagoon-500",
    dot: "bg-lagoon-500",
    glyph: "🔵",
  },
  OCCUPIED: {
    label: "Occupied",
    short: "OCC",
    tone: "coral",
    tile: "border-coral-500/40 bg-coral-50 text-coral-700 hover:border-coral-500",
    dot: "bg-coral-500",
    glyph: "🔴",
  },
  DISCHARGE_PENDING: {
    label: "Discharge pending",
    short: "D/C PEND",
    tone: "amber",
    tile: "border-amberly-500/45 bg-amberly-50 text-amberly-700 hover:border-amberly-500",
    dot: "bg-amberly-500",
    glyph: "🟠",
  },
  HOUSEKEEPING: {
    label: "Housekeeping",
    short: "CLEANING",
    tone: "amber",
    tile: "border-amberly-500/40 bg-amberly-50/70 text-amberly-700 hover:border-amberly-500",
    dot: "bg-amberly-500",
    glyph: "🟡",
  },
  MAINTENANCE: {
    label: "Maintenance",
    short: "MAINT",
    tone: "neutral",
    tile: "border-ink-300 bg-ink-50 text-ink-600 hover:border-ink-400",
    dot: "bg-ink-400",
    glyph: "⚫",
  },
  OUT_OF_SERVICE: {
    label: "Out of service",
    short: "OOS",
    tone: "neutral",
    tile: "border-ink-200 bg-ink-25 text-ink-400 hover:border-ink-300",
    dot: "bg-ink-300",
    glyph: "⚪",
  },
};

export const bedStatusOf = (status?: string | null): BedStatusMeta =>
  BED_STATUS_META[(status ?? "AVAILABLE") as BedStatusType] ??
  BED_STATUS_META.AVAILABLE;

/** Legend order used on the ward board (matches the story board). */
export const BED_LEGEND_ORDER: BedStatusType[] = [
  "OCCUPIED",
  "AVAILABLE",
  "HOUSEKEEPING",
  "RESERVED",
  "DISCHARGE_PENDING",
  "MAINTENANCE",
  "OUT_OF_SERVICE",
];

/* --------------------------- admission lifecycle --------------------------- */

export const ADMISSION_STATUS_META: Record<
  string,
  { label: string; tone: Tone }
> = {
  ADMITTED: { label: "Admitted", tone: "mint" },
  DISCHARGE_ORDERED: { label: "Discharge ordered", tone: "amber" },
  DISCHARGED: { label: "Discharged", tone: "lagoon" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export const admissionStatusMeta = (status?: string | null) =>
  ADMISSION_STATUS_META[(status ?? "").toUpperCase()] ?? {
    label: status ?? "—",
    tone: "neutral" as Tone,
  };

export const ADMISSION_TYPE_LABEL: Record<string, string> = {
  EMERGENCY: "Emergency",
  PLANNED: "Planned",
  TRANSFER: "Transfer in",
  DAYCARE: "Daycare",
};

export const DISCHARGE_TYPE_LABEL: Record<string, string> = {
  NORMAL: "Normal discharge",
  LAMA: "LAMA (left against advice)",
  TRANSFERRED: "Transferred out",
  EXPIRED: "Expired",
};

/* ------------------------------ option lists ------------------------------- */

export const ADMISSION_TYPE_OPTIONS = IPD_ADMISSION_TYPES.map((value) => ({
  value,
  label: ADMISSION_TYPE_LABEL[value] ?? value,
}));

export const DISCHARGE_TYPE_OPTIONS = IPD_DISCHARGE_TYPES.map((value) => ({
  value,
  label: DISCHARGE_TYPE_LABEL[value] ?? value,
}));

export const ADMISSION_STATUS_OPTIONS = (
  Object.keys(ADMISSION_STATUS_META) as IpdAdmissionStatus[]
).map((value) => ({
  value,
  label: ADMISSION_STATUS_META[value].label,
}));

/** Ward gender of `Room.gender` (WardGender enum). */
export const WARD_GENDER_LABEL: Record<string, string> = {
  ANY: "Any gender",
  MALE_ONLY: "Male only",
  FEMALE_ONLY: "Female only",
  PEDIATRIC: "Paediatric",
};

export const wardGenderLabel = (gender?: string | null) =>
  WARD_GENDER_LABEL[(gender ?? "").toUpperCase()] ?? gender ?? "—";

/**
 * Client-side mirror of the server's gender-ward rule
 * (`assertBedAssignable` — the server still enforces it).
 * Returns null when the pair is compatible, else a human reason.
 */
export const wardGenderConflict = (
  roomGender?: string | null,
  patientGender?: string | null,
): string | null => {
  const room = (roomGender ?? "ANY").toUpperCase();
  const patient = (patientGender ?? "").toUpperCase();
  if (!patient || room === "ANY") return null;
  if (room === "MALE_ONLY" && patient !== "MALE")
    return "Ward is male-only";
  if (room === "FEMALE_ONLY" && patient !== "FEMALE")
    return "Ward is female-only";
  return null;
};
