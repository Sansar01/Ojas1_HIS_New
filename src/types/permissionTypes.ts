/**
 * Permission model — the action set a role/user may hold on a module.
 * Authorization decisions live in `store/slices/permissionSlice.ts`.
 */

export type Permission = "view" | "create" | "edit" | "delete";
