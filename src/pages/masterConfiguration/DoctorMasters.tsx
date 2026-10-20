import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit2, Plus, Trash2, X } from "lucide-react";
import { Dialog, Tabs } from "@/components/ui/overlays";
import { Button, StatusBadge } from "@/components/ui/primitives";
import { Input, NumberInput, Select } from "@/components/ui/fields";
import { DataTable, RowActions, type Column } from "@/components/ui/table";
import { SectionPanel } from "@/components/common";
import { useAppDispatch } from "@/store/hooks";
import { toast } from "@/store/slices/uiSlice";

// Masters API — clinical departments → specializations.
// Doctor profiles live with the doctors feature (see DoctorMasters module note
// below) and hospital users feed the `hospitalUserId` dropdown.
import {
  masterService,
  type ClinicalDepartmentPayload,
  type SpecializationPayload,
} from "@/pages/masterConfiguration/master.service";
import { doctorService } from "@/pages/doctors/doctor.service";
import { userService } from "@/pages/users/user.service";
import type {
  ClinicalDepartmentItem,
  SpecializationMasterItem,
} from "@/types";

/* ------------------------------- constants -------------------------------- */

/**
 * "Cardiology" → "CARD" — clinical-department codes are short caps tags.
 */
const suggestDeptCode = (name: string) =>
  name.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);

/**
 * "Interventional Cardiology" → "INT_CARD" — first word (≤3) + second word
 * (≤4) joined by an underscore, falling back to the first 4 letters.
 */
const suggestSpecCode = (name: string) => {
  const words = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2)
    return `${words[0].slice(0, 3)}_${words[1].slice(0, 4)}`;
  return (words[0] ?? "").slice(0, 4);
};

/**
 * The master APIs answer either as a bare array or as an envelope
 * ({ data: [...] }) — accept both, and drop soft-deleted rows.
 */
const parseRows = <T,>(res: any): T[] => {
  const body = res?.data;
  const rows = Array.isArray(body) ? body : (body?.data ?? []);
  return Array.isArray(rows) ? rows.filter((r) => r && !r.deletedAt) : [];
};

/* ------------------------------- form seeds ------------------------------- */

const EMPTY_CLINICAL_DEPT = {
  name: "",
  code: "",
  description: "",
};

const EMPTY_SPEC = {
  clinicalDepartmentId: "",
  name: "",
  code: "",
};

const EMPTY_DOCTOR = {
  hospitalUserId: "",
  clinicalDepartmentId: "",
  specializationId: "",
  consultationFee: 500,
  slotDurationMins: 15,
};

/**
 * A doctor profile row from GET /api/opd/doctors/list. The backend enriches
 * some fields (user relation, fee, slot policy) — all are treated as optional
 * so the table tolerates older shapes.
 */
interface DoctorProfileRow {
  id: string;
  hospitalUserId?: string;
  /** joined user record when the API includes it */
  user?: { id?: string; firstName?: string; lastName?: string; email?: string };
  firstName?: string;
  lastName?: string;
  email?: string;
  clinicalDepartmentId?: string;
  departmentId?: string;
  specializationId?: string | string[];
  /** The create DTO stores the specialization as a plain name string. */
  specialization?: string;
  consultationFee?: number | string;
  slotDurationMins?: number | string;
  slotDuration?: number | string;
  isActive?: boolean;
  status?: string;
  [key: string]: unknown;
}

/** A staff account returned by GET /api/hospital/users (dropdown source). */
interface HospitalUserRow {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  userType?: string;
  [key: string]: unknown;
}

const displayName = (row: DoctorProfileRow) => {
  const first = row.firstName ?? row.user?.firstName ?? "";
  const last = row.lastName ?? row.user?.lastName ?? "";
  const name = `${first} ${last}`.trim();
  return name || "Doctor";
};

const specLabel = (value: DoctorProfileRow["specializationId"]) => {
  if (Array.isArray(value)) return value[0] ?? "—";
  return value ?? "—";
};

/** A doctor write payload (the shape the create DTO whitelists). */
const doctorCreatePayload = (
  hospitalUserId: string,
  specializationName: string,
  consultationFee: number,
  slotDurationMins: number,
) => ({
  hospitalUserId,
  // The doctors DTO links the specialization as a plain name string — the
  // `clinicalDepartmentId`/`specializationId` id fields are rejected by its
  // strict whitelist. The department is resolved back through the master on
  // display.
  specialization: specializationName,
  consultationFee,
  slotDurationMins,
  isActive: true,
});

/* ========================================================================== */

/**
 * Doctor Management Masters — the master chain behind OPD doctor scheduling:
 *
 *   1. Clinical Departments  GET/POST/PATCH  /api/hospital/masters/clinical-departments
 *   2. Specializations       GET/POST        /api/hospital/masters/specializations
 *                            GET             .../specializations/by-department/:deptId
 *   3. Doctor Profiles       GET             /api/opd/doctors/list
 *                            POST            /api/opd/doctors/create
 *
 * Everything loads once per dialog open, in dependency order; the tabs then
 * work off local state. Endpoints live in `master.service.ts` (masters) and
 * `doctor.service.ts` (doctor profiles) only.
 */
export function DoctorMasters({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState("clinical-departments");

  /* ------------------------------- masters ------------------------------- */

  const [departments, setDepartments] = useState<ClinicalDepartmentItem[]>([]);
  const [specializations, setSpecializations] = useState<
    SpecializationMasterItem[]
  >([]);
  const [doctors, setDoctors] = useState<DoctorProfileRow[]>([]);
  const [users, setUsers] = useState<HospitalUserRow[]>([]);

  const [deptLoading, setDeptLoading] = useState(false);
  const [specLoading, setSpecLoading] = useState(false);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(false);

  const loadClinicalDepartments = useCallback(async () => {
    try {
      setDeptLoading(true);
      const response = await masterService.fetchClinicalDepartments();
      if (response.status === 200)
        setDepartments(parseRows<ClinicalDepartmentItem>(response));
    } catch (e: any) {
      dispatch(toast.error("Failed to load clinical departments", e?.message));
    } finally {
      setDeptLoading(false);
    }
  }, [dispatch]);

  const loadSpecializations = useCallback(async () => {
    try {
      setSpecLoading(true);
      const response = await masterService.fetchSpecializations();
      if (response.status === 200)
        setSpecializations(parseRows<SpecializationMasterItem>(response));
    } catch (e: any) {
      dispatch(toast.error("Failed to load specializations", e?.message));
    } finally {
      setSpecLoading(false);
    }
  }, [dispatch]);

  const loadDoctors = useCallback(async () => {
    try {
      setDoctorLoading(true);
      const response = await doctorService.fetchDoctors();
      if (response.status === 200)
        setDoctors(parseRows<DoctorProfileRow>(response));
    } catch (e: any) {
      dispatch(toast.error("Failed to load doctor profiles", e?.message));
    } finally {
      setDoctorLoading(false);
    }
  }, [dispatch]);

  const loadUsers = useCallback(async () => {
    try {
      setUserLoading(true);
      const response = await userService.fetchUsers();
      if (response.status === 200) setUsers(parseRows<HospitalUserRow>(response));
    } catch (e: any) {
      dispatch(toast.error("Failed to load hospital users", e?.message));
    } finally {
      setUserLoading(false);
    }
  }, [dispatch]);

  /* ------------------------------ form state ----------------------------- */

  // Clinical Department (add / edit)
  const [deptForm, setDeptForm] = useState(EMPTY_CLINICAL_DEPT);
  const [deptEditingId, setDeptEditingId] = useState<string | null>(null);
  const [deptErrors, setDeptErrors] = useState<
    Partial<Record<keyof typeof EMPTY_CLINICAL_DEPT, string>>
  >({});
  const [deptSaving, setDeptSaving] = useState(false);

  // Specialization (add)
  const [specForm, setSpecForm] = useState(EMPTY_SPEC);
  const [specErrors, setSpecErrors] = useState<
    Partial<Record<keyof typeof EMPTY_SPEC, string>>
  >({});
  const [specSaving, setSpecSaving] = useState(false);
  const [specFilter, setSpecFilter] = useState("all");

  // Doctor Profile (add)
  const [doctorForm, setDoctorForm] = useState(EMPTY_DOCTOR);
  const [doctorErrors, setDoctorErrors] = useState<
    Partial<Record<keyof typeof EMPTY_DOCTOR, string>>
  >({});
  const [doctorSaving, setDoctorSaving] = useState(false);
  /** Specializations scoped to the selected clinical department (Step 3). */
  const [deptSpecs, setDeptSpecs] = useState<SpecializationMasterItem[]>([]);
  const [deptSpecsLoading, setDeptSpecsLoading] = useState(false);

  /* -------------------------------- lifecycle ---------------------------- */

  const resetDeptForm = () => {
    setDeptForm(EMPTY_CLINICAL_DEPT);
    setDeptEditingId(null);
    setDeptErrors({});
  };
  const resetSpecForm = () => {
    setSpecForm(EMPTY_SPEC);
    setSpecErrors({});
  };
  const resetDoctorForm = () => {
    setDoctorForm(EMPTY_DOCTOR);
    setDoctorErrors({});
    setDeptSpecs([]);
  };

  // One load per open, in dependency order (departments → specializations →
  // doctors/users); tabs afterwards work off local state.
  useEffect(() => {
    if (open) {
      loadClinicalDepartments();
      loadSpecializations();
      loadDoctors();
      loadUsers();
      setTab("clinical-departments");
      resetDeptForm();
      resetSpecForm();
      resetDoctorForm();
      setSpecFilter("all");
    }
  }, [
    open,
    loadClinicalDepartments,
    loadSpecializations,
    loadDoctors,
    loadUsers,
  ]);

  /* ------------------- STEP 1 · Clinical Departments ---------------------- */

  const setDept = <K extends keyof typeof EMPTY_CLINICAL_DEPT>(
    key: K,
    value: (typeof EMPTY_CLINICAL_DEPT)[K],
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
      const payload: ClinicalDepartmentPayload = {
        name: deptForm.name.trim(),
        code,
      };
      // optional fields — sent only when set
      if (deptForm.description.trim())
        payload.description = deptForm.description.trim();

      if (deptEditingId) {
        await masterService.updateClinicalDepartment(deptEditingId, payload);
        dispatch(toast.success("Clinical department updated", payload.name));
      } else {
        await masterService.createClinicalDepartment(payload);
        dispatch(toast.success("Clinical department added", payload.name));
      }
      resetDeptForm();
      loadClinicalDepartments();
    } catch (error: any) {
      dispatch(
        toast.error("Could not save clinical department", error?.message),
      );
    } finally {
      setDeptSaving(false);
    }
  };

  const handleDeptDelete = async (row: ClinicalDepartmentItem) => {
    try {
      await masterService.deleteClinicalDepartment(row.id);
      setDepartments((rows) => rows.filter((r) => r.id !== row.id));
      dispatch(
        toast.success("Clinical department deleted", row.name),
      );
    } catch (error: any) {
      dispatch(
        toast.error("Could not delete clinical department", error?.message),
      );
    }
  };

  const deptColumns: Column<ClinicalDepartmentItem>[] = [
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
      header: "CLINICAL DEPARTMENT",
      render: (r) => (
        <span className="font-medium text-ink-900">{r.name}</span>
      ),
    },
    {
      key: "description",
      header: "DESCRIPTION",
      hideBelow: "md",
      render: (r) => (
        <span className="text-ink-600">{r.description || "—"}</span>
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

  /* ---------------------- STEP 2 · Specializations ------------------------ */

  const setSpec = <K extends keyof typeof EMPTY_SPEC>(
    key: K,
    value: (typeof EMPTY_SPEC)[K],
  ) => {
    setSpecForm((f) => ({ ...f, [key]: value }));
    if (specErrors[key]) setSpecErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleSpecSave = async () => {
    const code = specForm.code.toUpperCase().trim();
    const next: typeof specErrors = {};
    if (!specForm.name.trim()) next.name = "Name is required";
    if (!code) next.code = "Code is required";
    else if (specializations.some((s) => s.code.toUpperCase() === code)) {
      next.code = "This code already exists";
    }
    if (!specForm.clinicalDepartmentId)
      next.clinicalDepartmentId = "Clinical department is required";
    setSpecErrors(next);
    if (Object.keys(next).length) {
      dispatch(toast.warning("Please fix the highlighted fields"));
      return;
    }

    setSpecSaving(true);
    try {
      const payload: SpecializationPayload = {
        clinicalDepartmentId: specForm.clinicalDepartmentId,
        name: specForm.name.trim(),
        code,
      };
      await masterService.createSpecialization(payload);
      dispatch(toast.success("Specialization added", payload.name));
      resetSpecForm();
      loadSpecializations();
    } catch (error: any) {
      dispatch(toast.error("Could not save specialization", error?.message));
    } finally {
      setSpecSaving(false);
    }
  };

  /**
   * Lookup tables for the three masters. The tables below resolve a department,
   * a specialization and a staff account for EVERY row, and each of those
   * resolutions used to be a `.find()` over the full master list — so one
   * render of the Doctors tab was O(rows × (departments + specializations +
   * users)). The maps are rebuilt only when the master data changes.
   */
  const departmentById = useMemo(() => {
    const map = new Map<string, ClinicalDepartmentItem>();
    for (const d of departments) map.set(d.id, d);
    return map;
  }, [departments]);

  const specializationById = useMemo(() => {
    const map = new Map<string, SpecializationMasterItem>();
    for (const s of specializations) map.set(s.id, s);
    return map;
  }, [specializations]);

  const specializationByName = useMemo(() => {
    const map = new Map<string, SpecializationMasterItem>();
    for (const s of specializations) map.set(s.name.toLowerCase(), s);
    return map;
  }, [specializations]);

  const userById = useMemo(() => {
    const map = new Map<string, HospitalUserRow>();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);

  const deptNameOf = (spec: SpecializationMasterItem) => {
    if (spec.clinicalDepartment?.name) return spec.clinicalDepartment.name;
    return (
      departmentById.get(spec.clinicalDepartmentId)?.name ?? "Unassigned"
    );
  };

  const specColumns: Column<SpecializationMasterItem>[] = [
    {
      key: "code",
      header: "CODE",
      width: "w-32",
      render: (r) => (
        <span className="font-mono text-[12.5px] font-semibold text-ink-600">
          {r.code}
        </span>
      ),
    },
    {
      key: "name",
      header: "SPECIALIZATION",
      render: (r) => (
        <span className="font-medium text-ink-900">{r.name}</span>
      ),
    },
    {
      key: "department",
      header: "CLINICAL DEPARTMENT",
      hideBelow: "md",
      render: (r) => (
        <span className="text-ink-600">{deptNameOf(r)}</span>
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

  /* ----------------------- STEP 3 · Doctor Profiles ----------------------- */

  const setDoctor = <K extends keyof typeof EMPTY_DOCTOR>(
    key: K,
    value: (typeof EMPTY_DOCTOR)[K],
  ) => {
    setDoctorForm((f) => ({ ...f, [key]: value }));
    if (doctorErrors[key]) setDoctorErrors((e) => ({ ...e, [key]: undefined }));
  };

  /**
   * Selecting a clinical department scopes the specialization dropdown through
   * GET …/specializations/by-department/:deptId. If that fetch fails, the
   * already-loaded full list is filtered locally as a fallback.
   */
  const handleDoctorDeptChange = async (deptId: string) => {
    setDoctorForm((f) => ({ ...f, clinicalDepartmentId: deptId, specializationId: "" }));
    if (doctorErrors.clinicalDepartmentId || doctorErrors.specializationId) {
      setDoctorErrors((e) => ({
        ...e,
        clinicalDepartmentId: undefined,
        specializationId: undefined,
      }));
    }
    if (!deptId) {
      setDeptSpecs([]);
      return;
    }
    setDeptSpecsLoading(true);
    try {
      const response = await masterService.fetchSpecializationsByDepartment(
        deptId,
      );
      const rows = parseRows<SpecializationMasterItem>(response);
      setDeptSpecs(
        rows.length
          ? rows
          : specializations.filter((s) => s.clinicalDepartmentId === deptId),
      );
    } catch {
      setDeptSpecs(
        specializations.filter((s) => s.clinicalDepartmentId === deptId),
      );
    } finally {
      setDeptSpecsLoading(false);
    }
  };

  const handleDoctorSave = async () => {
    const next: typeof doctorErrors = {};
    if (!doctorForm.hospitalUserId)
      next.hospitalUserId = "Select the staff (user) account";
    if (!doctorForm.clinicalDepartmentId)
      next.clinicalDepartmentId = "Clinical department is required";
    if (!doctorForm.specializationId)
      next.specializationId = "Specialization is required";
    if (!(Number(doctorForm.consultationFee) > 0))
      next.consultationFee = "Fee must be greater than zero";
    if (!(Number(doctorForm.slotDurationMins) >= 5))
      next.slotDurationMins = "Minimum slot length is 5 minutes";
    setDoctorErrors(next);
    if (Object.keys(next).length) {
      dispatch(toast.warning("Please fix the highlighted fields"));
      return;
    }

    setDoctorSaving(true);
    try {
      const selectedSpec =
        deptSpecs.find((s) => s.id === doctorForm.specializationId) ??
        specializations.find((s) => s.id === doctorForm.specializationId);
      const payload = doctorCreatePayload(
        doctorForm.hospitalUserId,
        selectedSpec?.name ?? "",
        Number(doctorForm.consultationFee),
        Number(doctorForm.slotDurationMins),
      );
      await doctorService.createDoctor(payload);
      dispatch(
        toast.success(
          "Doctor profile created",
          selectedSpec ? selectedSpec.name : undefined,
        ),
      );
      resetDoctorForm();
      loadDoctors();
    } catch (error: any) {
      dispatch(toast.error("Could not create doctor profile", error?.message));
    } finally {
      setDoctorSaving(false);
    }
  };

  /**
   * Resolve a doctor row's specialization against the loaded masters — by id,
   * or by the plain-name string the create DTO stores.
   */
  const resolveSpec = (row: DoctorProfileRow) => {
    const rawId = specLabel(row.specializationId);
    const rawName =
      typeof row.specialization === "string" ? row.specialization : "";
    return (
      specializationById.get(rawId) ??
      (rawName !== ""
        ? specializationByName.get(rawName.toLowerCase())
        : undefined)
    );
  };

  const userNameOf = (id?: string) => {
    const user = id ? userById.get(id) : undefined;
    if (!user) return null;
    return `${[user.firstName, user.lastName].filter(Boolean).join(" ")}${
      user.email ? ` · ${user.email}` : ""
    }`;
  };

  const doctorColumns: Column<DoctorProfileRow>[] = [
    {
      key: "name",
      header: "DOCTOR",
      render: (r) => (
        <div>
          <span className="font-medium text-ink-900">{displayName(r)}</span>
          <p className="mt-0.5 text-[11px] text-ink-400">
            {userNameOf(r.hospitalUserId) ?? (r.user?.email ?? r.email ?? "—")}
          </p>
        </div>
      ),
    },
    {
      key: "department",
      header: "CLINICAL DEPARTMENT",
      hideBelow: "md",
      render: (r) => {
        // The create DTO keeps only the specialization name — the department
        // resolves transitively through the specialization master.
        const spec = resolveSpec(r);
        const dept =
          departmentById.get(r.clinicalDepartmentId ?? r.departmentId ?? "") ??
          (spec?.clinicalDepartmentId
            ? departmentById.get(spec.clinicalDepartmentId)
            : undefined);
        return <span className="text-ink-600">{dept?.name ?? "—"}</span>;
      },
    },
    {
      key: "specialization",
      header: "SPECIALIZATION",
      hideBelow: "lg",
      render: (r) => {
        const spec = resolveSpec(r);
        const fallback =
          typeof r.specialization === "string" && r.specialization
            ? r.specialization
            : specLabel(r.specializationId);
        return (
          <span className="text-ink-600">{spec?.name ?? fallback}</span>
        );
      },
    },
    {
      key: "consultationFee",
      header: "FEE",
      width: "w-28",
      align: "right",
      render: (r) => (
        <span className="num font-medium text-ink-700">
          ₹{Number(r.consultationFee || 0).toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      key: "slotDurationMins",
      header: "SLOT",
      width: "w-20",
      align: "right",
      hideBelow: "md",
      render: (r) => (
        <span className="num text-ink-600">
          {Number(r.slotDurationMins ?? r.slotDuration ?? 15)} min
        </span>
      ),
    },
    {
      key: "status",
      header: "STATUS",
      width: "w-28",
      render: (r) => (
        <StatusBadge
          status={r.status ?? (r.isActive === false ? "Inactive" : "Active")}
        />
      ),
    },
  ];

  /* --------------------------------- render ------------------------------- */

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="full"
      title="Doctor Management"
      description="Clinical Departments → Specializations → Doctor Profiles — the master chain behind OPD doctor scheduling"
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
            value: "clinical-departments",
            label: "Clinical Departments",
            count: departments.length,
          },
          {
            value: "specializations",
            label: "Specializations",
            count: specializations.length,
          },
          { value: "doctors", label: "Doctor Profiles", count: doctors.length },
        ]}
        content={
          <div className="pt-5">
            {/* ─── STEP 1 · CLINICAL DEPARTMENTS ─────────────────────── */}
            {tab === "clinical-departments" && (
              <div className="space-y-5">
                <div className="rounded-xl border border-ink-100 bg-ink-25/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-500">
                      {deptEditingId
                        ? "Edit Clinical Department"
                        : "Add Clinical Department"}
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

                  <div className="grid items-end gap-3 sm:grid-cols-3">
                    <Input
                      name="clinicalDeptName"
                      label="Department Name"
                      required
                      placeholder="e.g. Cardiology"
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
                      name="clinicalDeptCode"
                      label="Code"
                      required
                      placeholder="e.g. CARD"
                      value={deptForm.code}
                      error={deptErrors.code}
                      onChange={(e) =>
                        setDept("code", e.target.value.toUpperCase())
                      }
                    />
                    <Input
                      name="clinicalDeptDescription"
                      label="Description"
                      placeholder="e.g. Heart & Vascular Care"
                      value={deptForm.description}
                      onChange={(e) => setDept("description", e.target.value)}
                    />
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button
                      icon={<Plus />}
                      loading={deptSaving}
                      onClick={handleDeptSave}
                    >
                      {deptEditingId
                        ? "Update Department"
                        : "Add Department"}
                    </Button>
                  </div>
                </div>

                <DataTable<ClinicalDepartmentItem>
                  columns={deptColumns}
                  rows={departments}
                  status={deptLoading ? "loading" : "ready"}
                  dense
                  rowKey={(r) => r.id}
                  emptyTitle="No Clinical Departments"
                  emptyDescription="Add your first clinical department using the form above."
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
                              description: row.description ?? "",
                            });
                            setDeptErrors({});
                          },
                        },
                        {
                          label: "Delete",
                          icon: <Trash2 />,
                          tone: "danger",
                          onClick: () => handleDeptDelete(row),
                        },
                      ]}
                    />
                  )}
                />
              </div>
            )}

            {/* ─── STEP 2 · SPECIALIZATIONS ─────────────────────────── */}
            {tab === "specializations" && (
              <div className="space-y-5">
                <div className="rounded-xl border border-ink-100 bg-ink-25/40 p-4">
                  <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-500">
                    Add Specialization
                  </p>

                  <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Select
                      label="Clinical Department"
                      required
                      value={specForm.clinicalDepartmentId}
                      onChange={(v) => setSpec("clinicalDepartmentId", v)}
                      options={departments.map((d) => ({
                        value: d.id,
                        label: d.name,
                      }))}
                      placeholder="Select department…"
                      loading={deptLoading}
                      loadingLabel="Loading departments…"
                      error={specErrors.clinicalDepartmentId}
                    />
                    <Input
                      name="specName"
                      label="Specialization Name"
                      required
                      placeholder="e.g. Interventional Cardiology"
                      value={specForm.name}
                      error={specErrors.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setSpec("name", name);
                        if (!specForm.code) {
                          setSpec("code", suggestSpecCode(name));
                        }
                      }}
                    />
                    <Input
                      name="specCode"
                      label="Code"
                      required
                      placeholder="e.g. INT_CARD"
                      value={specForm.code}
                      error={specErrors.code}
                      onChange={(e) =>
                        setSpec("code", e.target.value.toUpperCase())
                      }
                    />
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button
                      icon={<Plus />}
                      loading={specSaving}
                      onClick={handleSpecSave}
                    >
                      Add Specialization
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <Select
                    size="sm"
                    className="w-[14rem]"
                    label="Filter by department"
                    value={specFilter}
                    onChange={setSpecFilter}
                    options={[
                      { value: "all", label: "All departments" },
                      ...departments.map((d) => ({
                        value: d.id,
                        label: d.name,
                      })),
                    ]}
                  />
                </div>

                <DataTable<SpecializationMasterItem>
                  columns={specColumns}
                  rows={
                    specFilter === "all"
                      ? specializations
                      : specializations.filter(
                          (s) => s.clinicalDepartmentId === specFilter,
                        )
                  }
                  status={specLoading ? "loading" : "ready"}
                  dense
                  rowKey={(r) => r.id}
                  emptyTitle="No Specializations"
                  emptyDescription="Add your first specialization using the form above."
                />
              </div>
            )}

            {/* ─── STEP 3 · DOCTOR PROFILES ─────────────────────────── */}
            {tab === "doctors" && (
              <div className="space-y-5">
                <SectionPanel title="New Doctor Profile">
                  <p className="mb-3 text-[12px] text-ink-500">
                    Link an existing hospital user to a clinical department +
                    specialization, then set the visiting fee and slot policy.
                  </p>
                  <div className="grid items-end gap-x-5 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
                    <Select
                      label="Hospital User"
                      required
                      value={doctorForm.hospitalUserId}
                      onChange={(v) => setDoctor("hospitalUserId", v)}
                      options={users.map((u) => ({
                        value: u.id,
                        label: `${[u.firstName, u.lastName]
                          .filter(Boolean)
                          .join(" ")}${
                          u.userType ? ` (${u.userType})` : ""
                        }`,
                      }))}
                      placeholder="Select existing user…"
                      loading={userLoading}
                      loadingLabel="Loading users…"
                      error={doctorErrors.hospitalUserId}
                    />
                    <Select
                      label="Clinical Department"
                      required
                      value={doctorForm.clinicalDepartmentId}
                      onChange={handleDoctorDeptChange}
                      options={departments.map((d) => ({
                        value: d.id,
                        label: d.name,
                      }))}
                      placeholder="Select department…"
                      loading={deptLoading}
                      loadingLabel="Loading departments…"
                      error={doctorErrors.clinicalDepartmentId}
                    />
                    <Select
                      label="Specialization"
                      required
                      value={doctorForm.specializationId}
                      onChange={(v) => setDoctor("specializationId", v)}
                      options={deptSpecs.map((s) => ({
                        value: s.id,
                        label: s.name,
                      }))}
                      placeholder={
                        doctorForm.clinicalDepartmentId
                          ? "Select specialization…"
                          : "Select department first…"
                      }
                      disabled={!doctorForm.clinicalDepartmentId}
                      loading={deptSpecsLoading}
                      loadingLabel="Loading specializations…"
                      error={doctorErrors.specializationId}
                    />
                    <NumberInput
                      label="Consultation Fee"
                      required
                      suffix="₹"
                      value={doctorForm.consultationFee}
                      onValueChange={(v) => setDoctor("consultationFee", v)}
                      min={0}
                      step={50}
                      error={doctorErrors.consultationFee}
                    />
                    <NumberInput
                      label="Slot Duration"
                      required
                      suffix="min"
                      value={doctorForm.slotDurationMins}
                      onValueChange={(v) => setDoctor("slotDurationMins", v)}
                      min={5}
                      max={120}
                      step={5}
                      error={doctorErrors.slotDurationMins}
                    />
                    <div className="flex items-end justify-end">
                      <Button
                        icon={<Plus />}
                        loading={doctorSaving}
                        onClick={handleDoctorSave}
                      >
                        Add Doctor Profile
                      </Button>
                    </div>
                  </div>
                </SectionPanel>

                <DataTable<DoctorProfileRow>
                  columns={doctorColumns}
                  rows={doctors}
                  status={doctorLoading ? "loading" : "ready"}
                  dense
                  rowKey={(r) => r.id}
                  emptyTitle="No Doctor Profiles"
                  emptyDescription="Create the first doctor profile using the form above."
                />
              </div>
            )}
          </div>
        }
      />
    </Dialog>
  );
}
