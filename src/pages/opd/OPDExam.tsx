import { useState } from "react";
import { PageIntro } from "@/components/common";
import { PatientQueuePanel } from "@/components/PatientQueuePanel";
import { NursingAssessmentPanel } from "@/components/NursingAssessmentPanel";
import { RiskAlertsPanel } from "@/components/RiskAlertsPanel";
import { VisitHistoryPanel } from "@/components/VisitHistoryPanel";

export function OPDExaminationPage() {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  return (
    <div className="max-w-7xl mx-auto">
      <PageIntro
        title="OPD Examination & Nursing Assessment"
        description="Manage patient queue, vitals, nursing assessment, and clinical documentation."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Panel - Patient Queue */}
        <div className="lg:col-span-3">
          <PatientQueuePanel 
            onPatientSelect={setSelectedPatientId} 
            selectedPatientId={selectedPatientId} 
          />
        </div>

        {/* Center Panel - Nursing Assessment */}
        <div className="lg:col-span-6">
          <NursingAssessmentPanel patientId={selectedPatientId} />
        </div>

        {/* Right Panel - Risk Alerts + History */}
        <div className="lg:col-span-3 space-y-4">
          <RiskAlertsPanel patientId={selectedPatientId} />
          <VisitHistoryPanel patientId={selectedPatientId} />
        </div>
      </div>
    </div>
  );
}