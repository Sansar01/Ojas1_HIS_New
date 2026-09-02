import { idGen } from "@/data/db";
import type { Doctor, InvoiceItem, Patient, ScheduleDay, User } from "@/types";

/* ---------------------------------------------------------------------------
 * Realistic starting values for create-forms. Everything is editable — the
 * point is that a reviewer can walk a full workflow (register → book →
 * consult → bill) without hand-typing a single field, and every required
 * field already passes validation.
 * ------------------------------------------------------------------------ */

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const FIRST_F = [
  "Ananya",
  "Saanvi",
  "Meera",
  "Zoya",
  "Ines",
  "Mariam",
  "Priya",
];
const FIRST_M = ["Rohan", "Kabir", "Daniel", "Yusuf", "Ethan", "Sameer"];
const LAST = [
  "Iyer",
  "Nair",
  "Fernandes",
  "Okafor",
  "Duarte",
  "Bose",
  "Menon",
  "Haddad",
];
const STREETS = [
  "7 Marina Bay Ave, Apt 3B",
  "22 Palm Grove Rd",
  "41 Hillcrest Lane",
  "115 Lake View Rd",
  "3 Rosewood Court",
];
const CITIES = [
  "Bengaluru, KA 560025",
  "Kochi, KL 682016",
  "Pune, MH 411001",
  "Chennai, TN 600028",
];
const MOBILE = () =>
  `+91 9${Math.floor(10000 + Math.random() * 89999)} ${Math.floor(10000 + Math.random() * 89999)}`;

export const samplePatient = (): Partial<Patient> => {
  const female = Math.random() > 0.45;
  const first = female ? pick(FIRST_F) : pick(FIRST_M);
  const last = pick(LAST);
  return {
    firstName: first,
    lastName: last,
    gender: female ? "Female" : "Male",
    dateOfBirth: `19${Math.floor(70 + Math.random() * 29)}-0${Math.floor(1 + Math.random() * 9)}-1${Math.floor(Math.random() * 9)}`,
    ageUnit: "Years",
    mobile: MOBILE(),
    altMobile: MOBILE(),
    email: `${first.toLowerCase()}.${last.toLowerCase()}@mail.com`,
    bloodGroup: pick(["O+", "A+", "B+", "AB+", "O-"]),
    maritalStatus: "Married",
    address: pick(STREETS),
    city: pick(CITIES),
    emergencyContactName: `${pick([...FIRST_M, ...FIRST_F])} ${last} (spouse)`,
    emergencyContactNumber: MOBILE(),
    allergies: "Penicillin, Dust mites",
    chronicConditions: "Hypertension, Type 2 Diabetes",
    heightCm: 168,
    weightKg: 66,
    status: "active",
  };
};

const week = (days: number[]): ScheduleDay[] =>
  [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    enabled: days.includes(day),
    start: day === 6 ? "10:00" : "09:00",
    end: day === 6 ? "13:00" : "17:00",
  }));

export const sampleDoctor = (): Partial<Doctor> => {
  const female = Math.random() > 0.5;
  const first = female ? pick(FIRST_F) : pick(FIRST_M);
  const last = pick(LAST);
  return {
    firstName: first,
    lastName: last,
    gender: female ? "Female" : "Male",
    email: `${first.toLowerCase()}.${last.toLowerCase()}@meridian.care`,
    mobile: MOBILE(),
    dateOfBirth: "1984-06-12",
    qualifications: [
      "MBBS",
      "MD",
      "DM (Cardiology)",
      "Fellowship — Preventive Cardiology",
    ],
    experienceYears: 14,
    registrationNumber: `MCI-${Math.floor(30000 + Math.random() * 49999)}`,
    consultationFee: 1200,
    slotDuration: 20,
    bufferTime: 5,
    maxPatientsPerDay: 18,
    mode: "Both",
    status: "active",
    about:
      "Preventive cardiology, rhythm disorders and structured post-procedure follow-up clinics.",
    schedule: week([1, 2, 3, 4, 5, 6]),
  };
};

export const sampleUser = (): Partial<User> => ({
  firstName: pick(["Lakshmi", "Arun", "Neha", "Tarun"]),
  lastName: pick(LAST),
  gender: "Female",
  dateOfBirth: "1994-02-09",
  email: "",
  mobile: MOBILE(),
  title: "Senior Executive · Patient Access",
  status: "active",
  password: "portal123",
  modules: ["dashboard", "patients", "appointments", "billing"],
  permissions: {
    dashboard: ["view"],
    patients: ["view", "create", "edit"],
    appointments: ["view", "create", "edit"],
    billing: ["view", "create"],
  },
});

export const sampleClinicalNote = () => ({
  chiefComplaint:
    "Three-week history of exertional chest tightness with mild breathlessness on two flights of stairs.",
  symptoms:
    "Retrosternal pressure radiating to the left arm, lasting 5–8 minutes, relieved by rest. No syncope, no orthopnoea. Smoker, 6 cpd for 8 years.",
  examination:
    "Chest clear, S1 S2 normal, no murmurs or gallop. JVP not raised. No pedal oedema. Bilateral radial pulses 2+. BP 138/86 in the right arm.",
  diagnosis:
    "Stable angina pectoris (CCS Class II) — plan for stress echocardiography and lipid optimisation.",
  notes:
    "Counselled on smoking cessation and Mediterranean diet. Aspirin 75 mg and high-intensity statin initiated pending reports.",
  advice:
    "Avoid strenuous exertion until reviewed. Return immediately for rest pain, sweating or breathlessness. Cardiac rehab referral placed.",
  vitals: {
    bp: "138/86",
    pulse: "78/min",
    temp: "36.8 °C",
    spo2: "97%",
    weight: "74 kg",
  },
});

export const sampleInvoiceLines = (): InvoiceItem[] => [
  {
    id: idGen("it"),
    description: "Consultation — specialist OPD review",
    category: "Consultation",
    quantity: 1,
    unitPrice: 1200,
  },
  {
    id: idGen("it"),
    description: "ECG + 2D echocardiography",
    category: "Procedure",
    quantity: 1,
    unitPrice: 2400,
  },
  {
    id: idGen("it"),
    description: "Lipid profile, HbA1c, renal panel",
    category: "Lab",
    quantity: 1,
    unitPrice: 950,
  },
];

export const samplePrescription = () => [
  {
    id: idGen("rx"),
    medicine: "Aspirin 75 mg",
    dosage: "1 tablet",
    frequency: "OD",
    duration: "30 days",
    instructions: "After dinner",
  },
  {
    id: idGen("rx"),
    medicine: "Atorvastatin 40 mg",
    dosage: "1 tablet",
    frequency: "OD",
    duration: "30 days",
    instructions: "At bedtime",
  },
];
