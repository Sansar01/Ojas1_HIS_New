/**
 * Shared validation building blocks for the per-feature `*.schema.ts` files.
 *
 * A schema is a plain object: field name → list of `Rule`s (see
 * `@/hooks/useForm`). Keeping them out of the page components means they are
 * created once at module load (not on every keystroke), can be reused by the
 * create and edit forms of the same entity, and can be unit-tested without
 * rendering anything.
 */
import type { Rule } from "@/hooks/useForm";

/** A field-name → rules map; `satisfies` this in schema files to keep the
 *  literal field names while type-checking every rule. */
export type Schema = Record<string, Rule[]>;

/** Loose phone check used by the staff forms: optional "+" then digits,
 *  spaces, brackets or dashes (min 8 characters). */
export const LOOSE_PHONE_PATTERN = /^[+0-9][0-9\s()-]{7,}$/;

/** 2–6 letters, e.g. specialization code, invoice prefix. */
export const SHORT_CODE_PATTERN = /^[A-Za-z]{2,6}$/;

export const requiredMin = (required: string, min: number): Rule => ({
  required,
  min,
});

export const requiredEmail = (required = "Email address is required"): Rule => ({
  required,
  email: true,
});

export const requiredPhone = (required = "Mobile number is required"): Rule => ({
  required,
  pattern: LOOSE_PHONE_PATTERN,
});
