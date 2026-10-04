/**
 * Billing feature service — OPD invoices and payments.
 *
 *   GET    /api/opd/billing                   fetchInvoices(filters?)
 *   GET    /api/opd/billing/:id               fetchInvoiceById(id)
 *   POST   /api/opd/billing                   createInvoice(payload)
 *   PATCH  /api/opd/billing/:id               updateInvoice(id, payload)
 *   DELETE /api/opd/billing/:id               deleteInvoice(id)
 *   PATCH  /api/opd/billing/:id/cancel        cancelInvoice(id, reason)
 *   GET    /api/opd/billing/daily-summary     fetchDailySummary(date?)
 *   GET    /api/opd/billing/payments          fetchPayments(filters?)
 *   POST   /api/opd/billing/:billId/payments  collectPayment(billId, payload)
 *
 * Only invoice/payment operations belong here. Patients, doctors and
 * appointments stay in their own services — the billing screens import them
 * from `@/pages/patients`, `@/pages/doctors` and `@/pages/appointments`.
 */

import { axios } from "@/api/axios";

/** Billing endpoints — owned by the billing feature. */
const BILLING = "/api/opd/billing";
const invoicePath = (id: string | number) => `${BILLING}/${id}`;

/** List filters of the invoice tab — same query keys as before. */
export interface InvoiceFilters {
  page?: number;
  limit?: number;
  patientId?: string;
  date?: string;
  billStatus?: string;
  paymentStatus?: string;
  [key: string]: unknown;
}

/** List filters of the payments tab. */
export interface PaymentFilters {
  page?: number;
  limit?: number;
  patientId?: string;
  paymentMode?: string;
  date?: string;
  [key: string]: unknown;
}

/**
 * Drop empty / "all" filter values so the query string stays identical, and
 * return `undefined` when nothing is left (no stray "?" in the URL).
 */
function compactQuery(
  filters: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const entries = Object.entries(filters).filter(
    ([, value]) =>
      value !== undefined && value !== null && value !== "" && value !== "all",
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/**
 * Invoice list. The screen also reads pagination metadata (`res.meta`), so the
 * envelope is returned untouched.
 */

/* --------------------------------------------------------------------------
 * Service object — every method returns the axios request directly.
 * ----------------------------------------------------------------------- */

export const billingService = {
  fetchInvoices: (filters: InvoiceFilters = {}) =>
    axios.get(BILLING, { params: compactQuery(filters) }),
  fetchInvoiceById: (id: string | number) => axios.get(invoicePath(id)),
  createInvoice: (payload: Record<string, unknown>) =>
    axios.post(BILLING, payload),
  updateInvoice: (id: string | number, payload: Record<string, unknown>) =>
    axios.patch(invoicePath(id), payload),
  deleteInvoice: (id: string | number) => axios.delete(invoicePath(id)),
  /** Cancel a bill with a reason (kept non-destructive on the server). */
  cancelInvoice: (id: string | number, cancelReason: string) =>
    axios.patch(invoicePath(id) + "/cancel", { cancelReason }),
  /** Counter summary for one day (optional `date` parameter). */
  fetchDailySummary: (date?: string) =>
    axios.get(BILLING + "/daily-summary", {
      params: date ? { date } : undefined,
    }),
  /** Payment ledger (paged / filtered) — envelope kept for `res.meta`. */
  fetchPayments: (filters: PaymentFilters = {}) =>
    axios.get(BILLING + "/payments", { params: compactQuery(filters) }),
  /** Record a payment against one bill. */
  collectPayment: (billId: string | number, payload: Record<string, unknown>) =>
    axios.post(`${invoicePath(billId)}/payments`, payload),
};
