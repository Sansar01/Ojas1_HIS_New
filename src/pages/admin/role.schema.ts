import { requiredMin, type Schema } from "@/schemas/rules";

export type RoleMode = "master" | "custom";

/** Role form: a master role is picked, or a custom one is named. */
export const buildRoleSchema = (roleMode: RoleMode) =>
  ({
    roleNameId:
      roleMode === "master" ? [{ required: "Select a master role" }] : [],
    name:
      roleMode === "custom" ? [requiredMin("Role name is required", 3)] : [],
    slug: [{ required: "Slug is required", pattern: /^[a-z][a-z0-9_]{2,24}$/ }],
    description: [requiredMin("Describe what this role does", 10)],
  }) satisfies Schema;
