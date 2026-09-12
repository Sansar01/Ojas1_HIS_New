import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch } from "@/hooks";
import { FORM_INVALID } from "@/features/ui/uiSlice";

/* ---------------------------------------------------------------------------
 * useForm — schema validation, error mapping, invalid-field focus and
 * duplicate-submission protection. Every form in the portal runs on this,
 * including the stepped inline forms (see <FormDialog /> in components/common)
 * which validate the required fields of a step before allowing progress.
 *
 * Field-level validation model
 * ---------------------------
 *  validateOnChange : validate a field the moment it is edited (default true,
 *                     the original behaviour — FormDialog steps rely on it)
 *  validateOnBlur   : validate a field when it loses focus
 *  touched          : a field only *shows* its error once it was blurred or a
 *                     step/submit attempt was made (see errorFor)
 *  errorFor(name)   : display helper — the message to show for that field
 *  missingFields()  : non-mutating list of { name, label, message } that fail,
 *                     used for toasts and step summaries
 * ------------------------------------------------------------------------ */

export interface Rule {
  required?: boolean | string;
  email?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  message?: string;
  /** return a string to fail, false to fail with `message`, anything else to pass */
  validate?: (
    value: any,
    values: Record<string, any>,
  ) => string | undefined | true | false;
}

export type ValidationSchema<T> = Partial<Record<keyof T, Rule[]>>;

export interface UseFormConfig<T> {
  initialValues: T;
  schema?: ValidationSchema<T>;
  /** Human readable field names used by toasts / step summaries */
  labels?: Partial<Record<keyof T, string>>;
  /** Validate as soon as the user edits a field (default: true) */
  validateOnChange?: boolean;
  /** Validate a field when it loses focus (default: false) */
  validateOnBlur?: boolean;
}

const isBlank = (v: any) =>
  v === undefined ||
  v === null ||
  (typeof v === "string" && v.trim() === "") ||
  (Array.isArray(v) && v.length === 0);

/** "firstName" → "First name" when no explicit label was supplied. */
export const humanizeField = (name: string) =>
  name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

export interface MissingField {
  name: string;
  label: string;
  message: string;
}

/** Registry of the form currently rendering — lets inline stepped panels
 *  validate their own step without prop-drilling the form instance. */
export const formRegistry: { current: any } = { current: null };

export function useForm<T extends Record<string, any>>({
  initialValues,
  schema = {},
  labels,
  validateOnChange = true,
  validateOnBlur = false,
}: UseFormConfig<T>) {
  const dispatch = useAppDispatch();
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const nodes = useRef<Record<string, HTMLElement | null>>({});
  // mirrors of the state above so callbacks always read the latest value
  const touchedRef = useRef<Record<string, boolean>>({});
  const attemptedRef = useRef(false);

  /* ------------------------------ labelling ------------------------------ */

  const labelOf = useCallback(
    (name: string) => (labels as any)?.[name] ?? humanizeField(name),
    [labels],
  );

  /* ------------------------------ validation ----------------------------- */

  const validateField = useCallback(
    (name: keyof T, value: any, all: T) => {
      for (const rule of schema[name] ?? []) {
        if (rule.required && isBlank(value))
          return typeof rule.required === "string"
            ? rule.required
            : (rule.message ?? "This field is required");
        if (isBlank(value) && !rule.required) continue;
        if (rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value)))
          return rule.message ?? "Enter a valid email address";
        if (rule.min !== undefined && String(value).length < rule.min)
          return rule.message ?? `Must be at least ${rule.min} characters`;
        if (rule.max !== undefined && String(value).length > rule.max)
          return rule.message ?? `Must be no more than ${rule.max} characters`;
        if (rule.pattern && !rule.pattern.test(String(value)))
          return rule.message ?? "Invalid format";
        if (rule.validate) {
          const res = rule.validate(value, all);
          if (typeof res === "string") return res;
          if (res === false) return rule.message ?? "Invalid value";
        }
      }
      return undefined;
    },
    [schema],
  );

  const runValidation = useCallback(
    (names?: (keyof T)[]) => {
      const next: Partial<Record<keyof T, string>> = {};
      const keys = names?.length
        ? names.filter((k) => (schema as any)[k])
        : (Object.keys(schema) as (keyof T)[]);
      keys.forEach((key) => {
        const message = validateField(key, (values as any)[key], values);
        if (message) next[key] = message;
      });
      return next;
    },
    [schema, validateField, values],
  );

  const validate = useCallback(() => {
    const next = runValidation();
    setErrors(next);
    return next;
  }, [runValidation]);

  /** validate only the given field names (used per wizard step) */
  const validateFields = useCallback(
    (names: string[]) => {
      const next = runValidation(names as (keyof T)[]);

      setErrors((prev) => {
        const merged: any = { ...prev };

        names.forEach((n) => {
          const key = n as keyof T;
          if (next[key]) {
            merged[key] = next[key];
          } else {
            delete merged[key];
          }
        });

        return merged;
      });

      return next;
    },
    [runValidation],
  );

  /**
   * Non-mutating check of the given fields — returns the failing ones with a
   * human label so callers can toast "First name is required · Mobile is
   * required" without touching the error state.
   */
  const missingFields = useCallback(
    (names?: string[]): MissingField[] => {
      const keys = (
        names?.length
          ? names.filter((n) => (schema as any)[n])
          : Object.keys(schema)
      ) as (keyof T)[];
      return keys
        .map((key) => ({
          name: String(key),
          label: labelOf(String(key)),
          message: validateField(key, (values as any)[key], values) ?? "",
        }))
        .filter((f) => f.message);
    },
    [schema, values, validateField, labelOf],
  );

  const isValid = useCallback(
    (names?: string[]) => missingFields(names).length === 0,
    [missingFields],
  );

  /* -------------------------------- touch -------------------------------- */

  /** Mark a field as touched (and validate it when validateOnBlur is on). */
  const touch = useCallback(
    (name: keyof T) => {
      const key = String(name);
      if (!touchedRef.current[key]) {
        touchedRef.current = { ...touchedRef.current, [key]: true };
        setTouched(touchedRef.current);
      }
      if (validateOnBlur) {
        setErrors((prev) => {
          const message = validateField(name, (values as any)[key], values);
          const next = { ...prev };
          if (message) next[name] = message;
          else delete next[name];
          return next;
        });
      }
    },
    [validateOnBlur, validateField, values],
  );

  /** Reveal errors for a set of fields (used before advancing a step). */
  const revealErrors = useCallback(
    (names: string[]) => {
      const next = runValidation(names as (keyof T)[]);
      setErrors((prev) => {
        const merged: any = { ...prev };
        names.forEach((n) => {
          const key = n as keyof T;
          if (next[key]) merged[key] = next[key];
          else delete merged[key];
        });
        return merged;
      });
      const map = { ...touchedRef.current };
      names.forEach((n) => (map[n] = true));
      touchedRef.current = map;
      setTouched(map);
      return next;
    },
    [runValidation],
  );

  /** Error message to display for a field, respecting touched / submit state. */
  const errorFor = useCallback(
    (name: keyof T) => {
      const key = String(name);
      if (!touchedRef.current[key] && !attemptedRef.current) return undefined;
      return errors[name];
    },
    [errors],
  );

  const focusField = useCallback((name?: string) => {
    if (!name) return;
    const el = nodes.current[name];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(
        () => (el as HTMLInputElement).focus?.({ preventScroll: true }),
        240,
      );
    }
  }, []);

  const setValue = useCallback(
    (name: keyof T, value: any, validateNow = true) => {
      setValues((prev) => {
        const nextValues = { ...prev, [name]: value } as T;

        // Always keep the error state accurate for fields the user can already
        // see feedback on; untouched fields stay quiet until blurred/attempted.
        const key = String(name);
        const shouldValidate =
          validateNow &&
          (validateOnChange ||
            touchedRef.current[key] ||
            attemptedRef.current);

        if (shouldValidate) {
          const message = validateField(name, value, nextValues);
          setErrors((e) => {
            const newErrors = { ...e };
            if (message) {
              newErrors[name] = message;
            } else {
              delete newErrors[name];
            }
            return newErrors;
          });
        }

        return nextValues;
      });

      setDirty(true);
    },
    [validateField, validateOnChange],
  );

  const setMany = useCallback((patch: Partial<T>) => {
    setValues((prev) => ({ ...prev, ...patch }) as T);
    setDirty(true);
  }, []);

  const reset = useCallback(
    (next?: Partial<T>) => {
      setValues({ ...initialValues, ...(next ?? {}) } as T);
      setErrors({});
      setTouched({});
      setDirty(false);
      setSubmitting(false);
      setSubmitAttempted(false);
      touchedRef.current = {};
      attemptedRef.current = false;
    },
    [initialValues],
  );

  const handleSubmit =
    (onValid: (values: T) => void | Promise<void>) =>
    async (e?: React.FormEvent | React.MouseEvent) => {
      e?.preventDefault?.();
      if (submitting) return;
      const next = validate();
      if (Object.keys(next).length) {
        attemptedRef.current = true;
        setSubmitAttempted(true);
        dispatch(FORM_INVALID());
        focusField(Object.keys(next)[0]);
        return;
      }
      setSubmitting(true);
      try {
        await onValid(values);
      } finally {
        setSubmitting(false);
      }
    };

  // ==================== GLOBAL NUMERIC INPUT HANDLER ====================
  const handleNumericChange = useCallback(
    (field: keyof T, value: string) => {
      // Remove all non-numeric characters
      const numericValue = value.replace(/[^0-9]/g, "");

      // Update the field value
      setValue(field, numericValue);

      // Trigger real-time validation
      validateFields([field as string]);
    },
    [setValue, validateFields],
  );

  const api = useMemo(() => {
    return {
      values,
      errors,
      touched,
      dirty,
      submitting,
      submitAttempted,
      setSubmitting,
      setValues,
      setMany,
      setValue,
      validate,
      validateFields,
      revealErrors,
      missingFields,
      isValid,
      errorFor,
      touch,
      labelOf,
      focusField,
      reset,
      handleSubmit,
      handleNumericChange,
      schema,
      hasError: Object.keys(errors).length > 0,
      registerRef: (name: keyof T) => (el: HTMLElement | null) => {
        const key = String(name);
        const prev = nodes.current[key] as any;
        if (prev && prev.__useFormBlur) {
          prev.removeEventListener("blur", prev.__useFormBlur);
          prev.__useFormBlur = null;
        }
        nodes.current[key] = el;
        if (el && validateOnBlur) {
          const handler = () => touch(name);
          el.addEventListener("blur", handler);
          (el as any).__useFormBlur = handler;
        }
      },
    };
  }, [
    values,
    errors,
    touched,
    dirty,
    submitting,
    submitAttempted,
    setValue,
    setMany,
    validate,
    validateFields,
    revealErrors,
    missingFields,
    isValid,
    errorFor,
    touch,
    labelOf,
    focusField,
    reset,
    handleSubmit,
    handleNumericChange,
    schema,
    validateOnBlur,
  ]);

  // the panel rendered by this component reads the form from the registry
  formRegistry.current = api;
  useEffect(
    () => () => {
      if (formRegistry.current === api) formRegistry.current = null;
    },
    [],
  );

  return api;
}