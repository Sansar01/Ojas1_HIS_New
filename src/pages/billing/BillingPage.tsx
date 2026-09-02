import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BadgePercent, Banknote, CircleDollarSign, CreditCard, Eye, FileSpreadsheet, Landmark, Pencil, Plus, Printer, Receipt,
  Trash2, Wallet,
} from "lucide-react";
import { INVOICE_CATEGORIES, PAYMENT_METHODS } from "@/constants";
import { addDays, todayISO } from "@/data/db";
import { useAppDispatch, usePermission, useRootSelector, useTable } from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { invoicesApi } from "@/features/slices";
import { derivePaymentStatus, downloadText, formatDate, formatMoney, fullName, invoiceTotals, toCSV } from "@/utils";
import { cn } from "@/utils/cn";
import type { Invoice, InvoiceItem, Payment } from "@/types";
import { Avatar, Badge, Button, IconButton, Panel, StatusBadge } from "@/components/ui/primitives";
import { Input, NumberInput, Select, DatePicker, RadioGroup, Textarea } from "@/components/ui/fields";
import { DataTable, Pagination, RowActions, TableToolbar } from "@/components/ui/table";
import { Dialog, Tabs } from "@/components/ui/overlays";
import { FormDialog, FormRow, FormSection, PageIntro, StatStrip } from "@/components/common";
import { idGen } from "@/data/db";

export function BillingPage() {
  const dispatch = useAppDispatch();
  const [params, setParams] = useSearchParams();
  const { items: invoices, status } = useRootSelector((s) => s.invoices);
  const patients = useRootSelector((s) => s.patients.items);
  const doctors = useRootSelector((s) => s.doctors.items);
  const hospital = useRootSelector((s) => s.hospital.data);
  const { canCreate, canEdit, canDelete } = usePermission();
  const [tab, setTab] = useState("invoices");
  const [filters, setFilters] = useState({ paymentStatus: "all", doctor: "all", from: "", to: "" });
  const [editing, setEditing] = useState<Partial<Invoice> | null>(params.get("new") === "1" ? { patientId: params.get("patient") ?? "" } : null);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);

  const patientMap = useMemo(() => new Map(patients.map((p: any) => [p.id, p])), [patients]);
  const doctorMap = useMemo(() => new Map(doctors.map((d: any) => [d.id, d])), [doctors]);

  useEffect(() => {
    if (status === "idle") dispatch(invoicesApi.thunks.fetchAll() as any);
  }, [status, dispatch]);

  const enriched = useMemo(
    () => (invoices as Invoice[]).map((inv) => ({ ...inv, totals: invoiceTotals(inv) })),
    [invoices],
  );

  const kpis = useMemo(() => {
    const billed = enriched.reduce((s, i) => s + i.totals.total, 0);
    const collected = enriched.reduce((s, i) => s + i.totals.paid, 0);
    const outstanding = enriched.filter((i) => i.paymentStatus === "Pending" || i.paymentStatus === "Partially Paid").reduce((s, i) => s + i.totals.remaining, 0);
    const refunded = enriched.filter((i) => i.paymentStatus === "Refunded").reduce((s, i) => s + i.totals.paid, 0);
    return { billed, collected, outstanding, refunded };
  }, [enriched]);

  const filtered = enriched.filter((i) => {
    if (filters.paymentStatus !== "all" && i.paymentStatus !== filters.paymentStatus) return false;
    if (filters.doctor !== "all" && i.doctorId !== filters.doctor) return false;
    if (filters.from && i.date < filters.from) return false;
    if (filters.to && i.date > filters.to) return false;
    return true;
  });

  const table = useTable<any>(filtered, {
    pageSize: 10,
    searchFields: [(i) => i.number, (i) => fullName(patientMap.get(i.patientId)), (i) => i.notes, (i) => i.items.map((it: any) => it.description).join(" ")],
    sortAccessors: { date: (i) => i.date, total: (i) => i.totals.total, paymentStatus: (i) => i.paymentStatus, patient: (i) => fullName(patientMap.get(i.patientId)) },
  });

  const payments = useMemo(
    () =>
      enriched
        .flatMap((i) => i.payments.map((p) => ({ ...p, invoice: i.number, patient: fullName(patientMap.get(i.patientId)), invoiceId: i.id })))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [enriched, patientMap],
  );

  const clearParams = () => {
    if (params.get("new") || params.get("invoice")) {
      params.delete("new");
      params.delete("invoice");
      params.delete("patient");
      setParams(params, { replace: true });
    }
  };

  useEffect(() => {
    const target = params.get("invoice");
    if (target) {
      const found = (invoices as Invoice[]).find((i) => i.id === target);
      if (found) setViewing(found);
      clearParams();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, invoices]);

  const exportCsv = () => {
    downloadText(
      `invoices-${todayISO()}.csv`,
      toCSV(
        filtered.map((i) => ({
          Invoice: i.number,
          Patient: fullName(patientMap.get(i.patientId)),
          Date: i.date,
          Subtotal: i.totals.subtotal,
          Discount: i.totals.discount,
          Tax: i.totals.tax,
          Total: i.totals.total,
          Paid: i.totals.paid,
          Balance: i.totals.remaining,
          Status: i.paymentStatus,
        })),
      ),
    );
  };

  return (
    <>
      <PageIntro
        title="Billing & invoices"
        description="Charge consultation fees, procedures, labs and pharmacy items. Discounts, taxes, part-payments and refunds are recalculated instantly."
        module="billing"
        createLabel="Create invoice"
        onCreate={() => setEditing({ date: todayISO(), dueDate: addDays(new Date(), 7) })}
        actions={
          <Button variant="outline" icon={<FileSpreadsheet />} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 xl:grid-cols-[1fr_auto]">
        <StatStrip
          items={[
            { label: "Total billed", value: formatMoney(kpis.billed), tone: "text-ink-900" },
            { label: "Collected", value: formatMoney(kpis.collected), tone: "text-mint-600" },
            { label: "Outstanding", value: formatMoney(kpis.outstanding), tone: "text-coral-600" },
            { label: "Refunded", value: formatMoney(kpis.refunded), tone: "text-amberly-600" },
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
              { value: "invoices", label: `Invoices (${invoices.length})` },
              { value: "payments", label: `Payment history (${payments.length})` },
            ]}
          />
        </div>

        {tab === "invoices" ? (
          <>
            <TableToolbar
              search={table.query.search}
              onSearch={table.setSearch}
              searchPlaceholder="Search invoice no, patient, item…"
              filters={
                <>
                  <Select size="sm" className="w-[10.5rem]" name="ps" value={filters.paymentStatus} onChange={(v) => setFilters((f) => ({ ...f, paymentStatus: v }))} options={[{ value: "all", label: "Any payment status" }, { value: "Pending", label: "Pending" }, { value: "Partially Paid", label: "Partially paid" }, { value: "Paid", label: "Paid" }, { value: "Refunded", label: "Refunded" }, { value: "Cancelled", label: "Cancelled" }]} />
                  <Select size="sm" className="w-[11rem]" name="doc" value={filters.doctor} onChange={(v) => setFilters((f) => ({ ...f, doctor: v }))} options={[{ value: "all", label: "All doctors" }, ...doctors.map((d: any) => ({ value: d.id, label: `Dr. ${d.lastName}` }))]} />
                  <DatePicker label="" value={filters.from} onChange={(v) => setFilters((f) => ({ ...f, from: v }))} placeholder="From" />
                  <DatePicker label="" value={filters.to} onChange={(v) => setFilters((f) => ({ ...f, to: v }))} placeholder="To" />
                </>
              }
              actions={canCreate("billing") ? <Button size="sm" icon={<Plus />} onClick={() => setEditing({ date: todayISO(), dueDate: addDays(new Date(), 7) })}>New invoice</Button> : <Badge tone="neutral">View only</Badge>}
            />
            <DataTable
              columns={[
                { key: "number", header: "Invoice", render: (i) => <span className="num text-[13px] font-bold text-ink-900">{i.number}</span> },
                {
                  key: "patient",
                  header: "Patient",
                  sortable: true,
                  render: (i) => (
                    <div className="flex items-center gap-2.5">
                      <Avatar name={fullName(patientMap.get(i.patientId))} size="xs" color="bg-lagoon-500" />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-ink-900">{fullName(patientMap.get(i.patientId))}</p>
                        <p className="truncate text-[11px] text-ink-400">{i.doctorId ? `Dr. ${fullName(doctorMap.get(i.doctorId))}` : "Self / walk-in"}</p>
                      </div>
                    </div>
                  ),
                },
                { key: "date", header: "Billed", sortable: true, hideBelow: "md", render: (i) => <span className="text-[12.5px] text-ink-600">{formatDate(i.date)}</span> },
                { key: "dueDate", header: "Due", hideBelow: "lg", render: (i) => <span className={cn("text-[12.5px]", new Date(i.dueDate) < new Date() && i.totals.remaining > 0 ? "font-semibold text-coral-600" : "text-ink-500")}>{formatDate(i.dueDate)}</span> },
                { key: "items", header: "Lines", align: "center", hideBelow: "xl", render: (i) => <Badge tone="neutral" size="xs">{i.items.length}</Badge> },
                { key: "total", header: "Total", align: "right", sortable: true, render: (i) => <span className="num text-[13px] font-bold text-ink-900">{formatMoney(i.totals.total)}</span> },
                { key: "paid", header: "Paid / Balance", align: "right", hideBelow: "sm", render: (i) => <span className="num text-[12px] text-ink-500">{formatMoney(i.totals.paid)} <span className="text-ink-300">/</span> <span className={i.totals.remaining > 0 ? "font-semibold text-coral-600" : "text-mint-600"}>{formatMoney(i.totals.remaining)}</span></span> },
                { key: "paymentStatus", header: "Status", align: "center", sortable: true, render: (i) => <StatusBadge status={i.paymentStatus} /> },
              ]}
              rows={table.rows}
              status={status === "ready" ? "ready" : status === "error" ? "error" : "loading"}
              onRetry={() => dispatch(invoicesApi.thunks.fetchAll() as any)}
              sort={{ sortBy: table.query.sortBy, sortDir: table.query.sortDir, onSort: table.toggleSort }}
              onRowClick={(i) => setViewing(i)}
              actions={(i) => (
                <RowActions
                  items={[
                    { label: "View invoice", icon: <Eye />, onClick: () => setViewing(i) },
                    { label: "Record payment", icon: <Banknote />, hidden: !canEdit("billing") || i.paymentStatus === "Paid" || i.paymentStatus === "Cancelled", onClick: () => setPaying(i) },
                    { label: "Edit invoice", icon: <Pencil />, hidden: !canEdit("billing"), onClick: () => setEditing(i) },
                    { label: "Delete invoice", icon: <Trash2 />, tone: "danger", hidden: !canDelete("billing"), onClick: () => dispatch(invoicesApi.thunks.removeOne({ id: i.id, label: i.number } as any)) },
                  ]}
                />
              )}
              emptyTitle="No invoices yet"
              emptyDescription="Raise an invoice from a completed consultation or create a standalone bill."
              emptyAction={canCreate("billing") ? <Button size="sm" onClick={() => setEditing({ date: todayISO() })}>Create invoice</Button> : undefined}
              footer={<Pagination page={table.page} pageCount={table.pageCount} total={table.total} pageSize={table.pageSize} onPage={table.setPage} onPageSize={table.setPageSize} label="invoices" />}
            />
          </>
        ) : (
          <div className="p-4">
            {payments.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-ink-400">No payments recorded yet.</p>
            ) : (
              <ul className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-100">
                {payments.slice(0, 40).map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 transition-colors hover:bg-brand-25/40">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-mint-50 text-mint-600 [&>svg]:size-4">
                        {p.method === "Cash" ? <Wallet /> : p.method === "Insurance" ? <Landmark /> : <CreditCard />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-ink-900">
                          {formatMoney(p.amount)} · {p.patient}
                        </p>
                        <p className="num truncate text-[11.5px] text-ink-400">
                          {p.invoice} · {formatDate(p.date)} · {p.method} · {p.reference || "no ref"}
                        </p>
                      </div>
                    </div>
                    <Button size="xs" variant="ghost" onClick={() => setViewing(enriched.find((e) => e.id === p.invoiceId) as any)}>
                      View invoice
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Panel>

      {editing && (
        <InvoiceForm
          initial={editing}
          onClose={() => {
            setEditing(null);
            clearParams();
          }}
        />
      )}

      {paying && <PaymentDialog invoice={paying} onClose={() => setPaying(null)} />}

      {/* printable invoice view */}
      <Dialog
        open={!!viewing}
        onOpenChange={(v) => !v && setViewing(null)}
        size="lg"
        title={
          <span className="flex items-center gap-2">
            <Receipt className="size-4.5 text-brand-600" /> {viewing?.number}
          </span>
        }
        description={viewing ? `Patient statement · ${formatDate(viewing.date)}` : ""}
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <StatusBadge status={viewing?.paymentStatus ?? ""} />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" icon={<Printer />} onClick={() => window.print()}>
                Print / PDF
              </Button>
              {canEdit("billing") && viewing && (viewing as any).totals.remaining > 0 && (
                <Button size="sm" icon={<Banknote />} onClick={() => { setPaying(viewing); setViewing(null); }}>
                  Record payment
                </Button>
              )}
            </div>
          </div>
        }
      >
        {viewing && (
          <InvoiceSheet
            invoice={viewing}
            patient={patientMap.get(viewing.patientId)}
            doctor={viewing.doctorId ? doctorMap.get(viewing.doctorId) : null}
            hospital={hospital as any}
          />
        )}
      </Dialog>
    </>
  );
}

/* ------------------------------- invoice sheet ------------------------------ */

export function InvoiceSheet({ invoice, patient, doctor, hospital }: { invoice: Invoice; patient?: any; doctor?: any; hospital?: any }) {
  const t = invoiceTotals(invoice);
  const currency = hospital?.currencySymbol ?? "₹";
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-100 pb-4">
        <div>
          <p className="font-display text-[17px] font-bold text-ink-900">{hospital?.name ?? "Meridian Care Multispeciality Hospital"}</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-400">
            {hospital?.address} · {hospital?.city}
            <br />
            {hospital?.phone} · {hospital?.email} · GST {hospital?.taxId}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-400">Tax invoice</p>
          <p className="num text-[16px] font-bold text-ink-900">{invoice.number}</p>
          <p className="text-[11.5px] text-ink-400">Issued {formatDate(invoice.date)} · Due {formatDate(invoice.dueDate)}</p>
          <div className="mt-1.5 flex justify-end">
            <StatusBadge status={invoice.paymentStatus} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 py-4 sm:grid-cols-2">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-400">Billed to</p>
          <p className="mt-1 text-[13.5px] font-semibold text-ink-900">{fullName(patient)}</p>
          <p className="text-[11.5px] text-ink-400">{patient?.mrn} · {patient?.mobile}</p>
          <p className="text-[11.5px] text-ink-400">{patient?.address}, {patient?.city}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-400">Attending</p>
          <p className="mt-1 text-[13.5px] font-semibold text-ink-900">{doctor ? `Dr. ${fullName(doctor)}` : "—"}</p>
          <p className="text-[11.5px] text-ink-400">{doctor?.registrationNumber ?? ""}</p>
          {invoice.insurance && <Badge tone="lagoon" size="xs">Insurance · {invoice.insurance}</Badge>}
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
          {invoice.items.map((it) => (
            <tr key={it.id}>
              <td className="px-2 py-2 font-medium text-ink-800">{it.description || "—"}</td>
              <td className="px-2 py-2 text-ink-500">{it.category}</td>
              <td className="num px-2 py-2 text-center">{it.quantity}</td>
              <td className="num px-2 py-2 text-right">{formatMoney(it.unitPrice, currency)}</td>
              <td className="num px-2 py-2 text-right font-semibold">{formatMoney(it.quantity * it.unitPrice, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_15rem]">
        <div className="space-y-2 text-[11.5px] leading-relaxed text-ink-400">
          {invoice.notes && (
            <p className="rounded-lg bg-ink-25 px-3 py-2 text-ink-600">
              <span className="font-semibold text-ink-700">Notes · </span>
              {invoice.notes}
            </p>
          )}
          <p>
            <span className="font-semibold text-ink-700">Payments received · </span>
            {invoice.payments.length === 0 && "None"}
            {invoice.payments.map((p) => (
              <span key={p.id} className="num">
                {formatMoney(p.amount, currency)} ({p.method}
                {p.reference ? ` · ${p.reference}` : ""} on {formatDate(p.date)}){" "}
              </span>
            ))}
          </p>
        </div>
        <dl className="space-y-1.5 rounded-xl border border-ink-100 bg-ink-25/60 p-3 text-[12.5px]">
          <Line label="Subtotal" value={formatMoney(t.subtotal, currency)} />
          {t.discount > 0 && <Line label={`Discount${invoice.discountType === "Percent" ? ` (${invoice.discountValue}%)` : ""}`} value={`− ${formatMoney(t.discount, currency)}`} tone="mint" />}
          <Line label={`Tax (${invoice.taxRate}%)`} value={formatMoney(t.tax, currency)} />
          <div className="my-1.5 h-px bg-ink-200" />
          <Line label="Total payable" value={formatMoney(t.total, currency)} strong />
          <Line label="Paid" value={formatMoney(t.paid, currency)} />
          <Line label="Balance due" value={formatMoney(t.remaining, currency)} tone={t.remaining > 0 ? "coral" : "mint"} strong />
        </dl>
      </div>
      <p className="mt-4 border-t border-ink-100 pt-3 text-center text-[10.5px] text-ink-400">
        This is a computer generated invoice · {hospital?.name ?? "Meridian Care"} · License {hospital?.licenseNo ?? "—"}
      </p>
    </div>
  );
}

const Line = ({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "mint" | "coral" }) => (
  <div className="flex items-center justify-between gap-3">
    <dt className={cn("text-ink-500", strong && "font-semibold text-ink-700")}>{label}</dt>
    <dd className={cn("num font-semibold", tone === "coral" ? "text-coral-600" : tone === "mint" ? "text-mint-600" : "text-ink-900", strong && "text-[14px]")}>{value}</dd>
  </div>
);

/* ------------------------------- invoice form ------------------------------- */

function InvoiceForm({ initial, onClose }: { initial: Partial<Invoice>; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const patients = useRootSelector((s) => s.patients.items);
  const doctors = useRootSelector((s) => s.doctors.items);
  const consultations = useRootSelector((s) => s.consultations.items);
  const isEdit = Boolean(initial.id);

  const newItem = (): InvoiceItem => ({ id: idGen("it"), description: "", category: "Consultation", quantity: 1, unitPrice: 0 });

  const form = useForm({
    initialValues: {
      patientId: initial.patientId ?? (patients[0]?.id ?? ""),
      doctorId: initial.doctorId ?? (doctors.find((d: any) => d.status === "active")?.id ?? ""),
      consultationId: initial.consultationId ?? "",
      date: initial.date ?? todayISO(),
      dueDate: initial.dueDate ?? addDays(new Date(), 7),
      items: initial.items?.length
        ? initial.items
        : [
            { id: idGen("it"), description: "Consultation — specialist OPD review", category: "Consultation", quantity: 1, unitPrice: 1200 },
            { id: idGen("it"), description: "ECG + 2D echocardiography", category: "Procedure", quantity: 1, unitPrice: 2400 },
            { id: idGen("it"), description: "Lipid profile, HbA1c, renal panel", category: "Lab", quantity: 1, unitPrice: 950 },
          ] as InvoiceItem[],
      discountType: (initial.discountType ?? "Flat") as Invoice["discountType"],
      discountValue: initial.discountValue ?? 0,
      taxRate: initial.taxRate ?? 5,
      notes: initial.notes ?? "",
      insurance: initial.insurance ?? "",
      amountPaid: 0,
      paymentMethod: "Card" as Payment["method"],
    },
    schema: {
      patientId: [{ required: "Select a patient" }],
      date: [{ required: "Billing date is required" }],
      dueDate: [{ required: "Due date is required" }],
    },
  });

  const totals = invoiceTotals({
    items: form.values.items,
    discountType: form.values.discountType,
    discountValue: form.values.discountValue,
    taxRate: form.values.taxRate,
    payments: form.values.amountPaid > 0 ? [{ amount: form.values.amountPaid } as any] : [],
  });

  const patchItem = (id: string, patch: Partial<InvoiceItem>) =>
    form.setValue("items", form.values.items.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const save = form.handleSubmit(async (values) => {
    const data: any = {
      patientId: values.patientId,
      doctorId: values.doctorId || null,
      consultationId: values.consultationId || null,
      date: values.date,
      dueDate: values.dueDate,
      items: values.items.filter((i) => i.description.trim()),
      discountType: values.discountType,
      discountValue: Number(values.discountValue),
      taxRate: Number(values.taxRate),
      notes: values.notes,
      insurance: values.insurance || undefined,
      payments: values.amountPaid > 0 ? [{ id: idGen("pay"), date: values.date, amount: Number(values.amountPaid), method: values.paymentMethod, reference: "", note: "Payment at invoice creation" }] : [],
    };
    data.paymentStatus = derivePaymentStatus(invoiceTotals({ ...data, payments: data.payments }).total, data.payments.reduce((s: number, p: any) => s + p.amount, 0));
    if (isEdit) await dispatch(invoicesApi.thunks.updateOne({ id: initial.id!, data, successMessage: "Invoice updated" } as any));
    else await dispatch(invoicesApi.thunks.createOne({ data: { ...data, number: `${hospitalPrefix()}${Math.floor(2500 + Math.random() * 499)}` }, successMessage: "Invoice created" } as any));
    onClose();
  });

  const hospital = useRootSelector((s) => s.hospital.data);
  const hospitalPrefix = () => `${hospital?.invoicePrefix ?? "MCH"}-`;

  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && onClose()}
      size="xl"
      title={isEdit ? `Edit invoice ${initial.number}` : "Create invoice"}
      description="Line items, discounts and taxes recalculate the payable amount as you type."
      onSubmit={save}
      loading={form.submitting}
      submitLabel={isEdit ? "Save invoice" : "Raise invoice"}
      footerNote={<span>Subtotal {formatMoney(totals.subtotal)} · Tax {formatMoney(totals.tax)} · Payable <strong className="text-ink-700">{formatMoney(totals.total)}</strong></span>}
    >
      <FormSection title="Bill details">
        <FormRow className="lg:grid-cols-4">
          <Select name="patientId" label="Patient" required value={form.values.patientId} onChange={(v) => form.setValue("patientId", v)} error={form.errors.patientId} options={patients.map((p: any) => ({ value: p.id, label: fullName(p), description: p.mrn }))} />
          <Select name="doctorId" label="Attending doctor" clearable value={form.values.doctorId} onChange={(v) => form.setValue("doctorId", v)} options={doctors.map((d: any) => ({ value: d.id, label: `Dr. ${fullName(d)}` }))} />
          <Select
            name="consultationId"
            label="Link consultation"
            clearable
            value={form.values.consultationId}
            onChange={(v) => {
              const con = consultations.find((c: any) => c.id === v) as any;
              form.setValues({ ...form.values, consultationId: v, patientId: con?.patientId ?? form.values.patientId, doctorId: con?.doctorId ?? form.values.doctorId });
            }}
            options={consultations.filter((c: any) => c.status === "Completed").map((c: any) => ({ value: c.id, label: c.code, description: c.diagnosis }))}
            hint="Auto-fills patient & doctor from a completed visit"
          />
          <Select name="insurance" label="Insurance / payer" clearable value={form.values.insurance ?? ""} onChange={(v) => form.setValue("insurance", v)} options={["Star Health", "HDFC Ergo", "ICICI Lombard", "CGHS", "Self pay"].map((i) => ({ value: i, label: i }))} />
          <DatePicker label="Billing date" required value={form.values.date} onChange={(v) => form.setValue("date", v)} error={form.errors.date} />
          <DatePicker label="Due date" required value={form.values.dueDate} onChange={(v) => form.setValue("dueDate", v)} error={form.errors.dueDate} min={form.values.date} />
        </FormRow>
      </FormSection>

      <FormSection title="Chargeable items">
        <div className="mt-3 space-y-2">
          {form.values.items.map((it, index) => (
            <div key={it.id} className="grid gap-2 rounded-xl border border-ink-100 bg-ink-25/40 p-2.5 lg:grid-cols-[1.8fr_.9fr_.5fr_.8fr_auto_auto]">
              <Input name={`d${it.id}`} label={index === 0 ? "Description" : undefined} placeholder="Consultation — Dr. Rao" value={it.description} onChange={(e) => patchItem(it.id, { description: e.target.value })} />
              <Select size="sm" name={`c${it.id}`} label={index === 0 ? "Category" : undefined} value={it.category} onChange={(v) => patchItem(it.id, { category: v as any })} options={INVOICE_CATEGORIES.map((c) => ({ value: c, label: c }))} />
              <NumberInput label={index === 0 ? "Qty" : undefined} value={it.quantity} onValueChange={(v) => patchItem(it.id, { quantity: v })} min={1} max={99} />
              <NumberInput label={index === 0 ? "Unit price" : undefined} value={it.unitPrice} onValueChange={(v) => patchItem(it.id, { unitPrice: v })} min={0} step={50} suffix="₹" />
              <div className="flex flex-col justify-end px-1 text-right">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">{index === 0 ? "Amount" : ""}</span>
                <span className="num text-[13px] font-bold text-ink-900">{formatMoney(it.quantity * it.unitPrice)}</span>
              </div>
              <div className="flex items-end justify-end">
                <IconButton label="Remove line" size="sm" variant="ghost" className="mb-1 text-coral-500 hover:bg-coral-50" onClick={() => form.setValue("items", form.values.items.filter((x) => x.id !== it.id))}>
                  <Trash2 />
                </IconButton>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button size="sm" variant="outline" icon={<Plus />} onClick={() => form.setValue("items", [...form.values.items, newItem()])}>
              Add line item
            </Button>
            <Button size="sm" variant="ghost" icon={<BadgePercent />} onClick={() => form.setValue("items", [...form.values.items, { ...newItem(), description: "Session discount", category: "Service", quantity: 1, unitPrice: 0 }])}>
              Add concession line
            </Button>
          </div>
        </div>
      </FormSection>

      <FormSection title="Adjustments & payment">
        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_1fr_17rem]">
          <div className="space-y-3">
            <RadioGroup label="Discount basis" value={form.values.discountType} onChange={(v) => form.setValue("discountType", v)} options={[{ value: "Flat", label: "Flat amount" }, { value: "Percent", label: "Percentage" }]} />
            <NumberInput label={form.values.discountType === "Percent" ? "Discount %" : "Discount amount"} value={form.values.discountValue} onValueChange={(v) => form.setValue("discountValue", v)} min={0} max={form.values.discountType === "Percent" ? 100 : 1000000} suffix={form.values.discountType === "Percent" ? "%" : "₹"} />
          </div>
          <div className="space-y-3">
            <NumberInput label="Tax rate" value={form.values.taxRate} onValueChange={(v) => form.setValue("taxRate", v)} min={0} max={40} step={0.5} suffix="%" />
            <NumberInput label="Payment received now" value={form.values.amountPaid} onValueChange={(v) => form.setValue("amountPaid", Math.min(v, totals.total))} min={0} max={totals.total} step={100} suffix="₹" />
            <Select name="paymentMethod" label="Method" value={form.values.paymentMethod} onChange={(v) => form.setValue("paymentMethod", v)} options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} />
          </div>
          <dl className="space-y-1.5 self-start rounded-xl border border-brand-100 bg-brand-25 p-3.5 text-[12.5px]">
            <Line label="Subtotal" value={formatMoney(totals.subtotal)} />
            <Line label="Discount" value={`− ${formatMoney(totals.discount)}`} />
            <Line label={`Tax ${form.values.taxRate}%`} value={formatMoney(totals.tax)} />
            <div className="my-1.5 h-px bg-brand-200" />
            <Line label="Total payable" value={formatMoney(totals.total)} strong />
            <Line label="Balance" value={formatMoney(totals.remaining)} tone={totals.remaining > 0 ? "coral" : "mint"} strong />
          </dl>
        </div>
        <Textarea name="notes" label="Invoice notes" rows={2} className="mt-4" placeholder="Payment terms, corporate package rates, claim references…" value={form.values.notes} onChange={(e) => form.setValue("notes", e.target.value)} />
      </FormSection>
    </FormDialog>
  );
}

/* ------------------------------ payment dialog ------------------------------ */

function PaymentDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const totals = invoiceTotals(invoice);

  const form = useForm({
    initialValues: { amount: totals.remaining, method: "UPI" as Payment["method"], reference: "", note: "", date: todayISO() },
    schema: {
      amount: [{ required: "Amount is required", validate: (v: number) => (Number(v) > 0 && Number(v) <= totals.remaining ? true : `Enter between 1 and ${totals.remaining}`) }],
      date: [{ required: "Payment date is required" }],
    },
  });

  const save = form.handleSubmit(async (values) => {
    const payments = [...invoice.payments, { id: idGen("pay"), date: values.date, amount: Number(values.amount), method: values.method, reference: values.reference, note: values.note }];
    const nextTotal = invoiceTotals({ ...invoice, payments }).total;
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    await dispatch(
      invoicesApi.thunks.updateOne({
        id: invoice.id,
        data: { payments, paymentStatus: derivePaymentStatus(nextTotal, paid, invoice.paymentStatus) },
        successMessage: `${formatMoney(values.amount)} received on ${invoice.number}`,
      } as any),
    );
    onClose();
  });

  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && onClose()}
      size="sm"
      title={<span className="flex items-center gap-2"><CircleDollarSign className="size-4.5 text-mint-600" /> Record payment</span>}
      description={`${invoice.number} · balance ${formatMoney(totals.remaining)}`}
      onSubmit={save}
      loading={form.submitting}
      submitLabel="Save payment"
      footerNote={<span>Payments are added to the invoice ledger and update the status automatically.</span>}
    >
      <div className="space-y-4">
        <NumberInput label="Amount received" required value={form.values.amount} onValueChange={(v) => form.setValue("amount", v)} min={1} max={totals.remaining} step={100} suffix="₹" error={form.errors.amount} />
        <Select name="method" label="Payment method" value={form.values.method} onChange={(v) => form.setValue("method", v)} options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input name="reference" label="Reference / txn id" placeholder="UTR-4812…" value={form.values.reference} onChange={(e) => form.setValue("reference", e.target.value)} />
          <DatePicker label="Value date" required value={form.values.date} onChange={(v) => form.setValue("date", v)} error={form.errors.date} />
        </div>
        <Input name="note" label="Remark" placeholder="Final settlement, advance, part payment…" value={form.values.note} onChange={(e) => form.setValue("note", e.target.value)} />
      </div>
    </FormDialog>
  );
}

export default BillingPage;
