import { requiredMin, type Schema } from "@/schemas/rules";

export const departmentSchema = {
  name: [requiredMin("Department name is required", 3)],
} satisfies Schema;
