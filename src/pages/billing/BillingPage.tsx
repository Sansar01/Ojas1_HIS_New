import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BadgePercent,
  Banknote,
  CircleDollarSign,
  CreditCard,
  Eye,
  FileSpreadsheet,
  Landmark,
  Plus,
  Printer,
  Receipt,
  Trash2,
  Wallet,
  RefreshCw,
} from "lucide-react";
import { INVOICE_CATEGORIES, PAYMENT_METHODS } from "@/constants";
import { addDays, todayISO, idGen } from "@/data/db";
import { usePermission } from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { downloadText, formatDate, formatMoney, toCSV } from "@/utils";
import { cn } from "@/utils/cn";
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  Panel,
  StatusBadge,
} from "@/components/ui/primitives";
import {
  Input,
  NumberInput,
  Select,
  DatePicker,
  RadioGroup,
  Textarea,
} from "@/components/ui/fields";
import {
  DataTable,
  Pagination,
  RowActions,
  TableToolbar,
} from "@/components/ui/table";
import { Dialog, Tabs } from "@/components/ui/overlays";
import {
  FormDialog,
  FormRow,
  FormSection,
  PageIntro,
  StatStrip,
} from "@/components/common";
import { billingService } from "@/features/billing/billingService";

// Service Master Fallback for frontend quick-selection
const SERVICE_MASTER = [
  { code: "CON01", desc: "Consultation - General OPD", cat: "Consultation", price: 500, tax: 0 },
  { code: "CON02", desc: "Consultation - Specialist", cat: "Consultation", price: 1200, tax: 0 },
  { code: "LAB01", desc: "Complete Blood Count (CBC)", cat: "Lab", price: 350, tax: 0 },
  { code: "LAB02", desc: "Lipid Profile", cat: "Lab", price: 950, tax: 0 },
  { code: "RAD01", desc: "X-Ray Chest PA View", cat: "Procedure", price: 600, tax: 5 },
  { code: "RAD02", desc: "ECG + 2D Echocardiography", cat: "Procedure", price: 2400, tax: 5 },
  { code: "PHA01", desc: "Pharmacy Consumables Kit", cat: "Pharmacy", price: 150, tax: 12 },
];

export function BillingPage() {
  const [params, setParams] = useSearchParams();
  const { canCreate, canEdit, canDelete } = usePermission();

  const [tab, setTab] = useState("invoices");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states from API
  const [bills, setBills] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [kpis, setKpis] = useState({ totalAmount: 0, totalCollected: 0, totalDue: 0, totalDiscount: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [payPagination, setPayPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Filters
  const [filters, setFilters] = useState({
    paymentStatus: "all",
    billStatus: "all",
    date: "",
    search: "",
  });

  // Modal / Sheet States
  const [editing, setEditing] = useState<boolean>(params.get("new") === "1");
  const [viewing, setViewing] = useState<any | null>(null);
  const [paying, setPaying] = useState<any | null>(null);

  // ─── API DATA FETCHING ──────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    try {
      const summary = await billingService.getDailySummary(filters.date || undefined);
      setKpis({
        totalAmount: summary.totalAmount || 0,
        totalCollected: summary.totalCollected || 0,
        totalDue: summary.totalDue || 0,
        totalDiscount: summary.totalDiscount || 0,
      });
    } catch (e: any) {
      console.error("Failed to load daily summary", e);
    }
  }, [filters.date]);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await billingService.getBills({
        page: pagination.page,
        limit: pagination.limit,
        paymentStatus: filters.paymentStatus,
        billStatus: filters.billStatus,
        date: filters.date,
      });
      setBills(res.data || []);
      setPagination((prev) => ({
        ...prev,
        total: res.meta?.total || 0,
        totalPages: res.meta?.totalPages || 1,
      }));
    } catch (e: any) {
      setError(e.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  const fetchPayments = useCallback(async () => {
    try {
      const res = await billingService.getPayments({
        page: payPagination.page,
        limit: payPagination.limit,
      });
      setPayments(res.data || []);
      setPayPagination((prev) => ({
        ...prev,
        total: res.meta?.total || 0,
        totalPages: res.meta?.totalPages || 1,
      }));
    } catch (e: any) {
      console.error("Failed to load payments", e);
    }
  }, [payPagination.page, payPagination.limit]);

  const reloadAll = useCallback(() => {
    fetchSummary();
    fetchBills();
    fetchPayments();
  }, [fetchSummary, fetchBills, fetchPayments]);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  const exportCsv = () => {
    downloadText(
      `invoices-${todayISO()}.csv`,
      toCSV(
        bills.map((i) => ({
          Invoice: i.billNo,
          Patient: i.patient ? `${i.patient.firstName} ${i.patient.lastName || ""}` : "—",
          Date: formatDate(i.billedAt),
          Subtotal: i.subtotal,
          Discount: i.discountAmount,
          Tax: i.taxAmount,
          Total: i.totalAmount,
          Paid: i.paidAmount,
          Balance: i.dueAmount,
          Status: i.paymentStatus,
        }))
      )
    );
  };

  const handleCancelBill = async (bill: any) => {
    const reason = prompt(`Enter reason for cancelling bill ${bill.billNo}:`);
    if (!reason) return;
    try {
      await billingService.cancelBill(bill.id, reason);
      reloadAll();
    } catch (e: any) {
      alert(e.message || "Failed to cancel bill");
    }
  };

  return (
    <>
      <PageIntro
        title="Billing & invoices"
        description="Charge consultation fees, procedures, labs and pharmacy items. Discounts, taxes, part-payments and refunds are recalculated instantly."
        module="billing"
        createLabel="Create invoice"
        onCreate={() => setEditing(true)}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" icon={<RefreshCw />} onClick={reloadAll}>
              Refresh
            </Button>
            <Button variant="outline" icon={<FileSpreadsheet />} onClick={exportCsv}>
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-4 xl:grid-cols-[1fr_auto]">
        <StatStrip
          items={[
            {
              label: "Total billed",
              value: formatMoney(kpis.totalAmount),
              tone: "text-ink-900",
            },
            {
              label: "Collected",
              value: formatMoney(kpis.totalCollected),
              tone: "text-mint-600",
            },
            {
              label: "Outstanding",
              value: formatMoney(kpis.totalDue),
              tone: "text-coral-600",
            },
            {
              label: "Total Discount",
              value: formatMoney(kpis.totalDiscount),
              tone: "text-amberly-600",
            },
          ]}
        />
      </div>

      <Panel>
        <div className="border-b border-ink-100 px-3 pt-2">
          <Tabs
            value={tab}
            onValueChange={setTab}
            variant="pill"
            tabs={[
              { value: "invoices", label: `Invoices (${pagination.total})` },
              { value: "payments", label: `Payment history (${payPagination.total})` },
            ]}
          />
        </div>

        {tab === "invoices" ? (
          <>
            <TableToolbar
              search={filters.search}
              onSearch={(s) => setFilters((f) => ({ ...f, search: s }))}
              searchPlaceholder="Search invoice no, patient…"
              filters={
                <>
                  <Select
                    size="sm"
                    className="w-[10.5rem]"
                    name="ps"
                    value={filters.paymentStatus}
                    onChange={(v) => setFilters((f) => ({ ...f, paymentStatus: v }))}
                    options={[
                      { value: "all", label: "Any payment status" },
                      { value: "PENDING", label: "Pending" },
                      { value: "PARTIALLY_PAID", label: "Partially paid" },
                      { value: "PAID", label: "Paid" },
                      { value: "REFUNDED", label: "Refunded" },
                    ]}
                  />
                  <DatePicker
                    label=""
                    value={filters.date}
                    onChange={(v) => setFilters((f) => ({ ...f, date: v }))}
                    placeholder="Filter Date"
                  />
                </>
              }
            />

            <DataTable
              columns={[
                {
                  key: "billNo",
                  header: "Invoice",
                  render: (i) => (
                    <span className="num text-[13px] font-bold text-ink-900">
                      {i.billNo}
                    </span>
                  ),
                },
                {
                  key: "patient",
                  header: "Patient",
                  render: (i) => {
                    const name = i.patient ? `${i.patient.firstName} ${i.patient.lastName || ""}` : "Walk-in Patient";
                    return (
                      <div className="flex items-center gap-2.5">
                        <Avatar name={name} size="xs" color="bg-lagoon-500" />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-ink-900">{name}</p>
                          <p className="truncate text-[11px] text-ink-400">{i.patient?.uhid || ""}</p>
                        </div>
                      </div>
                    );
                  },
                },
                {
                  key: "billedAt",
                  header: "Billed",
                  render: (i) => (
                    <span className="text-[12.5px] text-ink-600">
                      {formatDate(i.billedAt)}
                    </span>
                  ),
                },
                {
                  key: "payer",
                  header: "Payer",
                  render: (i) => (
                    <Badge tone={i.isInsurance ? "lagoon" : "neutral"} size="xs">
                      {i.isInsurance ? i.insuranceProvider || "Insurance" : "Self Pay"}
                    </Badge>
                  ),
                },
                {
                  key: "totalAmount",
                  header: "Total",
                  align: "right",
                  render: (i) => (
                    <span className="num text-[13px] font-semibold text-ink-900">
                      {formatMoney(i.totalAmount)}
                    </span>
                  ),
                },
                {
                  key: "dueAmount",
                  header: "Balance Due",
                  align: "right",
                  render: (i) => (
                    <span
                      className={cn(
                        "num text-[13px] font-bold",
                        i.dueAmount > 0 ? "text-coral-600" : "text-mint-600"
                      )}
                    >
                      {formatMoney(i.dueAmount)}
                    </span>
                  ),
                },
                {
                  key: "paymentStatus",
                  header: "Status",
                  align: "center",
                  render: (i) => <StatusBadge status={i.paymentStatus} />,
                },
              ]}
              rows={bills}
              status={loading ? "loading" : error ? "error" : "ready"}
              onRetry={fetchBills}
              onRowClick={(i) => setViewing(i)}
              actions={(i) => (
                <RowActions
                  items={[
                    {
                      label: "View invoice",
                      icon: <Eye />,
                      onClick: () => setViewing(i),
                    },
                    {
                      label: "Record payment",
                      icon: <Banknote />,
                      hidden: !canEdit("billing") || i.paymentStatus === "PAID" || i.billStatus === "CANCELLED",
                      onClick: () => setPaying(i),
                    },
                    {
                      label: "Cancel/Void Bill",
                      icon: <Trash2 />,
                      tone: "danger",
                      hidden: !canDelete("billing") || i.paymentStatus === "PAID" || i.billStatus === "CANCELLED",
                      onClick: () => handleCancelBill(i),
                    },
                  ]}
                />
              )}
              emptyTitle="No invoices found"
              emptyDescription="Raise an invoice for an OPD appointment or walk-in patient."
              emptyAction={
                canCreate("billing") ? (
                  <Button size="sm" onClick={() => setEditing(true)}>
                    Create invoice
                  </Button>
                ) : undefined
              }
              footer={
                <Pagination
                  page={pagination.page}
                  pageCount={pagination.totalPages}
                  total={pagination.total}
                  pageSize={pagination.limit}
                  onPage={(p) => setPagination((prev) => ({ ...prev, page: p }))}
                  onPageSize={(s) => setPagination((prev) => ({ ...prev, limit: s, page: 1 }))}
                  label="invoices"
                />
              }
            />
          </>
        ) : (
          <div className="p-4">
            {payments.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-ink-400">
                No payment transactions recorded yet.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-100">
                {payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 transition-colors hover:bg-brand-25/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-mint-50 text-mint-600 [&>svg]:size-4">
                        {p.paymentMode === "CASH" ? (
                          <Wallet />
                        ) : p.paymentMode === "INSURANCE" ? (
                          <Landmark />
                        ) : (
                          <CreditCard />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-ink-900">
                          {formatMoney(p.amount)} · {p.patient?.name || "Patient"}
                        </p>
                        <p className="num truncate text-[11.5px] text-ink-400">
                          Receipt: {p.receiptNo} · Bill: {p.billNo} · {formatDate(p.paidAt)} · Mode: {p.paymentMode}
                          {p.transactionId ? ` · Txn: ${p.transactionId}` : ""}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Panel>

      {/* CREATE INVOICE MODAL */}
      {editing && (
        <InvoiceForm
          onClose={() => setEditing(false)}
          onSuccess={() => {
            setEditing(false);
            reloadAll();
          }}
        />
      )}

      {/* RECORD PAYMENT MODAL */}
      {paying && (
        <PaymentDialog
          bill={paying}
          onClose={() => setPaying(null)}
          onSuccess={() => {
            setPaying(null);
            reloadAll();
          }}
        />
      )}

      {/* VIEW PRINTABLE INVOICE SHEET */}
      <Dialog
        open={!!viewing}
        onOpenChange={(v) => !v && setViewing(null)}
        size="lg"
        title={
          <span className="flex items-center gap-2">
            <Receipt className="size-4.5 text-brand-600" /> {viewing?.billNo}
          </span>
        }
        description={viewing ? `Statement · ${formatDate(viewing.billedAt)}` : ""}
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <StatusBadge status={viewing?.paymentStatus ?? ""} />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" icon={<Printer />} onClick={() => window.print()}>
                Print / PDF
              </Button>
              {canEdit("billing") && viewing && viewing.dueAmount > 0 && (
                <Button
                  size="sm"
                  icon={<Banknote />}
                  onClick={() => {
                    setPaying(viewing);
                    setViewing(null);
                  }}
                >
                  Record payment
                </Button>
              )}
            </div>
          </div>
        }
      >
        {viewing && <InvoiceSheet invoice={viewing} />}
      </Dialog>
    </>
  );
}

/* ------------------------------- INVOICE SHEET ------------------------------ */

function InvoiceSheet({ invoice }: { invoice: any }) {
  const patient = invoice.patient;
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-100 pb-4">
        <div>
          <p className="font-display text-[17px] font-bold text-ink-900">Hospital Multi-Specialty</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-400">Main OPD Block</p>
        </div>
        <div className="text-right">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-400">Tax Invoice</p>
          <p className="num text-[16px] font-bold text-ink-900">{invoice.billNo}</p>
          <p className="text-[11.5px] text-ink-400">Issued {formatDate(invoice.billedAt)}</p>
          <div className="mt-1.5 flex justify-end">
            <StatusBadge status={invoice.paymentStatus} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 py-4 sm:grid-cols-2">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-400">Billed to</p>
          <p className="mt-1 text-[13.5px] font-semibold text-ink-900">
            {patient ? `${patient.firstName} ${patient.lastName || ""}` : "Walk-in"}
          </p>
          <p className="text-[11.5px] text-ink-400">{patient?.uhid} · {patient?.mobile}</p>
        </div>
      </div>

      <table className="w-full text-left text-[12.5px]">
        <thead>
          <tr className="border-y border-ink-100 bg-ink-25/70 text-[10.5px] uppercase tracking-[0.1em] text-ink-500">
            <th className="px-2 py-2 font-semibold">Service / item</th>
            <th className="px-2 py-2 font-semibold">Category</th>
            <th className="px-2 py-2 text-center font-semibold">Qty</th>
            <th className="px-2 py-2 text-right font-semibold">Unit</th>
            <th className="px-2 py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {(invoice.items || []).map((it: any) => (
            <tr key={it.id}>
              <td className="px-2 py-2 font-medium text-ink-800">{it.itemName || it.description}</td>
              <td className="px-2 py-2 text-ink-500">{it.category}</td>
              <td className="num px-2 py-2 text-center">{it.quantity}</td>
              <td className="num px-2 py-2 text-right">{formatMoney(it.unitPrice)}</td>
              <td className="num px-2 py-2 text-right font-semibold">{formatMoney(it.totalAmount || it.quantity * it.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_15rem]">
        <div className="space-y-2 text-[11.5px] leading-relaxed text-ink-400">
          <p>
            <span className="font-semibold text-ink-700">Payments received · </span>
            {invoice.payments?.length === 0 && "None"}
            {invoice.payments?.map((p: any) => (
              <span key={p.id} className="num">
                {formatMoney(p.amount)} ({p.paymentMode}) on {formatDate(p.paidAt)}{" "}
              </span>
            ))}
          </p>
        </div>
        <dl className="space-y-1.5 rounded-xl border border-ink-100 bg-ink-25/60 p-3 text-[12.5px]">
          <Line label="Subtotal" value={formatMoney(invoice.subtotal)} />
          <Line label="Discount" value={`− ${formatMoney(invoice.discountAmount)}`} tone="mint" />
          <Line label="Tax" value={formatMoney(invoice.taxAmount)} />
          <div className="my-1.5 h-px bg-ink-200" />
          <Line label="Total payable" value={formatMoney(invoice.totalAmount)} strong />
          <Line label="Paid" value={formatMoney(invoice.paidAmount)} />
          <Line
            label="Balance due"
            value={formatMoney(invoice.dueAmount)}
            tone={invoice.dueAmount > 0 ? "coral" : "mint"}
            strong
          />
        </dl>
      </div>
    </div>
  );
}

const Line = ({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "mint" | "coral" }) => (
  <div className="flex items-center justify-between gap-3">
    <dt className={cn("text-ink-500", strong && "font-semibold text-ink-700")}>{label}</dt>
    <dd className={cn("num font-semibold", tone === "coral" ? "text-coral-600" : tone === "mint" ? "text-mint-600" : "text-ink-900", strong && "text-[14px]")}>
      {value}
    </dd>
  </div>
);

/* ------------------------------- INVOICE FORM (CREATE) ------------------------------- */

/* ------------------------------- INVOICE FORM (CREATE) ------------------------------- */

function InvoiceForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [searchParams] = useSearchParams();
  
  // 🟢 1. Read URL Parameters
  const urlAppointmentId = searchParams.get("appointment");
  const urlPatientId = searchParams.get("patient");

  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [mastersLoading, setMastersLoading] = useState(true);

  const newItem = () => ({
    id: idGen("it"),
    code: "",
    description: "",
    category: "Consultation",
    quantity: 1,
    unitPrice: 0,
    taxRate: 0,
  });

  const form = useForm({
    initialValues: {
      patientId: urlPatientId || "",
      doctorId: "",
      appointmentId: urlAppointmentId || "",
      date: todayISO(),
      dueDate: addDays(new Date(), 7),
      items: [newItem()],
      discountType: "Flat" as "Flat" | "Percent",
      discountValue: 0,
      notes: "",
      insurance: "",
      amountPaid: 0,
      paymentMethod: "UPI",
    },
    schema: {
      patientId: [{ required: "Select a patient" }],
      date: [{ required: "Billing date is required" }],
    },
  });

  // Load Patients, Doctors, and ALL Appointments (No filter constraint)
  useEffect(() => {
    async function loadMasters() {
      try {
        setMastersLoading(true);
        const [patRes, docRes, aptRes] = await Promise.all([
          billingService.getPatients({ limit: 100 }),
          billingService.getDoctors(),
          billingService.getAppointments({}), // Fetches all recent appointments
        ]);

        const rawPatients = patRes.data || [];
        const rawDoctors = docRes.data || [];
        const rawAppointments = aptRes.data || [];

        // Find appointment passed in URL
        let matchedApt = rawAppointments.find((a: any) => a.id === urlAppointmentId);

        // Ensure Patient from matchedApt is present in patient options
        if (matchedApt?.patient && !rawPatients.some((p: any) => p.id === matchedApt.patient.id)) {
          rawPatients.unshift(matchedApt.patient);
        }

        const patList = rawPatients.map((p: any) => ({
          value: p.id,
          label: `${p.firstName} ${p.lastName || ""}`.trim(),
          description: `UHID: ${p.uhid} | Mob: ${p.mobile || "N/A"}`,
          raw: p,
        }));
        setPatients(patList);

        setDoctors(
          rawDoctors.map((d: any) => ({
            value: d.id,
            label: `Dr. ${d.fullName || `${d.firstName} ${d.lastName || ""}`}`.trim(),
            fee: Number(d.consultationFee || 0),
          }))
        );

        const aptList = rawAppointments.map((a: any) => ({
          value: a.id,
          label: `${a.appointmentNo} · ${a.patient ? `${a.patient.firstName} ${a.patient.lastName || ""}` : "Patient"} (${a.status})`,
          description: `Date: ${a.appointmentDate} | Fee: ₹${a.consultationFee}`,
          raw: a,
        }));
        setAppointments(aptList);

        // 🟢 2. AUTO-FILL FORM STATE EXPLICITLY
        if (matchedApt) {
          const pId = matchedApt.patient?.id || urlPatientId || "";
          const fee = Number(matchedApt.consultationFee || 500);
          const docName = matchedApt.doctor
            ? `Dr. ${matchedApt.doctor.firstName} ${matchedApt.doctor.lastName || ""}`.trim()
            : "OPD";

          form.setValue("patientId", pId);
          form.setValue("appointmentId", urlAppointmentId!);
          form.setValue("items", [
            {
              id: idGen("it"),
              code: "CON",
              description: `Consultation - ${docName}`,
              category: "Consultation",
              quantity: 1,
              unitPrice: fee,
              taxRate: 0,
            },
          ]);
          form.setValue("amountPaid", fee);
        } else if (urlPatientId) {
          form.setValue("patientId", urlPatientId);
        }

      } catch (e) {
        console.error("Failed loading billing masters", e);
      } finally {
        setMastersLoading(false);
      }
    }
    loadMasters();
  }, [urlAppointmentId, urlPatientId]);

  // Handle manual appointment selection in dropdown
  const handleAppointmentChange = (aptId: string) => {
    form.setValue("appointmentId", aptId);
    const apt = appointments.find((a) => a.value === aptId)?.raw;
    if (!apt) return;

    if (apt.patient?.id) form.setValue("patientId", apt.patient.id);

    const fee = Number(apt.consultationFee || 500);

    form.setValue("items", [
      {
        id: idGen("it"),
        code: "CON",
        description: `Consultation - ${apt.doctor ? `Dr. ${apt.doctor.firstName} ${apt.doctor.lastName || ""}` : "OPD"}`,
        category: "Consultation",
        quantity: 1,
        unitPrice: fee,
        taxRate: 0,
      },
    ]);

    form.setValue("amountPaid", fee);
  };

  // Calculate totals dynamically
  const totals = useMemo(() => {
    let subtotal = 0;
    let itemizedTax = 0;

    form.values.items.forEach((it: any) => {
      const lineTotal = Number(it.quantity || 1) * Number(it.unitPrice || 0);
      subtotal += lineTotal;
      itemizedTax += lineTotal * ((it.taxRate || 0) / 100);
    });

    let discount = 0;
    if (form.values.discountType === "Percent") {
      discount = subtotal * (Number(form.values.discountValue || 0) / 100);
    } else {
      discount = Number(form.values.discountValue || 0);
    }

    const total = subtotal - discount + itemizedTax;
    const remaining = total - Number(form.values.amountPaid || 0);

    return { subtotal, discount, tax: itemizedTax, total, remaining };
  }, [form.values.items, form.values.discountType, form.values.discountValue, form.values.amountPaid]);

  const patchItem = (id: string, patch: any) =>
    form.setValue(
      "items",
      form.values.items.map((it: any) => (it.id === id ? { ...it, ...patch } : it))
    );

  const save = form.handleSubmit(async (values) => {
    const payload: any = {
      patientId: values.patientId,
      appointmentId: values.appointmentId || undefined,
      items: values.items
        .filter((i: any) => i.description.trim())
        .map((i: any) => ({
          code: i.code || undefined,
          description: i.description,
          category: i.category,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          taxRate: Number(i.taxRate || 0),
        })),
      discountPercent: values.discountType === "Percent" ? Number(values.discountValue) : undefined,
      discountAmount: values.discountType === "Flat" ? Number(values.discountValue) : undefined,
      isInsurance: Boolean(values.insurance) && values.insurance !== "Self pay",
      insuranceProvider: values.insurance !== "Self pay" ? values.insurance : undefined,
    };

    if (Number(values.amountPaid) > 0) {
      payload.paymentAmount = Number(values.amountPaid);
      payload.paymentMode = values.paymentMethod;
    }

    try {
      await billingService.createBill(payload);
      onSuccess();
    } catch (e: any) {
      alert(e.message || "Failed to create invoice");
    }
  });

  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && onClose()}
      size="xl"
      title="Create invoice"
      description="Line items, discounts and taxes recalculate as you type."
      onSubmit={save}
      loading={form.submitting || mastersLoading}
      submitLabel="Save & Print Bill"
    >
      <FormSection title="Bill details">
        <FormRow className="lg:grid-cols-4">
          <Select
            name="patientId"
            label="Patient"
            required
            value={form.values.patientId}
            onChange={(v) => form.setValue("patientId", v)}
            error={form.errors.patientId}
            options={patients}
          />

          <Select
            name="appointmentId"
            label="Link consultation"
            clearable
            value={form.values.appointmentId}
            onChange={handleAppointmentChange}
            options={appointments}
            hint="Auto-fills patient & doctor from visit"
          />

          <Select
            name="insurance"
            label="Insurance / payer"
            clearable
            value={form.values.insurance}
            onChange={(v) => form.setValue("insurance", v)}
            options={["Star Health", "HDFC Ergo", "ICICI Lombard", "CGHS", "Self pay"].map((i) => ({ value: i, label: i }))}
          />

          <DatePicker
            label="Billing date"
            required
            value={form.values.date}
            onChange={(v) => form.setValue("date", v)}
          />
        </FormRow>
      </FormSection>

      <FormSection title="Chargeable items">
        <div className="mt-3 space-y-2">
          {form.values.items.map((it: any, index: number) => (
            <div
              key={it.id}
              className="grid gap-2 rounded-xl border border-ink-100 bg-ink-25/40 p-2.5 lg:grid-cols-[2fr_1fr_0.5fr_0.8fr_0.5fr_auto_auto]"
            >
              <Select
                name={`s${it.id}`}
                label={index === 0 ? "Service / Item" : undefined}
                value={it.code || ""}
                onChange={(v) => {
                  const service = SERVICE_MASTER.find((s) => s.code === v);
                  if (service) {
                    patchItem(it.id, {
                      code: service.code,
                      description: service.desc,
                      category: service.cat,
                      unitPrice: service.price,
                      taxRate: service.tax,
                    });
                  }
                }}
                options={SERVICE_MASTER.map((s) => ({
                  value: s.code,
                  label: s.desc,
                  description: `${s.cat} | Base: ${formatMoney(s.price)}`,
                }))}
              />
              <Input
                name={`c${it.id}`}
                label={index === 0 ? "Category" : undefined}
                value={it.category}
                readOnly
                className="bg-ink-50 text-ink-500"
              />
              <NumberInput
                label={index === 0 ? "Qty" : undefined}
                value={it.quantity}
                onValueChange={(v) => patchItem(it.id, { quantity: v })}
                min={1}
              />
              <NumberInput
                label={index === 0 ? "Unit price" : undefined}
                value={it.unitPrice}
                onValueChange={(v) => patchItem(it.id, { unitPrice: v })}
                min={0}
                suffix="₹"
              />
              <NumberInput
                label={index === 0 ? "Tax %" : undefined}
                value={it.taxRate}
                onValueChange={(v) => patchItem(it.id, { taxRate: v })}
                min={0}
                max={40}
                suffix="%"
              />
              <div className="flex flex-col justify-end px-1 text-right">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                  {index === 0 ? "Amount" : ""}
                </span>
                <span className="num text-[13px] font-bold text-ink-900">
                  {formatMoney(it.quantity * it.unitPrice)}
                </span>
              </div>
              <div className="flex items-end justify-end">
                <IconButton
                  label="Remove line"
                  size="sm"
                  variant="ghost"
                  className="mb-1 text-coral-500 hover:bg-coral-50"
                  onClick={() => form.setValue("items", form.values.items.filter((x: any) => x.id !== it.id))}
                >
                  <Trash2 />
                </IconButton>
              </div>
            </div>
          ))}
          <Button size="sm" variant="outline" icon={<Plus />} onClick={() => form.setValue("items", [...form.values.items, newItem()])}>
            Add line item
          </Button>
        </div>
      </FormSection>

      <FormSection title="Adjustments & payment">
        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_1fr_17rem]">
          <div className="space-y-3">
            <RadioGroup
              label="Global Discount"
              value={form.values.discountType}
              onChange={(v) => form.setValue("discountType", v)}
              options={[
                { value: "Flat", label: "Flat amount" },
                { value: "Percent", label: "Percentage" },
              ]}
            />
            <NumberInput
              label="Discount Value"
              value={form.values.discountValue}
              onValueChange={(v) => form.setValue("discountValue", v)}
              min={0}
              suffix={form.values.discountType === "Percent" ? "%" : "₹"}
            />
          </div>
          <div className="space-y-3">
            <NumberInput
              label="Payment received now"
              value={form.values.amountPaid}
              onValueChange={(v) => form.setValue("amountPaid", Math.min(v, totals.total))}
              min={0}
              max={totals.total}
              suffix="₹"
            />
            <Select
              name="paymentMethod"
              label="Method"
              value={form.values.paymentMethod}
              onChange={(v) => form.setValue("paymentMethod", v)}
              options={["CASH", "CARD", "UPI", "INSURANCE", "ONLINE"].map((m) => ({ value: m, label: m }))}
            />
          </div>
          <dl className="space-y-1.5 self-start rounded-xl border border-brand-100 bg-brand-25 p-3.5 text-[12.5px]">
            <Line label="Subtotal" value={formatMoney(totals.subtotal)} />
            <Line label="Discount" value={`− ${formatMoney(totals.discount)}`} />
            <Line label="Itemized Tax" value={formatMoney(totals.tax)} />
            <div className="my-1.5 h-px bg-brand-200" />
            <Line label="Total payable" value={formatMoney(totals.total)} strong />
            <Line label="Balance" value={formatMoney(totals.remaining)} tone={totals.remaining > 0 ? "coral" : "mint"} strong />
          </dl>
        </div>
      </FormSection>
    </FormDialog>
  );
}

/* ------------------------------ PAYMENT DIALOG ------------------------------ */

function PaymentDialog({ bill, onClose, onSuccess }: { bill: any; onClose: () => void; onSuccess: () => void }) {
  const form = useForm({
    initialValues: {
      amount: bill.dueAmount,
      method: "UPI",
      reference: "",
      notes: "",
    },
    schema: {
      amount: [
        {
          required: "Amount is required",
          validate: (v: number) => (Number(v) > 0 && Number(v) <= bill.dueAmount ? true : `Max ${bill.dueAmount}`),
        },
      ],
    },
  });

  const save = form.handleSubmit(async (values) => {
    try {
      await billingService.collectPayment(bill.id, {
        amount: Number(values.amount),
        paymentMode: values.method,
        transactionId: values.reference || undefined,
        notes: values.notes || undefined,
      });
      onSuccess();
    } catch (e: any) {
      alert(e.message || "Failed to record payment");
    }
  });

  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && onClose()}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          <CircleDollarSign className="size-4.5 text-mint-600" /> Record payment
        </span>
      }
      description={`${bill.billNo} · balance ${formatMoney(bill.dueAmount)}`}
      onSubmit={save}
      loading={form.submitting}
      submitLabel="Save payment"
    >
      <div className="space-y-4">
        <NumberInput
          label="Amount received"
          required
          value={form.values.amount}
          onValueChange={(v) => form.setValue("amount", v)}
          min={1}
          max={bill.dueAmount}
          suffix="₹"
        />
        <Select
          name="method"
          label="Payment method"
          value={form.values.method}
          onChange={(v) => form.setValue("method", v)}
          options={["CASH", "CARD", "UPI", "INSURANCE", "ONLINE"].map((m) => ({ value: m, label: m }))}
        />
        <Input
          name="reference"
          label="Reference / Transaction ID"
          placeholder="UTR-4812…"
          value={form.values.reference}
          onChange={(e) => form.setValue("reference", e.target.value)}
        />
        <Input
          name="notes"
          label="Remark"
          placeholder="Part payment, final settlement…"
          value={form.values.notes}
          onChange={(e) => form.setValue("notes", e.target.value)}
        />
      </div>
    </FormDialog>
  );
}

export default BillingPage;