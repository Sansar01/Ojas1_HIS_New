import { useCallback, useMemo, useState } from "react";
import { Layers, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Badge, Button, Panel } from "@/components/ui/primitives";
import { Select, Switch, fieldClasses } from "@/components/ui/fields";
import {
  DataTable,
  RowActions,
  TableToolbar,
  type Column,
} from "@/components/ui/table";
import { Tabs } from "@/components/ui/overlays";
import { PageIntro } from "@/components/common";
import { useAppDispatch } from "@/hooks";
import { useMasterData } from "@/hooks/useMasterData";
import { mastersService, type MasterRecord } from "@/services/mastersService";
import { toast } from "@/features/ui/uiSlice";
import { cn } from "@/utils/cn";

/**
 * Departments admin page.
 *
 * Every tab is the same generic master CRUD, so they all run through the
 * existing `useMasterData` hook + `mastersService`. The only thing that
 * differs per tab is the API slug and whether rows carry a parent.
 */

type TabKey = "departments" | "department-types" | "sub-departments";

const TABS: {
  key: TabKey;
  label: string;
  singular: string;
  /** Parent tab whose rows populate this tab's parent dropdown. */
  parent?: TabKey;
  parentLabel?: string;
}[] = [
  {
    key: "departments",
    label: "Departments",
    singular: "Department",
    parent: "department-types",
    parentLabel: "Type",
  },
  {
    key: "department-types",
    label: "Department Types",
    singular: "Department Type",
  },
  {
    key: "sub-departments",
    label: "Sub Departments",
    singular: "Sub Department",
    parent: "departments",
    parentLabel: "Department",
  },
];

const EMPTY_FORM = { name: "", code: "", description: "", parentId: "" };
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

export default function DepartmentsPage() {
  const [tab, setTab] = useState<TabKey>("departments");
  const active = TABS.find((t) => t.key === tab)!;

  // The parent tab's rows feed this tab's dropdown (types for departments,
  // departments for sub-departments). Both are plain master lists.
  const parentData = useMasterData(
    active.parent
      ? { key: active.parent, label: "", api: active.parent }
      : undefined,
  );

  return (
    <>
      <PageIntro
        title="Departments"
        description="Create departments, classify them by type, and break them down into sub-departments."
        meta={
          <>
            <Badge tone="brand" dot>
              {active.label}
            </Badge>
            <Badge tone="lagoon">Synced with /api/hospital/masters/{tab}</Badge>
          </>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabKey)}
        tabs={TABS.map((t) => ({ value: t.key, label: t.label }))}
        content={
          <div className="pt-4">
            <MasterTab
              key={active.key}
              api={active.key}
              singular={active.singular}
              parentLabel={active.parentLabel}
              parentRows={active.parent ? parentData.rows : undefined}
              onParentChanged={
                active.key === "department-types"
                  ? parentData.reload
                  : undefined
              }
            />
          </div>
        }
      />
    </>
  );
}

/** One tab: add form + searchable list, for a single master slug. */
function MasterTab({
  api,
  singular,
  parentLabel,
  parentRows,
  onParentChanged,
}: {
  api: string;
  singular: string;
  parentLabel?: string;
  parentRows?: MasterRecord[];
  onParentChanged?: () => void;
}) {
  const dispatch = useAppDispatch();
  const { rows, status, error, reload } = useMasterData({
    key: api,
    label: singular,
    api,
  });

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  /** True once the user edits Code themselves — stops auto-suggest overwriting it. */
  const [codeTouched, setCodeTouched] = useState(false);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setCodeTouched(false);
  }, []);

  const parentOptions = useMemo(
    () =>
      (parentRows ?? []).map((r) => ({ value: String(r.id), label: r.name })),
    [parentRows],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => showInactive || r.isActive !== false)
      .filter(
        (r) =>
          !q ||
          r.name?.toLowerCase().includes(q) ||
          r.code?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q),
      );
  }, [rows, search, showInactive]);

  const handleAdd = async () => {
    const name = form.name.trim();
    if (!name) {
      dispatch(toast.warning("Name is required"));
      return;
    }

    const code = form.code.trim().toUpperCase();
    const description = form.description.trim();

    // Send only the keys the user filled in — the API runs with
    // forbidNonWhitelisted, so any stray key is a 400.
    const payload: Partial<MasterRecord> = {
      name,
      ...(code ? { code } : {}),
      ...(description ? { description } : {}),
      ...(form.parentId ? { typeId: Number(form.parentId) } : {}),
    };

    setSaving(true);
    try {
      await mastersService.create(api, payload);
      await reload();
      onParentChanged?.();
      dispatch(toast.success(`${singular} added`, name));
      resetForm();
    } catch (e: any) {
      dispatch(toast.error("Could not save", e?.message));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (row: MasterRecord) => {
    const isActive = row.isActive !== false;
    setTogglingId(row.id);
    try {
      await mastersService.setActive(api, String(row.id), !isActive);
      await reload();
      dispatch(
        isActive
          ? toast.info("Deactivated", row.name)
          : toast.success("Activated", row.name),
      );
    } catch (e: any) {
      dispatch(toast.error("Update failed", e?.message));
    } finally {
      setTogglingId(null);
    }
  };

  const columns: Column<MasterRecord>[] = [
    {
      key: "idx",
      header: "#",
      width: "w-12",
      render: (_r, i) => <span className="text-ink-400">{i + 1}</span>,
    },
    {
      key: "code",
      header: "Code",
      width: "w-36",
      render: (r) => (
        <span className="font-mono text-[12px] text-ink-500">
          {r.code ?? "—"}
        </span>
      ),
    },
    {
      key: "name",
      header: "Name",
      render: (r) => (
        <span className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-25 text-brand-600 ring-1 ring-inset ring-brand-100">
            <Layers className="size-3.5" />
          </span>
          <span className="font-medium text-ink-900">{r.name}</span>
        </span>
      ),
    },
    {
      key: "description",
      header: "Description",
      hideBelow: "lg",
      render: (r) => (
        <span className="line-clamp-1 text-[12.5px] text-ink-500">
          {r.description || "—"}
        </span>
      ),
    },
    ...(parentLabel
      ? [
          {
            key: "parent",
            header: parentLabel,
            width: "w-36",
            hideBelow: "md" as const,
            render: (r: MasterRecord) =>
              r.type?.name ? (
                <Badge tone="brand" size="xs">
                  {r.type.name}
                </Badge>
              ) : (
                <span className="text-[12px] text-ink-300">—</span>
              ),
          },
        ]
      : []),
    {
      key: "status",
      header: "Status",
      width: "w-40",
      render: (r) => (
        // Inline switch: flip active/inactive straight from the list.
        <Switch
          checked={r.isActive !== false}
          disabled={togglingId === r.id}
          onCheckedChange={() => handleToggle(r)}
          label={r.isActive !== false ? "Active" : "Inactive"}
        />
      ),
    },
  ];

  return (
    <Panel>
      {/* ── Add form ───────────────────────────────────────────────── */}
      <div className="border-b border-ink-100 bg-ink-25/40 p-4">
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-500">
          Add {singular}
        </p>

        <div
          className={cn(
            "grid items-end gap-3 sm:grid-cols-2",
            parentLabel
              ? "lg:grid-cols-[1fr_1fr_1.3fr_1fr_auto]"
              : "lg:grid-cols-[1fr_1fr_1.4fr_auto]",
          )}
        >
          <div>
            <label
              htmlFor="dep-name"
              className="mb-1 block text-[12px] font-medium text-ink-600"
            >
              Name <span className="text-coral-500">*</span>
            </label>
            <input
              id="dep-name"
              value={form.name}
              maxLength={120}
              onChange={(e) => {
                set("name", e.target.value);
                if (!codeTouched) set("code", suggestCode(e.target.value));
              }}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={`e.g. ${singular === "Sub Department" ? "Biochemistry" : "Nephrology"}`}
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="dep-code"
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
              id="dep-code"
              value={form.code}
              maxLength={50}
              onChange={(e) => {
                setCodeTouched(true);
                set("code", e.target.value.toUpperCase());
              }}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="AUTO"
              className={cn(inputClass, "font-mono text-[13px] uppercase")}
            />
          </div>

          <div>
            <label
              htmlFor="dep-desc"
              className="mb-1 block text-[12px] font-medium text-ink-600"
            >
              Description
            </label>
            <input
              id="dep-desc"
              value={form.description}
              maxLength={255}
              onChange={(e) => set("description", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Short note (optional)"
              className={inputClass}
            />
          </div>

          {parentLabel && (
            <div>
              <label className="mb-1 block text-[12px] font-medium text-ink-600">
                {parentLabel}
              </label>
              <Select
                value={form.parentId}
                onChange={(v) => set("parentId", v)}
                options={parentOptions}
                placeholder="Select…"
                clearable
              />
            </div>
          )}

          <Button icon={<Plus />} loading={saving} onClick={handleAdd}>
            Add
          </Button>
        </div>

        {parentLabel && parentOptions.length === 0 && (
          <p className="mt-2 text-[11.5px] text-amberly-600">
            No active {parentLabel.toLowerCase()} found — create one in its tab
            first.
          </p>
        )}
      </div>

      {/* ── List ───────────────────────────────────────────────────── */}
      <TableToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder={`Search ${singular.toLowerCase()}…`}
        actions={
          <Switch
            checked={showInactive}
            onCheckedChange={setShowInactive}
            label="Show inactive"
          />
        }
      />

      <DataTable<MasterRecord>
        columns={columns}
        rows={visible}
        status={status}
        error={error}
        onRetry={reload}
        dense
        rowKey={(r) => String(r.id)}
        emptyTitle={`No ${singular.toLowerCase()} yet`}
        emptyDescription={`Add the first ${singular.toLowerCase()} using the form above.`}
        actions={(row) => (
          <RowActions
            items={[
              {
                label: row.isActive !== false ? "Deactivate" : "Activate",
                icon: row.isActive !== false ? <Trash2 /> : <RotateCcw />,
                tone: row.isActive !== false ? "danger" : "brand",
                onClick: () => handleToggle(row),
              },
            ]}
          />
        )}
      />
    </Panel>
  );
}
