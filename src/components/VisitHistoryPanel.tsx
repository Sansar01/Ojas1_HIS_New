export function VisitHistoryPanel({ patientId }: { patientId: string | null }) {
  if (!patientId) return null;

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
      <h4 className="mb-4 font-semibold text-ink-900">Previous Visits</h4>
      <div className="space-y-4 text-sm">
        <div className="border-b border-ink-100 pb-3">
          <p className="font-medium text-ink-800">15 Jan 2025 • Dr. Meera Nair</p>
          <p className="text-ink-500">Diagnosis: Acute Bronchitis</p>
        </div>
        <div>
          <p className="font-medium text-ink-800">02 Dec 2024 • Dr. Arjun Rao</p>
          <p className="text-ink-500">Diagnosis: Type 2 Diabetes Review</p>
        </div>
      </div>
    </div>
  );
}