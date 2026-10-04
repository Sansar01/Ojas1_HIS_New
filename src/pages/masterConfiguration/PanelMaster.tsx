import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useAppDispatch } from "@/store/hooks";
import { toast } from "@/store/slices/uiSlice";
import { YES_NO } from "@/types/masterConfig.data";

// ─── API access ──────────────────────────────────────────────────
import { masterService } from "@/pages/masterConfiguration/master.service";
import type { CreatePanelPayload, CoPaymentOn } from "@/types";

// ─── Types ───────────────────────────────────────────────────────
interface DropdownOption {
  value: string; // UUID from backend
  label: string; // Display text
}

interface PanelForm {
  panelName: string;
  groupTypeId: string;
  contactPerson: string;
  address1: string;
  address2: string;
  contactNo: string;
  phoneNo: string;
  email: string;
  faxNo: string;
  validFrom: string;
  validTo: string;
  paymentModeId: string;
  opdTariffId: string;
  ipdTariffId: string;
  creditLimit: number;
  selfOpd: boolean;
  selfIpd: boolean;
  showPrintout: string; // "yes" | "no"
  hideRate: string;
  coPaymentOn: string; // "bill" | "service" | "none"
  coPaymentPct: number;
  rateCurrencyId: string;
  panelTypeId: string;
  billCurrencyId: string;
  currencyConv: number;
  coverNote: string;
  panelAmount: number;
  dietType: string; // "normal" | "private"
  isSmartCard: string;
  encounter: boolean;
  isUsdBased: boolean;
}

const EMPTY: PanelForm = {
  panelName: "",
  groupTypeId: "",
  contactPerson: "",
  address1: "",
  address2: "",
  contactNo: "",
  phoneNo: "",
  email: "",
  faxNo: "",
  validFrom: "",
  validTo: "",
  paymentModeId: "",
  opdTariffId: "",
  ipdTariffId: "",
  creditLimit: 0,
  selfOpd: false,
  selfIpd: false,
  showPrintout: "yes",
  hideRate: "no",
  coPaymentOn: "bill",
  coPaymentPct: 0,
  rateCurrencyId: "",
  panelTypeId: "",
  billCurrencyId: "",
  currencyConv: 1,
  coverNote: "no",
  panelAmount: 0,
  dietType: "normal",
  isSmartCard: "no",
  encounter: false,
  isUsdBased: false,
};

// Map UI radio values → backend CoPaymentOn enum
const mapCoPaymentOn = (v: string): CoPaymentOn => {
  if (v === "bill") return "ON_BILL";
  if (v === "service") return "ON_SERVICE";
  return "NONE";
};

export function PanelMaster({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const dispatch = useAppDispatch();
  // Reference lists are this dialog's own data: it loads them when it opens and
  // drops them when it closes — nothing is shared through the store (doc §21/§26).
  const [dropdowns, setDropdowns] = useState<Record<string, any[]>>({});
  const [form, setForm] = useState<PanelForm>(EMPTY);
  const [errors, setErrors] = useState<
    Partial<Record<keyof PanelForm, string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  // ─── Dropdown Options (shared cache → Select options) ──────────
  const groupTypes = useMemo<DropdownOption[]>(
    () =>
      (dropdowns.GROUP_TYPE ?? []).map((i: any) => ({
        value: i.id,
        label: i.value,
      })),
    [dropdowns],
  );
  const paymentModes = useMemo<DropdownOption[]>(
    () =>
      (dropdowns.PAYMENT_MODE ?? []).map((i: any) => ({
        value: i.id,
        label: i.value,
      })),
    [dropdowns],
  );
  const panelTypes = useMemo<DropdownOption[]>(
    () =>
      (dropdowns.PANEL_TYPE ?? []).map((i: any) => ({
        value: i.id,
        label: i.value,
      })),
    [dropdowns],
  );
  const currencies = useMemo<DropdownOption[]>(
    () =>
      (dropdowns.CURRENCY ?? []).map((i: any) => ({
        value: i.id,
        label: i.value,
      })),
    [dropdowns],
  );
  const tariffs = useMemo<DropdownOption[]>(
    () =>
      (dropdowns.TARIFFS ?? []).map((i: any) => ({
        value: i.id,
        label: `${i.tariffCode} — ${i.tariffName}`,
      })),
    [dropdowns],
  );

  // ─── Load all dropdowns when dialog opens ──────────────────────
  // One aggregated toast keeps the failure UX identical to before (doc §13/§16).
  const rows = (res: any): any[] => {
    const body = res?.data ?? res;
    if (Array.isArray(body)) return body;
    return Array.isArray(body?.data) ? body.data : [];
  };
  const loadDropdowns = useCallback(async () => {
    setLoadingDropdowns(true);
    try {
      const [gtRes, pmRes, ptRes, curRes, tfRes] = await Promise.all([
        masterService.fetchGlobalDropdown("GROUP_TYPE"),
        masterService.fetchGlobalDropdown("PAYMENT_MODE"),
        masterService.fetchGlobalDropdown("PANEL_TYPE"),
        masterService.fetchGlobalDropdown("CURRENCY"),
        masterService.fetchTariffDropdown(),
      ]);
      const gt = rows(gtRes);
      const pt = rows(ptRes);
      const cur = rows(curRes);
      setDropdowns({
        GROUP_TYPE: gt,
        PAYMENT_MODE: rows(pmRes),
        PANEL_TYPE: pt,
        CURRENCY: cur,
        TARIFFS: rows(tfRes),
      });

      // Auto-select first defaults if form is empty
      setForm((prev) => {
        if (prev.panelName) return prev; // don't overwrite if user already typed
        const inr = cur.find((c: any) => c.value === "INR");
        const credit = pt.find((p: any) =>
          String(p.value ?? "")
            .toUpperCase()
            .includes("CREDIT"),
        );
        return {
          ...prev,
          groupTypeId: prev.groupTypeId || gt[0]?.id || "",
          rateCurrencyId: prev.rateCurrencyId || inr?.id || cur[0]?.id || "",
          billCurrencyId: prev.billCurrencyId || inr?.id || cur[0]?.id || "",
          panelTypeId: prev.panelTypeId || credit?.id || pt[0]?.id || "",
        };
      });
    } catch (error: any) {
      dispatch(
        toast.error(
          "Failed to load dropdowns",
          typeof error === "string" ? error : error?.message,
        ),
      );
    } finally {
      setLoadingDropdowns(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setErrors({});
      loadDropdowns();
    }
  }, [open, loadDropdowns]);

  // ─── Form helpers ──────────────────────────────────────────────
  const set = <K extends keyof PanelForm>(key: K, value: PanelForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // ─── Validation + Save ─────────────────────────────────────────
  const handleSave = async () => {
    const next: typeof errors = {};
    if (!form.panelName.trim()) next.panelName = "Panel name is required";
    if (form.validFrom && form.validTo && form.validTo < form.validFrom) {
      next.validTo = "Valid To must be after Valid From";
    }
    if (form.coPaymentPct < 0 || form.coPaymentPct > 100) {
      next.coPaymentPct = "Must be between 0 and 100";
    }
    if (form.isUsdBased && (!form.currencyConv || form.currencyConv <= 0)) {
      next.currencyConv = "Conversion rate required for USD-based panels";
    }

    setErrors(next);
    if (Object.keys(next).length) {
      dispatch(toast.warning("Please fix the highlighted fields"));
      return;
    }

    // Build backend payload
    const payload: CreatePanelPayload = {
      panelName: form.panelName.trim(),
      groupTypeId: form.groupTypeId || undefined,
      paymentModeId: form.paymentModeId || undefined,
      panelTypeId: form.panelTypeId || undefined,
      rateCurrencyId: form.rateCurrencyId || undefined,
      billCurrencyId: form.billCurrencyId || undefined,
      contactPerson: form.contactPerson || undefined,
      address1: form.address1 || undefined,
      address2: form.address2 || undefined,
      contactNo: form.contactNo || undefined,
      phoneNo: form.phoneNo || undefined,
      email: form.email || undefined,
      faxNo: form.faxNo || undefined,
      validFrom: form.validFrom || undefined,
      validTo: form.validTo || undefined,
      creditLimit: form.creditLimit || 0,
      opdTariffId: form.opdTariffId || undefined,
      ipdTariffId: form.ipdTariffId || undefined,
      rateTypeSelfOpd: form.selfOpd,
      rateTypeSelfIpd: form.selfIpd,
      showPrintout: form.showPrintout === "yes",
      hideRate: form.hideRate === "yes",
      coverNote: form.coverNote === "yes",
      isSmartCard: form.isSmartCard === "yes",
      hasEncounter: form.encounter,
      isUsdBased: form.isUsdBased,
      dietTypePrivate: form.dietType === "private",
      coPaymentOn: mapCoPaymentOn(form.coPaymentOn),
      coPaymentPercent: form.coPaymentPct,
      currencyConv: form.currencyConv || 1,
      panelAmount: form.panelAmount || undefined,
    };

    setSaving(true);
    try {
      await masterService.createPanel(payload);
      dispatch(toast.success("Panel saved successfully", form.panelName));
      setForm(EMPTY);
      onOpenChange(false);
    } catch (error: any) {
      dispatch(toast.error("Could not save panel", error?.message));
    } finally {
      setSaving(false);
    }
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
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={loadingDropdowns}
          >
            Save Panel
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* ═══════════ PANEL DETAILS ═══════════ */}
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
              value={form.groupTypeId}
              onChange={(v) => set("groupTypeId", v)}
              options={groupTypes}
              loading={loadingDropdowns}
              loadingLabel="Loading group types…"
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

        {/* ═══════════ VALIDITY & RATES ═══════════ */}
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
              value={form.paymentModeId}
              onChange={(v) => set("paymentModeId", v)}
              options={paymentModes}
              clearable
              loading={loadingDropdowns}
              loadingLabel="Loading payment modes…"
            />

            {/* Refer Rate = Tariff Master dropdown */}
            <Select
              label="Refer Rate (OPD)"
              value={form.opdTariffId}
              onChange={(v) => set("opdTariffId", v)}
              options={tariffs}
              clearable
              loading={loadingDropdowns}
              loadingLabel="Loading tariffs…"
            />
            <Select
              label="Refer Rate (IPD)"
              value={form.ipdTariffId}
              onChange={(v) => set("ipdTariffId", v)}
              options={tariffs}
              clearable
              loading={loadingDropdowns}
              loadingLabel="Loading tariffs…"
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

        {/* ═══════════ BILLING & CURRENCY ═══════════ */}
        <SectionPanel title="Billing & Currency">
          <div className="grid gap-x-5 gap-y-4 md:grid-cols-3">
            <RadioGroup
              label="Co-Payment On"
              value={form.coPaymentOn}
              onChange={(v) => set("coPaymentOn", v)}
              options={[
                { value: "bill", label: "On Bill" },
                { value: "service", label: "On Service" },
                { value: "none", label: "None" },
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
              value={form.rateCurrencyId}
              onChange={(v) => set("rateCurrencyId", v)}
              options={currencies}
              loading={loadingDropdowns}
              loadingLabel="Loading currencies…"
            />

            <Select
              label="Panel Type"
              value={form.panelTypeId}
              onChange={(v) => set("panelTypeId", v)}
              options={panelTypes}
              loading={loadingDropdowns}
              loadingLabel="Loading panel types…"
            />
            <Select
              label="Bill Currency"
              value={form.billCurrencyId}
              onChange={(v) => set("billCurrencyId", v)}
              options={currencies}
              placeholder={loadingDropdowns ? "Loading..." : "Select currency"}
            />
            <NumberInput
              label="Currency Conversion"
              value={form.currencyConv}
              onValueChange={(v) => set("currencyConv", v)}
              step={0.01}
              error={errors.currencyConv}
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
