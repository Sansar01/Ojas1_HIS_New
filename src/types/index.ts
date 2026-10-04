/**
 * Domain types barrel — one import surface for the whole app.
 *
 *   import type { Patient, Appointment } from "@/types";
 *
 * Each domain model is defined in its own file (`patientTypes.ts`,
 * `appointmentTypes.ts`, …) so types stay separated per module while this
 * barrel keeps `@/types` as the single convenient import path.
 */

export * from "./commonTypes";
export * from "./permissionTypes";
export * from "./authTypes";
export * from "./moduleTypes";
export * from "./userTypes";
export * from "./activityTypes";
export * from "./roleTypes";
export * from "./hospitalTypes";
export * from "./departmentTypes";
export * from "./specializationTypes";
export * from "./doctorTypes";
export * from "./patientTypes";
export * from "./appointmentTypes";
export * from "./consultationTypes";
export * from "./billingTypes";
export * from "./masterTypes";
