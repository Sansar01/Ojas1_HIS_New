import { useMemo, useState } from "react";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { Dialog } from "@/components/ui/overlays";
import { Button, StatusBadge } from "@/components/ui/primitives";
import { SearchInput, fieldClasses } from "@/components/ui/fields";
import { DataTable, RowActions, type Column } from "@/components/ui/table";
import { useAppDispatch } from "@/hooks";
import { useMasterData } from "@/hooks/useMasterData";
import { mastersService } from "@/services/mastersService";
import { toast } from "@/features/ui/uiSlice";
import { cn } from "@/utils/cn";
import {
  GLOBAL_CONFIG_GROUPS,
  type MasterDef,
} from "@/types/masterConfig.data";

type Row = { id: string; code?: string; label: string; active: boolean };

export function GlobalConfiguration({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const dispatch = useAppDispatch();
  const [activeKey, setActiveKey] = useState("department");
  const [newValue, setNewValue] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Local (not-yet-migrated) masters keep their in-memory list.
  const [localValues, setLocalValues] = useState<Record<string, string[]>>(
    () => {
      const seed: Record<string, string[]> = {};
      GLOBAL_CONFIG_GROUPS.forEach((g: any) =>
        g.items.forEach((it: any) => {
          if (it.values) seed[it.key] = [...it.values];
        }),
      );
      return seed;
    },
  );

  const activeItem: MasterDef | undefined = useMemo(
    () =>
      GLOBAL_CONFIG_GROUPS.flatMap((g: any) => g.items).find(
        (i: any) => i.key === activeKey,
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

  const rows: Row[] = useMemo(() => {
    const list: Row[] = enabled
      ? apiRows.map((r: any) => ({
          id: r.id,
          code: r.code,
          label: String(r[activeItem?.labelField ?? "name"] ?? ""),
          active: r.isActive !== false,
        }))
      : (localValues[activeKey] ?? []).map((v, i) => ({
          id: `${activeKey}-${i}`,
          label: v,
          active: true,
        }));

    const q = search.trim().toLowerCase();
    return q
      ? list.filter(
          (r) =>
            r.label.toLowerCase().includes(q) ||
            r.code?.toLowerCase().includes(q),
        )
      : list;
  }, [enabled, apiRows, localValues, activeKey, activeItem, search]);

  const countFor = (def: MasterDef) =>
    def.api === type
      ? enabled
        ? apiRows.length
        : rows.length
      : (localValues[def.key]?.length ?? "—");

  const handleAdd = async () => {
    const value = newValue.trim();
    if (!value) {
      dispatch(toast.warning("Please enter a value"));
      return;
    }
    if (enabled && type) {
      setSaving(true);
      try {
        await mastersService.create(type, {
          code: value.toUpperCase().replace(/\s+/g, "_"),
          name: value,
          isActive: true,
        });
        await reload();
        dispatch(toast.success(`${activeItem?.label} added`, value));
      } catch (e: any) {
        dispatch(toast.error("Could not save", e?.message));
      } finally {
        setSaving(false);
      }
    } else {
      setLocalValues((p) => ({
        ...p,
        [activeKey]: [...(p[activeKey] ?? []), value.toUpperCase()],
      }));
      dispatch(toast.success("Value added"));
    }
    setNewValue("");
  };

  const handleToggle = async (row: Row) => {
    if (enabled && type) {
      try {
        await mastersService.setActive(type, row.id, !row.active);
        await reload();
        dispatch(
          toast.info(row.active ? "Deactivated" : "Activated", row.label),
        );
      } catch (e: any) {
        dispatch(toast.error("Update failed", e?.message));
      }
    } else {
      setLocalValues((p) => ({
        ...p,
        [activeKey]: (p[activeKey] ?? []).filter((v) => v !== row.label),
      }));
      dispatch(toast.info("Value removed"));
    }
  };

  const columns: Column<Row>[] = [
    {
      key: "idx",
      header: "#",
      width: "w-14",
      render: (_r, i) => <span className="text-ink-400">{i + 1}</span>,
    },
    ...(enabled
      ? [
          {
            key: "code",
            header: "Code",
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
      header: "Value",
      render: (r) => (
        <span className="font-medium text-ink-900">{r.label}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.active ? "Active" : "Inactive"} />,
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
          {GLOBAL_CONFIG_GROUPS.map((group: any) => (
            <div key={group.section} className="mb-2">
              <p className="px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.11em] text-ink-400">
                {group.section}
              </p>
              {group.items.map((it: any) => {
                const isActive = activeKey === it.key;
                return (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => {
                      setActiveKey(it.key);
                      setSearch("");
                      setNewValue("");
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

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={`Add new ${activeItem?.label ?? "value"}…`}
              className={cn(
                fieldClasses(false),
                "h-10 min-w-[16rem] flex-1 px-3",
              )}
            />
            <Button icon={<Plus />} loading={saving} onClick={handleAdd}>
              Add
            </Button>
          </div>

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search values…"
            className="mb-4"
          />

          <DataTable<Row>
            columns={columns}
            rows={rows}
            status={enabled ? status : "ready"}
            error={error}
            onRetry={reload}
            dense
            rowKey={(r) => r.id}
            emptyTitle="No values yet"
            emptyDescription={`Add the first ${activeItem?.label?.toLowerCase()} using the field above.`}
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
