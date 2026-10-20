import { Banknote } from "lucide-react";
import { useForm } from "@/hooks/useForm";
import { formatDate, formatMoney } from "@/utils";
import { NumberInput, Select } from "@/components/ui/fields";
import { billingService } from "@/pages/billing/billing.service";
import { BillStatusBadge } from "@/pages/billing/BillStatusBadge";
import { useAppDispatch } from "@/store/hooks";
import { toast } from "@/store/slices/uiSlice";
import { Dialog } from "@/components/ui/overlays";
import type { BillResponse } from "@/types/billingTypes";

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Remaining refundable amount = paid − already refunded (server rule). */
export function refundableOf(bill: BillResponse | any): number {
  const paid = Number(bill?.paidAmount ?? 0);
  const refunded = (bill?.creditNotes ?? []).reduce(
    (sum: number, cn: any) => sum + Number(cn?.refundAmount ?? 0),
    0,
  );
  return round2(Math.max(0, paid - refunded));
}

/**
 * POST /api/opd/billing/:billId/refund — confirm first, reason required.
 * Defaults to the full remaining refundable amount of the bill.
 */
export function RefundDialog({
  bill,
  onClose,
  onSuccess,
}: {
  bill: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const dispatch = useAppDispatch();
  const refundable = refundableOf(bill);

  const form = useForm({
    initialValues: {
      amount: refundable,
      reason: "",
      refundMode: "",
    },
    schema: {
      amount: [
        {
          validate: (v: number) =>
            v == null || (Number(v) > 0 && Number(v) <= refundable)
              ? true
              : `Enter an amount up to ${formatMoney(refundable)}`,
        },
      ],
      reason: [
        {
          required: "A reason is required for audit",
          validate: (v: string) =>
            String(v ?? "").trim().length <= 500 || "Max 500 characters",
        },
      ],
    },
  });

  const save = form.handleSubmit(async (values) => {
    try {
      const res: any = await billingService.refundBill(bill.id, {
        // 0/NaN → omit: the backend then refunds the full refundable balance
        amount: Number(values.amount) || undefined,
        reason: String(values.reason).trim(),
        refundMode: values.refundMode || undefined,
      });
      const body = res?.data ?? {};
      const creditNoteNo =
        body?.creditNote?.creditNoteNo ?? body?.creditNoteNo ?? "Credit note";
      dispatch(
        toast.success(
          `Refund processed · ${creditNoteNo}`,
          `${formatMoney(Number(values.amount) || refundable)} refunded on ${bill.billNo}.`,
        ),
      );
      onSuccess();
    } catch (e: any) {
      dispatch(
        toast.error(
          "Could not process refund",
          e?.data?.message || e?.message || "Please try again.",
        ),
      );
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          <Banknote className="size-4.5 text-coral-600" /> Refund / Credit note
        </span>
      }
      description={
        <span className="flex flex-wrap items-center gap-2">
          {bill.billNo} · {formatDate(bill.billedAt)}
          <BillStatusBadge status={bill.paymentStatus} />
        </span>
      }
      onSubmit={save}
      loading={form.submitting}
      submitLabel={`Confirm refund${refundable > 0 ? ` (max ${formatMoney(refundable)})` : ""}`}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-ink-100 bg-ink-25/60 px-3.5 py-2.5 text-[12.5px] text-ink-600">
          Paid <span className="num font-semibold text-ink-900">{formatMoney(bill.paidAmount ?? 0)}</span>
          {" · "}Already refunded{" "}
          <span className="num font-semibold text-ink-900">
            {formatMoney(round2((bill.paidAmount ?? 0) - refundable))}
          </span>
          {" · "}Refundable{" "}
          <span className="num font-semibold text-coral-600">
            {formatMoney(refundable)}
          </span>
        </div>
        <NumberInput
          label="Refund amount"
          required
          value={form.values.amount}
          onValueChange={(v) => form.setValue("amount", v)}
          min={0.01}
          max={refundable}
          suffix="₹"
          error={form.errorFor("amount")}
          hint="Defaults to the full remaining refundable amount"
        />
        <Select
          name="refundMode"
          label="Refund mode"
          value={form.values.refundMode}
          onChange={(v) => form.setValue("refundMode", v)}
          options={[
            { value: "", label: "Same as original payment" },
            ...["CASH", "CARD", "UPI", "CREDIT", "INSURANCE", "ONLINE", "MIXED"].map(
              (m) => ({ value: m, label: m }),
            ),
          ]}
        />
        <label className="block">
          <span className="text-[12px] font-semibold text-ink-700">
            Reason <span className="text-coral-600">*</span>
          </span>
          <textarea
            value={form.values.reason}
            onChange={(e) => form.setValue("reason", e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Why is this refund being issued?"
            className="mt-1 w-full rounded-xl border border-ink-150 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
          />
          {form.errorFor("reason") && (
            <span className="mt-1 block text-[11.5px] text-coral-600">
              {form.errorFor("reason")}
            </span>
          )}
        </label>
      </div>
    </Dialog>
  );
}
