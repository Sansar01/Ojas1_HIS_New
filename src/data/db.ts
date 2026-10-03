import type {
  ActivityLog,
  Appointment,
  Consultation,
  Department,
  Doctor,
  Invoice,
  Specialization,
  Role,
  HospitalInfo,
  ISODate,
} from "@/types";
import { User } from "@/types/userTypes";

/* ------------------------------------------------------------------ *
 * Deterministic demo dataset. Acts as the "database" behind the mock
 * API layer (src/api/apiClient.ts) so every module is wired for
 * a real backend without touching component code.
 * ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260214);
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const int = (min: number, max: number) =>
  Math.floor(rnd() * (max - min + 1)) + min;
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export function addDays(base: Date, days: number): ISODate {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
export const todayISO = (): ISODate => new Date().toISOString().slice(0, 10);
const stamp = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(int(7, 19), int(0, 59), 0, 0);
  return d.toISOString();
};

export interface DB {
  users: User[];
  roles: Role[];
  departments: Department[];
  specializations: Specialization[];
  doctors: Doctor[];
  patients: any[];
  appointments: Appointment[];
  consultations: Consultation[];
  invoices: Invoice[];
  activities: ActivityLog[];
  hospital: HospitalInfo;
}

export const idGen = uid;
