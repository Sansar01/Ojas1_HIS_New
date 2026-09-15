import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/overlays";
import { Button } from "@/components/ui/primitives";
import { SectionPanel } from "@/components/common";
import { EmptyState } from "@/components/ui/feedback";
import {
  Input,
  NumberInput,
  Select,
  RadioGroup,
  Checkbox,
  SearchInput,
} from "@/components/ui/fields";
import { useAppDispatch } from "@/hooks";
import { toast } from "@/features/ui/uiSlice";
import { cn } from "@/utils/cn";
import { INVESTIGATIONS, YES_NO, toOptions, type ItemType } from "@/types/masterConfig.data";

const SUB_DEPTS = toOptions(["BIOCHEMISTRY", "HEMATOLOGY", "MICROBIOLOGY", "SEROLOGY", "PATHOLOGY"]);
const DEPARTMENTS = toOptions(["ALL", "Biochemistry", "Hematology", "Pathology", "Radiology"]);
const GENDERS = toOptions(["Both", "Male", "Female"]);
const REPORT_TYPES = toOptions(["Path Numeric", "Path Text", "Template"]);
const SAMPLE_TYPES = toOptions(["Blood", "Urine", "Stool", "Swab", "Tissue"]);
const TAT_UNITS = toOptions(["Hours", "Days", "Minutes"]);

const FLAGS = [
  { key: "showNameInReport", label: "Show Name in Patient Report", def: true },
  { key: "showInOnlineReport", label: "Show in Online Report", def: true },
  { key: "printSeparate", label: "Print Separate", def: false },
  { key: "printSampleName", label: "Print Sample Name", def: false },
  { key: "isCulture", label: "Is Culture", def: false },
  { key: "urgent", label: "Urgent", def: false },
  { key: "active", label: "Active", def: true },
  { key: "outsource", label: "Outsource", def: false },
  { key: "profileTest", label: "Profile Test", def: false },
] as const;

export function InvestigationMaster({
  open,
  itemType,
  onOpenChange,
}: {
  open: boolean;
  itemType: ItemType;
  onOpenChange: (v: boolean) => void;
}) {
  const dispatch = useAppDispatch();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [department, setDepartment] = useState("ALL");
  const [subDept, setSubDept] = useState("BIOCHEMISTRY");
  const [sampleType, setSampleType] = useState("");
  const [gender, setGender] = useState("Both");
  const [reportType, setReportType] = useState("Path Numeric");
  const [printSequence, setPrintSequence] = useState(0);
  const [tatTime, setTatTime] = useState("");
  const [tatUnit, setTatUnit] = useState("Hours");
  const [isDiscountable, setIsDiscountable] = useState("no");
  const [rateEditable, setRateEditable] = useState("no");
  const [flags, setFlags] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(FLAGS.map((f) => [f.key, f.def])),
  );
  const [errors, setErrors] = useState<{ investigation?: string; sampleType?: string }>({});

  const typeLabel = itemType ? itemType.charAt(0).toUpperCase() + itemType.slice(1) : "Item";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? INVESTIGATIONS.filter((i:any) => i.toLowerCase().includes(q)) : INVESTIGATIONS;
  }, [search]);

  const handleSave = () => {
    const next: typeof errors = {};
    if (!selected.trim()) next.investigation = "Investigation name is required";
    if (!sampleType) next.sampleType = "Sample type is required";
    setErrors(next);
    if (Object.keys(next).length) {
      dispatch(toast.warning("Please fix the highlighted fields"));
      return;
    }
    dispatch(toast.success("Investigation saved", selected));
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="full"
      title={`Manage Investigations — ${typeLabel}`}
      description="Define investigations, sample requirements and report behaviour"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Investigation</Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-end gap-4 border-b border-ink-100 pb-4">
        <Checkbox
          checked={!selected}
          onCheckedChange={(v) => v && setSelected("")}
          label="New Investigation"
        />
        <Select
          label="Department"
          value={department}
          onChange={setDepartment}
          options={DEPARTMENTS}
          size="sm"
          className="w-52"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        {/* Investigation list */}
        <aside className="rounded-xl border border-ink-100 bg-ink-25/40 p-3">
          <h4 className="mb-3 text-[13px] font-semibold text-ink-900">Investigations</h4>
          <SearchInput value={search} onChange={setSearch} placeholder="Search…" className="mb-3" />
          <div className="max-h-[22rem] space-y-0.5 overflow-y-auto rounded-lg border border-ink-100 bg-white p-1">
            {filtered.length === 0 ? (
              <EmptyState title="No matches" description="Try a different search term." />
            ) : (
              filtered.map((inv:any) => (
                <button
                  key={inv}
                  type="button"
                  onClick={() => setSelected(inv)}
                  className={cn(
                    "w-full rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors",
                    selected === inv
                      ? "bg-brand-50 font-medium text-brand-800"
                      : "text-ink-700 hover:bg-ink-50",
                  )}
                >
                  {inv}
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Detail form */}
        <div className="min-w-0 space-y-5">
          <SectionPanel title="Detail">
            <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
              <Select label="Sub Department" value={subDept} onChange={setSubDept} options={SUB_DEPTS} />
              <Input
                name="investigation"
                label="Investigation"
                required
                value={selected}
                error={errors.investigation}
                onChange={(e) => setSelected(e.target.value)}
              />

              <Input name="description" label="Description" />
              <Input name="method" label="Method" />

              <Select label="Gender" value={gender} onChange={setGender} options={GENDERS} />
              <Select label="Report Type" value={reportType} onChange={setReportType} options={REPORT_TYPES} />

              <Select
                label="Sample Type"
                required
                value={sampleType}
                onChange={setSampleType}
                options={SAMPLE_TYPES}
                error={errors.sampleType}
              />
              <NumberInput label="Print Sequence" value={printSequence} onValueChange={setPrintSequence} max={999} />

              <Input name="lisTestCode" label="LIS Test Code" />
              <div className="grid grid-cols-[1fr_9rem] items-end gap-2">
                <Input name="tatTime" label="TAT Time" value={tatTime} onChange={(e) => setTatTime(e.target.value)} />
                <Select value={tatUnit} onChange={setTatUnit} options={TAT_UNITS} />
              </div>

              <RadioGroup label="Is Discountable" value={isDiscountable} onChange={setIsDiscountable} options={YES_NO} />
              <RadioGroup label="Rate Editable" value={rateEditable} onChange={setRateEditable} options={YES_NO} />
            </div>
          </SectionPanel>

          <SectionPanel title="Other Information">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FLAGS.map((f) => (
                <Checkbox
                  key={f.key}
                  checked={!!flags[f.key]}
                  onCheckedChange={(v) => setFlags((p) => ({ ...p, [f.key]: v }))}
                  label={f.label}
                />
              ))}
            </div>
          </SectionPanel>
        </div>
      </div>
    </Dialog>
  );
}
