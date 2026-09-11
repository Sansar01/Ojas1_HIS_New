export function RiskAlertsPanel({ patientId }: { patientId: string | null }) {
  if (!patientId) return null;

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
      <h4 className="mb-4 font-semibold text-ink-900">Risk Alerts</h4>
      <div className="space-y-3">
        <div className="rounded-lg border border-coral-200 bg-coral-50 p-3">
          <p className="text-sm font-medium text-coral-700">High BP: 140/90 mmHg</p>
        </div>
        <div className="rounded-lg border border-amberly-200 bg-amberly-50 p-3">
          <p className="text-sm font-medium text-amberly-700">Low Grade Fever</p>
        </div>
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
          <p className="text-sm font-medium text-brand-700">Allergy: Penicillin</p>
        </div>
      </div>
    </div>
  );
}