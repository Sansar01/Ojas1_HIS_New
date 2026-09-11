import { useForm } from "@/hooks/useForm";
import { FormSection } from "@/components/common";
import { Input, Textarea } from "@/components/ui/fields";
import { Button } from "./ui/primitives";

interface NursingAssessmentPanelProps {
  patientId: string | null;
}

export function NursingAssessmentPanel({ patientId }: NursingAssessmentPanelProps) {
  const form = useForm({
    initialValues: {
      chiefComplaint: "",
      painScore: 0,
      bp: "",
      pulse: "",
      temp: "",
      spo2: "",
      respRate: "",
      weight: "",
      height: "",
      bmi: "",
    },
    schema: {},
  });

  if (!patientId) {
    return (
      <div className="flex h-96 items-center justify-center rounded-2xl border border-ink-100 bg-white">
        <p className="text-ink-400">Select a patient from the queue</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
      <h3 className="mb-6 text-xl font-semibold text-ink-900">Nursing Assessment</h3>

      <FormSection title="Chief Complaint">
        <Textarea name="chiefComplaint" label="Chief Complaint" rows={3} />
      </FormSection>

      <FormSection title="Pain Assessment">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Pain Score (0-10):</span>
          <input type="range" min="0" max="10" value={form.values.painScore} onChange={(e) => form.setValue("painScore", Number(e.target.value))} className="flex-1" />
          <span className="font-bold text-brand-600">{form.values.painScore}</span>
        </div>
      </FormSection>

      <FormSection title="Vital Signs">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Input name="bp" label="Blood Pressure" placeholder="120/80" />
          <Input name="pulse" label="Pulse Rate" placeholder="72" />
          <Input name="temp" label="Temperature" placeholder="36.8" />
          <Input name="spo2" label="SpO₂" placeholder="98" />
          <Input name="respRate" label="Respiratory Rate" placeholder="18" />
          <Input name="weight" label="Weight (kg)" />
          <Input name="height" label="Height (cm)" />
          <Input name="bmi" label="BMI" />
        </div>
      </FormSection>

      <div className="mt-6 flex gap-3">
        <Button variant="outline">Save as Draft</Button>
        <Button>Mark as Ready for Doctor</Button>
      </div>
    </div>
  );
}