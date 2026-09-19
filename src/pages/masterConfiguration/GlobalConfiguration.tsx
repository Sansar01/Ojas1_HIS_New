import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { Dialog } from "@/components/ui/overlays";
import { Button, StatusBadge } from "@/components/ui/primitives";
import { SearchInput, Switch, fieldClasses } from "@/components/ui/fields";
import { DataTable, RowActions, type Column } from "@/components/ui/table";
import { useAppDispatch } from "@/hooks";
import { toast } from "@/features/ui/uiSlice";
import { cn } from "@/utils/cn";
import {
  globalMasterService,
  type MasterCategory,
  type MasterValueType,
} from "@/features/masters/globalMasterService"; // Adjust path as needed

// Hardcoded sidebar configuration to map UI labels to API Enums
const SIDEBAR_CONFIG = [
  {
    section: "PANEL / BILLING",
    category: "PANEL_BILLING",
    items: [
      { key: "GROUP_TYPE", label: "Group Type" },
      { key: "PAYMENT_MODE", label: "Payment Mode" },
      { key: "RATE_TYPE", label: "Rate Type" },
      { key: "CURRENCY", label: "Currency" },
      { key: "PANEL_TYPE", label: "Panel Type" },
      { key: "TAX_TYPE", label: "Tax Type" },
      { key: "DISCOUNT_REASON", label: "Discount Reason" },
      { key: "REFUND_REASON", label: "Refund Reason" },
      { key: "CANCELLATION_REASON", label: "Cancellation Reason" },
    ],
  },
  {
    section: "CLINICAL",
    category: "CLINICAL",
    items: [
      { key: "CONSULTATION_TYPE", label: "Consultation Type" },
      { key: "DIAGNOSIS_TYPE", label: "Diagnosis Type" },
      { key: "DIET_TYPE", label: "Diet Type" },
    ],
  },
];

type Row = {
  id: string;
  value: string;
  isSystem: boolean;
  isActive: boolean;
};

export function GlobalConfiguration({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const dispatch = useAppDispatch();

  // States
  const [activeCategory, setActiveCategory] = useState<string>("PANEL_BILLING");
  const [activeType, setActiveType] = useState<string>("GROUP_TYPE");
  const [activeLabel, setActiveLabel] = useState<string>("Group Type");

  const [inputValue, setInputValue] = useState("");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [apiRows, setApiRows] = useState<Row[]>([]);
  const [sidebarCounts, setSidebarCounts] = useState<Record<string, number>>({});
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // 1. Fetch Sidebar Counts (Updates numbers next to categories)
  const fetchCounts = useCallback(async () => {
    try {
      const tree = await globalMasterService.getSidebar();
      const newCounts: Record<string, number> = {};
      // Flatten the tree to create a quick lookup dictionary e.g., { GROUP_TYPE: 4 }
      Object.values(tree).flat().forEach((item) => {
        newCounts[item.type] = item.count;
      });
      setSidebarCounts(newCounts);
    } catch (error) {
      console.error("Failed to load sidebar counts", error);
    }
  }, []);

  // 2. Fetch Data for the active tab
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await globalMasterService.getByType(activeType as MasterValueType);
      setApiRows(data);
    } catch (error: any) {
      dispatch(toast.error("Failed to load data", error?.message));
    } finally {
      setLoading(false);
    }
  }, [activeType, dispatch]);

  // Initial load
  useEffect(() => {
    if (open) {
      fetchCounts();
      fetchData();
    }
  }, [open, activeType, fetchCounts, fetchData]);

  // 3. Filter Rows (Search + Active Toggle)
  const rows: Row[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apiRows
      .filter((r) => showInactive || r.isActive)
      .filter((r) => !q || r.value.toLowerCase().includes(q));
  }, [apiRows, search, showInactive]);

  // 4. Handle Add New Value
  const handleAdd = async () => {
    const val = inputValue.trim();
    if (!val) {
      dispatch(toast.warning("Value is required"));
      return;
    }

    setSaving(true);
    try {
      await globalMasterService.create({
        category: activeCategory as MasterCategory,
        type: activeType as MasterValueType,
        value: val.toUpperCase(), // Best practice: keep masters uppercase
      });
      dispatch(toast.success(`${activeLabel} added successfully`));
      setInputValue("");
      
      // Refresh list & counts after adding
      fetchData(); 
      fetchCounts(); 
    } catch (e: any) {
      dispatch(toast.error("Could not save", e?.message));
    } finally {
      setSaving(false);
    }
  };

  // 5. Handle Toggle Active/Inactive
  const handleToggle = async (row: Row) => {
    setTogglingId(row.id);
    try {
      await globalMasterService.setActive(row.id, !row.isActive); // FIXED method name
      dispatch(
        row.isActive
          ? toast.info("Deactivated", row.value)
          : toast.success("Activated", row.value)
      );
      fetchData(); // Reload list
    } catch (e: any) {
      dispatch(toast.error("Update failed", e?.message));
    } finally {
      setTogglingId(null);
    }
  };

  // 6. Handle Soft Delete
  const handleDelete = async (row: Row) => {
    if (row.isSystem) {
      dispatch(
        toast.warning(
          "System default values cannot be deleted. You can deactivate them instead."
        )
      );
      return;
    }

    if (confirm(`Are you sure you want to delete '${row.value}'?`)) {
      try {
        await globalMasterService.remove(row.id); // FIXED method name
        dispatch(toast.success("Deleted successfully"));
        
        // Refresh list & counts after deleting
        fetchData();
        fetchCounts();
      } catch (e: any) {
        dispatch(toast.error("Delete failed", e?.message));
      }
    }
  };

  const columns: Column<Row>[] = [
    {
      key: "idx",
      header: "#",
      width: "w-12",
      render: (_r, i) => <span className="text-ink-400">{i + 1}</span>,
    },
    {
      key: "value",
      header: "VALUE",
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink-900">{r.value}</span>
          {r.isSystem && (
            <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600">
              SYSTEM
            </span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "STATUS",
      width: "w-32",
      render: (r) => (
        <Switch
          checked={r.isActive}
          disabled={togglingId === r.id}
          onCheckedChange={() => handleToggle(r)}
          label={r.isActive ? "Active" : "Inactive"}
        />
      ),
    },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="full"
      title="Global Master Configuration"
      description="Manage all dropdown lists used across the application from a single screen"
      className="p-0"
      footer={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      }
    >
      <div className="grid gap-5 md:grid-cols-[250px_1fr]">
        {/* ─── LEFT SIDEBAR ────────────────────────────────────────── */}
        <nav className="max-h-[60vh] overflow-y-auto rounded-xl border border-ink-100 bg-ink-25/40 p-2">
          {SIDEBAR_CONFIG.map((group) => (
            <div key={group.section} className="mb-2">
              <p className="px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.11em] text-ink-400">
                {group.section}
              </p>
              {group.items.map((it) => {
                const isActiveTab = activeType === it.key;
                return (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => {
                      setActiveCategory(group.category);
                      setActiveType(it.key);
                      setActiveLabel(it.label);
                      setSearch("");
                      setInputValue("");
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors",
                      isActiveTab
                        ? "bg-brand-600 font-medium text-white"
                        : "text-ink-700 hover:bg-ink-100"
                    )}
                  >
                    <span className="truncate">{it.label}</span>
                    
                    {/* Shows the count of items in this category */}
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                        isActiveTab
                          ? "bg-white/25 text-white"
                          : "bg-ink-200 text-ink-600"
                      )}
                    >
                      {sidebarCounts[it.key] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* ─── RIGHT CONTENT AREA ──────────────────────────────────── */}
        <section className="min-w-0 pr-4">
          <div className="mb-4">
            <h3 className="text-[15px] font-semibold text-ink-900">
              {activeLabel}
            </h3>
            <p className="text-[12.5px] text-ink-400">
              Add, edit or remove options that appear in the "{activeLabel}"
              dropdown.
            </p>
          </div>

          {/* ADD NEW FORM */}
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-ink-100 bg-ink-25/40 p-2">
            <input
              value={inputValue}
              maxLength={100}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={`Add new ${activeLabel}...`}
              className={cn(fieldClasses(false), "h-10 flex-1 px-3 bg-white")}
            />
            <Button icon={<Plus />} loading={saving} onClick={handleAdd}>
              Add
            </Button>
          </div>

          {/* SEARCH & FILTER */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search..."
              className="min-w-[14rem] flex-1"
            />
            <Switch
              checked={showInactive}
              onCheckedChange={setShowInactive}
              label="Show inactive"
              className="shrink-0"
            />
          </div>

          {/* DATA TABLE */}
      

                {/* DATA TABLE */}
          <DataTable<Row>
            columns={columns}
            rows={rows}
            status={loading ? "loading" : "ready"}
            dense
            rowKey={(r) => r.id}
            emptyTitle={`No ${activeLabel} found`}
            emptyDescription="Add a new value using the input above."
            actions={(row) => (
              <RowActions
                items={[
                  {
                    label: "Delete",
                    icon: <Trash2 />,
                    tone: "danger",
                    onClick: () => handleDelete(row),
                    hidden: row.isSystem, // 👈 Changed 'disabled' to 'hidden'
                  },
                ]}
              />
            )}
          />
        </section>
      </div>
    </Dialog>
  );
}