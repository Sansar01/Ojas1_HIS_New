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
  Trash2,
} from "lucide-react";
import { todayISO } from "@/data/db";
import { usePermission } from "@/hooks";
import { downloadText, formatDate, formatMoney, toCSV } from "@/utils";
import { cn } from "@/utils/cn";
import {
  Avatar,
  Button,
  Panel,
  StatusBadge,
} from "@/components/ui/primitives";
import { Select, DatePicker } from "@/components/ui/fields";
import {
  DataTable,
  Pagination,
  RowActions,
  TableToolbar,
} from "@/components/ui/table";
import { Dialog, Tabs } from "@/components/ui/overlays";
import { PageIntro, StatStrip } from "@/components/common";
import { billingService } from "@/features/billing/billingService";
import { OPDBillingForm } from "@/pages/billing/OPDBillingForm";
import { PaymentDialog } from "@/pages/billing/PaymentDialog";
import { InvoiceSheet } from "@/pages/billing/InvoiceSheet";

export function BillingPage() {
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
    date: "",
    search: "",
  });

  const [editing, setEditing] = useState<boolean>(params.get("new") === "1");
  const [viewing, setViewing] = useState<any | null>(null);
  const [paying, setPaying] = useState<any | null>(null);

  // --- API Calls ---
  const fetchSummary = useCallback(async () => {
    try {
      const summary = await billingService.getDailySummary(
        filters.date || undefined
      );
      setKpis({
        totalAmount: summary.totalAmount || 0,
        totalCollected: summary.totalCollected || 0,
        totalDue: summary.totalDue || 0,
        totalDiscount: summary.totalDiscount || 0,
      });
    } catch (e: any) {
      console.error("Summary error", e);
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
        date: filters.date,
      });
      setBills(res.data || []);
      setPagination((p) => ({
        ...p,
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
      setPayPagination((p) => ({
        ...p,
        total: res.meta?.total || 0,
        totalPages: res.meta?.totalPages || 1,
      }));
    } catch (e: any) {
      console.error("Payments error", e);
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

  // --- Actions ---
  const exportCsv = () => {
    downloadText(
      `invoices-${todayISO()}.csv`,
      toCSV(
        bills.map((i) => ({
          Invoice: i.billNo,
          Patient: i.patient
            ? `${i.patient.firstName} ${i.patient.lastName || ""}`
            : "—",
          Date: formatDate(i.billedAt),
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

  // If creating a new bill, show full-page form
  if (editing) {
    return (
      <OPDBillingForm
        onClose={() => setEditing(false)}
        onSuccess={() => {
          setEditing(false);
          reloadAll();
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
            <Button variant="outline" icon={<RefreshCw />} onClick={reloadAll}>
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
                    const name = i.patient
                      ? `${i.patient.firstName} ${i.patient.lastName || ""}`
                      : "Walk-in Patient";
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
                  header: "Billed",
                  render: (i) => (
                    <span className="text-[12.5px] text-ink-600">
                      {formatDate(i.billedAt)}
                    </span>
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
                      hidden:
                        !canEdit("billing") ||
                        i.paymentStatus === "PAID" ||
                        i.billStatus === "CANCELLED",
                      onClick: () => setPaying(i),
                    },
                    {
                      label: "Cancel Bill",
                      icon: <Trash2 />,
                      tone: "danger",
                      hidden:
                        !canDelete("billing") ||
                        i.paymentStatus === "PAID" ||
                        i.billStatus === "CANCELLED",
                      onClick: () => handleCancelBill(i),
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
                        {formatMoney(p.amount)} ·{" "}
                        {p.patient?.name || "Patient"}
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
            reloadAll();
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
            <StatusBadge status={viewing?.paymentStatus ?? ""} />
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
    </>
  );
}

export default BillingPage;