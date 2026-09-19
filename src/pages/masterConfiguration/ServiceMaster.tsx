import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Edit2, RotateCcw, X } from "lucide-react";
import { Dialog } from "@/components/ui/overlays";
import { Button, StatusBadge } from "@/components/ui/primitives";
import {
  Input,
  NumberInput,
  Select,
  SearchInput,
  fieldClasses,
} from "@/components/ui/fields";
import { DataTable, RowActions, type Column } from "@/components/ui/table";
import { useAppDispatch } from "@/hooks";
import { toast } from "@/features/ui/uiSlice";
import { cn } from "@/utils/cn";

// Import Service Master API
import {
  serviceMasterService,
  type ServiceMasterItem,
  type ServiceCategory,
} from "@/features/masters/serviceMasterService";

// Service Categories Dropdown Options
const CATEGORY_OPTIONS: { value: ServiceCategory; label: string }[] = [
  { value: "CONSULTATION", label: "Consultation" },
  { value: "LAB", label: "Laboratory" },
  { value: "RADIOLOGY", label: "Radiology & Imaging" },
  { value: "PROCEDURE", label: "Procedure & Nursing" },
  { value: "PHARMACY", label: "Pharmacy" },
  { value: "BED_CHARGE", label: "Bed & Room Charge" },
  { value: "OTHER", label: "Other Services" },
];

const EMPTY_FORM = {
  serviceCode: "",
  serviceName: "",
  category: "CONSULTATION" as ServiceCategory,
  baseRate: 0,
};

type FormState = typeof EMPTY_FORM;

export function ServiceMaster({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const dispatch = useAppDispatch();

  // Data & UI States
  const [services, setServices] = useState<ServiceMasterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // Filter States
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // ─── 1. Load Services ─────────────────────────────────────────────
  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await serviceMasterService.list();
      setServices(data);
    } catch (error: any) {
      dispatch(toast.error("Failed to load services", error?.message));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    if (open) {
      loadServices();
      resetForm();
    }
  }, [open, loadServices]);

  // ─── 2. Helpers ───────────────────────────────────────────────────
  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setErrors({});
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // Auto Code Suggestion (e.g., "Complete Blood Count" -> "LAB-COMP")
  const suggestCode = (name: string, category: string) => {
    if (!name.trim()) return "";
    const prefix = category.slice(0, 3).toUpperCase();
    const cleanName = name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .slice(0, 8);
    return `${prefix}-${cleanName}`;
  };

  // ─── 3. Save / Update Handler ──────────────────────────────────────
  const handleSave = async () => {
    const nextErrors: typeof errors = {};
    if (!form.serviceCode.trim()) nextErrors.serviceCode = "Code is required";
    if (!form.serviceName.trim()) nextErrors.serviceName = "Name is required";
    if (form.baseRate < 0) nextErrors.baseRate = "Base rate cannot be negative";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      if (editingId) {
        // Edit Mode
        await serviceMasterService.update(editingId, {
          serviceCode: form.serviceCode.toUpperCase().trim(),
          serviceName: form.serviceName.trim(),
          category: form.category,
          baseRate: form.baseRate,
        });
        dispatch(toast.success("Service updated successfully"));
      } else {
        // Create Mode
        await serviceMasterService.create({
          serviceCode: form.serviceCode.toUpperCase().trim(),
          serviceName: form.serviceName.trim(),
          category: form.category,
          baseRate: form.baseRate,
        });
        dispatch(toast.success("Service added successfully"));
      }

      resetForm();
      loadServices();
    } catch (error: any) {
      dispatch(toast.error("Could not save service", error?.message));
    } finally {
      setSaving(false);
    }
  };

  // ─── 4. Edit Handler ──────────────────────────────────────────────
  const handleEdit = (row: ServiceMasterItem) => {
    setEditingId(row.id);
    setForm({
      serviceCode: row.serviceCode,
      serviceName: row.serviceName,
      category: row.category,
      baseRate: Number(row.baseRate),
    });
  };

  // ─── 5. Soft Delete Handler ───────────────────────────────────────
  const handleDelete = async (row: ServiceMasterItem) => {
    if (!confirm(`Are you sure you want to delete '${row.serviceName}'?`)) return;

    try {
      await serviceMasterService.remove(row.id);
      dispatch(toast.success("Service deleted"));
      loadServices();
    } catch (error: any) {
      dispatch(toast.error("Delete failed", error?.message));
    }
  };

  // ─── 6. Filter Services for Table ─────────────────────────────────
  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      const matchesSearch =
        !q ||
        s.serviceName.toLowerCase().includes(q) ||
        s.serviceCode.toLowerCase().includes(q);
      const matchesCategory =
        selectedCategory === "ALL" || s.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [services, search, selectedCategory]);

  // ─── 7. Columns Definition ────────────────────────────────────────
  const columns: Column<ServiceMasterItem>[] = [
    {
      key: "idx",
      header: "#",
      width: "w-12",
      render: (_r, i) => <span className="text-ink-400">{i + 1}</span>,
    },
    {
      key: "serviceCode",
      header: "CODE",
      width: "w-36",
      render: (r) => (
        <span className="font-mono text-[12.5px] font-semibold text-ink-600">
          {r.serviceCode}
        </span>
      ),
    },
    {
      key: "serviceName",
      header: "SERVICE NAME",
      render: (r) => (
        <span className="font-medium text-ink-900">{r.serviceName}</span>
      ),
    },
    {
      key: "category",
      header: "CATEGORY",
      width: "w-40",
      render: (r) => (
        <span className="rounded bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-700">
          {r.category}
        </span>
      ),
    },
    {
      key: "baseRate",
      header: "BASE RATE (CASH)",
      width: "w-36",
      render: (r) => (
        <span className="font-semibold text-brand-600">
          ₹ {Number(r.baseRate).toFixed(2)}
        </span>
      ),
    },
    {
      key: "status",
      header: "STATUS",
      width: "w-28",
      render: (r) => (
        <StatusBadge status={r.isActive ? "Active" : "Inactive"} />
      ),
    },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title="Service Master Catalog"
      description="Manage all hospital services and their base (cash) rates"
      footer={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      }
    >
      <div className="space-y-5">
        {/* ─── ADD / EDIT INLINE FORM ──────────────────────────────── */}
        <div className="rounded-xl border border-ink-100 bg-ink-25/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-500">
              {editingId ? "Edit Service Details" : "Add New Hospital Service"}
            </p>
            {editingId && (
              <Button
                variant="ghost"
                size="sm"
                icon={<X className="h-3.5 w-3.5" />}
                onClick={resetForm}
              >
                Cancel Editing
              </Button>
            )}
          </div>

          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Category */}
            <Select
              label="Category"
              value={form.category}
              onChange={(v) => set("category", v as ServiceCategory)}
              options={CATEGORY_OPTIONS}
            />

            {/* Service Name */}
            <Input
              name="serviceName"
              label="Service Name"
              required
              placeholder="e.g. Complete Blood Count"
              value={form.serviceName}
              error={errors.serviceName}
              onChange={(e) => {
                const name = e.target.value;
                set("serviceName", name);
                // Auto generate code if not manually editing existing
                if (!editingId && !form.serviceCode) {
                  set("serviceCode", suggestCode(name, form.category));
                }
              }}
            />

            {/* Service Code */}
            <Input
              name="serviceCode"
              label="Service Code"
              required
              placeholder="e.g. LAB-CBC"
              value={form.serviceCode}
              error={errors.serviceCode}
              onChange={(e) => set("serviceCode", e.target.value.toUpperCase())}
            />

            {/* Base Rate */}
            <NumberInput
              label="Base Rate (Cash ₹)"
              value={form.baseRate}
              onValueChange={(v) => set("baseRate", v)}
              min={0}
              error={errors.baseRate}
            />
          </div>

          <div className="mt-4 flex justify-end">
            <Button icon={<Plus />} loading={saving} onClick={handleSave}>
              {editingId ? "Update Service" : "Add Service"}
            </Button>
          </div>
        </div>

        {/* ─── SEARCH & CATEGORY FILTER ───────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search service name or code..."
            className="min-w-[16rem] flex-1"
          />

          <div className="w-56">
            <Select
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={[
                { value: "ALL", label: "All Categories" },
                ...CATEGORY_OPTIONS,
              ]}
            />
          </div>
        </div>

        {/* ─── SERVICES DATA TABLE ────────────────────────────────── */}
        <DataTable<ServiceMasterItem>
          columns={columns}
          rows={filteredServices}
          status={loading ? "loading" : "ready"}
          dense
          rowKey={(r) => r.id}
          emptyTitle="No Services Found"
          emptyDescription="Add your first hospital service using the form above."
          actions={(row) => (
            <RowActions
              items={[
                {
                  label: "Edit",
                  icon: <Edit2 />,
                  onClick: () => handleEdit(row),
                },
                {
                  label: "Delete",
                  icon: <Trash2 />,
                  tone: "danger",
                  onClick: () => handleDelete(row),
                },
              ]}
            />
          )}
        />
      </div>
    </Dialog>
  );
}