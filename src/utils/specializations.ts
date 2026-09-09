// Add this in src/constants.ts or a new file src/constants/specializations.ts

export interface StaticSpecialization {
  id: string;
  name: string;
  code: string;
}

export const STATIC_SPECIALIZATIONS: StaticSpecialization[] = [
  { id: "Cardiology", name: "Cardiology", code: "CARD" },
  { id: "General Medicine", name: "General Medicine", code: "GEN_MED" },
  { id: "Pediatrics", name: "Pediatrics", code: "PED" },
  { id: "Orthopedics", name: "Orthopedics", code: "ORTHO" },
  { id: "Dermatology", name: "Dermatology", code: "DERM" },
  { id: "Neurology", name: "Neurology", code: "NEURO" },
  { id: "Gynecology & Obstetrics", name: "Gynecology & Obstetrics", code: "OBGYN" },
  { id: "ENT (Ear, Nose, Throat)", name: "ENT (Ear, Nose, Throat)", code: "ENT" },
  { id: "Ophthalmology", name: "Ophthalmology", code: "EYE" },
  { id: "Gastroenterology", name: "Gastroenterology", code: "GASTRO" },
  { id: "Pulmonology", name: "Pulmonology", code: "PULMO" },
  { id: "Psychiatry", name: "Psychiatry", code: "PSYCH" },
  { id: "Endocrinology", name: "Endocrinology", code: "ENDO" },
  { id: "Urology", name: "Urology", code: "URO" },
  { id: "Oncology", name: "Oncology", code: "ONCO" },
];