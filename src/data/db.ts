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

type DoctorSeed = Omit<Doctor, "id"> & { id: string };
export const doctorsSeed: DoctorSeed[] = [
  {
    id: "doc_1",
    userId: "usr_3",
    firstName: "Meera",
    lastName: "Nair",
    email: "meera.nair@meridian.care",
    mobile: "+91 98450 11223",
    gender: "Female",
    dateOfBirth: "1981-04-18",
    departmentId: "dep_1",
    specializationId: "spe_1",
    qualifications: ["MBBS", "MD (Internal Medicine)"],
    experienceYears: 17,
    registrationNumber: "MCI-45219",
    consultationFee: 900,
    slotDuration: 20,
    bufferTime: 5,
    maxPatientsPerDay: 24,
    schedule: schedule(["09:00", "17:00"], ["10:00", "13:00"]),
    about:
      "Focus on preventive medicine, hypertension and complex multi-morbidity care in adults.",
    mode: "Both",
    status: "active",
    rating: 4.8,
    joinedAt: stamp(-1500),
  },
  {
    id: "doc_2",
    userId: "usr_4",
    firstName: "Arjun",
    lastName: "Rao",
    email: "arjun.rao@meridian.care",
    mobile: "+91 98450 44127",
    gender: "Male",
    dateOfBirth: "1976-11-02",
    departmentId: "dep_4",
    specializationId: "spe_3",
    qualifications: ["MBBS", "MD", "DM (Cardiology)"],
    experienceYears: 24,
    registrationNumber: "MCI-31288",
    consultationFee: 1800,
    slotDuration: 30,
    bufferTime: 10,
    maxPatientsPerDay: 14,
    schedule: schedule(["08:30", "16:30"]),
    about:
      "Over 3,000 coronary interventions. Leads the cath-lab program and structural heart clinic.",
    mode: "In-clinic",
    status: "active",
    rating: 4.9,
    joinedAt: stamp(-2100),
  },
  {
    id: "doc_3",
    userId: "usr_5",
    firstName: "Sana",
    lastName: "Fernandes",
    email: "sana.fernandes@meridian.care",
    mobile: "+91 98450 77123",
    gender: "Female",
    dateOfBirth: "1985-06-30",
    departmentId: "dep_2",
    specializationId: "spe_4",
    qualifications: ["MBBS", "MS (Ortho)"],
    experienceYears: 12,
    registrationNumber: "MCI-58100",
    consultationFee: 1200,
    slotDuration: 25,
    bufferTime: 5,
    maxPatientsPerDay: 16,
    schedule: schedule(["10:00", "18:00"], ["09:00", "12:00"]),
    about:
      "Joint replacement and arthroscopic sports reconstruction with structured rehab pathways.",
    mode: "In-clinic",
    status: "active",
    rating: 4.7,
    joinedAt: stamp(-1120),
  },
  {
    id: "doc_4",
    userId: "usr_6",
    firstName: "Vikram",
    lastName: "Bose",
    email: "vikram.bose@meridian.care",
    mobile: "+91 98450 20981",
    gender: "Male",
    dateOfBirth: "1979-01-12",
    departmentId: "dep_3",
    specializationId: "spe_6",
    qualifications: ["MBBS", "MS (OBG)"],
    experienceYears: 20,
    registrationNumber: "MCI-27743",
    consultationFee: 1400,
    slotDuration: 30,
    bufferTime: 15,
    maxPatientsPerDay: 12,
    schedule: schedule(["09:30", "17:30"]),
    about:
      "High-risk pregnancy clinic, laparoscopic gynae surgery and fertility counselling.",
    mode: "Both",
    status: "active",
    rating: 4.6,
    joinedAt: stamp(-1800),
  },
  {
    id: "doc_5",
    userId: "usr_7",
    firstName: "Hana",
    lastName: "Kimura",
    email: "hana.kimura@meridian.care",
    mobile: "+91 98450 63344",
    gender: "Female",
    dateOfBirth: "1988-09-09",
    departmentId: "dep_5",
    specializationId: "spe_8",
    qualifications: ["MBBS", "DM (Neurology)"],
    experienceYears: 9,
    registrationNumber: "MCI-66210",
    consultationFee: 1600,
    slotDuration: 30,
    bufferTime: 10,
    maxPatientsPerDay: 10,
    schedule: schedule(["11:00", "19:00"]),
    about:
      "Stroke thrombectomy pathway lead, epilepsy and movement disorder clinics.",
    mode: "In-clinic",
    status: "active",
    rating: 4.9,
    joinedAt: stamp(-900),
  },
  {
    id: "doc_6",
    userId: "usr_8",
    firstName: "Imran",
    lastName: "Haddad",
    email: "imran.haddad@meridian.care",
    mobile: "+91 98450 51129",
    gender: "Male",
    dateOfBirth: "1990-03-21",
    departmentId: "dep_3",
    specializationId: "spe_7",
    qualifications: ["MBBS", "DCH", "MRCPI"],
    experienceYears: 7,
    registrationNumber: "MCI-72104",
    consultationFee: 800,
    slotDuration: 15,
    bufferTime: 5,
    maxPatientsPerDay: 32,
    schedule: schedule(["08:00", "14:00"], ["16:00", "19:00"]),
    about:
      "Newborn care, childhood growth clinics and paediatric allergy testing.",
    mode: "Both",
    status: "active",
    rating: 4.5,
    joinedAt: stamp(-700),
  },
  {
    id: "doc_7",
    userId: null,
    firstName: "Priya",
    lastName: "Menon",
    email: "priya.menon@meridian.care",
    mobile: "+91 98450 32001",
    gender: "Female",
    dateOfBirth: "1983-12-05",
    departmentId: "dep_1",
    specializationId: "spe_2",
    qualifications: ["MBBS", "MD", "Fellowship (Diabetology)"],
    experienceYears: 15,
    registrationNumber: "MCI-49021",
    consultationFee: 1000,
    slotDuration: 20,
    bufferTime: 5,
    maxPatientsPerDay: 20,
    schedule: schedule(["09:00", "16:00"]),
    about:
      "Reversal-program coach for type 2 diabetes, metabolic syndrome and lipid care.",
    mode: "Telemedicine",
    status: "inactive",
    rating: 4.4,
    joinedAt: stamp(-1300),
  },
  {
    id: "doc_8",
    userId: null,
    firstName: "Daniel",
    lastName: "Okafor",
    email: "daniel.okafor@meridian.care",
    mobile: "+91 98450 88123",
    gender: "Male",
    dateOfBirth: "1987-07-16",
    departmentId: "dep_2",
    specializationId: "spe_5",
    qualifications: ["MBBS", "MS (General Surgery)"],
    experienceYears: 11,
    registrationNumber: "MCI-61902",
    consultationFee: 1250,
    slotDuration: 25,
    bufferTime: 10,
    maxPatientsPerDay: 14,
    schedule: schedule(["07:30", "15:30"]),
    about:
      "Minimally invasive upper-GI surgery, hernia repair and day-care surgical unit.",
    mode: "In-clinic",
    status: "active",
    rating: 4.7,
    joinedAt: stamp(-980),
  },
];

export const rolesSeed: Role[] = [
  {
    id: "role_sa",
    name: "Super Admin",
    slug: "super_admin",
    system: true,
    description:
      "Unrestricted control over users, modules, roles and facility configuration.",
    createdAt: stamp(-1200),
    permissions: Object.fromEntries(
      [
        "dashboard",
        "users",
        "roles",
        "patients",
        "doctors",
        "departments",
        "specializations",
        "appointments",
        "consultations",
        "billing",
        "settings",
      ].map((m) => [m, ["view", "create", "edit", "delete"]]),
    ),
  },
  {
    id: "role_ad",
    name: "Admin",
    slug: "admin",
    system: true,
    description:
      "Operational administration across clinical and revenue modules.",
    createdAt: stamp(-1150),
    permissions: {
      dashboard: ["view"],
      patients: ["view", "create", "edit"],
      doctors: ["view", "create", "edit"],
      departments: ["view", "create", "edit"],
      specializations: ["view", "create", "edit"],
      appointments: ["view", "create", "edit", "delete"],
      consultations: ["view"],
      billing: ["view", "create", "edit"],
      users: ["view", "create", "edit"],
      roles: ["view"],
      settings: ["view"],
    },
  },
  {
    id: "role_do",
    name: "Doctor",
    slug: "doctor",
    system: true,
    description:
      "Clinical workspace for assigned patients, appointments and prescriptions.",
    createdAt: stamp(-1100),
    permissions: {
      dashboard: ["view"],
      patients: ["view", "edit"],
      doctors: ["view", "edit"],
      appointments: ["view", "edit"],
      consultations: ["view", "create", "edit"],
      billing: ["view"],
      departments: ["view"],
      specializations: ["view"],
    },
  },
  {
    id: "role_re",
    name: "Receptionist",
    slug: "receptionist",
    system: true,
    description:
      "Front-desk registration, appointment booking and patient intake.",
    createdAt: stamp(-1050),
    permissions: {
      dashboard: ["view"],
      patients: ["view", "create", "edit"],
      doctors: ["view"],
      appointments: ["view", "create", "edit"],
      consultations: ["view"],
      billing: ["view", "create"],
      departments: ["view"],
      specializations: ["view"],
    },
  },
  {
    id: "role_bi",
    name: "Billing Staff",
    slug: "billing",
    system: true,
    description: "Invoice generation, payment collection and reconciliation.",
    createdAt: stamp(-1000),
    permissions: {
      dashboard: ["view"],
      patients: ["view"],
      doctors: ["view"],
      appointments: ["view"],
      billing: ["view", "create", "edit", "delete"],
      consultations: ["view"],
    },
  },
  {
    id: "role_lab",
    name: "Lab Coordinator",
    slug: "lab_coordinator",
    system: false,
    description:
      "Custom role for diagnostics coordination and lab billing entries.",
    createdAt: stamp(-320),
    permissions: {
      dashboard: ["view"],
      patients: ["view"],
      appointments: ["view"],
      billing: ["view", "create"],
    },
  },
];

export const usersSeed: User[] = [
  {
    id: "usr_1",
    firstName: "Asha",
    lastName: "Verma",
    email: "admin@meridian.care",
    mobile: "+91 99001 20001",
    roleId: "role_sa",
    role: "SUPER_ADMIN",
    status: "active",
    gender: "Female",
    dateOfBirth: "1984-02-11",
    password: "admin123",
    modules: [
      "dashboard",
      "users",
      "roles",
      "patients",
      "doctors",
      "departments",
      "specializations",
      "appointments",
      "consultations",
      "billing",
      "settings",
    ],
    permissions: {
      dashboard: ["view", "create", "edit", "delete"],
      users: ["view", "create", "edit", "delete"],
      roles: ["view", "create", "edit", "delete"],
      patients: ["view", "create", "edit", "delete"],
      doctors: ["view", "create", "edit", "delete"],
      departments: ["view", "create", "edit", "delete"],
      specializations: ["view", "create", "edit", "delete"],
      appointments: ["view", "create", "edit", "delete"],
      consultations: ["view", "create", "edit", "delete"],
      billing: ["view", "create", "edit", "delete"],
      settings: ["view", "edit"],
    },
    lastLogin: stamp(0),
    createdAt: stamp(-1200),
    color: "bg-brand-500",
    title: "Portal Owner",
  },
  {
    id: "usr_2",
    firstName: "Rohit",
    lastName: "Kulkarni",
    email: "ops@meridian.care",
    mobile: "+91 99001 20002",
    roleId: "role_ad",
    role: "Admin",
    status: "active",
    gender: "Male",
    dateOfBirth: "1986-08-23",
    password: "admin123",
    modules: [
      "dashboard",
      "patients",
      "doctors",
      "appointments",
      "billing",
      "users",
      "departments",
      "specializations",
      "consultations",
      "roles",
      "settings",
    ],
    permissions: {
      dashboard: ["view"],
      patients: ["view", "create", "edit"],
      doctors: ["view", "create", "edit"],
      departments: ["view", "create", "edit"],
      specializations: ["view", "create", "edit"],
      appointments: ["view", "create", "edit", "delete"],
      consultations: ["view"],
      billing: ["view", "create", "edit"],
      users: ["view", "create", "edit"],
      roles: ["view"],
      settings: ["view"],
    },
    lastLogin: stamp(-1),
    createdAt: stamp(-900),
    color: "bg-lagoon-500",
    title: "Operations Manager",
  },
  {
    id: "usr_3",
    firstName: "Meera",
    lastName: "Nair",
    email: "doctor@meridian.care",
    mobile: "+91 98450 11223",
    roleId: "role_do",
    role: "Doctor",
    status: "active",
    gender: "Female",
    dateOfBirth: "1981-04-18",
    password: "doctor123",
    modules: [
      "dashboard",
      "patients",
      "appointments",
      "consultations",
      "doctors",
      "billing",
      "departments",
      "specializations",
    ],
    permissions: {
      dashboard: ["view"],
      patients: ["view", "edit"],
      doctors: ["view", "edit"],
      appointments: ["view", "edit"],
      consultations: ["view", "create", "edit"],
      billing: ["view"],
      departments: ["view"],
      specializations: ["view"],
    },
    lastLogin: stamp(0),
    createdAt: stamp(-1500),
    color: "bg-mint-500",
    title: "Chief of Internal Medicine",
  },
  {
    id: "usr_4",
    firstName: "Arjun",
    lastName: "Rao",
    email: "arjun.rao@meridian.care",
    mobile: "+91 98450 44127",
    roleId: "role_do",
    role: "Doctor",
    status: "active",
    gender: "Male",
    dateOfBirth: "1976-11-02",
    password: "doctor123",
    modules: [
      "dashboard",
      "patients",
      "appointments",
      "consultations",
      "doctors",
    ],
    permissions: {
      dashboard: ["view"],
      patients: ["view", "edit"],
      appointments: ["view", "edit"],
      consultations: ["view", "create", "edit"],
      doctors: ["view", "edit"],
    },
    lastLogin: stamp(-2),
    createdAt: stamp(-2100),
    color: "bg-amberly-500",
    title: "Senior Interventional Cardiologist",
  },
  {
    id: "usr_5",
    firstName: "Lakshmi",
    lastName: "Iyer",
    email: "frontdesk@meridian.care",
    mobile: "+91 99001 20005",
    roleId: "role_re",
    role: "Receptionist",
    status: "active",
    gender: "Female",
    dateOfBirth: "1995-05-14",
    password: "desk123",
    modules: [
      "dashboard",
      "patients",
      "doctors",
      "appointments",
      "billing",
      "departments",
      "specializations",
      "consultations",
    ],
    permissions: {
      dashboard: ["view"],
      patients: ["view", "create", "edit"],
      doctors: ["view"],
      appointments: ["view", "create", "edit"],
      consultations: ["view"],
      billing: ["view", "create"],
      departments: ["view"],
      specializations: ["view"],
    },
    lastLogin: stamp(0),
    createdAt: stamp(-640),
    color: "bg-coral-500",
    title: "Front Desk Lead",
  },
  {
    id: "usr_6",
    firstName: "Sameer",
    lastName: "Gupta",
    email: "billing@meridian.care",
    mobile: "+91 99001 20006",
    roleId: "role_bi",
    role: "Billing Staff",
    status: "active",
    gender: "Male",
    dateOfBirth: "1992-09-27",
    password: "bill123",
    modules: [
      "dashboard",
      "patients",
      "billing",
      "appointments",
      "doctors",
      "consultations",
    ],
    permissions: {
      dashboard: ["view"],
      patients: ["view"],
      billing: ["view", "create", "edit", "delete"],
      appointments: ["view"],
      doctors: ["view"],
      consultations: ["view"],
    },
    lastLogin: stamp(-1),
    createdAt: stamp(-720),
    color: "bg-brand-700",
    title: "Revenue Executive",
  },
  {
    id: "usr_7",
    firstName: "Nadia",
    lastName: "Duarte",
    email: "nadia.duarte@meridian.care",
    mobile: "+91 99001 20007",
    roleId: "role_re",
    role: "Receptionist",
    status: "inactive",
    gender: "Female",
    dateOfBirth: "1997-01-19",
    password: "desk123",
    modules: ["dashboard", "patients", "appointments"],
    permissions: {
      dashboard: ["view"],
      patients: ["view", "create"],
      appointments: ["view", "create"],
    },
    lastLogin: stamp(-46),
    createdAt: stamp(-420),
    color: "bg-ink-600",
    title: "Emergency Desk",
  },
  {
    id: "usr_8",
    firstName: "Theo",
    lastName: "Novak",
    email: "theo.novak@meridian.care",
    mobile: "+91 99001 20008",
    roleId: "role_lab",
    role: "Lab Coordinator",
    status: "active",
    gender: "Male",
    dateOfBirth: "1993-03-03",
    password: "lab123",
    modules: ["dashboard", "patients", "billing", "appointments"],
    permissions: {
      dashboard: ["view"],
      patients: ["view"],
      billing: ["view", "create"],
      appointments: ["view"],
    },
    lastLogin: stamp(-5),
    createdAt: stamp(-320),
    color: "bg-lagoon-600",
    title: "Diagnostics Coordination",
  },
  {
    id: "usr_9",
    firstName: "Ines",
    lastName: "Silva",
    email: "ines.silva@meridian.care",
    mobile: "+91 99001 20009",
    roleId: "role_do",
    role: "Doctor",
    status: "active",
    gender: "Female",
    dateOfBirth: "1989-10-10",
    password: "doctor123",
    modules: ["dashboard", "patients", "appointments", "consultations"],
    permissions: {
      dashboard: ["view"],
      patients: ["view"],
      appointments: ["view", "edit"],
      consultations: ["view", "create", "edit"],
    },
    lastLogin: stamp(-3),
    createdAt: stamp(-500),
    color: "bg-mint-500",
    title: "Resident · Paediatrics",
  },
];

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

export const hospitalSeed: HospitalInfo = {
  name: "Meridian Care Multispeciality Hospital",
  tagline: "Precision medicine, delivered with warmth.",
  address: "Meridian Health City, 14 Residency Road",
  city: "Bengaluru, KA 560025",
  phone: "+91 80 4455 9000",
  email: "hello@meridian.care",
  website: "meridian.care",
  taxId: "IN-GST-29AAECM1234F1Z7",
  currency: "INR",
  currencySymbol: "₹",
  invoicePrefix: "MCH",
  defaultTaxRate: 5,
  timezone: "Asia/Kolkata (IST)",
  licenseNo: "KAR-HOS-2019-008712",
};

function buildPatients() {
  const out: any[] = [];
  for (let i = 0; i < 46; i++) {
    const gender = pick(["Male", "Female", "Male", "Female", "Other"]) as any;
    const age = int(1, 88);
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - age);
    dob.setDate(dob.getDate() - int(0, 360));
    dob.setMonth(dob.getMonth() - int(0, 11));
    out.push({
      id: `pat_${i + 1}`,
      mrn: `MRN-${(240118 + i * 7).toString()}`,
      firstName: pick(FIRST),
      lastName: pick(LAST),
      gender,
      dateOfBirth: dob.toISOString().slice(0, 10),
      ageUnit: age < 2 ? (age === 0 ? "Months" : "Years") : "Years",
      mobile: `+91 9${int(10000, 99999)} ${int(10000, 99999)}`,
      email: `${"patient"}${i + 1}@mail.com`,
      bloodGroup: pick([
        "A+",
        "B+",
        "O+",
        "AB+",
        "O-",
        "A-",
        "B-",
        "AB-",
        "Unknown",
      ]),
      maritalStatus:
        age < 21
          ? "Single"
          : pick(["Married", "Single", "Widowed", "Divorced"]),
      address: pick(STREETS),
      city: pick(CITIES),
      emergencyContactName: `${pick(FIRST)} ${pick(LAST)}`,
      emergencyContactNumber: `+91 9${int(10000, 99999)} ${int(10000, 99999)}`,
      allergies: pick(ALLERGIES),
      chronicConditions: pick(CONDITIONS),
      heightCm: int(96, 189),
      weightKg: int(11, 104),
      status: rnd() > 0.08 ? "active" : "inactive",
      createdAt: stamp(-int(2, 700)),
    });
  }
  return out;
}

function buildAppointments(patients: any[]) {
  const out: Appointment[] = [];
  let n = 0;
  for (let offset = -14; offset <= 10; offset++) {
    const count = offset === 0 ? 9 : int(3, 7);
    for (let k = 0; k < count; k++) {
      const doc = pick(doctorsSeed);
      const patient = pick(patients);
      let status: AppointmentStatus =
        offset < 0
          ? pick(["Completed", "Completed", "No Show", "Cancelled"])
          : offset === 0
            ? pick([
                "Confirmed",
                "Checked In",
                "In Progress",
                "Completed",
                "Scheduled",
              ])
            : pick(["Scheduled", "Scheduled", "Confirmed"]);
      const slotMinutes =
        9 * 60 +
        (k + 1) * Math.round((doc.slotDuration + doc.bufferTime) * 1.1);
      const hh = String(Math.floor(slotMinutes / 60) % 20).padStart(2, "0");
      const mm = String(
        (slotMinutes % 60 < 10 ? 0 : Math.round((slotMinutes % 60) / 5) * 5) %
          60,
      ).padStart(2, "0");
      n += 1;
      out.push({
        id: `apt_${n}`,
        code: `APT-${9000 + n}`,
        patientId: patient.id,
        doctorId: doc.id,
        departmentId: doc.departmentId,
        specializationId: doc.specializationId,
        date: addDays(new Date(), offset),
        time: `${hh}:${mm}`,
        duration: doc.slotDuration,
        type: pick([
          "Consultation",
          "Follow-up",
          "Consultation",
          "Procedure",
          "Telemedicine",
          "Emergency",
        ]),
        fee: doc.consultationFee,
        priority: rnd() > 0.86 ? "Urgent" : "Routine",
        status,
        notes: pick([
          "Patient requested morning slot.",
          "Bringing previous discharge summary.",
          "Insurance pre-auth pending.",
          "Referred by external clinic.",
          "",
          "Requires interpreter (Kannada).",
        ]),
        createdAt: stamp(-int(1, 40)),
        ...(status === "Cancelled"
          ? {
              cancelledReason: pick([
                "Patient rescheduled",
                "Doctor unavailable",
                "Travel constraint",
              ]),
            }
          : {}),
      });
    }
  }
  return out;
}

function buildConsultations(appointments: Appointment[]) {
  const out: Consultation[] = [];
  let n = 0;
  for (const apt of appointments) {
    if (!["Completed", "In Progress"].includes(apt.status)) continue;
    if (rnd() > 0.82) continue;
    n += 1;
    const status: ConsultationStatus =
      apt.status === "In Progress" ? "In Progress" : "Completed";
    const complaint = pick([
      "Persistent dry cough for 9 days with evening fever.",
      "Episodic chest discomfort on exertion for 3 weeks.",
      "Follow-up of HbA1c and foot numbness.",
      "Recurrent migraine with aura, 4 attacks this month.",
      "Lower back pain radiating to left leg after lifting.",
      "Antenatal 28-week routine check-up.",
      "Rash on forearms with itching since travel.",
      "Infant fever 3 days, poor feeding.",
    ]);
    out.push({
      id: `con_${n}`,
      code: `CNS-${(4200 + n).toString()}`,
      appointmentId: apt.id,
      patientId: apt.patientId,
      doctorId: apt.doctorId,
      date: apt.date,
      startTime: apt.time,
      endTime:
        status === "Completed"
          ? `${String(Number(apt.time.slice(0, 2)) + 1).padStart(2, "0")}:10`
          : null,
      chiefComplaint: complaint,
      symptoms: pick([
        "Low grade fever, asthenia, mild breathlessness on stairs.",
        "Tightness in chest, radiating to jaw, 5–10 min episodes.",
        "Glycaemic variability, nocturnal cramps, blurred vision.",
        "Photophobia, nausea, unilateral throbbing pain.",
        "Worse on flexion, no bladder involvement, paraspinal spasm.",
      ]),
      examination:
        "Chest clear, S1 S2 normal, no murmurs. Abdomen soft, non-tender. CNS: no focal deficit.",
      diagnosis: pick([
        "Acute bronchitis — viral aetiology",
        "Stable angina (CCS Class II)",
        "Type 2 diabetes with distal symmetric polyneuropathy",
        "Migraine without aura, episodic",
        "Lumbar radiculopathy, L5 distribution",
      ]),
      notes:
        "Counselled on lifestyle modification. Advised labs and review with reports.",
      vitals: {
        bp: `${int(104, 152)}/${int(64, 96)}`,
        pulse: String(int(58, 108)),
        temp: `${(36 + rnd() * 1.9).toFixed(1)} °F`.replace("°F", "°C"),
        spo2: `${int(94, 99)}%`,
        weight: `${int(12, 102)} kg`,
      },
      prescriptions: [
        {
          id: uid("rx"),
          medicine: "Paracetamol 650 mg",
          dosage: "1 tablet",
          frequency: "TID × 3 days",
          duration: "3 days",
          instructions: "After meals",
        },
        {
          id: uid("rx"),
          medicine: "Azithromycin 500 mg",
          dosage: "1 tablet",
          frequency: "OD × 5 days",
          duration: "5 days",
          instructions: "1 hour before breakfast",
        },
        {
          id: uid("rx"),
          medicine: "Pantoprazole 40 mg",
          dosage: "1 tablet",
          frequency: "OD",
          duration: "7 days",
          instructions: "Before breakfast",
        },
      ].slice(0, int(1, 3)),
      advice:
        "Adequate hydration, steam inhalation twice daily, review if fever persists beyond 72 hours.",
      followUpDate:
        status === "Completed" ? addDays(new Date(apt.date), int(5, 28)) : null,
      status,
    });
  }
  return out;
}

function buildInvoices(patients: any[], consultations: Consultation[]) {
  const out: Invoice[] = [];
  const byPatient = new Map<string, Consultation[]>();
  consultations.forEach((c) =>
    byPatient.set(c.patientId, [...(byPatient.get(c.patientId) ?? []), c]),
  );
  let n = 0;
  for (const p of patients) {
    const count = int(0, 2);
    const cons = byPatient.get(p.id) ?? [];
    for (let i = 0; i < count; i++) {
      n += 1;
      const con = cons[i % Math.max(1, cons.length)];
      const date = addDays(new Date(), -int(0, 120));
      const items = [
        {
          id: uid("it"),
          description: con
            ? `Consultation — ${pick(doctorsSeed).firstName} ${pick(doctorsSeed).lastName}`
            : "Consultation — Specialist OP",
          category: "Consultation",
          quantity: 1,
          unitPrice: int(600, 1800),
        },
        {
          id: uid("it"),
          description: pick([
            "Complete blood count + CRP",
            "Lipid profile & HbA1c",
            "Digital X-ray (2 views)",
            "Echocardiogram",
            "Dressing & minor procedure",
          ]),
          category: pick(["Lab", "Procedure", "Service"]) as any,
          quantity: 1,
          unitPrice: int(350, 4200),
        },
        ...(rnd() > 0.5
          ? [
              {
                id: uid("it"),
                description: "Pharmacy — dispensary",
                category: "Pharmacy" as any,
                quantity: int(2, 6),
                unitPrice: int(90, 620),
              },
            ]
          : []),
      ];
      const subtotal = items.reduce(
        (s, it) => s + it.quantity * it.unitPrice,
        0,
      );
      const discount = rnd() > 0.7 ? Math.round(subtotal * 0.08) : 0;
      const tax = Math.round((subtotal - discount) * 0.05);
      const total = subtotal - discount + tax;
      const roll = rnd();
      let paymentStatus: PaymentStatus = "Paid";
      let paid = total;
      if (roll > 0.82) {
        paymentStatus = "Pending";
        paid = 0;
      } else if (roll > 0.66) {
        paymentStatus = "Partially Paid";
        paid = Math.round(total * (0.3 + rnd() * 0.4));
      } else if (roll > 0.62) {
        paymentStatus = "Refunded";
        paid = total;
      } else if (roll > 0.59) {
        paymentStatus = "Cancelled";
        paid = 0;
      }
      out.push({
        id: `inv_${n}`,
        number: `MCH-${2400 + n}`,
        patientId: p.id,
        doctorId: con ? con.doctorId : null,
        consultationId: con ? con.id : null,
        date,
        dueDate: addDays(new Date(date), 14),
        items,
        discountType: "Flat",
        discountValue: discount,
        taxRate: 5,
        payments:
          paid > 0
            ? [
                {
                  id: uid("pay"),
                  date,
                  amount: paid,
                  method: pick([
                    "Card",
                    "UPI",
                    "Cash",
                    "Insurance",
                    "Bank Transfer",
                  ]) as any,
                  reference: `TXN${int(100000, 999999)}`,
                  note: paid < total ? "Advance deposit" : "Full settlement",
                },
              ]
            : [],
        paymentStatus,
        notes: pick([
          "Insurance claim processed.",
          "Includes consumables.",
          "Package rate — corporate tie-up.",
          "",
        ]),
        insurance:
          rnd() > 0.6
            ? pick(["Star Health", "HDFC Ergo", "ICICI Lombard", "CGHS"])
            : undefined,
        createdAt: stamp(-int(1, 120)),
      });
    }
  }
  return out;
}

function buildActivities(): ActivityLog[] {
  const rows: Array<
    [string, string, string, string, ActivityLog["tone"], number]
  > = [
    [
      "Asha Verma",
      "updated permissions for",
      "Receptionist role",
      "Roles & Permissions",
      "brand",
      0,
    ],
    [
      "Lakshmi Iyer",
      "booked appointment",
      "APT-9063 · Dr. Meera Nair",
      "Appointments",
      "lagoon",
      0,
    ],
    [
      "Meera Nair",
      "completed consultation",
      "CNS-4208 · Ananya Sharma",
      "Consultations",
      "mint",
      -1,
    ],
    [
      "Sameer Gupta",
      "recorded payment ₹4,820",
      "MCH-2417",
      "Billing",
      "brand",
      -1,
    ],
    [
      "Arjun Rao",
      "cancelled slot for",
      "Saturday evening OPD",
      "Doctors",
      "amber",
      -1,
    ],
    [
      "Front Desk",
      "checked in 6 patients",
      "OPD waiting list",
      "Appointments",
      "lagoon",
      -2,
    ],
    ["Asha Verma", "deactivated user", "Nadia Duarte", "Users", "coral", -3],
    [
      "Vikram Bose",
      "added prescription",
      "CNS-4201 · Saanvi Patel",
      "Consultations",
      "mint",
      -3,
    ],
    ["Theo Novak", "created lab invoice", "MCH-2411", "Billing", "brand", -4],
    [
      "Sana Fernandes",
      "rescheduled 3 appointments",
      "Ortho clinic",
      "Appointments",
      "amber",
      -5,
    ],
  ];
  return rows.map(([userName, action, entityName, entity, tone, at], i) => ({
    id: `act_${i + 1}`,
    userName,
    action,
    entity,
    entityName,
    tone,
    at: stamp(at),
  }));
}

export function seedDb(): DB {
  const patients = buildPatients();
  const appointments = buildAppointments(patients);
  const consultations = buildConsultations(appointments);
  const invoices = buildInvoices(patients, consultations);
  return {
    users: usersSeed,
    roles: rolesSeed,
    departments: departmentsSeed,
    specializations: specializationsSeed,
    doctors: doctorsSeed as Doctor[],
    patients,
    appointments,
    consultations,
    invoices,
    activities: buildActivities(),
    hospital: hospitalSeed,
  };
}

export function loadDb(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      // keep demo dates fresh: rebuild if data is from a previous day
      const fresh = parsed.appointments?.some((a) => a.date === todayISO());
      if (!fresh && parsed.patients?.length) {
        const rebuilt = seedDb();
        return {
          ...parsed,
          appointments: rebuilt.appointments,
          consultations: rebuilt.consultations,
          activities: rebuilt.activities,
        };
      }
      return parsed;
    }
  } catch {
    /* ignore corrupt storage */
  }
  const db = seedDb();
  saveDb(db);
  return db;
}

export function saveDb(db: DB) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    /* storage full / unavailable — in-memory only */
  }
}

export function resetDb(): DB {
  const db = seedDb();
  saveDb(db);
  return db;
}

export const idGen = uid;
