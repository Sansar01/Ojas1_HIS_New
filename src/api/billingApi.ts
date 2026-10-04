/**
 * Billing domain API — OPD invoices and payments.
 *
 *   GET    /api/opd/billing                   billingApi.list
 *   GET    /api/opd/billing/:id               billingApi.getById
 *   POST   /api/opd/billing                   billingApi.create
 *   PATCH  /api/opd/billing/:id               billingApi.update
 *   DELETE /api/opd/billing/:id               billingApi.remove
 *   PATCH  /api/opd/billing/:id/cancel        billingApi.cancel
 *   GET    /api/opd/billing/daily-summary     billingApi.getDailySummary
 *   GET    /api/opd/billing/payments          billingApi.getPayments
 *   POST   /api/opd/billing/:id/payments      billingApi.collectPayment
 *
 * Only invoice/payment operations live here. Patients, doctors and
 * appointments stay in their own domains — the billing screen consumes those
 * through `patientSlice` / `doctorSlice` / `appointmentSlice` (Rule 24).
 */

import { apiClient } from "./apiClient";
import { API_ENDPOINTS } from "./endpoints";
import type { Invoice } from "@/types";

/** List filters of the invoice tab — same query keys as before. */
export interface BillFilters {
  page?: number;
  limit?: number;
  patientId?: string;
  date?: string;
  billStatus?: string;
  paymentStatus?: string;
}

/** List filters of the payments tab. */
export interface PaymentFilters {
  page?: number;
  limit?: number;
  patientId?: string;
  paymentMode?: string;
  date?: string;
}

/**
 * Drop empty/"all" filter values so the query string stays identical, and
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

export const billingApi = {
  /** Invoice list — the single definition of this endpoint for the whole app. */
  list: (filters: BillFilters = {}) =>
    apiClient<Invoice[]>(API_ENDPOINTS.billing.list, {
      method: "GET",
      params: compactQuery(filters as Record<string, unknown>),
    }),

  getById: (id: string | number) =>
    apiClient<Invoice>(API_ENDPOINTS.billing.getById(id), { method: "GET" }),

  create: (payload: unknown) =>
    apiClient<Invoice>(API_ENDPOINTS.billing.create, {
      method: "POST",
      body: payload,
    }),

  update: (id: string | number, payload: unknown) =>
    apiClient<Invoice>(API_ENDPOINTS.billing.update(id), {
      method: "PATCH",
      body: payload,
    }),

  remove: (id: string | number) =>
    apiClient(API_ENDPOINTS.billing.delete(id), { method: "DELETE" }),

  /** Cancel a bill with a reason (kept non-destructive on the server). */
  cancel: (id: string | number, cancelReason: string) =>
    apiClient(API_ENDPOINTS.billing.cancel(id), {
      method: "PATCH",
      body: { cancelReason },
    }),

  /** Counter summary for one day. */
  getDailySummary: (date?: string) =>
    apiClient(API_ENDPOINTS.billing.dailySummary, {
      method: "GET",
      params: date ? { date } : undefined,
    }),

  /** Payment ledger (paged / filtered). */
  getPayments: (filters: PaymentFilters = {}) =>
    apiClient(API_ENDPOINTS.billing.payments, {
      method: "GET",
      params: compactQuery(filters as Record<string, unknown>),
    }),

  /** Record a payment against one bill. */
  collectPayment: (billId: string | number, payload: unknown) =>
    apiClient(API_ENDPOINTS.billing.collectPayment(billId), {
      method: "POST",
      body: payload,
    }),
};

