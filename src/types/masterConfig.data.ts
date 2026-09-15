/**
 * Master Configuration — static/seed data & shared types.
 * Kept out of the components so each modal file stays presentational.
 */

export type ItemType = "" | "laboratory" | "radiology" | "medical" | "others";
export type ModalType = "" | "panel" | "investigation" | "global";

export interface LabItem {
    code: string;
    name: string;
    category: string;
    unit: string;
    rate: number;
    active: boolean;
}

export interface PanelItem {
    name: string;
    type: string;
    insurer: string;
    active: boolean;
}

/** A single master list in the Global Configuration modal. */
export interface MasterDef {
    key: string;
    label: string;
    /** Local seed values — used while the master has no backend yet. */
    values?: string[];
    /** Master slug for `/api/hospital/masters/:api`. Presence = API-backed. */
    api?: string;
    /** Field used as the display label on API-backed rows. */
    labelField?: string;
}

export interface MasterGroup {
    section: string;
    items: MasterDef[];
}

export const LAB_ITEMS: LabItem[] = [
    { code: "LAB-1001", name: "Complete Blood Count (CBC)", category: "Hematology", unit: "Each", rate: 300, active: true },
    { code: "LAB-1002", name: "Lipid Profile", category: "Biochemistry", unit: "Each", rate: 800, active: true },
    { code: "LAB-1003", name: "Liver Function Test (LFT)", category: "Biochemistry", unit: "Each", rate: 700, active: true },
    { code: "LAB-1004", name: "Thyroid Profile (T3, T4, TSH)", category: "Hormone", unit: "Each", rate: 900, active: true },
    { code: "LAB-1005", name: "HbA1c", category: "Diabetes", unit: "Each", rate: 600, active: true },
];

export const PANELS: PanelItem[] = [
    { name: "Star Health Insurance", type: "Insurance", insurer: "Star Health", active: true },
    { name: "Aditya Birla Health", type: "Insurance", insurer: "Aditya Birla", active: true },
    { name: "HDFC ERGO General", type: "Insurance", insurer: "HDFC ERGO", active: true },
    { name: "Reliance General", type: "Insurance", insurer: "Reliance", active: true },
    { name: "Max Bupa Health", type: "Insurance", insurer: "Max Bupa", active: false },
];

export const GLOBAL_CONFIG_GROUPS: MasterGroup[] = [
    {
        section: "PANEL / BILLING",
        items: [
            { key: "groupType", label: "Group Type", values: ["INSURANCE", "CORPORATE", "GOVERNMENT", "TPA"] },
            { key: "paymentMode", label: "Payment Mode", values: ["CASH", "CARD", "UPI", "CHEQUE", "NEFT", "WALLET"] },
            { key: "rateType", label: "Rate Type", values: ["STANDARD", "DISCOUNTED", "PREMIUM"] },
            { key: "currency", label: "Currency", values: ["INR", "USD", "EUR", "GBP", "AED"] },
            { key: "panelType", label: "Panel Type", values: ["CREDIT", "CASH"] },
            { key: "taxType", label: "Tax Type", values: ["GST 5%", "GST 12%", "GST 18%", "EXEMPT"] },
            { key: "discountReason", label: "Discount Reason", values: ["STAFF", "SENIOR CITIZEN", "CAMP", "OTHERS"] },
            { key: "refundReason", label: "Refund Reason", values: ["DUPLICATE PAYMENT", "SERVICE NOT AVAILED", "PATIENT REQUEST"] },
            { key: "cancellationReason", label: "Cancellation Reason", values: ["NO SHOW", "DOCTOR UNAVAILABLE", "PATIENT REQUEST"] },
        ],
    },
    {
        section: "CLINICAL",
        items: [
            // API-backed: department endpoint is live.
            { key: "department", label: "Department", api: "departments", labelField: "name" },
            { key: "subDepartment", label: "Sub Department", values: ["Biochemistry", "Hematology", "Microbiology", "Serology", "Pathology"] },
            { key: "consultationType", label: "Consultation Type", values: ["NEW", "FOLLOW-UP", "TELE", "EMERGENCY"] },
            { key: "diagnosisType", label: "Diagnosis Type", values: ["PROVISIONAL", "FINAL", "DIFFERENTIAL"] },
            { key: "dietType", label: "Diet Type", values: ["NORMAL", "DIABETIC", "SOFT", "LIQUID", "NPO"] },
            { key: "ward", label: "Ward", values: ["GENERAL", "SEMI-PRIVATE", "PRIVATE", "DELUXE", "ICU"] },
        ],
    },
];

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
