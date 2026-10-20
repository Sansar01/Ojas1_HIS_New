import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Plus, Trash2, Edit2, Power, PowerOff, X } from "lucide-react";
import { ConfirmDialog, Dialog } from "@/components/ui/overlays";
import { Button, StatusBadge } from "@/components/ui/primitives";
import {
  Input,
  NumberInput,
  SearchInput,
  Select,
  Switch,
} from "@/components/ui/fields";
import { DataTable, RowActions, type Column } from "@/components/ui/table";
import { useAppDispatch } from "@/store/hooks";
import { toast } from "@/store/slices/uiSlice";
import { cn } from "@/utils/cn";
import {
  downloadText,
  formatDateTime,
  relativeTime,
  toCSV,
  todayISO,
} from "@/utils";

// Service Master API — relational catalogue (service-categories + service-items)
import {
  masterService,
  type ServiceItemPayload,
} from "@/pages/masterConfiguration/master.service";
import type { ServiceCategoryItem, ServiceItem } from "@/types";

/**
 * `itemType` options — MANDATORY on POST /service-items; values must mirror
 * the backend enum exactly: BOTH | OPD | IPD | DAYCARE | PACKAGE.
 */
const ITEM_TYPE_OPTIONS = [
  { value: "BOTH", label: "Both (OPD & IPD)" },
  { value: "OPD", label: "OPD" },
  { value: "IPD", label: "IPD" },
  { value: "DAYCARE", label: "Daycare" },
  { value: "PACKAGE", label: "Package" },
];

const EMPTY_FORM = {
  serviceCode: "",
  serviceName: "",
  categoryId: "",
  baseRate: 0,
  itemType: "BOTH",
  rateEditable: false,
  discountable: true,
  isActive: true,
};

type FormState = typeof EMPTY_FORM;

/**
 * The catalogue APIs answer either as a bare array or as an envelope
 * ({ data: [...] }) — accept both, and drop soft-deleted rows so a
 * `deletedAt` record never reaches the table.
 */
const parseRows = <T,>(res: any): T[] => {
  const body = res?.data;
  const rows = Array.isArray(body) ? body : (body?.data ?? []);
  return Array.isArray(rows) ? rows.filter((r) => r && !r.deletedAt) : [];
};

export function ServiceMaster({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const dispatch = useAppDispatch();

  // Category master (id → name) — fetched once per dialog open
  const [categories, setCategories] = useState<ServiceCategoryItem[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // Service items catalogue — loaded by this dialog whenever it opens (§21/§26)
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      setCategoriesLoading(true);
      const response = await masterService.fetchServiceCategories();
      if (response.status === 200) setCategories(parseRows<ServiceCategoryItem>(response));
    } catch (e: any) {
      dispatch(toast.error("Failed to load service categories", e?.message));
    } finally {
      setCategoriesLoading(false);
    }
  }, [dispatch]);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      // Only active catalogue entries — `isActive=true` (the API also
      // defaults to active when the param is omitted).
      const response = await masterService.fetchServiceItems({
        isActive: true,
      });
      if (response.status === 200) setItems(parseRows<ServiceItem>(response));
    } catch (e: any) {
      dispatch(toast.error("Failed to load services", e?.message));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    if (open) {
      loadCategories();
      loadItems();
    }
  }, [open, loadCategories, loadItems]);

  // UI States
  const [saving, setSaving] = useState(false);

  // Form State
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});

  // Filter / sort states — selectedCategory holds a category id (or "ALL")
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Delete confirmation state (design-system dialog, never native confirm())
  const [deleteTarget, setDeleteTarget] = useState<ServiceItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  // ─── 1. Helpers ────────────────────────────────────────────────────
  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setErrors({});
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // Auto Code Suggestion (e.g., "Complete Blood Count" → "LAB-COMP")
  // Trailing underscores from the sanitizer are stripped.
  const suggestCode = (name: string) => {
    if (!name.trim()) return "";
    const cleanName = name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/_+$/g, "")
      .slice(0, 8)
      .replace(/_+$/g, "");
    return `SRV-${cleanName}`;
  };

  // ─── 2. Save / Update Handler (POST/PATCH service-items) ───────────
  const handleSave = async () => {
    const nextErrors: typeof errors = {};
    const code = form.serviceCode.toUpperCase().trim();

    if (!code) nextErrors.serviceCode = "Code is required";
    if (!form.serviceName.trim()) nextErrors.serviceName = "Name is required";
    if (!form.categoryId) nextErrors.categoryId = "Category is required";
    if (form.baseRate < 0) nextErrors.baseRate = "Base rate cannot be negative";
    // Duplicate-code guard — the catalogue is keyed by serviceCode
    if (
      code &&
      items.some(
        (s) => s.id !== editingId && s.serviceCode.toUpperCase() === code,
      )
    ) {
      nextErrors.serviceCode = "This service code already exists";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const payload: ServiceItemPayload = {
        serviceName: form.serviceName.trim(),
        serviceCode: code,
        categoryId: form.categoryId,
        baseRate: form.baseRate,
        itemType: form.itemType,
        rateEditable: form.rateEditable,
        discountable: form.discountable,
      };

      if (editingId) {
        // Edit Mode — isActive rides along so the switch persists too
        await masterService.updateServiceItem(editingId, {
          ...payload,
          isActive: form.isActive,
        });
        dispatch(toast.success("Service updated successfully"));
      } else {
        // Create Mode — payload exactly as the service-items API expects
        await masterService.createServiceItem(payload);
        dispatch(toast.success("Service added successfully"));
      }

      resetForm();
      loadItems();
    } catch (error: any) {
      dispatch(toast.error("Could not save service", error?.message));
    } finally {
      setSaving(false);
    }
  };

  // ─── 3. Edit Handler ──────────────────────────────────────────────
  const handleEdit = (row: ServiceItem) => {
    setEditingId(row.id);
    setForm({
      serviceCode: row.serviceCode,
      serviceName: row.serviceName,
      categoryId: row.categoryId ?? row.categoryRel?.id ?? "",
      baseRate: Number(row.baseRate),
      itemType: String(row.itemType ?? "BOTH"),
      rateEditable: row.rateEditable ?? false,
      discountable: row.discountable ?? true,
      isActive: row.isActive !== false,
    });
  };

  // ─── 4. Activate / Deactivate (soft status toggle, PATCH isActive) ─
  const handleToggleActive = async (row: ServiceItem) => {
    try {
      await masterService.updateServiceItem(row.id, { isActive: !row.isActive });
      dispatch(
        toast.success(
          row.isActive
            ? `'${row.serviceName}' deactivated`
            : `'${row.serviceName}' activated`,
        ),
      );
      loadItems();
    } catch (error: any) {
      dispatch(toast.error("Could not update status", error?.message));
    }
  };

  // ─── 5. Soft Delete Handler (confirmed via ConfirmDialog) ──────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await masterService.deleteServiceItem(deleteTarget.id);
      dispatch(toast.success("Service deleted"));
      setDeleteTarget(null);
      loadItems();
    } catch (error: any) {
      dispatch(toast.error("Delete failed", error?.message));
    } finally {
      setDeleting(false);
    }
  };

  // ─── 6. Category chips (live counts by categoryId; unknown categories appear too) ─
  const categoryChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of items) {
      const id = s.categoryId ?? s.categoryRel?.id ?? "";
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    // Known categories first (API order), then any category present on items
    // but missing from the category master (labelled via categoryRel).
    const known = categories.map((c) => ({
      value: c.id,
      label: c.name,
      count: counts.get(c.id) ?? 0,
    }));
    const extra = [...counts.entries()]
      .filter(([id]) => !categories.some((c) => c.id === id))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, count]) => ({
        value: id,
        label:
          items.find((s) => (s.categoryId ?? s.categoryRel?.id) === id)
            ?.categoryRel?.name ?? id,
        count,
      }));
    return [
      { value: "ALL", label: "All Categories", count: items.length },
      ...known,
      ...extra,
    ];
  }, [categories, items]);

  // ─── 7. Filter (by categoryId) + sort services for the table ───────
  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = items.filter((s) => {
      const matchesSearch =
        !q ||
        s.serviceName.toLowerCase().includes(q) ||
        s.serviceCode.toLowerCase().includes(q);
      const matchesCategory =
        selectedCategory === "ALL" ||
        (s.categoryId ?? s.categoryRel?.id) === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    if (!sortBy) return out;

    const accessor = (r: ServiceItem): string | number => {
      switch (sortBy) {
        case "baseRate":
          return Number(r.baseRate) || 0;
        case "updatedAt":
          return r.updatedAt ? Date.parse(r.updatedAt) : 0;
        case "status":
          return r.isActive === false ? 0 : 1;
        case "category":
          return String(r.categoryRel?.name ?? "").toLowerCase();
        default:
          return String(r[sortBy as keyof ServiceItem] ?? "").toLowerCase();
      }
    };

    return [...out].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      const dir = sortDir === "asc" ? 1 : -1;
      if (typeof av === "number" && typeof bv === "number")
        return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, {
        numeric: true,
      }) * dir;
    });
  }, [items, search, selectedCategory, sortBy, sortDir]);

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const activeCount = useMemo(
    () => items.filter((s) => s.isActive !== false).length,
    [items],
  );

  // ─── 8. CSV export of the current (filtered) view ──────────────────
  const handleExport = () => {
    if (!filteredServices.length) return;
    const rows = filteredServices.map((s) => ({
      Code: s.serviceCode,
      Service: s.serviceName,
      Category: s.categoryRel?.name ?? s.categoryId ?? "",
      "Base Rate": Number(s.baseRate).toFixed(2),
      Status: s.isActive === false ? "Inactive" : "Active",
      Updated: s.updatedAt ? formatDateTime(s.updatedAt) : "",
    }));
    downloadText(`service-catalog-${todayISO()}.csv`, toCSV(rows));
    dispatch(toast.success("Catalog exported", `${rows.length} services`));
  };

  // ─── 9. Columns Definition ─────────────────────────────────────────
  const columns: Column<ServiceItem>[] = [
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
      sortable: true,
      render: (r) => (
        <span className="font-mono text-[12.5px] font-semibold text-ink-600">
          {r.serviceCode}
        </span>
      ),
    },
    {
      key: "serviceName",
      header: "SERVICE NAME",
      sortable: true,
      render: (r) => (
        <span className="font-medium text-ink-900">{r.serviceName}</span>
      ),
    },
    {
      key: "category",
      header: "CATEGORY",
      width: "w-40",
      sortable: true,
      render: (r) => (
        <span className="rounded bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-700">
          {r.categoryRel?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "baseRate",
      header: "BASE RATE (CASH)",
      width: "w-36",
      align: "right",
      sortable: true,
      render: (r) => (
        <span className="font-semibold text-brand-600">
          ₹ {Number(r.baseRate).toFixed(2)}
        </span>
      ),
    },
    {
      key: "updatedAt",
      header: "UPDATED",
      width: "w-32",
      hideBelow: "lg",
      sortable: true,
      render: (r) =>
        r.updatedAt ? (
          <span
            className="text-[12px] text-ink-400"
            title={formatDateTime(r.updatedAt)}
          >
            {relativeTime(r.updatedAt)}
          </span>
        ) : (
          <span className="text-[12px] text-ink-300">—</span>
        ),
    },
    {
      key: "status",
      header: "STATUS",
      width: "w-28",
      sortable: true,
      render: (r) => (
        <StatusBadge status={r.isActive === false ? "Inactive" : "Active"} />
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
        {/* ─── ADD / EDIT INLINE FORM ───────────────────────────────── */}
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
              {/* Category — dynamic, from the service-categories master */}
              <Select
                label="Category"
                required
                value={form.categoryId}
                onChange={(v) => set("categoryId", v)}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Select category…"
                loading={categoriesLoading}
                loadingLabel="Loading categories…"
                error={errors.categoryId}
              />

              {/* Service Name */}
              <Input
                name="serviceName"
                label="Service Name"
                required
                placeholder="e.g. Complete Blood Count (CBC)"
                value={form.serviceName}
                error={errors.serviceName}
                onChange={(e) => {
                  const name = e.target.value;
                  set("serviceName", name);
                  // Auto generate code if not manually editing existing
                  if (!editingId && !form.serviceCode) {
                    set("serviceCode", suggestCode(name));
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

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                {/* Item Type — backend enum */}
                <div className="w-52">
                  <Select
                    label="Item Type"
                    value={form.itemType}
                    onChange={(v) => set("itemType", v)}
                    options={ITEM_TYPE_OPTIONS}
                  />
                </div>

                <div className="max-w-[15rem]">
                  <Switch
                    checked={form.rateEditable}
                    onCheckedChange={(v) => set("rateEditable", v)}
                    label="Rate editable"
                    description="Staff may override the rate at billing"
                  />
                </div>

                <div className="max-w-[15rem]">
                  <Switch
                    checked={form.discountable}
                    onCheckedChange={(v) => set("discountable", v)}
                    label="Discountable"
                    description="May be discounted on invoices"
                  />
                </div>

                {/* Status switch — only meaningful on an existing record */}
                {editingId && (
                  <div className="max-w-[15rem]">
                    <Switch
                      checked={form.isActive}
                      onCheckedChange={(v) => set("isActive", v)}
                      label="Service active"
                      description="Inactive services stay in history but are excluded from new billing"
                    />
                  </div>
                )}
              </div>

              <Button
                icon={<Plus />}
                loading={saving}
                onClick={handleSave}
              >
                {editingId ? "Update Service" : "Add Service"}
              </Button>
            </div>
        </div>

        {/* ─── CATEGORY CHIPS (live counts, click to filter by categoryId) ── */}
        <div className="flex flex-wrap gap-1.5">
          {categoryChips.map((chip) => {
            const active = selectedCategory === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => setSelectedCategory(chip.value)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                  active
                    ? "border-brand-400 bg-brand-50 text-brand-700 ring-1 ring-brand-400/40"
                    : "border-ink-100 bg-white text-ink-500 hover:border-ink-200 hover:text-ink-700",
                )}
              >
                {chip.label}{" "}
                <span
                  className={cn(
                    "font-semibold",
                    active ? "text-brand-500" : "text-ink-400",
                  )}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ─── SEARCH & EXPORT ─────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search service name or code..."
            className="min-w-[16rem] flex-1"
          />

          <div className="flex items-center gap-3">
            <span className="text-[12px] text-ink-400">
              Showing{" "}
              <span className="font-semibold text-ink-600">
                {filteredServices.length}
              </span>{" "}
              of {items.length} ·{" "}
              <span className="font-semibold text-brand-600">
                {activeCount}
              </span>{" "}
              active
            </span>
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="h-3.5 w-3.5" />}
              onClick={handleExport}
              disabled={!filteredServices.length}
            >
              Export CSV
            </Button>
          </div>
        </div>

        {/* ─── SERVICES DATA TABLE ────────────────────────────────── */}
        <DataTable<ServiceItem>
          columns={columns}
          rows={filteredServices}
          status={loading ? "loading" : "ready"}
          dense
          rowKey={(r) => r.id}
          sort={{ sortBy, sortDir, onSort: handleSort }}
          emptyTitle="No Services Found"
          emptyDescription="Add your first hospital service using the form above."
          actions={(row) => (
            <RowActions
              items={[
                {
                  label: row.isActive === false ? "Activate" : "Deactivate",
                  icon: row.isActive === false ? <Power /> : <PowerOff />,
                  onClick: () => handleToggleActive(row),
                },
                {
                  label: "Edit",
                  icon: <Edit2 />,
                  onClick: () => handleEdit(row),
                },
                {
                  label: "Delete",
                  icon: <Trash2 />,
                  tone: "danger",
                  onClick: () => setDeleteTarget(row),
                },
              ]}
            />
          )}
        />
      </div>

      {/* ─── DELETE CONFIRMATION ──────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Delete service?"
        description={
          deleteTarget
            ? `'${deleteTarget.serviceName}' (${deleteTarget.serviceCode}) will be removed from the catalog. Existing invoices keep their historical rates.`
            : ""
        }
        confirmLabel="Delete Service"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
      />
    </Dialog>
  );
}
