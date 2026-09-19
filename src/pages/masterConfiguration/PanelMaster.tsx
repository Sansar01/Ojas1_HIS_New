import { useState } from "react";
import { Dialog } from "@/components/ui/overlays";
import { Button } from "@/components/ui/primitives";
import { SectionPanel } from "@/components/common";
import {
  Input,
  NumberInput,
  Select,
  RadioGroup,
  Checkbox,
  DatePicker,
} from "@/components/ui/fields";
import { useAppDispatch } from "@/hooks";
import { toast } from "@/features/ui/uiSlice";
import { toOptions, YES_NO } from "@/types/masterConfig.data";

const GROUP_TYPES = toOptions(["INSURANCE", "CORPORATE", "GOVERNMENT", "TPA"]);
const PAYMENT_MODES = toOptions(["CASH", "CARD", "UPI", "CHEQUE", "NEFT"]);
const CURRENCIES = toOptions(["INR", "USD", "EUR", "GBP", "AED"]);
const RATE_SOURCES = toOptions(["CASH", "STANDARD", "DISCOUNTED", "PREMIUM"]);

interface PanelForm {
  panelName: string;
  groupType: string;
  contactPerson: string;
  address1: string;
  address2: string;
  contactNo: string;
  phoneNo: string;
  email: string;
  faxNo: string;
  validFrom: string;
  validTo: string;
  paymentMode: string;
  referRateOpd: string;
  referRateIpd: string;
  creditLimit: number;
  selfOpd: boolean;
  selfIpd: boolean;
  showPrintout: string;
  hideRate: string;
  coPaymentOn: string;
  coPaymentPct: number;
  rateCurrency: string;
  panelType: string;
  billCurrency: string;
  currencyConv: number;
  coverNote: string;
  panelAmount: number;
  dietType: string;
  isSmartCard: string;
  encounter: boolean;
  isUsdBased: boolean;
}

const EMPTY: PanelForm = {
  panelName: "",
  groupType: "INSURANCE",
  contactPerson: "",
  address1: "",
  address2: "",
  contactNo: "",
  phoneNo: "",
  email: "",
  faxNo: "",
  validFrom: "",
  validTo: "",
  paymentMode: "",
  referRateOpd: "CASH",
  referRateIpd: "CASH",
  creditLimit: 0,
  selfOpd: false,
  selfIpd: false,
  showPrintout: "yes",
  hideRate: "no",
  coPaymentOn: "bill",
  coPaymentPct: 0,
  rateCurrency: "INR",
  panelType: "credit",
  billCurrency: "INR",
  currencyConv: 1,
  coverNote: "no",
  panelAmount: 0,
  dietType: "normal",
  isSmartCard: "no",
  encounter: false,
  isUsdBased: false,
};

export function PanelMaster({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const dispatch = useAppDispatch();
  const [form, setForm] = useState<PanelForm>(EMPTY);
  const [errors, setErrors] = useState<
    Partial<Record<keyof PanelForm, string>>
  >({});

  const set = <K extends keyof PanelForm>(key: K, value: PanelForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleSave = () => {
    const next: typeof errors = {};
    if (!form.panelName.trim()) next.panelName = "Panel name is required";
    if (form.validFrom && form.validTo && form.validTo < form.validFrom)
      next.validTo = "Valid To must be after Valid From";
    if (form.coPaymentPct < 0 || form.coPaymentPct > 100)
      next.coPaymentPct = "Must be between 0 and 100";

    setErrors(next);
    if (Object.keys(next).length) {
      dispatch(toast.warning("Please fix the highlighted fields"));
      return;
    }
    dispatch(toast.success("Panel saved successfully", form.panelName));
    setForm(EMPTY);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title="Panel Master"
      description="Register a new insurance / corporate panel"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Panel</Button>
        </>
      }
    >
      <div className="space-y-5">
        <SectionPanel title="Panel Details">
          <div className="grid gap-x-5 gap-y-4 md:grid-cols-3">
            <Input
              name="panelName"
              label="Panel Name"
              required
              value={form.panelName}
              error={errors.panelName}
              onChange={(e) => set("panelName", e.target.value)}
            />
            <Select
              label="Group Type"
              value={form.groupType}
              onChange={(v) => set("groupType", v)}
              options={GROUP_TYPES}
            />
            <Input
              name="contactPerson"
              label="Contact Person"
              value={form.contactPerson}
              onChange={(e) => set("contactPerson", e.target.value)}
            />

            <Input
              name="address1"
              label="Address 1"
              value={form.address1}
              onChange={(e) => set("address1", e.target.value)}
            />
            <Input
              name="address2"
              label="Address 2"
              value={form.address2}
              onChange={(e) => set("address2", e.target.value)}
            />
            <Input
              name="contactNo"
              label="Contact No."
              value={form.contactNo}
              onChange={(e) => set("contactNo", e.target.value)}
            />

            <Input
              name="phoneNo"
              label="Phone No."
              value={form.phoneNo}
              onChange={(e) => set("phoneNo", e.target.value)}
            />
            <Input
              name="email"
              label="Email ID"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
            <Input
              name="faxNo"
              label="Fax No."
              value={form.faxNo}
              onChange={(e) => set("faxNo", e.target.value)}
            />
          </div>
        </SectionPanel>

        <SectionPanel title="Validity & Rates">
          <div className="grid gap-x-5 gap-y-4 md:grid-cols-3">
            <DatePicker
              label="Valid From"
              value={form.validFrom}
              onChange={(v) => set("validFrom", v)}
            />
            <DatePicker
              label="Valid To"
              value={form.validTo}
              onChange={(v) => set("validTo", v)}
              error={errors.validTo}
            />
            <Select
              label="Payment Mode"
              value={form.paymentMode}
              onChange={(v) => set("paymentMode", v)}
              options={PAYMENT_MODES}
              clearable
            />

            <Select
              label="Refer Rate (OPD)"
              value={form.referRateOpd}
              onChange={(v) => set("referRateOpd", v)}
              options={RATE_SOURCES}
            />
            <Select
              label="Refer Rate (IPD)"
              value={form.referRateIpd}
              onChange={(v) => set("referRateIpd", v)}
              options={RATE_SOURCES}
            />
            <NumberInput
              label="Credit Limit"
              value={form.creditLimit}
              onValueChange={(v) => set("creditLimit", v)}
              max={100000000}
            />

            <div className="flex flex-col gap-2 pt-6">
              <Checkbox
                checked={form.selfOpd}
                onCheckedChange={(v) => set("selfOpd", v)}
                label="SELF (OPD)"
              />
              <Checkbox
                checked={form.selfIpd}
                onCheckedChange={(v) => set("selfIpd", v)}
                label="SELF (IPD)"
              />
            </div>
            <RadioGroup
              label="Show Printout"
              value={form.showPrintout}
              onChange={(v) => set("showPrintout", v)}
              options={YES_NO}
            />
            <RadioGroup
              label="Hide Rate"
              value={form.hideRate}
              onChange={(v) => set("hideRate", v)}
              options={YES_NO}
            />
          </div>
        </SectionPanel>

        <SectionPanel title="Billing & Currency">
          <div className="grid gap-x-5 gap-y-4 md:grid-cols-3">
            <RadioGroup
              label="Co-Payment On"
              value={form.coPaymentOn}
              onChange={(v) => set("coPaymentOn", v)}
              options={[
                { value: "bill", label: "On Bill" },
                { value: "service", label: "On Service" },
              ]}
            />
            <NumberInput
              label="Co-Payment (%)"
              value={form.coPaymentPct}
              onValueChange={(v) => set("coPaymentPct", v)}
              max={100}
              suffix="%"
              error={errors.coPaymentPct}
              hint="Payable by the patient"
            />
            <Select
              label="Rate Currency"
              value={form.rateCurrency}
              onChange={(v) => set("rateCurrency", v)}
              options={CURRENCIES}
            />

            <RadioGroup
              label="Panel Type"
              value={form.panelType}
              onChange={(v) => set("panelType", v)}
              options={[
                { value: "credit", label: "Credit" },
                { value: "cash", label: "Cash" },
              ]}
            />
            <Select
              label="Bill Currency"
              value={form.billCurrency}
              onChange={(v) => set("billCurrency", v)}
              options={CURRENCIES}
            />
            <NumberInput
              label="Currency Conversion"
              value={form.currencyConv}
              onValueChange={(v) => set("currencyConv", v)}
              step={0.01}
              hint="Cost in INR for 1 US Dollar"
            />

            <RadioGroup
              label="Cover Note"
              value={form.coverNote}
              onChange={(v) => set("coverNote", v)}
              options={YES_NO}
            />
            <NumberInput
              label="Panel Amount"
              value={form.panelAmount}
              onValueChange={(v) => set("panelAmount", v)}
              max={100000000}
            />
            <RadioGroup
              label="Diet Type"
              value={form.dietType}
              onChange={(v) => set("dietType", v)}
              options={[
                { value: "normal", label: "Normal" },
                { value: "private", label: "Private" },
              ]}
            />

            <RadioGroup
              label="Is Smart Card"
              value={form.isSmartCard}
              onChange={(v) => set("isSmartCard", v)}
              options={YES_NO}
            />
            <div className="flex flex-col gap-2 pt-6">
              <Checkbox
                checked={form.encounter}
                onCheckedChange={(v) => set("encounter", v)}
                label="Encounter"
              />
              <Checkbox
                checked={form.isUsdBased}
                onCheckedChange={(v) => set("isUsdBased", v)}
                label="Is USD Based"
              />
            </div>
          </div>
        </SectionPanel>
      </div>
    </Dialog>
  );
}
