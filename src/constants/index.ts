import type {
  AppointmentStatus,
  ConsultationStatus,
  Permission,
} from "@/types";

export const APP_NAME = "OJAS1";
export const APP_SUBTITLE = "Hospital Management Portal";

// MODULES removed per cleanup plan — runtime source is the entitlement API (moduleSlice.modules)
// MODULE_LABEL and ALL_MODULE_KEYS removed for same reason — single source of truth is backend

export const PERMISSIONS: Permission[] = ["view", "create", "edit", "delete"];

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "Scheduled",
  "Confirmed",
  "Checked In",
  "In Progress",
  "Completed",
  "Cancelled",
  "No Show",
];

export const CONSULTATION_STATUSES: ConsultationStatus[] = [
  "Scheduled",
  "In Progress",
  "Completed",
  "Cancelled",
];

export const APPT_TYPE_COLORS: Record<string, string> = {
  TELECONSULTATION: "bg-brand-50 text-brand-700 ring-brand-200",
  WALK_IN: "bg-lagoon-50 text-lagoon-600 ring-lagoon-500/20",
  SCHEDULED: "bg-amberly-50 text-amberly-600 ring-amberly-500/25",
  EMERGENCY: "bg-coral-50 text-coral-600 ring-coral-500/25",
  telemedicine: "bg-mint-50 text-mint-600 ring-mint-500/25",
};

export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const GENDERS = ["Male", "Female", "Other"] as const;
export const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
  "Unknown",
];
export const MARITAL_STATUS = ["Single", "Married", "Divorced", "Widowed"];
export const guardianRelations: Record<string, string> = {
  Self: "SELF",
  Spouse: "SPOUSE",
  Father: "FATHER",
  Mother: "MOTHER",
  Son: "SON",
  Daughter: "DAUGHTER",
  Brother: "BROTHER",
  Sister: "SISTER",
  Guardian: "GUARDIAN",
  Other: "OTHER",
};

export const AVATAR_COLORS = [
  "bg-brand-500",
  "bg-lagoon-500",
  "bg-amberly-500",
  "bg-mint-500",
  "bg-coral-500",
  "bg-ink-600",
  "bg-brand-700",
  "bg-lagoon-600",
];

export const PAGE_SIZES = [8, 12, 25, 50];

/* ------------------------- backend DTO value mirrors ----------------------- */
export const APPOINTMENT_TYPES = [
  { value: "WALK_IN", label: "Walk In" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "EMERGENCY", label: "Emergency" },
  { value: "TELECONSULTATION", label: "Teleconsultation" },
] as const;

export const VISIT_TYPES = [
  { value: "NEW_VISIT", label: "New Visit" },
  { value: "FOLLOW_UP", label: "Follow Up" },
  { value: "REVIEW", label: "Review" },
  { value: "REFERRAL", label: "Referral" },
  { value: "POST_OP", label: "Post Op" },
  { value: "EMERGENCY", label: "Emergency" },
] as const;

export const PRIORITY_OPTIONS = [
  { value: "0", label: "Routine" },
  { value: "1", label: "Urgent" },
  { value: "2", label: "Emergency" },
] as const;

/** Where the forced password change lives — kept in one place. */
export const FORCE_PASSWORD_PATH = "/accounts/force-password-change";
