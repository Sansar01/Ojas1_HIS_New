import type { Schema } from "@/schemas/rules";

/** Payment dialog: the amount must be positive and at most the amount due. */
export const buildPaymentSchema = (dueAmount: number) =>
  ({
    amount: [
      {
        required: "Amount is required",
        validate: (v: number) =>
          Number(v) > 0 && Number(v) <= dueAmount ? true : `Max ${dueAmount}`,
      },
    ],
  }) satisfies Schema;
