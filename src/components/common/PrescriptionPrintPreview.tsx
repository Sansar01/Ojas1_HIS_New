import { HeartPulse, Printer } from "lucide-react";
import { Dialog } from "@/components/ui/overlays";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/utils/cn";
import { HospitalInfo } from "@/types";

type PrescriptionLine = {
  id: string;
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
};

type Vitals = {
  bp?: string;
  pulse?: string;
  temp?: string;
  spo2?: string;
  weight?: string;
};

type PrescriptionPrintPreviewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hospital: HospitalInfo | null;
  patient: {
    fullName?: string;
    uhid?: string;
    age?: string | number;
    gender?: string;
  };
  doctor: {
    firstName?: string;
    lastName?: string;
    qualification?: string;
    registrationNo?: string;
  };
  consultation: {
    consultationNo?: string;
    id?: string;
    startedAt?: string;
    createdAt?: string;
  };
  /* ---------------------- everything the form captures --------------------- */
  lines: PrescriptionLine[];
  /** Vitals recorded at the visit — only the filled ones are printed. */
  vitals?: Vitals;
  chiefComplaint?: string;
  /** "Symptoms & history" */
  history?: string;
  /** "Physical examination" */
  examination?: string;
  diagnosis?: string;
  advice?: string;
  followUpDate?: string;
  /** Optional fixed height for the preview area, e.g. "calc(100vh - 12rem)". Scrolls when the sheet is taller. */
  height?: string;
};

const displayDate = (value?: string) => {
  if (!value) return new Intl.DateTimeFormat("en-GB").format(new Date());
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB").format(date);
};

const doctorName = (doctor: PrescriptionPrintPreviewProps["doctor"]) =>
  `Dr. ${[doctor.firstName, doctor.lastName].filter(Boolean).join(" ") || "Consultant"}`;

/** A titled block: black label, black body, thin black rules. */
function Section({
  label,
  value,
  strong,
}: {
  label: string;
  value?: string;
  strong?: boolean;
}) {
  if (!value || !String(value).trim()) return null;
  return (
    <div className="border-b border-black/25 py-2 last:border-b-0">
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-black">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 whitespace-pre-wrap text-[11.5px] leading-relaxed text-black",
          strong && "font-semibold",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function PrescriptionPrintPreview({
  open,
  onOpenChange,
  hospital,
  patient,
  doctor,
  consultation,
  lines,
  vitals,
  chiefComplaint,
  history,
  examination,
  diagnosis,
  advice,
  followUpDate,
  height,
}: PrescriptionPrintPreviewProps) {
  const prescribed = lines.filter((line) => line.medicine.trim());
  const rows = Array.from(
    { length: Math.max(6, prescribed.length) },
    (_, index) => prescribed[index],
  );
  const consultationNo =
    consultation.consultationNo ||
    `CNS-${consultation.id?.slice(0, 6).toUpperCase() || "—"}`;

  const vitalsList = [
    vitals?.bp ? ["BP", vitals.bp] : null,
    vitals?.pulse ? ["Pulse", `${vitals.pulse}/min`] : null,
    vitals?.temp ? ["Temp", `${vitals.temp} °C`] : null,
    vitals?.spo2 ? ["SpO₂", `${vitals.spo2}%`] : null,
    vitals?.weight ? ["Weight", `${vitals.weight} kg`] : null,
  ].filter(Boolean) as [string, string][];

  const hasClinicalNotes = Boolean(
    [chiefComplaint, history, examination, diagnosis].some(
      (value) => value && String(value).trim(),
    ),
  );

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
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button size="sm" icon={<Printer />} onClick={() => window.print()}>
            Print prescription
          </Button>
        </>
      }
    >
      <article
        className={cn(
          // Every piece of text on this sheet is black; only the rules are grey.
          "prescription-document mx-auto flex w-full max-w-[210mm] flex-col bg-white p-[10mm] text-black shadow-card sm:p-[12mm]",
          height ? "h-[297mm] shrink-0" : "min-h-[297mm]",
        )}
      >
        <header className="border-b-2 border-black pb-3">
          <div className="flex items-start justify-between gap-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg border-2 border-black text-black">
                <HeartPulse className="size-6" />
              </span>
              <div className="min-w-0">
                <h1 className="font-display text-[21px] font-bold leading-tight text-black sm:text-[25px]">
                  {hospital?.name || "Hospital"}
                </h1>
                <p className="mt-1 text-[10px] leading-relaxed text-black sm:text-[11px]">
                  {[hospital?.address, hospital?.city, hospital?.phone]
                    .filter(Boolean)
                    .join(" · ") || "Clinical care, thoughtfully delivered."}
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-[15px] font-bold text-black sm:text-[17px]">
                {doctorName(doctor)}
              </p>
              {doctor.qualification && (
                <p className="mt-1 text-[10px] text-black">
                  {doctor.qualification}
                </p>
              )}
              {doctor.registrationNo && (
                <p className="mt-1 text-[10px] text-black">
                  Reg. No. {doctor.registrationNo}
                </p>
              )}
            </div>
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-x-5 gap-y-3 border-b border-black/40 py-3 sm:grid-cols-5">
          {[
            ["Patient name", patient.fullName || "—"],
            ["UHID", patient.uhid || "—"],
            [
              "Age / sex",
              [patient.age, patient.gender].filter(Boolean).join(" / ") || "—",
            ],
            [
              "Date",
              displayDate(consultation.startedAt || consultation.createdAt),
            ],
            ["Rx no.", consultationNo],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[9px] font-bold uppercase tracking-[0.12em] text-black">
                {label}
              </dt>
              <dd className="mt-1 truncate text-[12px] font-semibold text-black sm:text-[13px]">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        {vitalsList.length > 0 && (
          <section className="border-b border-black/25 py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-black">
              Vitals
            </p>
            <div className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1">
              {vitalsList.map(([label, value]) => (
                <p key={label} className="text-[11.5px] text-black">
                  <span className="font-semibold">{label}</span> {value}
                </p>
              ))}
            </div>
          </section>
        )}

        {hasClinicalNotes && (
          <section className="py-1">
            <Section label="Chief complaint" value={chiefComplaint} />
            <Section label="Symptoms & history" value={history} />
            <Section label="Physical examination" value={examination} />
            <Section label="Diagnosis" value={diagnosis} strong />
          </section>
        )}

        <section className="pt-3">
          <h2 className="flex items-center gap-2 font-display text-[17px] font-bold text-black">
            <span className="text-[26px] font-serif font-normal text-black">℞</span>{" "}
            Medicines prescribed
          </h2>
          <div className="mt-2 border border-black/40">
            <table className="w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-black text-[8px] font-bold uppercase tracking-[0.1em] text-black sm:text-[9px]">
                  <th className="w-[7%] px-2 py-2">#</th>
                  <th className="w-[35%] px-2 py-2">Medicine</th>
                  <th className="w-[14%] px-2 py-2">Dose</th>
                  <th className="w-[28%] px-2 py-2">When to take</th>
                  <th className="w-[16%] px-2 py-2">Days</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((line, index) => (
                  <tr
                    key={line?.id || index}
                    className="h-[34px] border-b border-black/20 align-top text-[10px] text-black last:border-b-0 sm:text-[11px]"
                  >
                    <td className="num px-2 py-2.5">{index + 1}</td>
                    <td className="px-2 py-2.5 font-semibold">
                      {line?.medicine || ""}
                    </td>
                    <td className="num px-2 py-2.5">{line?.dosage || ""}</td>
                    <td className="px-2 py-2.5">
                      <p>{line?.frequency || ""}</p>
                      {line?.instructions && (
                        <p className="mt-0.5 text-[9px] italic">
                          {line.instructions}
                        </p>
                      )}
                    </td>
                    <td className="num px-2 py-2.5">{line?.duration || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {(advice || followUpDate) && (
          <section className="mt-4 border border-black/40 px-3 py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-black">
              Advice & follow-up
            </p>
            {advice && (
              <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-black">
                {advice}
              </p>
            )}
            {followUpDate && (
              <p className="mt-1 text-[11px] font-semibold text-black">
                Follow-up: {displayDate(followUpDate)}
              </p>
            )}
          </section>
        )}

        <footer className="mt-auto flex min-h-[46mm] flex-col justify-end pt-5">
          <div className="ml-auto w-52 border-b border-black pb-1 text-right">
            <p className="font-display text-[16px] font-semibold text-black">
              {doctorName(doctor)}
            </p>
            <p className="mt-0.5 text-[9px] uppercase tracking-[0.1em] text-black">
              Signature & stamp
            </p>
          </div>
          <div className="mt-6 flex justify-between border-t border-black/25 pt-2 text-[8px] text-black">
            <span>
              Valid only with the doctor's signature and hospital stamp.
            </span>
            <span>
              {consultationNo} ·{" "}
              {displayDate(consultation.startedAt || consultation.createdAt)}
            </span>
          </div>
        </footer>
      </article>
    </Dialog>
  );
}
