import {
  requiredEmail,
  requiredMin,
  SHORT_CODE_PATTERN,
  type Schema,
} from "@/schemas/rules";

/** Facility (hospital profile) settings form. */
export const facilitySchema = {
  name: [requiredMin("Facility name is required", 4)],
  address: [{ required: "Address is required" }],
  phone: [{ required: "Phone is required" }],
  email: [requiredEmail("Email is required")],
  invoicePrefix: [
    { required: "Invoice prefix required", pattern: SHORT_CODE_PATTERN },
  ],
  defaultTaxRate: [{ required: "Tax rate is required" }],
} satisfies Schema;
