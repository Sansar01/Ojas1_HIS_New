import { cn } from "@/utils/cn";
import { formatDate, formatMoney } from "@/utils";
import { StatusBadge } from "@/components/ui/primitives";

export function InvoiceSheet({ invoice }: { invoice: any }) {
  const patient = invoice.patient;
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-100 pb-4">
        <div>
          <p className="font-display text-[17px] font-bold text-ink-900">
            Hospital Multi-Specialty
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-400">
            Main OPD Block
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-400">
            Tax Invoice
          </p>
          <p className="num text-[16px] font-bold text-ink-900">{invoice.billNo}</p>
          <p className="text-[11.5px] text-ink-400">
            Issued {formatDate(invoice.billedAt)}
          </p>
          <div className="mt-1.5 flex justify-end">
            <StatusBadge status={invoice.paymentStatus} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 py-4 sm:grid-cols-2">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-400">
            Billed to
          </p>
          <p className="mt-1 text-[13.5px] font-semibold text-ink-900">
            {patient ? `${patient.firstName} ${patient.lastName || ""}` : "Walk-in"}
          </p>
          <p className="text-[11.5px] text-ink-400">
            {patient?.uhid} · {patient?.mobile}
          </p>
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
              <td className="px-2 py-2 font-medium text-ink-800">
                {it.itemName || it.description}
              </td>
              <td className="px-2 py-2 text-ink-500">{it.category}</td>
              <td className="num px-2 py-2 text-center">{it.quantity}</td>
              <td className="num px-2 py-2 text-right">{formatMoney(it.unitPrice)}</td>
              <td className="num px-2 py-2 text-right font-semibold">
                {formatMoney(it.totalAmount || it.quantity * it.unitPrice)}
              </td>
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
          <Line
            label="Discount"
            value={`− ${formatMoney(invoice.discountAmount)}`}
            tone="mint"
          />
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

const Line = ({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "mint" | "coral";
}) => (
  <div className="flex items-center justify-between gap-3">
    <dt className={cn("text-ink-500", strong && "font-semibold text-ink-700")}>
      {label}
    </dt>
    <dd
      className={cn(
        "num font-semibold",
        tone === "coral"
          ? "text-coral-600"
          : tone === "mint"
          ? "text-mint-600"
          : "text-ink-900",
        strong && "text-[14px]"
      )}
    >
      {value}
    </dd>
  </div>
);