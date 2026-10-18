import {
  requiredEmail,
  requiredMin,
  requiredPhone,
  type Schema,
} from "@/schemas/rules";

export const doctorSchema = {
  firstName: [requiredMin("First name is required", 2)],
  lastName: [requiredMin("Last name is required", 2)],
  email: [requiredEmail()],
  mobile: [requiredPhone()],
  registrationNumber: [
    requiredMin("Medical registration number is required", 4),
  ],
  consultationFee: [
    {
      required: "Consultation fee is required",
      validate: (v: number) =>
        Number(v) > 0 ? true : "Fee must be greater than zero",
    },
  ],
  slotDuration: [
    {
      required: "Slot duration is required",
      validate: (v: number) =>
        Number(v) >= 5 ? true : "Minimum slot length is 5 minutes",
    },
  ],
  maxPatientsPerDay: [
    {
      validate: (v: number) => (Number(v) > 0 ? true : "Set a daily capacity"),
    },
  ],
} satisfies Schema;
