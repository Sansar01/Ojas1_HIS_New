import { formatDate, formatMoney } from "@/utils";
import { cn } from "@/utils/cn";
import { BillStatusBadge } from "@/pages/billing/BillStatusBadge";
import type { BillReceiptData } from "@/types/billingTypes";

/**
 * Printable OPD counter receipt — rendered by `GET /api/opd/billing/:id/receipt`.
 *
 * Print path: the sheet lives inside a `<Dialog>` (portalled to `<body>`, so
 * `body > #root { display:none }` hides the app while printing). The global
 * print rules neutralise the dialog chrome, and `.opd-receipt` (index.css)
 * sizes the document to A4 and keeps colours/backgrounds on paper.
 */

const ageOf = (dob?: string | null) => {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  const years = Math.abs(new Date(diff).getUTCFullYear() - 1970);
  return Number.isFinite(years) ? years : null;
};

function TotalLine({
  label,
  value,
  strong,
  negative,
}: {
  label: string;
  value: string;
  strong?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-[3px]">
      <dt className={cn("text-ink-500", strong && "font-semibold text-ink-700")}>
        {label}
      </dt>
      <dd
        className={cn(
          "num font-semibold",
          strong ? "text-[14.5px] text-ink-900" : "text-ink-800",
          negative && "text-mint-600",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function OpdReceiptSheet({ receipt }: { receipt: BillReceiptData }) {
  const { hospital, bill, patient, panel, doctor, items, totals, payments, creditNotes } =
    receipt;
  const age = ageOf(patient?.dateOfBirth);

  return (
    <div className="opd-receipt print-receipt rounded-xl border border-ink-100 bg-white p-5 text-ink-900">
      {/* ── Hospital header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink-200 pb-4">
        <div className="flex items-start gap-3">
          {hospital?.logoUrl ? (
            <img
              src={hospital.logoUrl}
              alt=""
              className="size-12 shrink-0 rounded object-contain"
            />
          ) : (
            <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50 font-display text-lg font-bold text-brand-600">
              {String(hospital?.name ?? "H")
                .trim()
                .charAt(0)
                .toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-display text-[17px] font-bold leading-tight">
              {hospital?.name ?? "Hospital"}
            </p>
            <p className="mt-1 max-w-[24rem] text-[11.5px] leading-relaxed text-ink-500">
              {hospital?.address}
              {hospital?.city ? `, ${hospital.city}` : ""}
              {hospital?.state ? `, ${hospital.state}` : ""}
              {hospital?.pincode ? ` - ${hospital.pincode}` : ""}
            </p>
            {hospital?.phone && (
              <p className="num text-[11.5px] text-ink-500">
                Phone: {hospital.phone}
                {hospital.email ? ` · ${hospital.email}` : ""}
              </p>
            )}
          </div>
        </div>

        {/* Bill reference block */}
        <div className="text-right">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-400">
            OPD Receipt
          </p>
          <p className="num text-[17px] font-bold">{bill.billNo}</p>
          <p className="num mt-0.5 text-[11.5px] text-ink-500">
            Visit No: {bill.visitNo || "—"}
          </p>
          <p className="num text-[11.5px] text-ink-500">
            Date: {formatDate(bill.billedAt)}
          </p>
          <div className="mt-1.5 flex justify-end gap-1.5">
            <BillStatusBadge status={bill.billStatus} />
            <BillStatusBadge status={bill.paymentStatus} />
          </div>
        </div>
      </div>

      {/* ── Patient / doctor block ──────────────────────────────────────── */}
      <div className="grid gap-4 border-b border-ink-100 py-4 sm:grid-cols-3">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-400">
            Patient
          </p>
          <p className="mt-1 text-[13.5px] font-semibold">{patient?.name}</p>
          <p className="num text-[11.5px] text-ink-500">
            {patient?.uhid}
            {patient?.mobile ? ` · ${patient.mobile}` : ""}
          </p>
          <p className="text-[11.5px] text-ink-500">
            {patient?.gender ? String(patient.gender).toLowerCase() : "—"}
            {age != null ? ` · ${age} yrs` : ""}
          </p>
        </div>
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-400">
            Doctor
          </p>
          <p className="mt-1 text-[13.5px] font-semibold">
            {doctor ? `Dr. ${doctor.name}` : "—"}
          </p>
          <p className="text-[11.5px] text-ink-500">
            {doctor?.specialization || "—"}
          </p>
        </div>
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-400">
            Panel / Insurance
          </p>
          <p className="mt-1 text-[13.5px] font-semibold">
            {panel?.name ?? "GENERAL / Cash"}
          </p>
          <p className="text-[11.5px] text-ink-500">
            Payment mode: {bill.paymentMode || "—"}
          </p>
        </div>
      </div>

      {/* ── Items ───────────────────────────────────────────────────────── */}
      <table className="mt-4 w-full text-left text-[12.5px]">
        <thead>
          <tr className="border-y border-ink-200 bg-ink-25/70 text-[10.5px] uppercase tracking-[0.1em] text-ink-500">
            <th className="px-2 py-2 font-semibold">Code</th>
            <th className="px-2 py-2 font-semibold">Service / item</th>
            <th className="px-2 py-2 font-semibold">Category</th>
            <th className="px-2 py-2 text-center font-semibold">Qty</th>
            <th className="px-2 py-2 text-right font-semibold">Rate</th>
            <th className="px-2 py-2 text-right font-semibold">Disc</th>
            <th className="px-2 py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {(items ?? []).map((it) => (
            <tr key={it.id}>
              <td className="num px-2 py-2 text-ink-500">{it.serviceCode || "—"}</td>
              <td className="px-2 py-2 font-medium text-ink-800">{it.itemName}</td>
              <td className="px-2 py-2 text-ink-500">{it.category}</td>
              <td className="num px-2 py-2 text-center">{it.quantity}</td>
              <td className="num px-2 py-2 text-right">{formatMoney(it.unitPrice)}</td>
              <td className="num px-2 py-2 text-right text-coral-600">
                {it.discountAmount > 0 ? `− ${formatMoney(it.discountAmount)}` : "—"}
              </td>
              <td className="num px-2 py-2 text-right font-semibold">
                {formatMoney(it.totalAmount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Totals + payment receipts ───────────────────────────────────── */}
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_17rem]">
        <div className="space-y-3">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-400">
              Payment receipts
            </p>
            {(payments ?? []).length === 0 && (
              <p className="mt-1 text-[11.5px] text-ink-400">No payments recorded.</p>
            )}
            <ul className="mt-1 space-y-1 text-[11.5px] text-ink-500">
              {(payments ?? []).map((p) => (
                <li key={p.id} className="num">
                  <span className="font-semibold text-ink-700">
                    {formatMoney(p.amount)}
                  </span>{" "}
                  · {p.receiptNo} · {p.paymentMode}
                  {p.transactionId ? ` · Ref ${p.transactionId}` : ""} ·{" "}
                  {formatDate(p.paidAt)}
                </li>
              ))}
            </ul>
          </div>

          {(creditNotes ?? []).length > 0 && (
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                Refunds issued
              </p>
              <ul className="mt-1 space-y-1 text-[11.5px] text-ink-500">
                {creditNotes.map((note) => (
                  <li key={note.id} className="num">
                    <span className="font-semibold text-ink-700">
                      {formatMoney(note.refundAmount)}
                    </span>{" "}
                    · {note.creditNoteNo} · {note.refundMode} ·{" "}
                    {formatDate(note.issuedAt)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {bill.remarks && (
            <p className="text-[11.5px] text-ink-500">
              <span className="font-semibold text-ink-700">Remarks: </span>
              {bill.remarks}
            </p>
          )}
        </div>

        <dl className="space-y-1 rounded-xl border border-ink-100 bg-ink-25/60 p-3.5 text-[12.5px]">
          <TotalLine label="Gross amount" value={formatMoney(totals.grossAmount)} />
          <TotalLine
            label="Discount"
            value={`− ${formatMoney(totals.discountAmount)}`}
            negative
          />
          <TotalLine label="Tax" value={formatMoney(totals.taxAmount)} />
          <div className="my-1.5 h-px bg-ink-200" />
          <TotalLine label="Net amount" value={formatMoney(totals.netAmount)} strong />
          <TotalLine
            label="Patient payable"
            value={formatMoney(totals.patientPayable ?? totals.netAmount)}
          />
          <TotalLine
            label="Panel payable"
            value={formatMoney(totals.panelPayable ?? 0)}
          />
          <div className="my-1.5 h-px bg-ink-200" />
          <TotalLine label="Paid" value={formatMoney(totals.paidAmount)} />
          <TotalLine label="Change" value={formatMoney(totals.changeAmount)} />
          <TotalLine
            label="Balance due"
            value={formatMoney(totals.dueAmount)}
            strong
          />
        </dl>
      </div>

      {/* ── Footer note ─────────────────────────────────────────────────── */}
      <p className="mt-5 border-t border-ink-100 pt-3 text-center text-[11px] leading-relaxed text-ink-400">
        Thank you. This is a computer-generated receipt issued by{" "}
        {hospital?.name ?? "the hospital"}
        {hospital?.phone ? ` (Phone: ${hospital.phone})` : ""}. Please retain it for
        your records.
      </p>
    </div>
  );
}
