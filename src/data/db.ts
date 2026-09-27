import { DB_KEY } from "@/constants";
import type {
  ActivityLog,
  Appointment,
  Consultation,
  Department,
  Doctor,
  Invoice,
  Specialization,
  User,
  Role,
  HospitalInfo,
  ISODate,
  AppointmentStatus,
  ConsultationStatus,
  PaymentStatus,
} from "@/types";

/* ------------------------------------------------------------------ *
 * Deterministic demo dataset. Acts as the "database" behind the mock
 * API layer (src/services/apiClient.ts) so every module is wired for
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

const FIRST = [
  "Aarav",
  "Vivaan",
  "Aditya",
  "Rohan",
  "Kabir",
  "Arjun",
  "Ishaan",
  "Dhruv",
  "Ananya",
  "Diya",
  "Saanvi",
  "Aadhya",
  "Myra",
  "Kiara",
  "Neha",
  "Priya",
  "Ravi",
  "Sameer",
  "Zoya",
  "Hana",
  "Omar",
  "Layla",
  "Yusuf",
  "Mariam",
  "Daniel",
  "Sarah",
  "Ethan",
  "Noah",
  "Amara",
  "Theo",
  "Ines",
  "Luca",
];
const LAST = [
  "Sharma",
  "Iyer",
  "Nair",
  "Patel",
  "Bose",
  "Menon",
  "Kulkarni",
  "Rao",
  "Fernandes",
  "Kaur",
  "Gupta",
  "Mehta",
  "Joshi",
  "Reddy",
  "Chopra",
  "Ahmed",
  "Haddad",
  "Novak",
  "Silva",
  "Duarte",
  "Okafor",
  "Kimura",
];
const STREETS = [
  "22 Palm Grove Rd",
  "7 Marina Bay Ave",
  "41 Hillcrest Lane",
  "9 Cotton Street",
  "115 Lake View Rd",
  "3 Rosewood Court",
  "58 Harbour Walk",
  "14 Jasmine Alley",
  "90 Cedar Street",
  "5 Fort Road",
];
const CITIES = [
  "Bengaluru",
  "Mumbai",
  "Kochi",
  "Chennai",
  "Hyderabad",
  "Goa",
  "Pune",
  "Dubai",
  "Lisbon",
  "Colombo",
];
const ALLERGIES = [
  "Penicillin",
  "Peanuts",
  "Dust mites",
  "Sulfa drugs",
  "Latex",
  "Shellfish",
  "Aspirin",
  "None known",
];
const CONDITIONS = [
  "Hypertension",
  "Type 2 Diabetes",
  "Asthma",
  "Hypothyroidism",
  "Migraine",
  "Anemia",
  "GERD",
  "Polycystic ovary",
  "None reported",
];

export const departmentsSeed: Department[] = [
  {
    id: "dep_1",
    name: "Internal Medicine",
    code: "IM",
    description:
      "Adult non-surgical medical care and chronic disease management.",
    headDoctorId: "doc_1",
    floor: "Block A · 2nd",
    status: "active",
    createdAt: stamp(-820),
  },
  {
    id: "dep_2",
    name: "Surgery & Trauma",
    code: "SUR",
    description: "Elective and emergency surgical services with OT support.",
    headDoctorId: "doc_3",
    floor: "Block B · 3rd",
    status: "active",
    createdAt: stamp(-800),
  },
  {
    id: "dep_3",
    name: "Mother & Child",
    code: "MC",
    description: "Obstetrics, gynaecology, paediatrics and neonatal care.",
    headDoctorId: "doc_4",
    floor: "Block C · 1st",
    status: "active",
    createdAt: stamp(-760),
  },
  {
    id: "dep_4",
    name: "Cardiac Sciences",
    code: "CAR",
    description: "Non-invasive and interventional cardiology programs.",
    headDoctorId: "doc_2",
    floor: "Block A · 4th",
    status: "active",
    createdAt: stamp(-700),
  },
  {
    id: "dep_5",
    name: "Neurosciences",
    code: "NEU",
    description: "Neurology, neuro-surgery and rehabilitation services.",
    headDoctorId: "doc_5",
    floor: "Block D · 2nd",
    status: "active",
    createdAt: stamp(-660),
  },
  {
    id: "dep_6",
    name: "Emergency & Critical Care",
    code: "ECC",
    description: "24×7 triage, resuscitation and intensive care units.",
    headDoctorId: null,
    floor: "Block A · Ground",
    status: "inactive",
    createdAt: stamp(-500),
  },
];

export const specializationsSeed: Specialization[] = [
  {
    id: "spe_1",
    name: "General Medicine",
    code: "GM",
    departmentId: "dep_1",
    description: "Primary adult care, preventive screening.",
    status: "active",
    createdAt: stamp(-800),
  },
  {
    id: "spe_2",
    name: "Diabetology",
    code: "DBT",
    departmentId: "dep_1",
    description: "Endocrine & metabolic disorders.",
    status: "active",
    createdAt: stamp(-790),
  },
  {
    id: "spe_3",
    name: "Interventional Cardiology",
    code: "IC",
    departmentId: "dep_4",
    description: "Angioplasty and coronary intervention.",
    status: "active",
    createdAt: stamp(-700),
  },
  {
    id: "spe_4",
    name: "Orthopaedic Surgery",
    code: "ORT",
    departmentId: "dep_2",
    description: "Joint replacement, sports injury.",
    status: "active",
    createdAt: stamp(-690),
  },
  {
    id: "spe_5",
    name: "General Surgery",
    code: "GS",
    departmentId: "dep_2",
    description: "Laparoscopic & open procedures.",
    status: "active",
    createdAt: stamp(-680),
  },
  {
    id: "spe_6",
    name: "Obstetrics & Gynaecology",
    code: "OG",
    departmentId: "dep_3",
    description: "Pregnancy care and gynae surgery.",
    status: "active",
    createdAt: stamp(-640),
  },
  {
    id: "spe_7",
    name: "Paediatrics",
    code: "PD",
    departmentId: "dep_3",
    description: "Newborn to adolescent medicine.",
    status: "active",
    createdAt: stamp(-630),
  },
  {
    id: "spe_8",
    name: "Neurology",
    code: "NL",
    departmentId: "dep_5",
    description: "Stroke, epilepsy, movement disorders.",
    status: "active",
    createdAt: stamp(-600),
  },
  {
    id: "spe_9",
    name: "Dermatology",
    code: "DRM",
    departmentId: "dep_1",
    description: "Skin, hair and laser clinic.",
    status: "inactive",
    createdAt: stamp(-420),
  },
];

const schedule = (monFri: [string, string], sat?: [string, string]) =>
  [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    enabled: day >= 1 && day <= 5 ? monFri !== null : Boolean(sat) && day === 6,
    start: day === 6 ? (sat?.[0] ?? "10:00") : (monFri?.[0] ?? "09:00"),
    end: day === 6 ? (sat?.[1] ?? "13:00") : (monFri?.[1] ?? "17:00"),
  }));

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





