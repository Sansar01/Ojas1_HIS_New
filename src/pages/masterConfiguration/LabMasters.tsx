import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit2, Plus, X } from "lucide-react";
import { Dialog, Tabs } from "@/components/ui/overlays";
import { Button, StatusBadge } from "@/components/ui/primitives";
import {
  Checkbox,
  Input,
  NumberInput,
  SearchInput,
  Select,
} from "@/components/ui/fields";
import { DataTable, RowActions, type Column } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { SectionPanel } from "@/components/common";
import { useAppDispatch } from "@/store/hooks";
import { toast } from "@/store/slices/uiSlice";
import { cn } from "@/utils/cn";

// Lab / specimen masters API — dependency order: departments → sample types → investigations
import {
  masterService,
  type InvestigationPayload,
  type LabDepartmentPayload,
  type SampleTypePayload,
} from "@/pages/masterConfiguration/master.service";
import type {
  InvestigationItem,
  LabDepartmentItem,
  SampleContainerItem,
  SampleTypeItem,
} from "@/types";

/* ------------------------------ constants -------------------------------- */

/** "HEMATOLOGY" → "Hematology", "NUCLEAR_MEDICINE" → "Nuclear Medicine". */
const labelize = (value?: string | null) =>
  value
    ? value
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "—";

const DEPARTMENT_TYPE_OPTIONS = (
  [
    "BIOCHEMISTRY",
    "HEMATOLOGY",
    "MICROBIOLOGY",
    "PATHOLOGY",
    "SEROLOGY",
    "RADIOLOGY",
    "CARDIOLOGY",
    "NUCLEAR_MEDICINE",
    "OTHER",
  ] as const
).map((v) => ({ value: v, label: labelize(v) }));

const STORAGE_TEMP_OPTIONS = (
  [
    "ROOM_TEMPERATURE",
    "REFRIGERATED",
    "FROZEN",
    "DEEP_FROZEN",
  ] as const
).map((v) => ({ value: v, label: labelize(v) }));

/** Reporting formats — backend enum; extend here if the API defines more. */
const REPORTING_FORMAT_OPTIONS = [
  { value: "NUMERIC_TABLE", label: "Numeric Table" },
  { value: "TEXT", label: "Text" },
  { value: "MICROBIOLOGY", label: "Microbiology" },
  { value: "TEMPLATE", label: "Template" },
];

/* --------------------------- code auto-suggest --------------------------- */

/** "Hematology" → "HEM" */
const suggestDeptCode = (name: string) =>
  name.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);

/** "Whole Blood" → "WB" */
const suggestSampleCode = (name: string) =>
  name
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Z0-9]/g, "").slice(0, 1))
    .join("")
    .slice(0, 6);

/** "Urine Protein" → "URINE_PROTEIN" (first two words, max 12 chars) */
const suggestInvCode = (name: string) =>
  name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join("_")
    .slice(0, 12)
    .replace(/_+$/, "");

/**
 * The master APIs answer either as a bare array or as an envelope
 * ({ data: [...] }) — accept both, and drop soft-deleted rows.
 */
const parseRows = <T,>(res: any): T[] => {
  const body = res?.data;
  const rows = Array.isArray(body) ? body : (body?.data ?? []);
  return Array.isArray(rows) ? rows.filter((r) => r && !r.deletedAt) : [];
};

/* ------------------------------- form seeds ------------------------------ */

const EMPTY_DEPT = {
  name: "",
  code: "",
  departmentType: "HEMATOLOGY",
  turnaroundHours: 24,
  allowTemplates: true,
};

const EMPTY_SAMPLE = {
  name: "",
  code: "",
  defaultContainerId: "",
  storageTemp: "REFRIGERATED",
  minVolumeMl: 0,
};

const EMPTY_INVESTIGATION = {
  name: "",
  code: "",
  labDepartmentId: "",
  sampleTypeId: "",
  reportingFormat: "NUMERIC_TABLE",
  outsourceTatHours: 24,
};

/* ========================================================================== */

/**
 * Lab / Radio Masters — the relational master chain behind Item Management:
 *
 *   1. Lab Departments   GET/POST/PATCH  /api/hospital/masters/lab-departments
 *   2. Sample Types      GET/POST        /api/hospital/masters/sample-types
 *                       GET             /api/hospital/masters/sample-containers (dropdown)
 *   3. Investigations   GET/POST/PATCH  /api/hospital/masters/investigations
 *
 * Everything loads once per dialog open, in dependency order; the tabs then
 * work off local state. Endpoints live only in `master.service.ts` (§21).
 */
export function LabMasters({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState("departments");

  /* ------------------------------- masters ------------------------------- */

  const [departments, setDepartments] = useState<LabDepartmentItem[]>([]);
  const [containers, setContainers] = useState<SampleContainerItem[]>([]);
  const [sampleTypes, setSampleTypes] = useState<SampleTypeItem[]>([]);
  const [investigations, setInvestigations] = useState<InvestigationItem[]>([]);

  const [deptLoading, setDeptLoading] = useState(false);
  const [containerLoading, setContainerLoading] = useState(false);
  const [stLoading, setStLoading] = useState(false);
  const [invLoading, setInvLoading] = useState(false);

  const loadDepartments = useCallback(async () => {
    try {
      setDeptLoading(true);
      const response = await masterService.fetchLabDepartments();
      if (response.status === 200)
        setDepartments(parseRows<LabDepartmentItem>(response));
    } catch (e: any) {
      dispatch(toast.error("Failed to load lab departments", e?.message));
    } finally {
      setDeptLoading(false);
    }
  }, [dispatch]);

  const loadContainers = useCallback(async () => {
    try {
      setContainerLoading(true);
      const response = await masterService.fetchSampleContainers();
      if (response.status === 200)
        setContainers(parseRows<SampleContainerItem>(response));
    } catch (e: any) {
      dispatch(toast.error("Failed to load sample containers", e?.message));
    } finally {
      setContainerLoading(false);
    }
  }, [dispatch]);

  const loadSampleTypes = useCallback(async () => {
    try {
      setStLoading(true);
      const response = await masterService.fetchSampleTypes();
      if (response.status === 200)
        setSampleTypes(parseRows<SampleTypeItem>(response));
    } catch (e: any) {
      dispatch(toast.error("Failed to load sample types", e?.message));
    } finally {
      setStLoading(false);
    }
  }, [dispatch]);

  const loadInvestigations = useCallback(async () => {
    try {
      setInvLoading(true);
      const response = await masterService.fetchInvestigations();
      if (response.status === 200)
        setInvestigations(parseRows<InvestigationItem>(response));
    } catch (e: any) {
      dispatch(toast.error("Failed to load investigations", e?.message));
    } finally {
      setInvLoading(false);
    }
  }, [dispatch]);

  /* ------------------------------ form state ----------------------------- */

  // Lab Department (add / edit)
  const [deptForm, setDeptForm] = useState(EMPTY_DEPT);
  const [deptEditingId, setDeptEditingId] = useState<string | null>(null);
  const [deptErrors, setDeptErrors] = useState<
    Partial<Record<keyof typeof EMPTY_DEPT, string>>
  >({});
  const [deptSaving, setDeptSaving] = useState(false);

  // Sample Type (add)
  const [stForm, setStForm] = useState(EMPTY_SAMPLE);
  const [stErrors, setStErrors] = useState<
    Partial<Record<keyof typeof EMPTY_SAMPLE, string>>
  >({});
  const [stSaving, setStSaving] = useState(false);

  // Investigation (add / edit)
  const [invForm, setInvForm] = useState(EMPTY_INVESTIGATION);
  const [invSelectedId, setInvSelectedId] = useState<string | null>(null);
  const [invErrors, setInvErrors] = useState<
    Partial<Record<keyof typeof EMPTY_INVESTIGATION, string>>
  >({});
  const [invSaving, setInvSaving] = useState(false);
  const [invSearch, setInvSearch] = useState("");

  /* -------------------------------- lifecycle ---------------------------- */

  const resetDeptForm = () => {
    setDeptForm(EMPTY_DEPT);
    setDeptEditingId(null);
    setDeptErrors({});
  };
  const resetStForm = () => {
    setStForm(EMPTY_SAMPLE);
    setStErrors({});
  };
  const resetInvForm = () => {
    setInvForm(EMPTY_INVESTIGATION);
    setInvSelectedId(null);
    setInvErrors({});
  };

  // One load per open, in dependency order (departments → sample types →
  // investigations); tabs afterwards work off local state.
  useEffect(() => {
    if (open) {
      loadDepartments();
      loadContainers();
      loadSampleTypes();
      loadInvestigations();
      setTab("departments");
      resetDeptForm();
      resetStForm();
      resetInvForm();
      setInvSearch("");
    }
  }, [
    open,
    loadDepartments,
    loadContainers,
    loadSampleTypes,
    loadInvestigations,
  ]);

  /* ------------------------- STEP 1 · Lab Departments --------------------- */

  const setDept = <K extends keyof typeof EMPTY_DEPT>(
    key: K,
    value: (typeof EMPTY_DEPT)[K],
  ) => {
    setDeptForm((f) => ({ ...f, [key]: value }));
    if (deptErrors[key]) setDeptErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleDeptSave = async () => {
    const code = deptForm.code.toUpperCase().trim();
    const next: typeof deptErrors = {};
    if (!deptForm.name.trim()) next.name = "Name is required";
    if (!code) next.code = "Code is required";
    else if (
      departments.some(
        (d) => d.id !== deptEditingId && d.code.toUpperCase() === code,
      )
    ) {
      next.code = "This code already exists";
    }
    setDeptErrors(next);
    if (Object.keys(next).length) return;

    setDeptSaving(true);
    try {
      const payload: LabDepartmentPayload = {
        name: deptForm.name.trim(),
        code,
        departmentType: deptForm.departmentType,
        turnaroundHours: Number(deptForm.turnaroundHours) || 0,
        allowTemplates: deptForm.allowTemplates,
      };
      if (deptEditingId) {
        await masterService.updateLabDepartment(deptEditingId, payload);
        dispatch(toast.success("Lab department updated"));
      } else {
        await masterService.createLabDepartment(payload);
        dispatch(toast.success("Lab department added"));
      }
      resetDeptForm();
      loadDepartments();
    } catch (error: any) {
      dispatch(toast.error("Could not save lab department", error?.message));
    } finally {
      setDeptSaving(false);
    }
  };

  const deptColumns: Column<LabDepartmentItem>[] = [
    {
      key: "code",
      header: "CODE",
      width: "w-28",
      render: (r) => (
        <span className="font-mono text-[12.5px] font-semibold text-ink-600">
          {r.code}
        </span>
      ),
    },
    {
      key: "name",
      header: "DEPARTMENT NAME",
      render: (r) => (
        <span className="font-medium text-ink-900">{r.name}</span>
      ),
    },
    {
      key: "departmentType",
      header: "TYPE",
      width: "w-40",
      render: (r) => (
        <span className="rounded bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-700">
          {labelize(r.departmentType)}
        </span>
      ),
    },
    {
      key: "turnaroundHours",
      header: "TURNAROUND",
      width: "w-32",
      render: (r) => (
        <span className="text-ink-600">{Number(r.turnaroundHours)} hrs</span>
      ),
    },
    {
      key: "status",
      header: "STATUS",
      width: "w-28",
      render: (r) => (
        <StatusBadge status={r.isActive === false ? "Inactive" : "Active"} />
      ),
    },
  ];

  /* --------------------------- STEP 2 · Sample Types ---------------------- */

  const setSt = <K extends keyof typeof EMPTY_SAMPLE>(
    key: K,
    value: (typeof EMPTY_SAMPLE)[K],
  ) => {
    setStForm((f) => ({ ...f, [key]: value }));
    if (stErrors[key]) setStErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleStSave = async () => {
    const code = stForm.code.toUpperCase().trim();
    const next: typeof stErrors = {};
    if (!stForm.name.trim()) next.name = "Name is required";
    if (!code) next.code = "Code is required";
    else if (sampleTypes.some((s) => s.code.toUpperCase() === code)) {
      next.code = "This code already exists";
    }
    setStErrors(next);
    if (Object.keys(next).length) return;

    setStSaving(true);
    try {
      const payload: SampleTypePayload = {
        name: stForm.name.trim(),
        code,
        storageTemp: stForm.storageTemp,
        // optional fields — sent only when set
        ...(stForm.defaultContainerId
          ? { defaultContainerId: stForm.defaultContainerId }
          : {}),
        ...(stForm.minVolumeMl > 0 ? { minVolumeMl: stForm.minVolumeMl } : {}),
      };
      await masterService.createSampleType(payload);
      dispatch(toast.success("Sample type added"));
      resetStForm();
      loadSampleTypes();
    } catch (error: any) {
      dispatch(toast.error("Could not save sample type", error?.message));
    } finally {
      setStSaving(false);
    }
  };

  const stColumns: Column<SampleTypeItem>[] = [
    {
      key: "code",
      header: "CODE",
      width: "w-24",
      render: (r) => (
        <span className="font-mono text-[12.5px] font-semibold text-ink-600">
          {r.code}
        </span>
      ),
    },
    {
      key: "name",
      header: "SAMPLE TYPE",
      render: (r) => (
        <span className="font-medium text-ink-900">{r.name}</span>
      ),
    },
    {
      key: "container",
      header: "CONTAINER",
      width: "w-40",
      hideBelow: "md",
      render: (r) => (
        <span className="text-ink-600">{r.defaultContainer?.name ?? "—"}</span>
      ),
    },
    {
      key: "storageTemp",
      header: "STORAGE",
      width: "w-36",
      render: (r) => (
        <span className="rounded bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-700">
          {labelize(r.storageTemp)}
        </span>
      ),
    },
    {
      key: "minVolumeMl",
      header: "MIN VOLUME",
      width: "w-32",
      hideBelow: "md",
      render: (r) =>
        Number(r.minVolumeMl) > 0 ? (
          <span className="text-ink-600">{Number(r.minVolumeMl)} mL</span>
        ) : (
          <span className="text-ink-300">—</span>
        ),
    },
    {
      key: "status",
      header: "STATUS",
      width: "w-28",
      render: (r) => (
        <StatusBadge status={r.isActive === false ? "Inactive" : "Active"} />
      ),
    },
  ];

  /* --------------------------- STEP 3 · Investigations -------------------- */

  const setInv = <K extends keyof typeof EMPTY_INVESTIGATION>(
    key: K,
    value: (typeof EMPTY_INVESTIGATION)[K],
  ) => {
    setInvForm((f) => ({ ...f, [key]: value }));
    if (invErrors[key]) setInvErrors((e) => ({ ...e, [key]: undefined }));
  };

  /** Selecting a list item loads its record into the form. */
  const selectInvestigation = (inv: InvestigationItem) => {
    setInvSelectedId(inv.id);
    setInvForm({
      name: inv.name ?? "",
      code: inv.code ?? "",
      labDepartmentId: inv.labDepartmentId ?? inv.labDepartment?.id ?? "",
      sampleTypeId: inv.sampleTypeId ?? inv.sampleType?.id ?? "",
      reportingFormat: inv.reportingFormat ?? "NUMERIC_TABLE",
      outsourceTatHours: Number(inv.outsourceTatHours) || 0,
    });
    setInvErrors({});
  };

  const handleInvSave = async () => {
    const code = invForm.code.toUpperCase().trim();
    const next: typeof invErrors = {};
    if (!invForm.name.trim()) next.name = "Investigation name is required";
    if (!code) next.code = "Code is required";
    else if (
      investigations.some(
        (i) => i.id !== invSelectedId && i.code.toUpperCase() === code,
      )
    ) {
      next.code = "This code already exists";
    }
    if (!invForm.labDepartmentId)
      next.labDepartmentId = "Department is required";
    if (!invForm.sampleTypeId) next.sampleTypeId = "Sample type is required";
    setInvErrors(next);
    if (Object.keys(next).length) {
      dispatch(toast.warning("Please fix the highlighted fields"));
      return;
    }

    setInvSaving(true);
    try {
      // Payload exactly as the investigations API maps it
      const payload: InvestigationPayload = {
        labDepartmentId: invForm.labDepartmentId,
        name: invForm.name.trim(),
        code,
        sampleTypeId: invForm.sampleTypeId,
        reportingFormat: invForm.reportingFormat,
        outsourceTatHours: Number(invForm.outsourceTatHours) || 0,
      };
      if (invSelectedId) {
        await masterService.updateInvestigation(invSelectedId, payload);
        dispatch(toast.success("Investigation updated", payload.name));
      } else {
        await masterService.createInvestigation(payload);
        dispatch(toast.success("Investigation created", payload.name));
      }
      resetInvForm();
      loadInvestigations();
    } catch (error: any) {
      dispatch(toast.error("Could not save investigation", error?.message));
    } finally {
      setInvSaving(false);
    }
  };

  const filteredInvestigations = useMemo(() => {
    const q = invSearch.trim().toLowerCase();
    if (!q) return investigations;
    return investigations.filter(
      (i) =>
        i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q),
    );
  }, [investigations, invSearch]);

  /* --------------------------------- render ------------------------------- */

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="full"
      title="Lab & Radio Masters"
      description="Departments → Sample Types → Investigations — the master chain behind lab services"
      footer={
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      }
    >
      <Tabs
        value={tab}
        onValueChange={setTab}
        variant="pill"
        tabs={[
          {
            value: "departments",
            label: "Lab Departments",
            count: departments.length,
          },
          {
            value: "sample-types",
            label: "Sample Types",
            count: sampleTypes.length,
          },
          {
            value: "investigations",
            label: "Investigations",
            count: investigations.length,
          },
        ]}
        content={
          <div className="pt-5">
            {/* ─── STEP 1 · LAB DEPARTMENTS ──────────────────────────── */}
            {tab === "departments" && (
              <div className="space-y-5">
                <div className="rounded-xl border border-ink-100 bg-ink-25/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-500">
                      {deptEditingId
                        ? "Edit Lab Department"
                        : "Add Lab Department"}
                    </p>
                    {deptEditingId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<X className="h-3.5 w-3.5" />}
                        onClick={resetDeptForm}
                      >
                        Cancel Editing
                      </Button>
                    )}
                  </div>

                  <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Input
                      name="deptName"
                      label="Department Name"
                      required
                      placeholder="e.g. Hematology"
                      value={deptForm.name}
                      error={deptErrors.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setDept("name", name);
                        // Auto-generate code while the user hasn't typed one
                        if (!deptEditingId && !deptForm.code) {
                          setDept("code", suggestDeptCode(name));
                        }
                      }}
                    />
                    <Input
                      name="deptCode"
                      label="Code"
                      required
                      placeholder="e.g. HEM"
                      value={deptForm.code}
                      error={deptErrors.code}
                      onChange={(e) =>
                        setDept("code", e.target.value.toUpperCase())
                      }
                    />
                    <Select
                      label="Department Type"
                      required
                      value={deptForm.departmentType}
                      onChange={(v) => setDept("departmentType", v)}
                      options={DEPARTMENT_TYPE_OPTIONS}
                    />
                    <NumberInput
                      label="Turnaround Time"
                      suffix="hrs"
                      required
                      value={deptForm.turnaroundHours}
                      onValueChange={(v) => setDept("turnaroundHours", v)}
                      min={0}
                      error={deptErrors.turnaroundHours}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <Checkbox
                      checked={deptForm.allowTemplates}
                      onCheckedChange={(v) => setDept("allowTemplates", v)}
                      label="Allow report templates"
                    />
                    <Button
                      icon={<Plus />}
                      loading={deptSaving}
                      onClick={handleDeptSave}
                    >
                      {deptEditingId ? "Update Department" : "Add Department"}
                    </Button>
                  </div>
                </div>

                <DataTable<LabDepartmentItem>
                  columns={deptColumns}
                  rows={departments}
                  status={deptLoading ? "loading" : "ready"}
                  dense
                  rowKey={(r) => r.id}
                  emptyTitle="No Lab Departments"
                  emptyDescription="Add your first lab department using the form above."
                  actions={(row) => (
                    <RowActions
                      items={[
                        {
                          label: "Edit",
                          icon: <Edit2 />,
                          onClick: () => {
                            setDeptEditingId(row.id);
                            setDeptForm({
                              name: row.name,
                              code: row.code,
                              departmentType: String(row.departmentType),
                              turnaroundHours: Number(row.turnaroundHours) || 0,
                              allowTemplates: row.allowTemplates !== false,
                            });
                            setDeptErrors({});
                          },
                        },
                      ]}
                    />
                  )}
                />
              </div>
            )}

            {/* ─── STEP 2 · SAMPLE TYPES ─────────────────────────────── */}
            {tab === "sample-types" && (
              <div className="space-y-5">
                <div className="rounded-xl border border-ink-100 bg-ink-25/40 p-4">
                  <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-500">
                    Add Sample Type
                  </p>

                  <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <Input
                      name="sampleName"
                      label="Sample Name"
                      required
                      placeholder="e.g. Whole Blood"
                      value={stForm.name}
                      error={stErrors.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setSt("name", name);
                        if (!stForm.code) {
                          setSt("code", suggestSampleCode(name));
                        }
                      }}
                    />
                    <Input
                      name="sampleCode"
                      label="Code"
                      required
                      placeholder="e.g. WB"
                      value={stForm.code}
                      error={stErrors.code}
                      onChange={(e) =>
                        setSt("code", e.target.value.toUpperCase())
                      }
                    />
                    <Select
                      label="Default Container"
                      value={stForm.defaultContainerId}
                      onChange={(v) => setSt("defaultContainerId", v)}
                      options={containers.map((c) => ({
                        value: c.id,
                        label: c.name,
                      }))}
                      placeholder="None (optional)"
                      clearable
                      loading={containerLoading}
                      loadingLabel="Loading containers…"
                    />
                    <Select
                      label="Storage Temp"
                      value={stForm.storageTemp}
                      onChange={(v) => setSt("storageTemp", v)}
                      options={STORAGE_TEMP_OPTIONS}
                    />
                    <NumberInput
                      label="Min Volume"
                      suffix="mL"
                      value={stForm.minVolumeMl}
                      onValueChange={(v) => setSt("minVolumeMl", v)}
                      min={0}
                      step={0.5}
                    />
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button icon={<Plus />} loading={stSaving} onClick={handleStSave}>
                      Add Sample Type
                    </Button>
                  </div>
                </div>

                <DataTable<SampleTypeItem>
                  columns={stColumns}
                  rows={sampleTypes}
                  status={stLoading ? "loading" : "ready"}
                  dense
                  rowKey={(r) => r.id}
                  emptyTitle="No Sample Types"
                  emptyDescription="Add your first sample type using the form above."
                />
              </div>
            )}

            {/* ─── STEP 3 · INVESTIGATIONS ───────────────────────────── */}
            {tab === "investigations" && (
              <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
                {/* Left sidebar — investigations list */}
                <aside className="rounded-xl border border-ink-100 bg-ink-25/40 p-3">
                  <Button
                    variant={invSelectedId ? "outline" : "primary"}
                    size="sm"
                    className="mb-3 w-full"
                    icon={<Plus />}
                    onClick={resetInvForm}
                  >
                    New Investigation
                  </Button>
                  <SearchInput
                    value={invSearch}
                    onChange={setInvSearch}
                    placeholder="Search…"
                    className="mb-3"
                  />
                  <div className="max-h-[24rem] space-y-0.5 overflow-y-auto rounded-lg border border-ink-100 bg-white p-1">
                    {invLoading ? (
                      <p className="px-3 py-4 text-center text-[12.5px] text-ink-400">
                        Loading investigations…
                      </p>
                    ) : filteredInvestigations.length === 0 ? (
                      <EmptyState
                        title="No investigations"
                        description={
                          invSearch
                            ? "Try a different search term."
                            : "Create your first investigation from the form."
                        }
                      />
                    ) : (
                      filteredInvestigations.map((inv) => (
                        <button
                          key={inv.id}
                          type="button"
                          onClick={() => selectInvestigation(inv)}
                          className={cn(
                            "w-full rounded-md px-2.5 py-1.5 text-left transition-colors",
                            invSelectedId === inv.id
                              ? "bg-brand-50"
                              : "hover:bg-ink-50",
                          )}
                        >
                          <span
                            className={cn(
                              "block truncate text-[13px]",
                              invSelectedId === inv.id
                                ? "font-medium text-brand-800"
                                : "text-ink-700",
                            )}
                          >
                            {inv.name}
                          </span>
                          <span className="block truncate font-mono text-[11px] text-ink-400">
                            {inv.code}
                            {inv.labDepartment?.name
                              ? ` • ${inv.labDepartment.name}`
                              : ""}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </aside>

                {/* Detail form */}
                <div className="min-w-0 space-y-5">
                  <SectionPanel
                    title={
                      invSelectedId ? "Edit Investigation" : "New Investigation"
                    }
                  >
                    <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
                      <Select
                        label="Department"
                        required
                        value={invForm.labDepartmentId}
                        onChange={(v) => setInv("labDepartmentId", v)}
                        options={departments.map((d) => ({
                          value: d.id,
                          label: d.name,
                        }))}
                        placeholder="Select department…"
                        loading={deptLoading}
                        loadingLabel="Loading departments…"
                        error={invErrors.labDepartmentId}
                      />
                      <Select
                        label="Sample Type"
                        required
                        value={invForm.sampleTypeId}
                        onChange={(v) => setInv("sampleTypeId", v)}
                        options={sampleTypes.map((s) => ({
                          value: s.id,
                          label: s.name,
                        }))}
                        placeholder="Select sample type…"
                        loading={stLoading}
                        loadingLabel="Loading sample types…"
                        error={invErrors.sampleTypeId}
                      />
                      <Input
                        name="invName"
                        label="Investigation"
                        required
                        placeholder="e.g. 24hrs Urine Protein"
                        value={invForm.name}
                        error={invErrors.name}
                        onChange={(e) => {
                          const name = e.target.value;
                          setInv("name", name);
                          if (!invSelectedId && !invForm.code) {
                            setInv("code", suggestInvCode(name));
                          }
                        }}
                      />
                      <Input
                        name="invCode"
                        label="Code"
                        required
                        placeholder="e.g. URINE_PROT"
                        value={invForm.code}
                        error={invErrors.code}
                        onChange={(e) =>
                          setInv("code", e.target.value.toUpperCase())
                        }
                      />
                      <Select
                        label="Reporting Format"
                        value={invForm.reportingFormat}
                        onChange={(v) => setInv("reportingFormat", v)}
                        options={REPORTING_FORMAT_OPTIONS}
                      />
                      <NumberInput
                        label="Outsource TAT"
                        suffix="hrs"
                        value={invForm.outsourceTatHours}
                        onValueChange={(v) => setInv("outsourceTatHours", v)}
                        min={0}
                      />
                    </div>

                    <div className="mt-5 flex justify-end">
                      <Button
                        icon={<Plus />}
                        loading={invSaving}
                        onClick={handleInvSave}
                      >
                        {invSelectedId
                          ? "Update Investigation"
                          : "Create Investigation"}
                      </Button>
                    </div>
                  </SectionPanel>
                </div>
              </div>
            )}
          </div>
        }
      />
    </Dialog>
  );
}
