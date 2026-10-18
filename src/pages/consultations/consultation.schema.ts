import { requiredMin, type Schema } from "@/schemas/rules";

export const consultationSchema = {
  chiefComplaint: [requiredMin("Required", 3)],
  diagnosis: [requiredMin("Required", 3)],
} satisfies Schema;
