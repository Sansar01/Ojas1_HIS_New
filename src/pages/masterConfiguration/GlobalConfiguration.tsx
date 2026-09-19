import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { Dialog } from "@/components/ui/overlays";
import { Button, StatusBadge } from "@/components/ui/primitives";
import {
  SearchInput,
  Select,
  Switch,
  fieldClasses,
} from "@/components/ui/fields";
import { DataTable, RowActions, type Column } from "@/components/ui/table";
import { useAppDispatch } from "@/hooks";
import { useMasterData } from "@/hooks/useMasterData";
import {
  DepartmentTypeRecord,
  MasterRecord,
  mastersService,
} from "@/services/mastersService";
import { toast } from "@/features/ui/uiSlice";
import { cn } from "@/utils/cn";
import {
  GLOBAL_CONFIG_GROUPS,
  type MasterDef,
} from "@/types/masterConfig.data";

type Row = {
  id: string;
  code?: string;
  label: string;
  active: boolean;
  description?: string;
};

const EMPTY_FORM = { name: "", code: "", description: "" };
type FormState = typeof EMPTY_FORM;

/** "Gynecology & Obstetrics" -> "GYNECOLOGY_OBSTETRICS". Suggestion only; editable. */
const suggestCode = (name: string) =>
  name
    .trim()
    .toUpperCase()
    .replace(/&/g, " ")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);

const inputClass = cn(fieldClasses(false), "h-10 w-full px-3");

export function GlobalConfiguration({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const dispatch = useAppDispatch();
  const [activeKey, setActiveKey] = useState("department");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  /** True once the user edits Code themselves — stops auto-suggest overwriting it. */
  const [codeTouched, setCodeTouched] = useState(false);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | string | null>(null);

  // Local (not-yet-migrated) masters keep their in-memory list.
  const [localValues, setLocalValues] = useState<Record<string, string[]>>(
    () => {
      const seed: Record<string, string[]> = {};
      GLOBAL_CONFIG_GROUPS.forEach((g) =>
        g.items.forEach((it) => {
          if (it.values) seed[it.key] = [...it.values];
        }),
      );
      return seed;
    },
  );

  const activeItem: MasterDef | undefined = useMemo(
    () =>
      GLOBAL_CONFIG_GROUPS.flatMap((g) => g.items).find(
        (i) => i.key === activeKey,
      ),
    [activeKey],
  );

  const {
    rows: apiRows,
    status,
    error,
    reload,
    type,
    enabled,
  } = useMasterData(activeItem);

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setCodeTouched(false);
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const rows: Row[] = useMemo(() => {
    const list: Row[] = enabled
      ? apiRows.map((r) => ({
          id: r.id as string,
          code: r.code ?? undefined,
          label: String(r[activeItem?.labelField ?? "name"] ?? ""),
          description: r.description ?? undefined,
          active: r.isActive !== false,
        }))
      : (localValues[activeKey] ?? []).map((v, i) => ({
          id: `${activeKey}-${i}`,
          label: v,
          active: true,
        }));

    const q = search.trim().toLowerCase();
    return list
      .filter((r) => showInactive || r.active)
      .filter(
        (r) =>
          !q ||
          r.label.toLowerCase().includes(q) ||
          r.code?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q),
      );
  }, [
    enabled,
    apiRows,
    localValues,
    activeKey,
    activeItem,
    search,
    showInactive,
  ]);

  const countFor = (def: MasterDef) =>
    def.api === type
      ? enabled
        ? apiRows.length
        : rows.length
      : (localValues[def.key]?.length ?? "—");

  const handleAdd = async () => {
    const name = form.name.trim();
    if (!name) {
      dispatch(toast.warning("Name is required"));
      return;
    }

    if (!enabled || !type) {
      setLocalValues((p) => ({
        ...p,
        [activeKey]: [...(p[activeKey] ?? []), name.toUpperCase()],
      }));
      dispatch(toast.success("Value added"));
      resetForm();
      return;
    }

    const code = form.code.trim().toUpperCase();
    const description = form.description.trim();

    // Send only the keys the user filled in — the API rejects unknown extras.
    const payload: Partial<MasterRecord> = {
      name,
      ...(code ? { code } : {}),
      ...(description ? { description } : {}),
    };

    setSaving(true);
    try {
      await mastersService.create(type, payload);
      await reload();
      dispatch(toast.success(`${activeItem?.label} added`, name));
      resetForm();
    } catch (e: any) {
      dispatch(toast.error("Could not save", e?.message));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (row: Row) => {
    if (!enabled || !type) {
      setLocalValues((p) => ({
        ...p,
        [activeKey]: (p[activeKey] ?? []).filter((v) => v !== row.label),
      }));
      dispatch(toast.info("Value removed"));
      return;
    }

    setTogglingId(row.id);
    try {
      await mastersService.setActive(type, row.id, !row.active);
      await reload();
      dispatch(
        row.active
          ? toast.info("Deactivated", row.label)
          : toast.success("Activated", row.label),
      );
    } catch (e: any) {
      dispatch(toast.error("Update failed", e?.message));
    } finally {
      setTogglingId(null);
    }
  };

  const columns: Column<Row>[] = [
    {
      key: "idx",
      header: "#",
      width: "w-12",
      render: (_r, i) => <span className="text-ink-400">{i + 1}</span>,
    },
    ...(enabled
      ? [
          {
            key: "code",
            header: "Code",
            width: "w-36",
            render: (r: Row) => (
              <span className="font-mono text-[12px] text-ink-500">
                {r.code ?? "—"}
              </span>
            ),
          },
        ]
      : []),
    {
      key: "label",
      header: "Name",
      render: (r) => (
        <span className="font-medium text-ink-900">{r.label}</span>
      ),
    },
    ...(enabled
      ? [
          {
            key: "description",
            header: "Description",
            hideBelow: "lg" as const,
            render: (r: Row) => (
              <span className="line-clamp-1 text-[12.5px] text-ink-500">
                {r.description || "—"}
              </span>
            ),
          },
        ]
      : []),
    {
      key: "status",
      header: "Status",
      width: "w-40",
      render: (r) =>
        enabled ? (
          // Inline switch: flip active/inactive straight from the list.
          <Switch
            checked={r.active}
            disabled={togglingId === r.id}
            onCheckedChange={() => handleToggle(r)}
            label={r.active ? "Active" : "Inactive"}
          />
        ) : (
          <StatusBadge status={r.active ? "Active" : "Inactive"} />
        ),
    },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="full"
      title="Global Master Configuration"
      description="Manage every dropdown list used across the application from a single screen"
      className="p-0"
      footer={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      }
    >
      <div className="grid gap-5 md:grid-cols-[250px_1fr]">
        {/* Master list rail */}
        <nav className="max-h-[60vh] overflow-y-auto rounded-xl border border-ink-100 bg-ink-25/40 p-2">
          {GLOBAL_CONFIG_GROUPS.map((group) => (
            <div key={group.section} className="mb-2">
              <p className="px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.11em] text-ink-400">
                {group.section}
              </p>
              {group.items.map((it) => {
                const isActive = activeKey === it.key;
                return (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => {
                      setActiveKey(it.key);
                      setSearch("");
                      resetForm();
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors",
                      isActive
                        ? "bg-brand-600 font-medium text-white"
                        : "text-ink-700 hover:bg-ink-100",
                    )}
                  >
                    <span className="truncate">
                      {it.label}
                      {it.api && (
                        <span
                          className={cn(
                            "ml-1.5 text-[9.5px] uppercase",
                            isActive ? "text-white/70" : "text-brand-600",
                          )}
                        >
                          live
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                        isActive
                          ? "bg-white/25 text-white"
                          : "bg-ink-200 text-ink-600",
                      )}
                    >
                      {countFor(it)}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Selected master */}
        <section className="min-w-0">
          <div className="mb-4">
            <h3 className="text-[15px] font-semibold text-ink-900">
              {activeItem?.label}
            </h3>
            <p className="text-[12.5px] text-ink-400">
              {enabled
                ? `Synced with /api/hospital/masters/${type}`
                : `Local list — options shown in the "${activeItem?.label}" dropdown.`}
            </p>
          </div>

          {/* ── Add form ──────────────────────────────────────────────── */}
          {enabled ? (
            <div className="mb-4 rounded-xl border border-ink-100 bg-ink-25/40 p-4">
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-500">
                Add {activeItem?.label}
              </p>

              <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr_auto]">
                {/* Name */}
                <div>
                  <label
                    htmlFor="master-name"
                    className="mb-1 block text-[12px] font-medium text-ink-600"
                  >
                    Name <span className="text-coral-500">*</span>
                  </label>
                  <input
                    id="master-name"
                    value={form.name}
                    maxLength={120}
                    onChange={(e) => {
                      set("name", e.target.value);
                      if (!codeTouched)
                        set("code", suggestCode(e.target.value));
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    placeholder="e.g. Nephrology"
                    className={inputClass}
                  />
                </div>

                {/* Code */}
                <div>
                  <label
                    htmlFor="master-code"
                    className="mb-1 flex items-baseline justify-between gap-2 text-[12px] font-medium text-ink-600"
                  >
                    <span>Code</span>
                    {codeTouched && (
                      <button
                        type="button"
                        onClick={() => {
                          setCodeTouched(false);
                          set("code", suggestCode(form.name));
                        }}
                        className="text-[11px] font-medium text-brand-600 hover:underline"
                      >
                        reset
                      </button>
                    )}
                  </label>
                  <input
                    id="master-code"
                    value={form.code}
                    maxLength={50}
                    onChange={(e) => {
                      setCodeTouched(true);
                      set("code", e.target.value.toUpperCase());
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    placeholder="AUTO"
                    className={cn(
                      inputClass,
                      "font-mono text-[13px] uppercase",
                    )}
                  />
                </div>

                {/* Description */}
                <div>
                  <label
                    htmlFor="master-description"
                    className="mb-1 block text-[12px] font-medium text-ink-600"
                  >
                    Description
                  </label>
                  <input
                    id="master-description"
                    value={form.description}
                    maxLength={255}
                    onChange={(e) => set("description", e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    placeholder="Short note (optional)"
                    className={inputClass}
                  />
                </div>

                <Button icon={<Plus />} loading={saving} onClick={handleAdd}>
                  Add
                </Button>
              </div>
            </div>
          ) : (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder={`Add new ${activeItem?.label ?? "value"}…`}
                className={cn(
                  fieldClasses(false),
                  "h-10 min-w-[16rem] flex-1 px-3",
                )}
              />
              <Button icon={<Plus />} onClick={handleAdd}>
                Add
              </Button>
            </div>
          )}

          {/* ── List ──────────────────────────────────────────────────── */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search values…"
              className="min-w-[14rem] flex-1"
            />
            {enabled && (
              <Switch
                checked={showInactive}
                onCheckedChange={setShowInactive}
                label="Show inactive"
                className="shrink-0"
              />
            )}
          </div>

          <DataTable<Row>
            columns={columns}
            rows={rows}
            status={enabled ? status : "ready"}
            error={error}
            onRetry={reload}
            dense
            rowKey={(r) => String(r.id)}
            emptyTitle="No values yet"
            emptyDescription={`Add the first ${activeItem?.label?.toLowerCase()} using the form above.`}
            actions={(row) => (
              <RowActions
                items={[
                  {
                    label: row.active ? "Deactivate" : "Activate",
                    icon: row.active ? <Trash2 /> : <RotateCcw />,
                    tone: row.active ? "danger" : "brand",
                    onClick: () => handleToggle(row),
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
