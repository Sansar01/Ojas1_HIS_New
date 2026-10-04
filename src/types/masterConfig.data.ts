/**
 * Master Configuration — the reference lists the configuration modals render
 * (dropdown seeds, shared types). Kept out of the components so each modal
 * file stays presentational; anything the backend owns lives in `masterApi`.
 */

export type ItemType = "" | "laboratory" | "radiology" | "medical" | "others";
export type ModalType =
  | ""
  | "panel"
  | "investigation"
  | "global"
  | "rate-managment"
  | "service-master";

export const INVESTIGATIONS: string[] = [
  "24hrs Urine Protein",
  "Acid Fast Bacilli Smear Sputum",
  "Adenosine deaminase (ADA)",
  "Adrenocorticotropic Hormone",
  "AFB Smear By ZN Stain",
  "AFP",
  "AG RATIO",
  "ALAT- GPT",
  "Albumin",
  "Alkaline Phosphatase",
  "Amylase-Pancreatic",
  "Amylase-Total",
];

export const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export const toOptions = (values: string[]) =>
  values.map((v) => ({ value: v, label: v }));
