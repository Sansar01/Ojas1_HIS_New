/**
 * Billing models — invoices, line items and payments.
 */

import type { ID, ISODate, ISODateTime } from "./commonTypes";

export type PaymentStatus =
  | "Pending"
  | "Partially Paid"
  | "Paid"
  | "Cancelled"
  | "Refunded";

export interface InvoiceItem {
  id: ID;
  description: string;
  code: string;
  category:
    | "Consultation"
    | "Procedure"
    | "Lab"
    | "Pharmacy"
    | "Room & Board"
    | "Service"
    | "Other";
  quantity: number;
  unitPrice: number;
}

export interface Payment {
  id: ID;
  date: ISODate;
  amount: number;
  method: "Cash" | "Card" | "UPI" | "Insurance" | "Bank Transfer" | "Wallet";
  reference: string;
  note: string;
}

export interface Invoice {
  id: ID;
  number: string;
  patientId: ID;
  doctorId: ID | null;
  consultationId: ID | null;
  date: ISODate;
  dueDate: ISODate;
  items: InvoiceItem[];
  discountType: "Flat" | "Percent";
  discountValue: number;
  taxRate: number;
  payments: Payment[];
  paymentStatus: PaymentStatus;
  notes: string;
  insurance?: string;
  createdAt: ISODateTime;
}
