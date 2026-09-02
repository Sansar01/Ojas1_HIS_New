import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Archive,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Clock,
  DollarSign,
  HeartPulse,
  Stethoscope,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { cn } from "@/utils/cn";
import { addDays } from "@/data/db";
import {
  formatCompact,
  formatDate,
  formatMoney,
  fullName,
  relativeTime,
} from "@/utils";
import { usePermission, useRootSelector } from "@/hooks";
import {
  Badge,
  Panel,
  PanelHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { CardSkeleton } from "@/components/ui/feedback";
import { MiniList, SectionPanel } from "@/components/common";
import { invoiceTotals } from "@/utils";
import { APPT_TYPE_COLORS } from "@/constants";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
);

const GRID = { color: "rgba(45,78,86,.08)", drawBorder: false } as const;
const FONT = { family: "'IBM Plex Sans', sans-serif", size: 11 } as const;

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

function KpiCard({
  label,
  value,
  icon,
  tone = "brand",
  suffix,
  hint,
  to,
  trend,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "brand" | "mint" | "amber" | "coral" | "lagoon" | "ink";
  suffix?: string;
  hint?: React.ReactNode;
  to?: string;
  trend?: number;
}) {
  const animated = useCountUp(value);
  const tones = {
    brand: "from-brand-500/12 text-brand-600",
    mint: "from-mint-500/12 text-mint-600",
    amber: "from-amberly-500/14 text-amberly-600",
    coral: "from-coral-500/12 text-coral-600",
    lagoon: "from-lagoon-500/12 text-lagoon-600",
    ink: "from-ink-900/10 text-ink-700",
  }[tone];
  const body = (
    <div className="group relative h-full overflow-hidden rounded-xl border border-ink-100 bg-white p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-pop">
      <div
        className={cn(
          "absolute inset-x-0 -top-10 h-24 bg-gradient-to-b to-transparent opacity-70",
          tones.split(" ")[0],
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-400">
          {label}
        </p>
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg bg-ink-25 ring-1 ring-inset ring-ink-100 [&>svg]:size-4",
            tones.split(" ")[1],
            "transition-transform duration-300 group-hover:scale-110",
          )}
        >
          {icon}
        </span>
      </div>
      <p className="num relative mt-3 text-[30px] font-bold leading-none text-ink-900">
        {formatCompact(animated)}
        {suffix && (
          <span className="ml-0.5 text-[15px] font-semibold text-ink-400">
            {suffix}
          </span>
        )}
      </p>
      <div className="relative mt-2.5 flex items-center justify-between gap-2">
        <span className="text-[11.5px] text-ink-400">{hint}</span>
        {trend !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold",
              trend >= 0
                ? "bg-mint-50 text-mint-600"
                : "bg-coral-50 text-coral-600",
            )}
          >
            <TrendingUp className={cn("size-3", trend < 0 && "rotate-180")} />
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      {to && (
        <span className="absolute bottom-3 right-3 translate-y-1 text-[11px] font-semibold text-brand-600 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          Open <ArrowUpRight className="inline size-3" />
        </span>
      )}
    </div>
  );
  return to ? (
    <Link to={to} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { can, canCreate, isSuperAdmin } = usePermission();
  const patients = useRootSelector((s) => s.patients.items);
  const doctors = useRootSelector((s) => s.doctors.items);
  const appointments = useRootSelector((s) => s.appointments.items);
  const consultations = useRootSelector((s) => s.consultations.items);
  const invoices = useRootSelector((s) => s.invoices.items);
  const activities = useRootSelector((s) => s.activities.items);
  const departments = useRootSelector((s) => s.departments.items);
  const loading = useRootSelector((s) => s.appointments.status) === "loading";

  const today = addDays(new Date(), 0);
  const patientMap = useMemo(
    () => new Map(patients.map((p: any) => [p.id, p])),
    [patients],
  );
  const doctorMap = useMemo(
    () => new Map(doctors.map((d: any) => [d.id, d])),
    [doctors],
  );

  const todaysAppointments = appointments.filter((a: any) => a.date === today);
  const completed = consultations.filter((c: any) => c.status === "Completed");
  const pendingConsultations = consultations.filter(
    (c: any) => c.status !== "Completed",
  );

  const totals = useMemo(() => {
    const sums = invoices.map((inv: any) => ({ inv, t: invoiceTotals(inv) }));
    const revenue = sums.reduce((s, x) => s + x.t.paid, 0);
    const outstanding = sums
      .filter(
        (x) =>
          x.inv.paymentStatus === "Pending" ||
          x.inv.paymentStatus === "Partially Paid",
      )
      .reduce((s, x) => s + x.t.remaining, 0);
    return { revenue, outstanding, invoiceCount: sums.length };
  }, [invoices]);

  const trendSeries = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) =>
      addDays(new Date(), i - 13),
    );
    return {
      labels: days.map((d) =>
        new Date(d).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
        }),
      ),
      booked: days.map(
        (d) =>
          appointments.filter(
            (a: any) =>
              a.date === d && !["Cancelled", "No Show"].includes(a.status),
          ).length,
      ),
      completed: days.map(
        (d) =>
          appointments.filter(
            (a: any) => a.date === d && a.status === "Completed",
          ).length,
      ),
    };
  }, [appointments]);

  const statusMix = useMemo(() => {
    const buckets = [
      "Scheduled",
      "Confirmed",
      "Checked In",
      "In Progress",
      "Completed",
      "Cancelled",
      "No Show",
    ];
    return {
      labels: buckets,
      values: buckets.map(
        (b) => appointments.filter((a: any) => a.status === b).length,
      ),
    };
  }, [appointments]);

  const deptLoad = useMemo(() => {
    const rows = departments
      .filter((d: any) => d.status === "active")
      .map((d: any) => ({
        label: d.name,
        value: appointments.filter(
          (a: any) =>
            a.departmentId === d.id && a.date >= addDays(new Date(), -30),
        ).length,
      }));
    return {
      labels: rows.map((r) => r.label),
      values: rows.map((r) => r.value),
    };
  }, [departments, appointments]);

  const occupancy = todaysAppointments.length
    ? Math.round(
        (todaysAppointments.filter((a: any) =>
          ["Completed", "In Progress", "Checked In"].includes(a.status),
        ).length /
          todaysAppointments.length) *
          100,
      )
    : 0;

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const timeline = [...todaysAppointments].sort((a: any, b: any) =>
    a.time.localeCompare(b.time),
  );

  const upcoming = appointments
    .filter(
      (a: any) =>
        a.date > today && ["Scheduled", "Confirmed"].includes(a.status),
    )
    .sort((a: any, b: any) =>
      `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
    )
    .slice(0, 6);

  if (loading && !patients.length) {
    return (
      <div className="space-y-4">
        <CardSkeleton count={4} />
        <div className="grid gap-4 lg:grid-cols-3">
          <CardSkeleton count={1} />
          <CardSkeleton count={1} />
          <CardSkeleton count={1} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* command banner */}
      <div className="relative overflow-hidden rounded-2xl bg-ink-950 px-5 py-5 text-white shadow-pop sm:px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_10%,rgba(64,190,174,.28),transparent_45%),radial-gradient(circle_at_8%_120%,rgba(61,111,209,.28),transparent_42%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-200">
              <HeartPulse className="size-3.5 animate-pulse-soft" /> Facility
              overview ·{" "}
              {formatDate(today, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <h2 className="mt-2 font-display text-[26px] font-bold leading-tight sm:text-[30px]">
              {todaysAppointments.length} appointments on the floor today
            </h2>
            <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-white/55">
              {occupancy}% of today's schedule is already in motion ·{" "}
              {pendingConsultations.length} consultations awaiting closure ·{" "}
              {formatMoney(totals.outstanding)} awaiting settlement.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canCreate("appointments") && (
              <button
                onClick={() => navigate("/app/appointments?new=1")}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3.5 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-brand-400 hover:shadow-[0_14px_28px_-16px_rgba(64,190,174,.95)]"
              >
                <CalendarPlus className="size-4" /> Book appointment
              </button>
            )}
            {canCreate("patients") && (
              <button
                onClick={() => navigate("/app/patients?new=1")}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/8 px-3.5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/14"
              >
                <UserPlus className="size-4" /> Register patient
              </button>
            )}
            {canCreate("billing") && (
              <button
                onClick={() => navigate("/app/billing?new=1")}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/8 px-3.5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/14"
              >
                <DollarSign className="size-4" /> New invoice
              </button>
            )}
            {isSuperAdmin && (
              <Link
                to="/app/users"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/8 px-3.5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/14"
              >
                <Users className="size-4" /> Manage access
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {can("patients", "view") && (
          <KpiCard
            label="Total patients"
            value={patients.length}
            icon={<Users />}
            tone="brand"
            trend={12}
            hint="Registered in the facility directory"
            to="/app/patients"
          />
        )}
        {can("doctors", "view") && (
          <KpiCard
            label="Doctors"
            value={doctors.filter((d: any) => d.status === "active").length}
            icon={<Stethoscope />}
            tone="lagoon"
            trend={4}
            hint={`${doctors.length - doctors.filter((d: any) => d.status === "active").length} on leave / inactive`}
            to="/app/doctors"
          />
        )}
        <KpiCard
          label="Today's appointments"
          value={todaysAppointments.length}
          icon={<CalendarClock />}
          tone="amber"
          hint={`${todaysAppointments.filter((a: any) => a.status === "Confirmed").length} confirmed · ${todaysAppointments.filter((a: any) => a.status === "Checked In").length} checked in`}
          trend={9}
        />
        <KpiCard
          label="Total appointments"
          value={appointments.length}
          icon={<Archive />}
          tone="ink"
          hint="Last 25 days of scheduling"
          to="/app/appointments"
        />
        {can("consultations", "view") && (
          <KpiCard
            label="Completed consultations"
            value={completed.length}
            icon={<CheckCircle2 />}
            tone="mint"
            trend={18}
            hint="Signed off with prescription notes"
            to="/app/consultations"
          />
        )}
        {can("consultations", "view") && (
          <KpiCard
            label="Pending consultations"
            value={pendingConsultations.length}
            icon={<ClipboardList />}
            tone="coral"
            hint="Awaiting doctor closure"
            to="/app/consultations"
          />
        )}
        {can("billing", "view") && (
          <KpiCard
            label="Total revenue"
            value={Math.round(totals.revenue)}
            icon={<Banknote />}
            tone="brand"
            suffix="₹"
            hint={`${totals.invoiceCount} invoices raised`}
            trend={7}
            to="/app/billing"
          />
        )}
        {can("billing", "view") && (
          <KpiCard
            label="Pending payments"
            value={Math.round(totals.outstanding)}
            icon={<Clock />}
            tone="amber"
            suffix="₹"
            hint="Outstanding balance across payers"
            to="/app/billing"
          />
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* appointment flow chart */}
        <Panel className="xl:col-span-2">
          <PanelHeader
            title="Appointment flow · last 14 days"
            subtitle="Bookings against completed visits — refreshed from the scheduling engine"
            icon={<TrendingUp />}
            action={
              <Badge tone="brand">
                {
                  appointments.filter(
                    (a: any) => !["Cancelled", "No Show"].includes(a.status),
                  ).length
                }{" "}
                valid visits
              </Badge>
            }
          />
          <div className="p-4">
            <Line
              data={{
                labels: trendSeries.labels,
                datasets: [
                  {
                    label: "Booked",
                    data: trendSeries.booked,
                    borderColor: "#0f8377",
                    backgroundColor: (ctx) => {
                      const chart = ctx.chart;
                      const { ctx: c, chartArea } = chart as any;
                      if (!chartArea) return "rgba(15,131,119,.16)";
                      const g = c.createLinearGradient(
                        0,
                        chartArea.top,
                        0,
                        chartArea.bottom,
                      );
                      g.addColorStop(0, "rgba(30,158,144,.32)");
                      g.addColorStop(1, "rgba(30,158,144,0)");
                      return g;
                    },
                    fill: true,
                    tension: 0.38,
                    borderWidth: 2.4,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointBackgroundColor: "#0f8377",
                  },
                  {
                    label: "Completed",
                    data: trendSeries.completed,
                    borderColor: "#3d6fd1",
                    backgroundColor: "rgba(61,111,209,.14)",
                    borderWidth: 2,
                    borderDash: [5, 4],
                    tension: 0.38,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                  legend: {
                    position: "bottom",
                    align: "end",
                    labels: {
                      boxWidth: 8,
                      usePointStyle: true,
                      font: FONT,
                      color: "#4f6a71",
                      padding: 14,
                    },
                  },
                },
                scales: {
                  x: {
                    grid: { display: false },
                    ticks: {
                      font: FONT,
                      color: "#93a8ad",
                      maxRotation: 0,
                      autoSkipPadding: 16,
                    },
                    border: GRID,
                  },
                  y: {
                    beginAtZero: true,
                    grid: GRID,
                    ticks: { font: FONT, color: "#93a8ad", precision: 0 },
                    border: { display: false },
                  },
                },
              }}
              height={210}
            />
          </div>
        </Panel>

        {/* status mix */}
        <Panel>
          <PanelHeader
            title="Status mix"
            subtitle="Live distribution of scheduled visits"
            icon={<BadgeCheck />}
          />
          <div className="flex flex-col items-center gap-4 p-4">
            <div className="relative w-full max-w-[15rem]">
              <Doughnut
                data={{
                  labels: statusMix.labels,
                  datasets: [
                    {
                      data: statusMix.values,
                      backgroundColor: [
                        "#a9eae0",
                        "#0f8377",
                        "#e08600",
                        "#3d6fd1",
                        "#1f9d63",
                        "#d94a4a",
                        "#bccacd",
                      ],
                      borderWidth: 2,
                      borderColor: "#ffffff",
                      hoverOffset: 8,
                    },
                  ],
                }}
                options={{
                  cutout: "68%",
                  maintainAspectRatio: true,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      bodyFont: FONT,
                      callbacks: {
                        label: (c: any) => ` ${c.label}: ${c.parsed}`,
                      },
                    },
                  },
                }}
              />
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <p className="num text-[22px] font-bold leading-none text-ink-900">
                    {appointments.length}
                  </p>
                  <p className="text-[10.5px] uppercase tracking-[0.12em] text-ink-400">
                    total
                  </p>
                </div>
              </div>
            </div>
            <ul className="grid w-full grid-cols-2 gap-x-3 gap-y-1.5">
              {statusMix.labels.map((label, i) => (
                <li
                  key={label}
                  className="flex items-center justify-between gap-2 text-[11.5px]"
                >
                  <span className="flex min-w-0 items-center gap-1.5 text-ink-500">
                    <span
                      className="size-2 shrink-0 rounded-[3px]"
                      style={{
                        background: [
                          "#a9eae0",
                          "#0f8377",
                          "#e08600",
                          "#3d6fd1",
                          "#1f9d63",
                          "#d94a4a",
                          "#bccacd",
                        ][i],
                      }}
                    />
                    <span className="truncate">{label}</span>
                  </span>
                  <span className="num font-semibold text-ink-800">
                    {statusMix.values[i]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* today's floor schedule */}
        <SectionPanel
          title="Today on the floor"
          subtitle={`${timeline.length} slots across ${new Set(timeline.map((t: any) => t.doctorId)).size} clinicians`}
          icon={<CalendarClock />}
          className="xl:col-span-2"
          bodyClass="p-0"
          action={
            <Link
              to="/app/appointments"
              className="text-[12px] font-semibold text-brand-600 hover:underline"
            >
              Open scheduler
            </Link>
          }
        >
          {timeline.length === 0 ? (
            <MiniList rows={[]} emptyLabel="No appointments booked for today" />
          ) : (
            <ol className="relative max-h-[19rem] overflow-y-auto px-4 py-3">
              <span className="absolute bottom-3 left-[3.6rem] top-3 w-px bg-ink-100" />
              {timeline.map((a: any) => {
                const [h, m] = a.time.split(":").map(Number);
                const isNow =
                  Math.abs(h * 60 + m - nowMinutes) < 45 &&
                  a.status !== "Completed";
                return (
                  <li
                    key={a.id}
                    className="relative flex items-start gap-3 py-1.5"
                  >
                    <span className="num w-12 shrink-0 pt-1 text-right text-[11.5px] font-semibold text-ink-500">
                      {a.time}
                    </span>
                    <span
                      className={cn(
                        "relative z-10 mt-1.5 grid size-3 shrink-0 place-items-center rounded-full ring-4 ring-white",
                        isNow
                          ? "bg-amberly-500"
                          : a.status === "Completed"
                            ? "bg-mint-500"
                            : ["Cancelled", "No Show"].includes(a.status)
                              ? "bg-ink-200"
                              : "bg-brand-500",
                      )}
                    >
                      {isNow && (
                        <span className="absolute inline-flex size-3 animate-ping rounded-full bg-amberly-500/60" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1 rounded-lg border border-ink-100 bg-white px-3 py-2 transition-colors hover:border-brand-200">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[13px] font-semibold text-ink-900">
                          {fullName(patientMap.get(a.patientId))}
                          <span className="num ml-2 text-[11px] font-medium text-ink-400">
                            {a.code}
                          </span>
                        </p>
                        <StatusBadge status={a.status} />
                      </div>
                      <p className="mt-0.5 truncate text-[11.5px] text-ink-400">
                        Dr. {fullName(doctorMap.get(a.doctorId))} · {a.type} ·{" "}
                        {formatMoney(a.fee)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </SectionPanel>

        {/* department load */}
        <Panel>
          <PanelHeader
            title="Department load"
            subtitle="Appointments, last 30 days"
            icon={<Users />}
          />
          <div className="p-4">
            <Bar
              data={{
                labels: deptLoad.labels.map((l: string) =>
                  l.length > 14 ? `${l.slice(0, 13)}…` : l,
                ),
                datasets: [
                  {
                    label: "Visits",
                    data: deptLoad.values,
                    backgroundColor: "rgba(15,131,119,.75)",
                    hoverBackgroundColor: "#0d6961",
                    borderRadius: 6,
                    barThickness: 14,
                  },
                ],
              }}
              options={{
                indexAxis: "y" as const,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: { bodyFont: FONT },
                },
                scales: {
                  x: {
                    beginAtZero: true,
                    grid: GRID,
                    ticks: { font: FONT, color: "#93a8ad", precision: 0 },
                    border: { display: false },
                  },
                  y: {
                    grid: { display: false },
                    ticks: { font: { ...FONT, size: 10.5 }, color: "#4f6a71" },
                    border: { display: false },
                  },
                },
              }}
              height={Math.max(140, deptLoad.labels.length * 34)}
            />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {can("appointments", "view") && (
          <SectionPanel
            title="Upcoming appointments"
            subtitle="Next confirmed bookings"
            icon={<CalendarPlus />}
            className="xl:col-span-2"
            bodyClass="p-0"
            action={
              <Link
                to="/app/appointments"
                className="text-[12px] font-semibold text-brand-600 hover:underline"
              >
                View all
              </Link>
            }
          >
            <MiniList
              rows={upcoming.map((a: any) => ({
                title: fullName(patientMap.get(a.patientId)),
                meta: `${formatDate(a.date, { weekday: "short", day: "2-digit", month: "short" })} · ${a.time} · Dr. ${fullName(doctorMap.get(a.doctorId))}`,
                right: (
                  <Badge
                    className={cn(
                      "ring-1 ring-inset",
                      APPT_TYPE_COLORS[a.type] ??
                        "bg-ink-50 text-ink-600 ring-ink-200",
                    )}
                    size="xs"
                  >
                    {a.type}
                  </Badge>
                ),
                onClick: () => navigate(`/app/appointments?focus=${a.id}`),
              }))}
              emptyLabel="Nothing scheduled yet — the booking desk can create the first slot."
            />
          </SectionPanel>
        )}

        <SectionPanel
          title="Recent activity"
          subtitle="Audit trail across modules"
          icon={<HeartPulse />}
          bodyClass="p-0"
        >
          <MiniList
            rows={activities.slice(0, 8).map((a: any) => ({
              title: (
                <span className="text-[12.5px] leading-snug">
                  <span className="font-semibold text-ink-800">
                    {a.userName}
                  </span>{" "}
                  {a.action}{" "}
                  <span className="font-medium text-brand-700">
                    {a.entityName}
                  </span>
                </span>
              ),
              meta: `${a.entity} · ${relativeTime(a.at)}`,
              right: (
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    (
                      {
                        brand: "bg-brand-500",
                        amber: "bg-amberly-500",
                        coral: "bg-coral-500",
                        mint: "bg-mint-500",
                        lagoon: "bg-lagoon-500",
                      } as Record<string, string>
                    )[a.tone],
                  )}
                />
              ),
            }))}
          />
        </SectionPanel>
      </div>
    </div>
  );
}
