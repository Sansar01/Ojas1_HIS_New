import {
  requiredEmail,
  requiredMin,
  requiredPhone,
  type Schema,
} from "@/schemas/rules";

const PERSON_NAME = /^[A-Za-z][A-Za-z .'-]*$/;
const personName = (label: string) => [
  { required: `${label} is required` },
  { min: 2, message: "Use at least 2 characters" },
  {
    pattern: PERSON_NAME,
    message: "Letters, spaces, apostrophes and hyphens only",
  },
];

/** "Add user" wizard. */
export const newUserSchema = {
  firstName: personName("First name"),
  lastName: personName("Last name"),
  email: [requiredEmail()],
  mobile: [
    { required: "Mobile number is required" },
    {
      pattern: /^(\+?\d{1,3}[\s-]?)?\d{10}$/,
      message: "Enter a 10-digit mobile number (optionally with +91)",
    },
  ],
  userType: [{ required: "User type is required" }],
  primaryRoleId: [{ required: "Primary role is required" }],
  password: [
    { required: "Temporary password is required" },
    { min: 8, message: "Use at least 8 characters" },
  ],
} satisfies Schema;

export const NEW_USER_LABELS = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email address",
  mobile: "Mobile number",
  userType: "User type",
  primaryRoleId: "Primary role",
  password: "Temporary password",
} as const;

/** Create / edit user dialog — a password is only required on create. */
export const buildUserSchema = (isEdit: boolean) =>
  ({
    firstName: [requiredMin("First name is required", 2)],
    lastName: [requiredMin("Last name is required", 2)],
    email: [requiredEmail()],
    mobile: [requiredPhone()],
    roleId: [{ required: "Choose a role" }],
    dateOfBirth: [{ required: "Date of birth is required" }],
    password: isEdit
      ? []
      : [requiredMin("A temporary password is required", 6)],
  }) satisfies Schema;
