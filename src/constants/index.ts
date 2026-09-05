import type {
  AppointmentStatus,
  ConsultationStatus,
  ModuleDef,
  ModuleKey,
  PaymentStatus,
  Permission,
} from "@/types";

export const APP_NAME = "Meridian Care";
export const APP_SUBTITLE = "Hospital Management Portal";
export const STORAGE_KEY = "meridian.session.v1";
export const DB_KEY = "meridian.db.v1";

export const MODULES: ModuleDef[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    icon: "LayoutDashboard",
    group: "Insights",
    description: "Live hospital overview & KPIs",
  },
  {
    key: "patients",
    label: "Patients",
    path: "/patients",
    icon: "Users",
    group: "Clinical",
    description: "Registry, profiles & history",
  },
  {
    key: "doctors",
    label: "Doctors",
    path: "/doctors",
    icon: "Stethoscope",
    group: "Clinical",
    description: "Clinicians, fees & availability",
  },
  {
    key: "consultations",
    label: "Consultations",
    path: "/consultation",
    icon: "ClipboardList",
    group: "Clinical",
    description: "Clinical workspace & prescriptions",
  },
  {
    key: "appointments",
    label: "Appointments",
    path: "/appointments",
    icon: "CalendarClock",
    group: "Operations",
    description: "Scheduling engine & slot builder",
  },
  {
    key: "billing",
    label: "Billing",
    path: "/billing",
    icon: "ReceiptIndianRupee",
    group: "Operations",
    description: "Invoices, payments & charges",
  },
  {
    key: "departments",
    label: "Departments",
    path: "departments",
    icon: "Building2",
    group: "Operations",
    description: "Hospital departments",
  },
  {
    key: "specializations",
    label: "Specializations",
    path: "/specializations",
    icon: "Sparkles",
    group: "Operations",
    description: "Clinical specializations",
  },
  {
    key: "users",
    label: "Users",
    path: "/users",
    icon: "UserCog",
    group: "Access",
    description: "Portal users & access",
  },
  {
    key: "roles",
    label: "Roles & Permissions",
    path: "/roles",
    icon: "ShieldCheck",
    group: "Access",
    description: "RBAC matrix per module",
  },
  {
    key: "settings",
    label: "Hospital Settings",
    path: "/settings",
    icon: "Settings",
    group: "Access",
    description: "Facility & invoice settings",
  },
];

export const MODULE_LABEL: Record<ModuleKey, string> = MODULES.reduce(
  (acc, m) => ({ ...acc, [m.key]: m.label }),
  {} as Record<ModuleKey, string>,
);

export const ALL_MODULE_KEYS: ModuleKey[] = MODULES.map((m) => m.key);
export const PERMISSIONS: Permission[] = ["view", "create", "edit", "delete"];
export const PERMISSION_LABEL: Record<Permission, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
};

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
export const PAYMENT_STATUSES: PaymentStatus[] = [
  "Pending",
  "Partially Paid",
  "Paid",
  "Cancelled",
  "Refunded",
];

export const APPT_TYPE_COLORS: Record<string, string> = {
  Consultation: "bg-brand-50 text-brand-700 ring-brand-200",
  "Follow-up": "bg-lagoon-50 text-lagoon-600 ring-lagoon-500/20",
  Procedure: "bg-amberly-50 text-amberly-600 ring-amberly-500/25",
  Emergency: "bg-coral-50 text-coral-600 ring-coral-500/25",
  Telemedicine: "bg-mint-50 text-mint-600 ring-mint-500/25",
};

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
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
  Father: "FATHER",
  Mother: "MOTHER",
  Spouse: "SPOUSE",
  Son: "SON",
  Daughter: "DAUGHTER",
  Other: "OTHER",
};
export const PAYMENT_METHODS = [
  "Cash",
  "Card",
  "UPI",
  "Insurance",
  "Bank Transfer",
  "Wallet",
];
export const INVOICE_CATEGORIES = [
  "Consultation",
  "Procedure",
  "Lab",
  "Pharmacy",
  "Room & Board",
  "Service",
  "Other",
];

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
