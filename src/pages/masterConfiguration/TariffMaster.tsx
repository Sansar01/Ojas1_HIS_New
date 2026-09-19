import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Settings2, Trash2, ArrowLeft, Save } from "lucide-react";
import { Dialog } from "@/components/ui/overlays";
import { Button, StatusBadge } from "@/components/ui/primitives";
import { Input, SearchInput, fieldClasses } from "@/components/ui/fields";
import { DataTable, RowActions, type Column } from "@/components/ui/table";
import { useAppDispatch } from "@/hooks";
import { toast } from "@/features/ui/uiSlice";
import { cn } from "@/utils/cn";

// Import backend services
import { tariffService, type TariffMasterItem } from "@/features/masters/tariffService";
import { serviceMasterService, type ServiceMasterItem } from "@/features/masters/serviceMasterService";

// ─── Types ────────────────────────────────────────────────────────
type ViewState = "LIST" | "MANAGE_RATES";

type RateMap = Record<
  string, // serviceId
  { rate: number | ""; discountPercent: number | "" }
>;

// ─── Auto-Suggest Helper ──────────────────────────────────────────
const suggestTariffCode = (name: string) => {
  if (!name.trim()) return "";
  // Example: "Star Health 2025" -> "TRF-STAR-HEALT"
  const cleanName = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-") // Replace spaces/special chars with hyphens
    .replace(/^-+|-+$/g, "")     // Trim hyphens from start/end
    .slice(0, 10);               // Keep it short
  return `TRF-${cleanName}`;
};

export function TariffMaster({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const dispatch = useAppDispatch();

  // Navigation State
  const [view, setView] = useState<ViewState>("LIST");
  const [activeTariff, setActiveTariff] = useState<TariffMasterItem | null>(null);

  // Data States
  const [tariffs, setTariffs] = useState<TariffMasterItem[]>([]);
  const [baseServices, setBaseServices] = useState<ServiceMasterItem[]>([]);
  const [ratesMap, setRatesMap] = useState<RateMap>({});

  // UI States
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Inline Form State (For adding new Tariff)
  const [newTariffName, setNewTariffName] = useState("");
  const [newTariffCode, setNewTariffCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false); // 👈 Tracks if user manually edited code

  // ─── Data Fetching ────────────────────────────────────────────────
  const loadTariffs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tariffService.list();
      setTariffs(data);
    } catch (error: any) {
      dispatch(toast.error("Failed to load tariffs", error.message));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  const loadServicesAndRates = useCallback(async (tariffId: string) => {
    setLoading(true);
    try {
      const services = await serviceMasterService.list();
      setBaseServices(services);

      const tariffDetail = await tariffService.getById(tariffId);
      
      const initialRates: RateMap = {};
      tariffDetail.rates?.forEach((r: any) => {
        initialRates[r.serviceId] = {
          rate: Number(r.rate),
          discountPercent: Number(r.discountPercent),
        };
      });
      setRatesMap(initialRates);
    } catch (error: any) {
      dispatch(toast.error("Failed to load rates data", error.message));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  // Initial Load
  useEffect(() => {
    if (open && view === "LIST") {
      loadTariffs();
      // Reset form when dialog opens
      setNewTariffName("");
      setNewTariffCode("");
      setCodeTouched(false);
    }
  }, [open, view, loadTariffs]);

  // ─── Handlers (List View) ─────────────────────────────────────────
  const handleAddTariff = async () => {
    if (!newTariffCode.trim() || !newTariffName.trim()) {
      dispatch(toast.warning("Tariff Code and Name are required"));
      return;
    }

    setSaving(true);
    try {
      await tariffService.create({
        tariffCode: newTariffCode.toUpperCase(),
        tariffName: newTariffName,
      });
      dispatch(toast.success("Tariff created successfully"));
      
      // Reset Inputs
      setNewTariffName("");
      setNewTariffCode("");
      setCodeTouched(false);
      
      loadTariffs();
    } catch (error: any) {
      dispatch(toast.error("Failed to create tariff", error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTariff = async (id: string) => {
    if (!confirm("Are you sure you want to delete this Tariff?")) return;
    try {
      await tariffService.remove(id);
      dispatch(toast.success("Tariff deleted"));
      loadTariffs();
    } catch (error: any) {
      dispatch(toast.error("Delete failed", error.message));
    }
  };

  const openRateManager = (tariff: TariffMasterItem) => {
    setActiveTariff(tariff);
    setView("MANAGE_RATES");
    setSearch("");
    loadServicesAndRates(tariff.id);
  };

  // ─── Handlers (Rate Manager View) ─────────────────────────────────
  const handleRateChange = (serviceId: string, field: "rate" | "discountPercent", value: number | "") => {
    setRatesMap((prev) => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        [field]: value,
      },
    }));
  };

  const handleSaveRates = async () => {
    if (!activeTariff) return;
    setSaving(true);

    try {
      const payload = Object.entries(ratesMap)
        .filter(([_, data]) => data.rate !== "" && data.rate !== undefined)
        .map(([serviceId, data]) => ({
          serviceId,
          rate: Number(data.rate),
          discountPercent: Number(data.discountPercent || 0),
        }));

      await tariffService.bulkSetRates(activeTariff.id, payload);
      dispatch(toast.success("Rates saved successfully", activeTariff.tariffName));
      
      setView("LIST");
      setActiveTariff(null);
    } catch (error: any) {
      dispatch(toast.error("Failed to save rates", error.message));
    } finally {
      setSaving(false);
    }
  };

  // ─── Columns (Tariff List) ────────────────────────────────────────
  const filteredTariffs = useMemo(() => {
    const q = search.toLowerCase();
    return tariffs.filter(
      (t) => t.tariffName.toLowerCase().includes(q) || t.tariffCode.toLowerCase().includes(q)
    );
  }, [tariffs, search]);

  const listColumns: Column<TariffMasterItem>[] = [
    {
      key: "tariffCode",
      header: "CODE",
      width: "w-32",
      render: (r) => <span className="font-mono text-[13px] text-ink-500">{r.tariffCode}</span>,
    },
    {
      key: "tariffName",
      header: "TARIFF NAME",
      render: (r) => <span className="font-medium text-ink-900">{r.tariffName}</span>,
    },
    {
      key: "status",
      header: "STATUS",
      width: "w-32",
      render: (r) => <StatusBadge status={r.isActive ? "Active" : "Inactive"} />,
    },
  ];

  // ─── Columns (Rate Manager) ───────────────────────────────────────
  const filteredServices = useMemo(() => {
    const q = search.toLowerCase();
    return baseServices.filter(
      (s) => s.serviceName.toLowerCase().includes(q) || s.serviceCode.toLowerCase().includes(q)
    );
  }, [baseServices, search]);

  const rateColumns: Column<ServiceMasterItem>[] = [
    {
      key: "service",
      header: "SERVICE DETAILS",
      render: (r) => (
        <div>
          <p className="font-medium text-ink-900">{r.serviceName}</p>
          <p className="text-[12px] text-ink-500">{r.serviceCode} • {r.category}</p>
        </div>
      ),
    },
    {
      key: "baseRate",
      header: "BASE RATE (CASH)",
      width: "w-40",
      render: (r) => <span className="text-ink-500 font-medium">₹ {Number(r.baseRate).toFixed(2)}</span>,
    },
    {
      key: "customRate",
      header: `CUSTOM RATE (₹)`,
      width: "w-48",
      render: (r) => (
        <Input
          name={`rate-${r.id}`}
          type="number"
          placeholder="Enter rate"
          value={ratesMap[r.id]?.rate ?? ""}
          onChange={(e) => handleRateChange(r.id, "rate", e.target.value === "" ? "" : Number(e.target.value))}
          className="h-9"
        />
      ),
    },
    {
      key: "discount",
      header: "DISCOUNT (%)",
      width: "w-32",
      render: (r) => (
        <Input
          name={`discount-${r.id}`}
          type="number"
          placeholder="0%"
          max={100}
          value={ratesMap[r.id]?.discountPercent ?? ""}
          onChange={(e) => handleRateChange(r.id, "discountPercent", e.target.value === "" ? "" : Number(e.target.value))}
          className="h-9"
        />
      ),
    },
  ];

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size={view === "MANAGE_RATES" ? "full" : "xl"}
      title={view === "LIST" ? "Tariff & Rate Management" : `Configure Rates: ${activeTariff?.tariffName}`}
      description={
        view === "LIST" 
          ? "Create rate lists for different panels, insurances, and corporate tie-ups." 
          : "Override base hospital rates for this specific tariff."
      }
      footer={
        view === "LIST" ? (
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        ) : (
          <div className="flex w-full justify-between">
            <Button variant="outline" icon={<ArrowLeft />} onClick={() => setView("LIST")}>
              Back to Tariffs
            </Button>
            <Button icon={<Save />} loading={saving} onClick={handleSaveRates}>
              Save Rates
            </Button>
          </div>
        )
      }
    >
      {view === "LIST" ? (
        <div className="space-y-6">
          <div className="flex items-end gap-3 rounded-xl border border-ink-100 bg-ink-25/40 p-4">
            
            {/* Tariff Name (Moved to first position for better UX) */}
            <div className="flex-[2]">
              <label className="mb-1 block text-[12px] font-medium text-ink-600">Tariff Name</label>
              <input
                value={newTariffName}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewTariffName(val);
                  // 👈 Auto-Suggest Logic Here
                  if (!codeTouched) {
                    setNewTariffCode(suggestTariffCode(val));
                  }
                }}
                onKeyDown={(e) => e.key === "Enter" && handleAddTariff()}
                placeholder="e.g. Central Govt Health Scheme 2025"
                className={cn(fieldClasses(false), "h-10 w-full px-3")}
              />
            </div>
            
            {/* Tariff Code */}
            <div className="flex-1">
              <label className="mb-1 block text-[12px] font-medium text-ink-600">Tariff Code</label>
              <input
                value={newTariffCode}
                onChange={(e) => {
                  setNewTariffCode(e.target.value.toUpperCase());
                  setCodeTouched(true); // 👈 User touched it, stop auto-suggesting
                }}
                placeholder="e.g. CGHS-2025"
                className={cn(fieldClasses(false), "h-10 w-full px-3 uppercase font-mono")}
              />
            </div>
            
            <Button icon={<Plus />} loading={saving} onClick={handleAddTariff}>
              Add Tariff
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search tariffs..."
              className="max-w-sm"
            />
          </div>

          <DataTable<TariffMasterItem>
            columns={listColumns}
            rows={filteredTariffs}
            status={loading ? "loading" : "ready"}
            rowKey={(r) => r.id}
            emptyTitle="No Tariffs Found"
            actions={(row) => (
              <RowActions
                items={[
                  {
                    label: "Configure Rates",
                    icon: <Settings2 />,
                    onClick: () => openRateManager(row),
                  },
                  {
                    label: "Delete",
                    icon: <Trash2 />,
                    tone: "danger",
                    onClick: () => handleDeleteTariff(row.id),
                  },
                ]}
              />
            )}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-brand-50 p-4 border border-brand-100">
            <div>
              <p className="text-[12px] font-semibold text-brand-600 uppercase tracking-wider">Active Tariff</p>
              <h3 className="text-lg font-bold text-ink-900">{activeTariff?.tariffName}</h3>
            </div>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search services..."
              className="w-72 bg-white"
            />
          </div>

          <div className="border border-ink-100 rounded-xl overflow-hidden">
            <DataTable<ServiceMasterItem>
              columns={rateColumns}
              rows={filteredServices}
              status={loading ? "loading" : "ready"}
              rowKey={(r) => r.id}
              dense
            />
          </div>
        </div>
      )}
    </Dialog>
  );
}