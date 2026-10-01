import { CircleDollarSign } from "lucide-react";
import { useForm } from "@/hooks/useForm";
import { formatMoney } from "@/utils";
import { Input, NumberInput, Select } from "@/components/ui/fields";
import { FormDialog } from "@/components/common";
import { billingService } from "@/features/billing/billingService";

export function PaymentDialog({
  bill,
  onClose,
  onSuccess,
}: {
  bill: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
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
          validate: (v: number) =>
            Number(v) > 0 && Number(v) <= bill.dueAmount
              ? true
              : `Max ${bill.dueAmount}`,
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
          options={["CASH", "CARD", "UPI", "INSURANCE", "ONLINE"].map((m) => ({
            value: m,
            label: m,
          }))}
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