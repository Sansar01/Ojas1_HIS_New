import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Eye,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Banknote,
  Printer,
  Receipt,
  Undo2,
  Ban,
} from "lucide-react";
import { todayISO } from "@/utils";
import { usePermission } from "@/hooks";
import { downloadText, formatDate, formatMoney, toCSV } from "@/utils";
import { cn } from "@/utils/cn";
import { Avatar, Button, Panel } from "@/components/ui/primitives";
import { Select, DatePicker } from "@/components/ui/fields";
import {
  DataTable,
  Pagination,
  RowActions,
  TableToolbar,
} from "@/components/ui/table";
import { Dialog, Tabs } from "@/components/ui/overlays";
import { PageIntro, StatStrip } from "@/components/common";
import { billingService } from "@/pages/billing/billing.service";
import { useAppDispatch } from "@/store/hooks";
import { toast } from "@/store/slices/uiSlice";
import { OPDBillingForm } from "@/pages/billing/OPDBillingForm";
import { PaymentDialog } from "@/pages/billing/PaymentDialog";
import { InvoiceSheet } from "@/pages/billing/InvoiceSheet";
import { OpdReceiptSheet } from "@/pages/billing/OpdReceiptSheet";
import { BillStatusBadge } from "@/pages/billing/BillStatusBadge";
import { RefundDialog, refundableOf } from "@/pages/billing/RefundDialog";
import { CancelBillDialog } from "@/pages/billing/CancelBillDialog";

export function BillingPage() {
  const dispatch = useAppDispatch();
  const [params] = useSearchParams();
  const { canCreate, canEdit, canDelete } = usePermission();

  const [tab, setTab] = useState("invoices");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bills, setBills] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [kpis, setKpis] = useState({
    totalAmount: 0,
    totalCollected: 0,
    totalDue: 0,
    totalDiscount: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [payPagination, setPayPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [filters, setFilters] = useState({
    paymentStatus: "all",
    fromDate: "",
    toDate: "",
    search: "",
  });

  const [editing, setEditing] = useState<boolean>(params.get("new") === "1");
  const [viewing, setViewing] = useState<any | null>(null);
  const [paying, setPaying] = useState<any | null>(null);
  /** Bill currently shown in the printable receipt modal */
  const [receiptBill, setReceiptBill] = useState<any | null>(null);
  const [receiptData, setReceiptData] = useState<any | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  /** Bill targeted by the refund / cancel confirmation dialogs */
  const [refunding, setRefunding] = useState<any | null>(null);
  const [cancelling, setCancelling] = useState<any | null>(null);

  // --- API Calls ---
  const fetchSummary = useCallback(async () => {
    try {
      const body: any = (await billingService.fetchDailySummary())?.data ?? {};
      const summary: any = body.data ?? body;
      setKpis({
        totalAmount: summary.totalAmount || 0,
        totalCollected: summary.totalCollected || 0,
        totalDue: summary.totalDue || 0,
        totalDiscount: summary.totalDiscount || 0,
      });
    } catch (e: any) {
      console.error("Summary error", e);
      dispatch(toast.error("Could not load billing summary", e?.message));
    }
  }, [dispatch]);

  /**
   * Invoice list of this page: always fetched here through `billing.service`
   * — there is no shared snapshot any more, so the table can never show rows
   * another screen loaded.
   */
  const fetchBills = useCallback(
    async (_force = false) => {
      setLoading(true);
      setError(null);
      try {
        const res: any = await billingService.fetchInvoices({
          page: pagination.page,
          limit: pagination.limit,
          paymentStatus: filters.paymentStatus,
          fromDate: filters.fromDate,
          toDate: filters.toDate,
        });
        const body: any = res.data ?? {};
        setBills(body.data || []);
        // keep the pagination object identical when nothing changed: a new
        // object would re-create fetchBills → reloadAll → a second request
        // for the same page (doc §29).
        setPagination((p) => {
          const total = body.meta?.total || 0;
          const totalPages = body.meta?.totalPages || 1;
          return p.total === total && p.totalPages === totalPages
            ? p
            : { ...p, total, totalPages };
        });
      } catch (e: any) {
        setError(e.message || "Failed to load invoices");
        dispatch(toast.error("Could not load invoices", e?.message));
      } finally {
        setLoading(false);
      }
    },
    [pagination.page, pagination.limit, filters],
  );

  const fetchPayments = useCallback(async () => {
    try {
      const res: any = await billingService.fetchPayments({
        page: payPagination.page,
        limit: payPagination.limit,
      });
      const body: any = res.data ?? {};
      setPayments(body.data || []);
      setPayPagination((p) => {
        const total = body.meta?.total || 0;
        const totalPages = body.meta?.totalPages || 1;
        return p.total === total && p.totalPages === totalPages
          ? p
          : { ...p, total, totalPages };
      });
    } catch (e: any) {
      console.error("Payments error", e);
      dispatch(toast.error("Could not load payments", e?.message));
    }
  }, [payPagination.page, payPagination.limit]);

  const reloadAll = useCallback(
    (force = false) => {
      fetchSummary();
      fetchBills(force);
      fetchPayments();
    },
    [fetchSummary, fetchBills, fetchPayments],
  );

  /** Rows + table status of the invoice tab. */
  const invoiceRows = bills;
  const invoiceStatus = loading ? "loading" : error ? "error" : "ready";

  // One effect per endpoint: paging or filtering the invoices must not also
  // refetch the payments and the daily summary (and vice versa). `reloadAll`
  // is for explicit refreshes after a payment / refund / cancellation.
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);
  useEffect(() => {
    fetchBills();
  }, [fetchBills]);
  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // --- Actions ---
  const exportCsv = () => {
    downloadText(
      `invoices-${todayISO()}.csv`,
      toCSV(
        invoiceRows.map((i) => ({
          Invoice: i.billNo,
          Patient: i.patient?.fullName ||
            (i.patient ? `${i.patient.firstName} ${i.patient.lastName || ""}` : ""),
          Date: formatDate(i.billedAt),
          Doctor: i.doctor?.name ? `Dr. ${i.doctor.name}` : "",
          "Net amount": i.netAmount ?? i.totalAmount,
          Paid: i.paidAmount,
          Due: i.dueAmount,
          "Bill status": i.billStatus,
          "Payment status": i.paymentStatus,
        })),
      ),
    );
  };

  /** GET /api/opd/billing/:billId/receipt → printable receipt modal. */
  const openReceipt = async (bill: any) => {
    setReceiptBill(bill);
    setReceiptData(null);
    setReceiptLoading(true);
    try {
      const res: any = await billingService.fetchReceipt(bill.id);
      setReceiptData(res?.data ?? null);
    } catch (e: any) {
      dispatch(
        toast.error(
          "Could not load receipt",
          e?.data?.message || e?.message || "Please try again.",
        ),
      );
      setReceiptBill(null);
    } finally {
      setReceiptLoading(false);
    }
  };

  // If creating a new bill, show full-page form
  if (editing) {
    return (
      <OPDBillingForm
        onClose={() => setEditing(false)}
        onSuccess={() => {
          setEditing(false);
          reloadAll(true);
        }}
      />
    );
  }

  return (
    <>
      <PageIntro
        title="Billing & Invoices"
        description="Manage patient bills, record payments, and track outstanding balances."
        module="billing"
        createLabel="New OPD Bill"
        onCreate={() => setEditing(true)}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              icon={<RefreshCw />}
              onClick={() => reloadAll(true)}
            >
              Refresh
            </Button>
            <Button
              variant="outline"
              icon={<FileSpreadsheet />}
              onClick={exportCsv}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <StatStrip
          items={[
            {
              label: "Total Billed",
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
              {
                value: "payments",
                label: `Payment History (${payPagination.total})`,
              },
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
                    onChange={(v) =>
                      setFilters((f) => ({ ...f, paymentStatus: v }))
                    }
                    options={[
                      { value: "all", label: "Any status" },
                      { value: "PENDING", label: "Pending" },
                      { value: "PARTIALLY_PAID", label: "Partially paid" },
                      { value: "PAID", label: "Paid" },
                      { value: "REFUNDED", label: "Refunded" },
                    ]}
                  />
                  <DatePicker
                    label=""
                    value={filters.fromDate}
                    onChange={(v) => setFilters((f) => ({ ...f, fromDate: v }))}
                    placeholder="From date"
                  />
                  <DatePicker
                    label=""
                    value={filters.toDate}
                    onChange={(v) => setFilters((f) => ({ ...f, toDate: v }))}
                    placeholder="To date"
                  />
                </>
              }
            />

            <DataTable
              columns={[
                {
                  key: "billNo",
                  header: "Bill No",
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
                    const name =
                      i.patient?.fullName ||
                      (i.patient
                        ? `${i.patient.firstName} ${i.patient.lastName || ""}`
                        : "Walk-in Patient");
                    return (
                      <div className="flex items-center gap-2.5">
                        <Avatar name={name} size="xs" color="bg-lagoon-500" />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-ink-900">
                            {name}
                          </p>
                          <p className="truncate text-[11px] text-ink-400">
                            {i.patient?.uhid || ""}
                          </p>
                        </div>
                      </div>
                    );
                  },
                },
                {
                  key: "billedAt",
                  header: "Date",
                  render: (i) => (
                    <span className="text-[12.5px] text-ink-600">
                      {formatDate(i.billedAt)}
                    </span>
                  ),
                },
                {
                  key: "doctor",
                  header: "Doctor",
                  render: (i) => (
                    <span className="text-[12.5px] text-ink-600">
                      {i.doctor?.name ? `Dr. ${i.doctor.name}` : "—"}
                    </span>
                  ),
                },
                {
                  key: "netAmount",
                  header: "Net Amount",
                  align: "right",
                  render: (i) => (
                    <span className="num text-[13px] font-semibold text-ink-900">
                      {formatMoney(i.netAmount ?? i.totalAmount ?? 0)}
                    </span>
                  ),
                },
                {
                  key: "paidAmount",
                  header: "Paid",
                  align: "right",
                  render: (i) => (
                    <span className="num text-[13px] font-semibold text-mint-600">
                      {formatMoney(i.paidAmount ?? 0)}
                    </span>
                  ),
                },
                {
                  key: "dueAmount",
                  header: "Due",
                  align: "right",
                  render: (i) => (
                    <span
                      className={cn(
                        "num text-[13px] font-bold",
                        i.dueAmount > 0 ? "text-coral-600" : "text-mint-600",
                      )}
                    >
                      {formatMoney(i.dueAmount)}
                    </span>
                  ),
                },
                {
                  key: "billStatus",
                  header: "Bill Status",
                  align: "center",
                  render: (i) => <BillStatusBadge status={i.billStatus} />,
                },
                {
                  key: "paymentStatus",
                  header: "Payment",
                  align: "center",
                  render: (i) => <BillStatusBadge status={i.paymentStatus} />,
                },
              ]}
              rows={invoiceRows}
              status={invoiceStatus}
              onRetry={fetchBills}
              onRowClick={(i) => setViewing(i)}
              actions={(i) => (
                <RowActions
                  items={[
                    {
                      label: "View bill",
                      icon: <Eye />,
                      onClick: () => setViewing(i),
                    },
                    {
                      label: "Receipt",
                      icon: <Receipt />,
                      onClick: () => openReceipt(i),
                    },
                    {
                      label: "Collect payment",
                      icon: <Banknote />,
                      hidden:
                        !canEdit("billing") ||
                        !["GENERATED", "PARTIALLY_PAID"].includes(
                          i.billStatus,
                        ) ||
                        Number(i.dueAmount ?? 0) <= 0,
                      onClick: () => setPaying(i),
                    },
                    {
                      label: "Refund",
                      icon: <Undo2 />,
                      tone: "danger",
                      hidden:
                        !canEdit("billing") ||
                        Number(i.paidAmount ?? 0) <= 0 ||
                        refundableOf(i) <= 0,
                      onClick: () => setRefunding(i),
                    },
                    {
                      label: "Cancel bill",
                      icon: <Ban />,
                      tone: "danger",
                      hidden:
                        !canDelete("billing") ||
                        i.billStatus !== "GENERATED" ||
                        Number(i.paidAmount ?? 0) !== 0,
                      onClick: () => setCancelling(i),
                    },
                  ]}
                />
              )}
              emptyTitle="No invoices found"
              emptyDescription="Raise an invoice for an OPD appointment or walk-in patient."
              emptyAction={
                canCreate("billing") ? (
                  <Button
                    size="sm"
                    icon={<Plus />}
                    onClick={() => setEditing(true)}
                  >
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
                  onPage={(p) =>
                    setPagination((prev) => ({ ...prev, page: p }))
                  }
                  onPageSize={(s) =>
                    setPagination((prev) => ({ ...prev, limit: s, page: 1 }))
                  }
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
                    className="flex items-center justify-between gap-3 bg-white px-4 py-3 hover:bg-brand-25/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-ink-900">
                        {formatMoney(p.amount)} · {p.patient?.name || "Patient"}
                      </p>
                      <p className="num truncate text-[11.5px] text-ink-400">
                        Receipt: {p.receiptNo} · Bill: {p.billNo} ·{" "}
                        {formatDate(p.paidAt)} · {p.paymentMode}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Panel>

      {/* Payment Modal */}
      {paying && (
        <PaymentDialog
          bill={paying}
          onClose={() => setPaying(null)}
          onSuccess={() => {
            setPaying(null);
            reloadAll(true);
          }}
        />
      )}

      {/* View Invoice Modal */}
      <Dialog
        open={!!viewing}
        onOpenChange={(v) => !v && setViewing(null)}
        size="lg"
        title={
          <span className="flex items-center gap-2">
            <Receipt className="size-4.5 text-brand-600" /> {viewing?.billNo}
          </span>
        }
        description={
          viewing ? `Statement · ${formatDate(viewing.billedAt)}` : ""
        }
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <BillStatusBadge status={viewing?.paymentStatus ?? ""} />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                icon={<Printer />}
                onClick={() => window.print()}
              >
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

      {/* Receipt Modal — printable (index.css print rules target .opd-receipt) */}
      <Dialog
        open={!!receiptBill}
        onOpenChange={(v) => {
          if (!v) {
            setReceiptBill(null);
            setReceiptData(null);
          }
        }}
        size="lg"
        title={
          <span className="flex items-center gap-2">
            <Receipt className="size-4.5 text-brand-600" /> Receipt
          </span>
        }
        description={receiptBill ? `Bill ${receiptBill.billNo}` : ""}
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              icon={<Printer />}
              disabled={!receiptData}
              onClick={() => window.print()}
            >
              Print / PDF
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setReceiptBill(null);
                setReceiptData(null);
              }}
            >
              Done
            </Button>
          </div>
        }
      >
        {receiptData ? (
          <OpdReceiptSheet receipt={receiptData} />
        ) : (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-400">
            <RefreshCw
              className={cn("size-4", receiptLoading && "animate-spin")}
            />
            {receiptLoading ? "Loading receipt…" : "Receipt unavailable."}
          </div>
        )}
      </Dialog>

      {/* Refund (credit note) confirmation */}
      {refunding && (
        <RefundDialog
          bill={refunding}
          onClose={() => setRefunding(null)}
          onSuccess={() => {
            setRefunding(null);
            reloadAll(true);
          }}
        />
      )}

      {/* Cancel bill confirmation */}
      {cancelling && (
        <CancelBillDialog
          bill={cancelling}
          onClose={() => setCancelling(null)}
          onSuccess={() => {
            setCancelling(null);
            reloadAll(true);
          }}
        />
      )}
    </>
  );
}

export default BillingPage;
