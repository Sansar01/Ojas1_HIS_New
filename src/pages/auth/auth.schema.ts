import { requiredEmail, type Schema } from "@/schemas/rules";

export const loginSchema = {
  email: [requiredEmail()],
  password: [{ required: "Password is required", min: 6 }],
} satisfies Schema;

export const forgotPasswordSchema = {
  email: [requiredEmail()],
} satisfies Schema;

export const FORCE_PASSWORD_LABELS = {
  oldPassword: "Current password",
  newPassword: "New password",
} as const;

export const buildForcePasswordSchema = (minLength: number) =>
  ({
    oldPassword: [
      { required: "Enter the password you signed in with" },
      { min: 1, message: "Enter the password you signed in with" },
    ],
    newPassword: [
      { required: "New password is required" },
      {
        min: minLength,
        message: `New password must be at least ${minLength} characters`,
      },
      {
        message: "New password must be different from the current password",
        validate: (value: string, all: Record<string, any>) =>
          value && value === all.oldPassword
            ? "New password must be different from the current password"
            : true,
      },
    ],
  }) satisfies Schema;

/** `strength` returns 0–4 (see the password meter on the reset page). */
export const buildResetPasswordSchema = (strength: (pw: string) => number) =>
  ({
    email: [requiredEmail()],
    code: [
      {
        required: "Enter the 6-digit code from your email",
        pattern: /^[A-Za-z0-9_]{4,12}$/,
      },
    ],
    password: [
      { required: "New password is required", min: 8 },
      {
        validate: (v: string) =>
          strength(v) < 3 ? "Use upper case, a number and a symbol" : true,
      },
    ],
    confirm: [
      { required: "Confirm your new password" },
      {
        validate: (v: string, all: Record<string, any>) =>
          v === all.password ? true : "Passwords do not match",
      },
    ],
  }) satisfies Schema;
