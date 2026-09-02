import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppDispatch } from "@/hooks";
import { FORM_INVALID } from "@/features/ui/uiSlice";

/* ---------------------------------------------------------------------------
 * useForm — schema validation, error mapping, invalid-field focus and
 * duplicate-submission protection. Every form in the portal runs on this,
 * including the stepped inline forms (see <FormDialog /> in components/common)
 * which validate the required fields of a step before allowing progress.
 * ------------------------------------------------------------------------ */

export interface Rule {
  required?: boolean | string;
  email?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  message?: string;
  /** return a string to fail, false to fail with `message`, anything else to pass */
  validate?: (value: any, values: Record<string, any>) => string | undefined | true | false;
}

export type ValidationSchema<T> = Partial<Record<keyof T, Rule[]>>;

export interface UseFormConfig<T> {
  initialValues: T;
  schema?: ValidationSchema<T>;
}

const isBlank = (v: any) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

/** Registry of the form currently rendering — lets inline stepped panels
 *  validate their own step without prop-drilling the form instance. */
export const formRegistry: { current: any } = { current: null };

export function useForm<T extends Record<string, any>>({ initialValues, schema = {} }: UseFormConfig<T>) {
  const dispatch = useAppDispatch();
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const nodes = useRef<Record<string, HTMLElement | null>>({});

  const validateField = useCallback(
    (name: keyof T, value: any, all: T) => {
      for (const rule of schema[name] ?? []) {
        if (rule.required && isBlank(value)) return typeof rule.required === "string" ? rule.required : rule.message ?? "This field is required";
        if (isBlank(value) && !rule.required) continue;
        if (rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value))) return rule.message ?? "Enter a valid email address";
        if (rule.min !== undefined && String(value).length < rule.min) return rule.message ?? `Must be at least ${rule.min} characters`;
        if (rule.max !== undefined && String(value).length > rule.max) return rule.message ?? `Must be no more than ${rule.max} characters`;
        if (rule.pattern && !rule.pattern.test(String(value))) return rule.message ?? "Invalid format";
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
      const keys = names?.length ? names.filter((k) => (schema as any)[k]) : (Object.keys(schema) as (keyof T)[]);
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
        names.forEach((n) => (next[n as keyof T] ? (merged[n] = next[n as keyof T]) : delete merged[n]));
        return merged;
      });
      return next;
    },
    [runValidation],
  );

  const focusField = useCallback((name?: string) => {
    if (!name) return;
    const el = nodes.current[name];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => (el as HTMLInputElement).focus?.({ preventScroll: true }), 240);
    }
  }, []);

  const setValue = useCallback(
    (name: keyof T, value: any, validateNow = true) => {
      setValues((prev) => {
        const nextValues = { ...prev, [name]: value } as T;
        if (validateNow) {
          const message = validateField(name, value, nextValues);
          setErrors((e) => (e[name] === message ? e : { ...e, [name]: message }));
        }
        return nextValues;
      });
      setDirty(true);
    },
    [validateField],
  );

  const setMany = useCallback((patch: Partial<T>) => {
    setValues((prev) => ({ ...prev, ...patch }) as T);
    setDirty(true);
  }, []);

  const reset = useCallback(
    (next?: Partial<T>) => {
      setValues({ ...initialValues, ...(next ?? {}) } as T);
      setErrors({});
      setDirty(false);
      setSubmitting(false);
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

  const api = {
    values,
    errors,
    dirty,
    submitting,
    setSubmitting,
    setValues,
    setMany,
    setValue,
    validate,
    validateFields,
    focusField,
    reset,
    handleSubmit,
    schema,
    hasError: Object.keys(errors).length > 0,
    registerRef: (name: keyof T) => (el: HTMLElement | null) => {
      nodes.current[name as string] = el;
    },
  };

  // the panel rendered by this component reads the form from the registry
  formRegistry.current = api;
  useEffect(() => () => {
    if (formRegistry.current === api) formRegistry.current = null;
  }, []);

  return api;
}
