import {
  requiredMin,
  SHORT_CODE_PATTERN,
  type Schema,
} from "@/schemas/rules";

export const specializationSchema = {
  name: [requiredMin("Name is required", 3)],
  code: [{ required: "Code is required", pattern: SHORT_CODE_PATTERN }],
  departmentId: [{ required: "Attach this specialization to a department" }],
  description: [requiredMin("Description is required", 8)],
} satisfies Schema;
