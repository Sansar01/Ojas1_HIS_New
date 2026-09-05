const BACKEND_TO_UI: Record<string, string> = {
  A_POSITIVE: "A+",
  A_NEGATIVE: "A-",
  B_POSITIVE: "B+",
  B_NEGATIVE: "B-",
  AB_POSITIVE: "AB+",
  AB_NEGATIVE: "AB-",
  O_POSITIVE: "O+",
  O_NEGATIVE: "O-",
  UNKNOWN: "Unknown",
};

// Display value → backend enum (for forms / API payloads)
export const toBackendBloodGroup = (value: string) =>
  Object.entries(BACKEND_TO_UI).find(([, ui]) => ui === value)?.[0] ??
  (value ? value.toUpperCase() : "UNKNOWN");

// Backend enum → display value (for tables / detail views)
export const toDisplayBloodGroup = (value?: string | null): string => {
  if (!value || !value.trim()) return "Unknown";
  const v = value.trim().toUpperCase();

  if (BACKEND_TO_UI[v]) return BACKEND_TO_UI[v];
  // Fallback: handles any XXX_POSITIVE / XXX_NEGATIVE shape
  if (v.endsWith("_POSITIVE")) return v.replace("_POSITIVE", "+");
  if (v.endsWith("_NEGATIVE")) return v.replace("_NEGATIVE", "-");

  return value; // already in display format (e.g. "A+")
};
