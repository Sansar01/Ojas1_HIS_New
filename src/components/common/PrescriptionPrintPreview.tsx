import { HeartPulse, Printer } from "lucide-react";
import { Dialog } from "@/components/ui/overlays";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/utils/cn";

type PrescriptionLine = {
  id: string;
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
};

type PrescriptionPrintPreviewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hospital: { name?: string; address?: string; city?: string; phone?: string };
  patient: { fullName?: string; uhid?: string; age?: string | number; gender?: string };
  doctor: { firstName?: string; lastName?: string; qualification?: string; registrationNo?: string };
  consultation: { consultationNo?: string; id?: string; startedAt?: string; createdAt?: string };
  lines: PrescriptionLine[];
  advice?: string;
  followUpDate?: string;
  /** Optional fixed height for the preview area, e.g. "calc(100vh - 12rem)". Scrolls when the sheet is taller. */
  height?: string;
};

const displayDate = (value?: string) => {
  if (!value) return new Intl.DateTimeFormat("en-GB").format(new Date());
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB").format(date);
};

const doctorName = (doctor: PrescriptionPrintPreviewProps["doctor"]) =>
  `Dr. ${[doctor.firstName, doctor.lastName].filter(Boolean).join(" ") || "Consultant"}`;

export function PrescriptionPrintPreview({
  open,
  onOpenChange,
  hospital,
  patient,
  doctor,
  consultation,
  lines,
  advice,
  followUpDate,
  height,
}: PrescriptionPrintPreviewProps) {
  const prescribed = lines.filter((line) => line.medicine.trim());
  const rows = Array.from({ length: Math.max(10, prescribed.length) }, (_, index) => prescribed[index]);
  const consultationNo = consultation.consultationNo || `CNS-${consultation.id?.slice(0, 6).toUpperCase() || "—"}`;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Prescription preview"
      description="Review the prescription exactly as it will print."
      size="full"
      className="max-w-[min(62rem,96vw)]"
      height={height}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button size="sm" icon={<Printer />} onClick={() => window.print()}>Print prescription</Button>
        </>
      }
    >
      <article
        className={cn(
          "prescription-document mx-auto flex w-full max-w-[210mm] flex-col bg-white p-[10mm] text-ink-800 shadow-card sm:p-[12mm]",
          height ? "h-[297mm] shrink-0" : "min-h-[297mm]",
        )}
      >
        <header className="border-b-[3px] border-brand-600 pb-4">
          <div className="flex items-start justify-between gap-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-600 text-white"><HeartPulse className="size-7" /></span>
              <div className="min-w-0">
                <h1 className="font-display text-[21px] font-bold leading-tight text-ink-950 sm:text-[26px]">{hospital.name || "Hospital"}</h1>
                <p className="mt-1 text-[10px] leading-relaxed text-ink-500 sm:text-[11px]">{[hospital.address, hospital.city, hospital.phone].filter(Boolean).join(" · ") || "Clinical care, thoughtfully delivered."}</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-[15px] font-bold text-ink-950 sm:text-[17px]">{doctorName(doctor)}</p>
              {doctor.qualification && <p className="mt-1 text-[10px] text-ink-500">{doctor.qualification}</p>}
              {doctor.registrationNo && <p className="mt-1 text-[10px] text-ink-400">Reg. No. {doctor.registrationNo}</p>}
            </div>
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-x-5 gap-y-3 border-b border-ink-300 py-4 sm:grid-cols-5">
          {[
            ["Patient name", patient.fullName || "—"],
            ["UHID", patient.uhid || "—"],
            ["Age / sex", [patient.age, patient.gender].filter(Boolean).join(" / ") || "—"],
            ["Date", displayDate(consultation.startedAt || consultation.createdAt)],
            ["Rx no.", consultationNo],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-400">{label}</dt>
              <dd className="mt-1 truncate text-[12px] font-semibold text-ink-900 sm:text-[13px]">{value}</dd>
            </div>
          ))}
        </dl>

        <section className="pt-4">
          <h2 className="flex items-center gap-2 font-display text-[18px] font-bold text-brand-700"><span className="text-[27px] font-serif font-normal">℞</span> Medicine prescribed</h2>
          <div className="mt-3 overflow-hidden border border-ink-200">
            <table className="w-full table-fixed border-collapse text-left">
              <thead className="bg-ink-900 text-white">
                <tr className="text-[8px] font-bold uppercase tracking-[0.1em] sm:text-[9px]">
                  <th className="w-[8%] px-2 py-2">#</th><th className="w-[32%] px-2 py-2">Medicine</th><th className="w-[13%] px-2 py-2">Dose</th><th className="w-[22%] px-2 py-2">When to take</th><th className="w-[15%] px-2 py-2">Days</th><th className="w-[10%] px-2 py-2">Qty.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((line, index) => (
                  <tr key={line?.id || index} className="h-[36px] border-b border-dashed border-ink-200 last:border-b-0 align-top text-[10px] sm:text-[11px]">
                    <td className="num px-2 py-2.5 text-ink-400">{index + 1}</td>
                    <td className="px-2 py-2.5 font-semibold text-ink-900">{line?.medicine || "—"}</td>
                    <td className="num px-2 py-2.5">{line?.dosage || "—"}</td>
                    <td className="px-2 py-2.5"><p>{line?.frequency || "—"}</p>{line?.instructions && <p className="mt-0.5 text-[9px] text-ink-400">{line.instructions}</p>}</td>
                    <td className="num px-2 py-2.5">{line?.duration || "—"}</td>
                    <td className="num px-2 py-2.5">{line ? "—" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {(advice || followUpDate) && <section className="mt-5 rounded-lg border border-brand-100 bg-brand-25 px-3 py-2.5 text-[10px] sm:text-[11px]"><p className="font-bold uppercase tracking-[0.1em] text-brand-700">Advice & follow-up</p>{advice && <p className="mt-1 leading-relaxed text-ink-700">{advice}</p>}{followUpDate && <p className="mt-1 font-medium text-ink-700">Follow-up: {displayDate(followUpDate)}</p>}</section>}

        <footer className="mt-auto flex min-h-[52mm] flex-col justify-end pt-6">
          <div className="ml-auto w-48 border-b border-ink-400 pb-2 text-right"><p className="font-display text-[17px] font-semibold italic text-brand-700">{doctorName(doctor)}</p><p className="mt-1 text-[10px] font-semibold text-ink-800">{doctorName(doctor)}</p><p className="text-[8px] font-bold uppercase tracking-[0.1em] text-ink-400">Signature & stamp</p></div>
          <div className="mt-8 flex justify-between border-t border-dashed border-ink-300 pt-2 text-[8px] text-ink-400"><span>Valid only with the doctor's signature and hospital stamp.</span><span>{consultationNo} · {displayDate(consultation.startedAt || consultation.createdAt)}</span></div>
        </footer>
      </article>
    </Dialog>
  );
}
