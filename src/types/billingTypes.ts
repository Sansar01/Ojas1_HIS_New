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

/* ==========================================================================
 * OPD billing backend contract — mirrors the NestJS DTOs of
 * `/api/opd/billing` (BillResponseDto, CreateBillDto, receipt builder).
 * The legacy shapes above stay for older screens; new code uses these.
 * ========================================================================== */

/** Bill lifecycle status returned by the server. */
export type BillStatus =
  | "DRAFT"
  | "GENERATED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CANCELLED"
  | "REFUNDED";

/** Payment status returned by the server. */
export type BillPaymentStatus =
  | "PENDING"
  | "PAID"
  | "PARTIALLY_PAID"
  | "REFUNDED"
  | "WAIVED";

/** Payment modes accepted by CreateBillDto / RefundBillDto. */
export type BillPaymentMode =
  | "CASH"
  | "UPI"
  | "CARD"
  | "CREDIT"
  | "INSURANCE"
  | "ONLINE"
  | "MIXED";

/** Line item of a generated bill (BillItemResponseDto). */
export interface BillItemResponse {
  id: string;
  itemCode: string | null;
  itemName: string;
  category: string;
  serviceId: string | null;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  totalAmount: number;
}

/** Payment receipt attached to a bill (PaymentResponseDto). */
export interface BillPaymentResponse {
  id: string;
  receiptNo: string;
  amount: number;
  paymentMode: string;
  transactionId: string | null;
  receivedBy: string | null;
  paidAt: string;
  notes: string | null;
}

/** Refund record of a bill (CreditNoteResponseDto). */
export interface BillCreditNoteResponse {
  id: string;
  creditNoteNo: string;
  refundAmount: number;
  refundMode: string;
  reason?: string;
  issuedAt: string;
}

/** GET/POST /api/opd/billing — bare BillResponseDto (no envelope). */
export interface BillResponse {
  id: string;
  billNo: string;
  patient: {
    id: string;
    uhid: string;
    firstName: string;
    lastName: string | null;
    fullName: string;
    mobile: string;
  };
  appointmentId: string | null;
  appointmentNo: string;
  doctorProfileId: string | null;
  doctor: { id: string; name: string; specialization: string | null } | null;
  visitNo: string | null;
  panelId: string | null;
  grossAmount: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  discountReason: string | null;
  coPayPercent: number;
  coPayAmount: number;
  patientPayable: number | null;
  panelPayable: number | null;
  taxAmount: number;
  netAmount: number;
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  dueAmount: number;
  paymentStatus: string;
  billStatus: string;
  paymentMode: string | null;
  remarks: string | null;
  billedAt: string;
  createdAt?: string;
  cancelReason?: string | null;
  items: BillItemResponse[];
  payments: BillPaymentResponse[];
  creditNotes: BillCreditNoteResponse[];
}

/** GET /api/opd/billing list envelope. */
export interface BillListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** One line of the Generate Bill payload (CreateBillItemDto, spec shape). */
export interface CreateBillItemPayload {
  serviceId?: string;
  serviceName: string;
  quantity: number;
  unitRate: number;
  discountAmount?: number;
  totalAmount: number;
}

/** POST /api/opd/billing payload (CreateBillDto, spec shape). */
export interface CreateBillPayload {
  patientId: string;
  panelId: string | null;
  doctorProfileId?: string;
  appointmentId: string | null;
  visitNo?: string;
  paymentMode: BillPaymentMode;
  grossAmount: number;
  /** Exactly one of discountPercent / discountAmount when discounting. */
  discountPercent?: number;
  discountAmount?: number;
  discountReason?: string;
  coPayPercent?: number;
  patientPayable?: number;
  panelPayable?: number;
  netAmount: number;
  paidAmount: number;
  changeAmount: number;
  remarks?: string;
  paymentTransactionId?: string;
  items: CreateBillItemPayload[];
}

/** Error body returned with HTTP 400/404/409:
 *  `{ statusCode, code?, message, details?, timestamp, path }` */
export interface BillingApiError {
  statusCode?: number;
  code?: string;
  message: string | string[];
  details?: Record<string, any>;
}

/** GET /api/opd/billing/:billId/receipt — printable receipt payload. */
export interface BillReceiptData {
  hospital: {
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    phone: string | null;
    email: string | null;
    logoUrl: string | null;
  } | null;
  bill: {
    id: string;
    billNo: string;
    visitNo: string | null;
    billedAt: string;
    paymentStatus: string;
    billStatus: string;
    paymentMode: string | null;
    remarks: string | null;
    appointmentNo: string | null;
  };
  patient: {
    id: string;
    uhid: string;
    name: string;
    mobile: string | null;
    gender: string | null;
    dateOfBirth: string | null;
  };
  panel: { id: string; name: string } | null;
  doctor: { id: string; name: string; specialization: string | null } | null;
  items: {
    id: string;
    serviceCode: string | null;
    itemName: string;
    category: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    discountAmount: number;
    taxPercent: number;
    totalAmount: number;
  }[];
  totals: {
    grossAmount: number;
    discountAmount: number;
    discountPercent: number;
    discountReason: string | null;
    taxAmount: number;
    netAmount: number;
    coPayPercent: number;
    coPayAmount: number;
    patientPayable: number | null;
    panelPayable: number | null;
    paidAmount: number;
    changeAmount: number;
    dueAmount: number;
  };
  payments: {
    id: string;
    receiptNo: string;
    amount: number;
    paymentMode: string;
    transactionId: string | null;
    paidAt: string;
  }[];
  creditNotes: {
    id: string;
    creditNoteNo: string;
    refundAmount: number;
    refundMode: string;
    issuedAt: string;
  }[];
}
