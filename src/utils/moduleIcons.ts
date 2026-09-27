import {
  LayoutDashboard,
  Users,
  Stethoscope,
  CalendarClock,
  ClipboardList,
  ReceiptIndianRupee,
  Building2,
  Sparkles,
  UserCog,
  ShieldCheck,
  Settings,
  UserPlus,
} from "lucide-react";

// Icon-only mapping — stable module code → icon
// No label/path duplication. Use module.name for display, module.route for navigation.
export const moduleIcons: Record<string, any> = {
  DASHBOARD: LayoutDashboard,
  PATIENT_REGISTRATION: UserPlus,
  PATIENTS: Users,
  DOCTORS: Stethoscope,
  APPOINTMENTS: CalendarClock,
  CONSULTATIONS: ClipboardList,
  CONSULTATION: ClipboardList,
  BILLING: ReceiptIndianRupee,
  DEPARTMENTS: Building2,
  DEPARTMENT: Building2,
  SPECIALIZATIONS: Sparkles,
  SPECIALIZATION: Sparkles,
  USERS: UserCog,
  ROLES: ShieldCheck,
  SETTINGS: Settings,
};

function normalizeCode(value: string = "") {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
}

export function getModuleIconByCode(code: string) {
  const normalized = normalizeCode(code);
  return (
    moduleIcons[normalized] || moduleIcons[normalized.replace(/S$/, "")] || null
  );
}

// Backward compat — will be removed after Sidebar migration
export { moduleIcons as moduleMap };
