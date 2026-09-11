import { Badge } from "@/components/ui/primitives";
import { cn } from "@/utils/cn";

interface PatientQueuePanelProps {
  onPatientSelect: (id: string) => void;
  selectedPatientId: string | null;
}

export function PatientQueuePanel({ onPatientSelect, selectedPatientId }: PatientQueuePanelProps) {
  // Dummy Queue Data
  const queuePatients = [
    { id: "p1", name: "Rahul Sharma", mrn: "MRN-240118", age: 45, gender: "Male", status: "Waiting", arrivalTime: "09:15", waitTime: "25 min", complaint: "Chest pain" },
    { id: "p2", name: "Priya Patel", mrn: "MRN-240119", age: 32, gender: "Female", status: "Vitals Done", arrivalTime: "09:30", waitTime: "15 min", complaint: "Fever & cough" },
    { id: "p3", name: "Amit Kumar", mrn: "MRN-240120", age: 58, gender: "Male", status: "Ready for Doctor", arrivalTime: "09:45", waitTime: "10 min", complaint: "Diabetes follow-up" },
    { id: "p4", name: "Sneha Gupta", mrn: "MRN-240121", age: 27, gender: "Female", status: "Consultation", arrivalTime: "10:00", waitTime: "5 min", complaint: "Headache" },
  ];

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
      <h3 className="mb-4 text-lg font-semibold text-ink-900">Patient Queue</h3>

      <div className="space-y-3">
        {queuePatients.map((patient) => (
          <div
            key={patient.id}
            onClick={() => onPatientSelect(patient.id)}
            className={cn(
              "cursor-pointer rounded-xl border p-4 transition-all hover:border-brand-300",
              selectedPatientId === patient.id ? "border-brand-500 bg-brand-25" : "border-ink-100"
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-ink-900">{patient.name}</p>
                <p className="text-sm text-ink-500">{patient.mrn} • {patient.age} yrs • {patient.gender}</p>
              </div>
              <Badge tone={patient.status === "Waiting" ? "amber" : patient.status === "Vitals Done" ? "brand" : patient.status === "Ready for Doctor" ? "mint" : "lagoon"} size="xs">
                {patient.status}
              </Badge>
            </div>
            <div className="mt-2 text-sm text-ink-600">
              <p>Chief Complaint: {patient.complaint}</p>
              <p className="text-xs text-ink-400 mt-1">Arrived: {patient.arrivalTime} • Wait: {patient.waitTime}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}