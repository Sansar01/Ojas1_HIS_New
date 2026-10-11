/**
 * IPD admission form — `/ipd/admissions/new`.
 *
 * One page, one write: `POST /api/ipd/admissions` (CreateAdmissionDto).
 * The body is built to match the DTO exactly — unknown fields are rejected
 * with 400, so empty optionals are omitted rather than sent as "".
 *
 * Reference data reuses the existing feature services:
 *   patientService.fetchPatients()      → patient dropdown
 *   doctorService.fetchDoctors()        → admitting doctor dropdown
 *   masterService.fetchPanelDropdown()  → panel dropdown
 *   ipdService.fetchReferDoctors()      → external refer doctor
 *
 * A bed is optional here (the API can assign it later) and is preselected when
 * the user came from the ward board with `?bedId=…`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IpdFormSkeleton } from "@/components/ui/IpdSkeletons";
import { BedDouble, CheckCircle2 } from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { useForm } from "@/hooks/useForm";
import { toast } from "@/store/slices/uiSlice";
import { Button, Badge, Panel } from "@/components/ui/primitives";
import {
  Checkbox,
  DatePicker,
  Input,
  NumberInput,
  Select,
} from "@/components/ui/fields";
import { PageIntro, FormRow, FormSection } from "@/components/common";
import { patientService } from "@/pages/patients/patient.service";
import { doctorService } from "@/pages/doctors/doctor.service";
import { masterService } from "@/pages/masterConfiguration/master.service";
import { ipdService } from "./ipd.service";
import { ADMISSION_TYPE_OPTIONS } from "./ipd.constants";
import { BedPicker } from "@/components/ui/BedPicker";
import { PendingBackendNote } from "@/components/ui/IpdBits";
import { fullName } from "@/utils";

export function IpdAdmissionFormPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedBedId = searchParams.get("bedId") ?? "";

  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [panels, setPanels] = useState<any[]>([]);
  const [referDoctors, setReferDoctors] = useState<any[]>([]);

  const [patientsLoading, setPatientsLoading] = useState(false);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [panelsLoading, setPanelsLoading] = useState(false);
  const [referDoctorsLoading, setReferDoctorsLoading] = useState(false);

  const [assignBedNow, setAssignBedNow] = useState(!!preselectedBedId);
  const [bedId, setBedId] = useState(preselectedBedId);

  /* ------------------------------ reference ------------------------------- */

  useEffect(() => {
    let active = true;

    const load = async (
      request: Promise<any>,
      apply: (rows: any[]) => void,
      setFlag: (v: boolean) => void,
      unwrapEnvelope = true,
    ) => {
      setFlag(true);
      try {
        const res = await request;
        if (!active || res?.status !== 200) return;
        const body: any = res.data ?? [];
        apply(unwrapEnvelope ? (Array.isArray(body) ? body : (body?.data ?? [])) : body);
      } catch (e: any) {
        dispatch(toast.error("Could not load options", e?.message));
      } finally {
        if (active) setFlag(false);
      }
    };

    void Promise.all([
      load(patientService.fetchPatients(), setPatients, setPatientsLoading),
      load(doctorService.fetchDoctors(), setDoctors, setDoctorsLoading),
      load(
        masterService.fetchPanelDropdown(),
        setPanels,
        setPanelsLoading,
        false,
      ),
      load(
        ipdService.fetchReferDoctors({ isActive: true }),
        setReferDoctors,
        setReferDoctorsLoading,
        false,
      ),
    ]);

    return () => {
      active = false;
    };
  }, [dispatch]);

  /* --------------------------------- form --------------------------------- */

  const form = useForm({
    initialValues: {
      patientId: "",
      doctorProfileId: "",
      referDoctorId: "none",
      panelId: "none",
      admissionType: "EMERGENCY",
      provisionalDiagnosis: "",
      reasonForAdmission: "",
      expectedDischargeDate: "",
      advancePaid: 0,
    },
    schema: {
      patientId: [{ required: "Select the patient being admitted" }],
      doctorProfileId: [{ required: "Select the admitting doctor" }],
      admissionType: [{ required: "Select the admission type" }],
    },
    labels: {
      patientId: "Patient",
      doctorProfileId: "Admitting doctor",
      admissionType: "Admission type",
    },
  });

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === form.values.patientId) ?? null,
    [patients, form.values.patientId],
  );

  const patientOptions = useMemo(
    () =>
      patients.map((p) => ({
        value: p.id,
        label: fullName(p),
        description: [p.uhid ?? p.mrn, p.mobile].filter(Boolean).join(" · "),
      })),
    [patients],
  );

  const doctorOptions = useMemo(
    () =>
      doctors.map((d) => ({
        value: d.id,
        label: `Dr. ${fullName(d)}`,
        description: d.specialization ?? undefined,
        disabled: d.isActive === false,
      })),
    [doctors],
  );

  const panelOptions = useMemo(
    () => [
      { value: "none", label: "Self pay (no panel)" },
      ...panels.map((p: any) => ({
        value: p.id,
        label: p.panelName ?? p.panelCode,
        description: [p.panelCode, p.panelType?.value]
          .filter(Boolean)
          .join(" · "),
      })),
    ],
    [panels],
  );

  const referDoctorOptions = useMemo(
    () => [
      { value: "none", label: "Not referred" },
      ...referDoctors.map((r: any) => ({
        value: r.id,
        label: r.name ?? r.doctorName ?? "Refer doctor",
        description: [r.code, r.clinicHospitalName].filter(Boolean).join(" · "),
      })),
    ],
    [referDoctors],
  );

  const isDaycare = form.values.admissionType === "DAYCARE";

  /* -------------------------------- submit -------------------------------- */

  const handleSubmit = form.handleSubmit(async (values) => {
    const payload = {
      patientId: values.patientId,
      doctorProfileId: values.doctorProfileId,
      admissionType: values.admissionType as any,
      ...(values.referDoctorId && values.referDoctorId !== "none"
        ? { referDoctorId: values.referDoctorId }
        : {}),
      ...(values.panelId && values.panelId !== "none"
        ? { panelId: values.panelId }
        : {}),
      ...(values.provisionalDiagnosis?.trim()
        ? { provisionalDiagnosis: values.provisionalDiagnosis.trim() }
        : {}),
      ...(values.reasonForAdmission?.trim()
        ? { reasonForAdmission: values.reasonForAdmission.trim() }
        : {}),
      ...(values.expectedDischargeDate
        ? { expectedDischargeDate: values.expectedDischargeDate }
        : {}),
      ...(Number(values.advancePaid) > 0
        ? { advancePaid: Number(values.advancePaid) }
        : {}),
      ...(assignBedNow && bedId ? { bedId } : {}),
    };

    try {
      const res = await ipdService.createAdmission(payload as any);
      const body: any = res.data ?? {};
      const saved = body.data ?? body;

      if (saved?.admissionNo) {
        dispatch(
          toast.success(
            "Patient admitted",
            `${saved.admissionNo} · ${saved.bed?.bedIdentifier ?? "bed not assigned"}`,
          ),
        );
      } else {
        dispatch(toast.success("Patient admitted"));
      }

      if (saved?.id) {
        navigate(`/ipd/admissions/${saved.id}`, { replace: true });
      } else {
        navigate("/ipd/admissions", { replace: true });
      }
    } catch (e: any) {
      dispatch(toast.error("Admission failed", e?.message));
    }
  });

  const clearBed = useCallback(() => {
    setBedId("");
  }, []);

  /* -------------------------------- render -------------------------------- */

  /**
   * First paint: jab tak patient/doctor/panel/refer lists aayi nahi, form
   * skeleton dikhao — khaali dropdowns wala half-broken form nahi.
   * Ek bhi list aa gayi to form turant usable ho jata hai (per-field
   * "Loading …" labels ke saath), isliye && condition hai, || nahi.
   */
  const referenceReady =
    patients.length + doctors.length + panels.length + referDoctors.length > 0;
  const referenceLoading =
    patientsLoading || doctorsLoading || panelsLoading || referDoctorsLoading;

  if (referenceLoading && !referenceReady) {
    return (
      <>
        <PageIntro
          title="New IPD admission"
          description="Patient, admitting doctor, panel and bed options load karte hi form yahin aa jata hai."
          module="ipd"
          back
        />
        <IpdFormSkeleton />
      </>
    );
  }

  return (
    <>
      <PageIntro
        title="New IPD admission"
        description="Admit a patient and optionally lock a bed in the same step. The admission number (IPD-YYYY-#####) is generated by the server; daycare admissions are auto-capped at 24 hours."
        module="ipd"
        back
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Panel className="p-5">
          <div className="space-y-8">
            <FormSection
              title="Patient & clinician"
              description="Who is being admitted and under whose care"
            >
              <FormRow>
                <Select
                  name="patientId"
                  label="Patient"
                  required
                  searchable
                  value={form.values.patientId}
                  onChange={(v) => form.setValue("patientId", v)}
                  error={form.errorFor("patientId")}
                  loading={patientsLoading}
                  loadingLabel="Loading patients…"
                  searchPlaceholder="Search name, UHID or mobile…"
                  options={patientOptions}
                  placeholder="Search registered patients…"
                />
                <Select
                  name="admissionType"
                  label="Admission type"
                  required
                  value={form.values.admissionType}
                  onChange={(v) => form.setValue("admissionType", v)}
                  error={form.errorFor("admissionType")}
                  options={ADMISSION_TYPE_OPTIONS}
                />
                <Select
                  name="doctorProfileId"
                  label="Admitting doctor"
                  required
                  searchable
                  value={form.values.doctorProfileId}
                  onChange={(v) => form.setValue("doctorProfileId", v)}
                  error={form.errorFor("doctorProfileId")}
                  loading={doctorsLoading}
                  loadingLabel="Loading doctors…"
                  searchPlaceholder="Search doctor…"
                  options={doctorOptions}
                />
              </FormRow>

              <FormRow>
                <Select
                  name="panelId"
                  label="Panel / insurance"
                  value={form.values.panelId}
                  onChange={(v) => form.setValue("panelId", v)}
                  loading={panelsLoading}
                  loadingLabel="Loading panels…"
                  options={panelOptions}
                  hint="Self pay when left as-is. Panel billing rates arrive with the IPD billing sprint."
                />
                <Select
                  name="referDoctorId"
                  label="Referred by (external doctor)"
                  searchable
                  value={form.values.referDoctorId}
                  onChange={(v) => form.setValue("referDoctorId", v)}
                  loading={referDoctorsLoading}
                  loadingLabel="Loading refer doctors…"
                  options={referDoctorOptions}
                />
                <Input
                  name="provisionalDiagnosis"
                  label="Provisional diagnosis"
                  placeholder="e.g. Acute coronary syndrome"
                  value={form.values.provisionalDiagnosis}
                  onChange={(e) =>
                    form.setValue("provisionalDiagnosis", e.target.value)
                  }
                />
              </FormRow>
            </FormSection>

            <FormSection
              title="Stay planning"
              description="What the doctor advised and when the patient is expected to leave"
            >
              <FormRow>
                <Input
                  name="reasonForAdmission"
                  label="Reason for admission"
                  placeholder="e.g. Chest pain, Troponin 0.8 — angiography planned"
                  value={form.values.reasonForAdmission}
                  onChange={(e) =>
                    form.setValue("reasonForAdmission", e.target.value)
                  }
                />
                <DatePicker
                  label="Expected discharge"
                  value={form.values.expectedDischargeDate}
                  onChange={(v) => form.setValue("expectedDischargeDate", v)}
                  min={new Date().toISOString().slice(0, 10)}
                  hint={
                    isDaycare
                      ? "Optional — the server auto-sets +24h for daycare admissions."
                      : "Optional day-level plan; the discharge workflow still owns the real date."
                  }
                />
                <NumberInput
                  label="Advance payment received (₹)"
                  value={Number(form.values.advancePaid) || 0}
                  onValueChange={(v: number) =>
                    form.setValue("advancePaid", v)
                  }
                  min={0}
                  max={100000000}
                  step={500}
                  hint="Optional. Additional payments need the IPD payment endpoint (next backend sprint)."
                />
              </FormRow>

              {isDaycare && (
                <div className="flex items-center gap-2">
                  <Badge tone="amber" dot>
                    Daycare
                  </Badge>
                  <span className="text-[12px] text-ink-500">
                    Stay is capped at 24 hours by the server; room types flagged
                    as daycare bill per session.
                  </span>
                </div>
              )}
            </FormSection>

            <FormSection
              title="Bed assignment"
              description="Optional now — can be done from the ward board any time"
            >
              <Checkbox
                id="assign-bed-now"
                checked={assignBedNow}
                onCheckedChange={(v) => {
                  setAssignBedNow(v);
                  if (!v) clearBed();
                }}
                label="Assign a bed in this step"
                description="Beds in wards that do not match the patient's gender stay blocked — the server re-checks on save."
              />

              {assignBedNow && (
                <div className="pt-1">
                  {preselectedBedId && bedId === preselectedBedId && (
                    <div className="mb-3 flex items-center gap-2 rounded-lg bg-brand-25 px-3 py-2">
                      <CheckCircle2 className="size-4 text-brand-600" />
                      <span className="text-[12px] font-medium text-brand-700">
                        Bed preselected from the ward board — change it below if
                        needed.
                      </span>
                    </div>
                  )}
                  <BedPicker
                    value={bedId}
                    onChange={(id) => setBedId(id)}
                    patientGender={selectedPatient?.gender ?? null}
                    selectableStatuses={["AVAILABLE", "RESERVED"]}
                  />
                </div>
              )}
            </FormSection>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate("/ipd/admissions")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              icon={<BedDouble />}
              loading={form.submitting}
            >
              Admit patient
            </Button>
          </div>
        </Panel>

        {!assignBedNow && (
          <PendingBackendNote
            title="Charges start only after the IPD billing endpoint ships"
            endpoints={[
              "POST /api/ipd/billing/charges",
              "POST /api/ipd/billing/daily-accrual",
              "POST /api/ipd/admissions/:id/payments",
            ]}
          >
            The admission itself is live: number generation, gender-ward
            enforcement, daycare cap, threshold check on panel. Daily bed/nursing
            charges are added by the backend accrual endpoint (Sprint 1) — until
            then the running bill on the patient chart shows the advance paid
            only.
          </PendingBackendNote>
        )}
      </form>
    </>
  );
}

export default IpdAdmissionFormPage;
