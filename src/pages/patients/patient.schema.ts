/**
 * Patient registration / edit form — validation schema and field validators.
 *
 * Optional fields (Aadhaar, ABHA, passport, ...) are only validated when the
 * user typed something; on edit, a value that still equals the saved one is
 * accepted so legacy records can be saved without being "fixed" first.
 */
import type { Rule } from "@/hooks/useForm";
import type { Schema } from "@/schemas/rules";

/** Human labels for validation toasts — static for this form. */
export const PATIENT_LABELS = {
  firstName: "First name",
  lastName: "Last name",
  gender: "Gender",
  mobile: "Mobile number",
  dateOfBirth: "Date of birth",
  age: "Age",
  panelPolicyNo: "Policy / Emp No",
} as const;

/* ── VALIDATORS ─────────────────────────────────────────────── */

export const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** Mobile optionally prefixed with a country code:
 *   9845011223, 09845011223, 919845011223, "+91 9845 011 223", "+855 12 345 6789"
 *   Spaces, dashes and parentheses are ignored. */
const isMobile = (v: string) => {
  const s = String(v ?? "")
    .trim()
    .replace(/[\s()-]/g, "");
  if (s.startsWith("+")) {
    const d = s.slice(1);
    if (!/^\d{7,15}$/.test(d)) return false;
    if (d.startsWith("91") && d.length === 12) return /^91[6-9]\d{9}$/.test(d);
    return true;
  }
  const d = digits(s);
  return (
    /^[6-9]\d{9}$/.test(d) ||
    /^0[6-9]\d{9}$/.test(d) ||
    /^91[6-9]\d{9}$/.test(d)
  );
};

/** Optional-field validators — they run ONLY when the user typed something. */
const isAlnumId = (min: number, max: number) => (v: string) =>
  new RegExp(`^[A-Za-z0-9-]{${min},${max}}$`).test(v.trim());
const isPassport = (v: string) => /^[A-Za-z][0-9]{7}$/.test(v.trim());
const isKraPin = (v: string) => /^[A-Za-z][0-9]{9}[A-Za-z]$/.test(v.trim());
const isPersonName = (v: string) =>
  /^[A-Za-z][A-Za-z.' ]{1,49}$/.test(v.trim());
const isPositiveAmount = (v: string) => /^\d+(\.\d{1,2})?$/.test(v.trim());
const isPregnancyDays = (v: string) =>
  /^\d+$/.test(v.trim()) && Number(v) >= 1 && Number(v) <= 310;
const isIntlNo = (v: string) => {
  const s = v.trim().replace(/[\s()-]/g, "");
  return /^\+?\d{6,15}$/.test(s);
};
const isPincode = (v: string) => /^[1-9]\d{5}$/.test(digits(v));
const isAadhaar = (v: string) =>
  /^\d{12}$/.test(digits(v)) && !/^0+$/.test(digits(v));
const isAbha = (v: string) => /^\d{14}$/.test(digits(v));

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const isPolicyNo = (v: string) => /^[A-Za-z0-9-]{6,}$/.test(v.trim());

const DIGIT_FIELDS = new Set([
  "mobile",
  "alternateMobile",
  "pincode",
  "aadhaarNumber",
  "abhaId",
  "guardianMobile",
]);


/* ── DATE HELPERS ───────────────────────────────────────────── */

/** ⚡ Clean 6-line Typed DOB Parser (Handles 15/05/1990, 15-05-1990, 15051990, 1990-05-15) */
export function parseDobInput(raw: string): string {
  if (!raw) return "";
  const clean = raw.trim().replace(/[^\d-/.]/g, "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean; // YYYY-MM-DD
  const dmy = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy)
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`; // DD/MM/YYYY
  if (/^\d{8}$/.test(clean)) {
    return `${clean.slice(4, 8)}-${clean.slice(2, 4)}-${clean.slice(0, 2)}`; // 15051990
  }
  return clean;
}

/** Local calendar date (YYYY-MM-DD). `toISOString()` is UTC-based, so in
 *  IST it still says yesterday between 00:00 and 05:29 — a newborn's date of
 *  birth would then read as "in the future". */
export function localISO(date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}


export interface PatientSchemaContext {
  isEdit: boolean;
  /** Local calendar date (YYYY-MM-DD) used for the "not in the future" rule. */
  todayISO: string;
  /** Values the record was loaded with (used by optional() on edit). */
  initialValues: Record<string, unknown>;
}

export function buildPatientSchema({
  isEdit,
  todayISO,
  initialValues,
}: PatientSchemaContext) {
  const registered = (key: string) =>
    String(initialValues[key] ?? "");

  const optional = (
    key: string,
    test: (v: string) => boolean,
    message: string,
  ): Rule => ({
    message,
    validate: (value: any) => {
      const raw = String(value ?? "").trim();
      if (!raw) return true;
      const current = DIGIT_FIELDS.has(String(key))
        ? digits(raw)
        : raw.toLowerCase();
      const existing = DIGIT_FIELDS.has(String(key))
        ? digits(registered(key))
        : registered(key).toLowerCase();
      if (isEdit && existing && current === existing) return true;
      return test(raw) ? true : message;
    },
  });

  return {
      firstName: [
        { required: "First name is required" },
        { min: 2, message: "Use at least 2 characters" },
      ],
      lastName: [
        { required: "Last name is required" },
        { min: 2, message: "Use at least 2 characters" },
      ],
      gender: [{ required: "Select a gender" }],
      mobile: [
        ...(isEdit ? [] : [{ required: "Mobile number is required" } as Rule]),
        optional("mobile", isMobile, "Enter a valid 10-digit mobile number"),
      ],
      alternateMobile: [
        optional("alternateMobile", isMobile, "Invalid 10-digit number"),
      ],
      email: [optional("email", isEmail, "Invalid email address")],
      pincode: [optional("pincode", isPincode, "Invalid 6-digit pincode")],
      aadhaarNumber: [
        optional("aadhaarNumber", isAadhaar, "Aadhaar must be 12 digits"),
      ],
      abhaId: [optional("abhaId", isAbha, "ABHA ID must be 14 digits")],
      guardianMobile: [
        optional("guardianMobile", isMobile, "Invalid mobile number"),
      ],
      pregnancyDays: [
        optional(
          "pregnancyDays",
          isPregnancyDays,
          "Enter days between 1 and 310",
        ),
      ],
      staffId: [optional("staffId", isAlnumId(2, 30), "Invalid staff ID")],
      dependentId: [
        optional("dependentId", isAlnumId(2, 30), "Invalid dependent ID"),
      ],
      familyNumber: [
        optional("familyNumber", isAlnumId(3, 30), "Invalid family number"),
      ],
      idProofNo: [
        optional("idProofNo", isAlnumId(5, 20), "Invalid ID proof number"),
      ],
      nationalId: [
        optional("nationalId", isAlnumId(4, 25), "Invalid National ID"),
      ],
      passportNo: [
        optional(
          "passportNo",
          isPassport,
          "Format: 1 letter + 7 digits (e.g. P1234567)",
        ),
      ],
      kraPin: [optional("kraPin", isKraPin, "KRA PIN format: A123456789B")],
      membershipNo: [
        optional("membershipNo", isAlnumId(4, 30), "Invalid membership number"),
      ],
      employeeReferenceId: [
        optional(
          "employeeReferenceId",
          isAlnumId(3, 30),
          "Invalid employee reference id",
        ),
      ],
      mlcNo: [optional("mlcNo", isAlnumId(3, 30), "Invalid MLC number")],
      internationalNo: [
        optional("internationalNo", isIntlNo, "Invalid international number"),
      ],
      emergencyMobile: [
        optional("emergencyMobile", isMobile, "Invalid mobile number"),
      ],
      emergencyResidentNo: [
        optional("emergencyResidentNo", isIntlNo, "Invalid resident number"),
      ],
      policyCardNo: [
        optional(
          "policyCardNo",
          isAlnumId(4, 20),
          "Invalid policy card number",
        ),
      ],
      nameOnCard: [optional("nameOnCard", isPersonName, "Letters only")],
      cardHolder: [optional("cardHolder", isPersonName, "Letters only")],
      approvalAmount: [
        optional("approvalAmount", isPositiveAmount, "Enter a valid amount"),
      ],
      panelPolicyNo: [
        optional(
          "panelPolicyNo",
          isPolicyNo,
          "Policy number must be at least 6 characters",
        ),
      ],
      dateOfBirth: [
        {
          message: "Date of birth cannot be in the future",
          validate: (value: any) => {
            const parsed = parseDobInput(value);
            return !parsed || parsed <= todayISO
              ? true
              : "Date of birth cannot be in the future";
          },
        },
      ],
      age: [
        {
          message: "Enter an age between 0 and 129",
          validate: (value: any) => {
            if (value === "" || value === null || value === undefined)
              return true;
            const n = Number(value);
            if (Number.isNaN(n)) return "Enter a valid age";
            return n >= 0 && n <= 129 ? true : "Enter an age between 0 and 129";
          },
        },
      ],
  } satisfies Schema;
}
