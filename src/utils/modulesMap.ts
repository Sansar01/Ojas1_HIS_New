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
// Static mapping for icons based on module name/label
export const moduleMap: Record<
  string,
  { label: string; path: string; icon: any }
> = {
  Dashboard: {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  Patients: {
    label: "Patients",
    path: "/patients",
    icon: Users,
  },
  Doctors: {
    label: "Doctors",
    path: "/doctors",
    icon: Stethoscope,
  },
  Appointments: {
    label: "Appointments",
    path: "/appointments",
    icon: CalendarClock,
  },
  Consultations: {
    label: "Consultations",
    path: "/consultations",
    icon: ClipboardList,
  },
  Billing: {
    label: "Billing",
    path: "/billing",
    icon: ReceiptIndianRupee,
  },
  Departments: {
    label: "Departments",
    path: "/departments",
    icon: Building2,
  },
  Specializations: {
    label: "Specializations",
    path: "/specializations",
    icon: Sparkles,
  },
  Users: {
    label: "Users",
    path: "/users",
    icon: UserCog,
  },
  Roles: {
    label: "Roles",
    path: "/roles",
    icon: ShieldCheck,
  },
  Settings: {
    label: "Settings",
    path: "/settings",
    icon: Settings,
  },
};
// Helper function to get module info by label (case-insensitive)
export function getModuleInfoByLabel(label: string) {
  const normalizedLabel = label.trim().toLowerCase();
  const foundKey = Object.keys(moduleMap).find(
    (key) => key.toLowerCase() === normalizedLabel,
  );
  return foundKey ? moduleMap[foundKey] : null;
}
