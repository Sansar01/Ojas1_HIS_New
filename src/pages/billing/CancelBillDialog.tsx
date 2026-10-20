import { Ban } from "lucide-react";
import { useForm } from "@/hooks/useForm";
import { formatDate, formatMoney } from "@/utils";
import { billingService } from "@/pages/billing/billing.service";
import { BillStatusBadge } from "@/pages/billing/BillStatusBadge";
import { useAppDispatch } from "@/store/hooks";
import { toast } from "@/store/slices/uiSlice";
import { Dialog } from "@/components/ui/overlays";

/**
 * PATCH /api/opd/billing/:billId/cancel — reason required (≤500).
 * The row action only offers this when billStatus is GENERATED and the bill
 * has no payments (server rules OPD_BIL_007 / OPD_BIL_008 still win).
 */
export function CancelBillDialog({
  bill,
  onClose,
  onSuccess,
}: {
  bill: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const dispatch = useAppDispatch();

  const form = useForm({
    initialValues: { cancelReason: "" },
    schema: {
      cancelReason: [
        {
          required: "A cancellation reason is required",
          validate: (v: string) =>
            String(v ?? "").trim().length <= 500 || "Max 500 characters",
        },
      ],
    },
  });

  const save = form.handleSubmit(async (values) => {
    try {
      await billingService.cancelInvoice(
        bill.id,
        String(values.cancelReason).trim(),
      );
      dispatch(
        toast.success("Bill cancelled", `${bill.billNo} has been cancelled.`),
      );
      onSuccess();
    } catch (e: any) {
      dispatch(
        toast.error(
          "Could not cancel bill",
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
          <Ban className="size-4.5 text-coral-600" /> Cancel bill
        </span>
      }
      description={
        <span className="flex flex-wrap items-center gap-2">
          {bill.billNo} · {formatDate(bill.billedAt)} ·{" "}
          {formatMoney(bill.netAmount ?? bill.totalAmount ?? 0)}
          <BillStatusBadge status={bill.billStatus} />
        </span>
      }
      onSubmit={save}
      loading={form.submitting}
      submitLabel="Cancel bill"
    >
      <div className="space-y-3">
        <p className="rounded-xl border border-amberly-100 bg-amberly-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amberly-700">
          The bill will be marked <strong>CANCELLED</strong>. Payments already
          collected must be refunded instead of cancelled.
        </p>
        <label className="block">
          <span className="text-[12px] font-semibold text-ink-700">
            Reason <span className="text-coral-600">*</span>
          </span>
          <textarea
            value={form.values.cancelReason}
            onChange={(e) => form.setValue("cancelReason", e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Why is this bill being cancelled?"
            className="mt-1 w-full rounded-xl border border-ink-150 bg-white px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
          />
          {form.errorFor("cancelReason") && (
            <span className="mt-1 block text-[11.5px] text-coral-600">
              {form.errorFor("cancelReason")}
            </span>
          )}
        </label>
      </div>
    </Dialog>
  );
}
