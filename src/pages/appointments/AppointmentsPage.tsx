import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CheckCheck,
  CircleSlash,
  Eye,
  ListChecks,
  Pencil,
  RefreshCw,
  Stethoscope,
  Timer,
  Trash2,
  UserRound,
  XCircle,
  Banknote,
  Loader2,
} from "lucide-react";
import { APPT_TYPE_COLORS, APPOINTMENT_STATUSES } from "@/constants";
import { addDays } from "@/utils";
import { useAppDispatch } from "@/store/hooks";
import { usePermission, useTable } from "@/hooks";
import { appointmentService } from "@/pages/appointments/appointment.service";
import { departmentService } from "@/pages/Departments/department.service";

import { toast } from "@/store/slices/uiSlice";
import {
  formatDate,
  formatMoney,
  formatTime,
  fullName,
  generateSlots,
  type SlotOption,
} from "@/utils";
import { cn } from "@/utils/cn";
import type { Appointment, AppointmentStatus } from "@/types";
import {
  Avatar,
  Badge,
  Button,
  Panel,
  StatusBadge,
} from "@/components/ui/primitives";
import { Segmented, Select, DatePicker } from "@/components/ui/fields";
import {
  DataTable,
  Pagination,
  RowActions,
  TableToolbar,
} from "@/components/ui/table";
import { Dialog, Sheet, Tooltip } from "@/components/ui/overlays";
import { DetailGrid, PageIntro, SectionPanel } from "@/components/common";
import { AppointmentFormModal } from "./AppointmentFormPage";
export function SlotPicker({
  doctorId,
  date,
  appointments,
  value,
  onChange,
  loading = false,
  remoteSlots = null,
  doctors = [],
}: {
  doctorId: string;
  date: string;
  appointments: Appointment[];
  value: string;
  onChange: (time: string) => void;
  /** true while the doctor slot-by-id API is in flight */
  loading?: boolean;
  /** slots returned live from the doctor availability API (overrides generated ones) */
  remoteSlots?: SlotOption[] | null;
  /** doctor list of the caller — page data, so it is passed in, not read globally */
  doctors?: any[];
}) {
  const doctor = (doctors ?? []).find((d: any) => d.id === doctorId) as any;
  const generated = useMemo(
    () => generateSlots(doctor, date, appointments),
    [doctor, date, appointments],
  );

  const slots = remoteSlots && remoteSlots.length ? remoteSlots : generated;
  const available = slots.filter((s) => s.state === "available");

  // Slot-specific loader: the only thing that is loading here is the slot
  // source (doctor availability + the appointment list it is checked against).
  if (loading)
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-ink-200 px-3 py-6 text-[12.5px] text-ink-500"
      >
        <Loader2 className="size-4 animate-spin text-brand-600" /> Checking
        available slots…
      </div>
    );

  if (!doctor)
    return (
      <p className="rounded-lg border border-dashed border-ink-200 px-3 py-6 text-center text-[12.5px] text-ink-400">
        Select doctor and date to see available slots.
      </p>
    );
  if (!slots.length)
    return (
      <p className="rounded-lg border border-dashed border-coral-500/25 bg-coral-50/60 px-3 py-6 text-center text-[12.5px] text-coral-600">
        No clinic hours on{" "}
        {formatDate(date, { weekday: "long", day: "2-digit", month: "short" })}.
        Choose another date or update the doctor's weekly schedule.
      </p>
    );

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-25 px-3 py-2 text-[11.5px] text-brand-800 ring-1 ring-inset ring-brand-100">
        <span>
          Slots generated from <strong>{doctor.slotDuration}m</strong> duration
          + <strong>{doctor.bufferTime}m</strong> buffer · max{" "}
          <strong>{doctor.maxPatientsPerDay}</strong> patients/day
        </span>
        <Badge tone="mint" size="xs">
          {available.length} open
        </Badge>
      </div>
      <div className="grid max-h-[15rem] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-6">
        {slots.map((s) => (
          <button
            key={s.time}
            type="button"
            disabled={s.state !== "available"}
            onClick={() => onChange(s.time)}
            className={cn(
              "group rounded-lg border px-1.5 py-2 text-center transition-all duration-150",
              s.state === "available" &&
                "border-ink-200 bg-white hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-card",
              s.state === "booked" &&
                "cursor-not-allowed border-ink-100 bg-ink-50 text-ink-300",
              s.state === "past" &&
                "cursor-not-allowed border-ink-100 bg-white text-ink-200 line-through",
              s.state === "unavailable" &&
                "cursor-not-allowed border-coral-500/20 bg-coral-50 text-coral-500",
              value === s.time &&
                s.state === "available" &&
                "border-brand-600 bg-brand-600 text-white shadow-[0_10px_22px_-14px_rgba(13,105,97,.95)]",
            )}
          >
            <span className="num block text-[12.5px] font-bold">{s.time}</span>
            <span className="block text-[9.5px] font-semibold uppercase tracking-wide opacity-70">
              {s.state === "available" ? "open" : s.state}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AppointmentsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { canCreate, canEdit, canDelete } = usePermission();

  /* ------------------------------- local data ----------------------------- */

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await appointmentService.fetchAppointments();
      if (response.status === 200) {
        setAppointments(response.data?.data ?? []);
      }
    } catch (e: any) {
      setError(e?.message ?? "Could not load appointments");
      dispatch(toast.error("Could not load appointments", e?.message));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Department names for the filter + detail view.
   *
   * THIS PAGE FETCHES ONE THING: THE APPOINTMENTS. The patient roster and the
   * doctor roster are deliberately NOT requested here — an appointment row
   * already embeds its `patient` and `doctor`, so the filter options, the board
   * and the detail drawer read those instead of pulling two more lists the page
   * does not actually need.
   */
  const [departments, setDepartments] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await departmentService.fetchDepartments();
        if (active && response.status === 200) {
          setDepartments(response.data?.data ?? []);
        }
      } catch (e: any) {
        dispatch(toast.error("Could not load departments", e?.message));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const status = loading ? "loading" : error ? "error" : "ready";

  const [view, setView] = useState<"list" | "board">("list");
  const [boardDate, setBoardDate] = useState(addDays(new Date(), 0));
  const [filters, setFilters] = useState({
    doctor: "all",
    department: "all",
    status: "all",
    from: "",
    to: "",
  });
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("Patient request");
  const [detailId, setDetailId] = useState<string | null>(params.get("focus"));
  const [bookOpen, setBookOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Appointment | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Re-run the appointment list API (after a write, or from the Refresh
   * button). The list is page state, so this is a plain local reload.
   */
  const refreshList = async (_force = true) => {
    setRefreshing(true);
    await loadAppointments();
    setRefreshing(false);
  };

  const [cancelling, setCancelling] = useState(false);
  const handleCancelAppointment = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await appointmentService.cancelAppointment(cancelTarget.id, cancelReason);
      setAppointments((rows) =>
        rows.map((row) =>
          row.id === cancelTarget.id
            ? ({ ...row, status: "Cancelled" } as Appointment)
            : row,
        ),
      );
      dispatch(
        toast.success(
          "Appointment cancelled",
          `${cancelTarget.code} was cancelled successfully`,
        ),
      );
      setCancelTarget(null);
      await refreshList();
    } catch (error: any) {
      dispatch(
        toast.error(
          "Could not cancel appointment",
          error?.message ?? "Please try again",
        ),
      );
    } finally {
      setCancelling(false);
    }
  };

  /** doctors that actually appear in the loaded appointments — no roster call */
  const appointmentDoctors = useMemo(() => {
    const seen = new Map<string, any>();
    (appointments as any[]).forEach((a) => {
      if (!a?.doctorId || seen.has(a.doctorId)) return;
      seen.set(a.doctorId, { id: a.doctorId, ...(a.doctor ?? {}) });
    });
    return [...seen.values()].sort((a, b) =>
      fullName(a).localeCompare(fullName(b)),
    );
  }, [appointments]);

  const filtered = useMemo(() => {
    return (appointments as Appointment[]).filter((a) => {
      if (filters.doctor !== "all" && a.doctorId !== filters.doctor)
        return false;
      if (filters.department !== "all" && a.departmentId !== filters.department)
        return false;
      if (filters.status !== "all" && a.status !== filters.status) return false;
      if (filters.from && a.date < filters.from) return false;
      if (filters.to && a.date > filters.to) return false;
      return true;
    });
  }, [appointments, filters]);

  const table = useTable<Appointment>(filtered, {
    pageSize: 10,
    searchFields: [
      (a: any) => a.code,
      (a: any) => fullName(a.patient),
      (a: any) => `Dr. ${fullName(a.doctor)}`,
      (a: any) => a.patient?.uhid,
      (a: any) => a.patient?.mobile,
      (a: any) => a.reasonForVisit,
      (a: any) => a.notes,
    ],
    sortAccessors: {
      date: (a: any) => `${a.date}${a.time ?? ""}`,
      status: (a: any) => a.status,
      fee: (a: any) => a.fee,
      patient: (a: any) => fullName(a.patient),
    },
  });

  const detail =
    (appointments as Appointment[]).find((a) => a.id === detailId) ?? null;

  const advance = async (a: Appointment, next: AppointmentStatus) => {
    try {
      await appointmentService.updateAppointment(a.id, { status: next });
      setAppointments((rows) =>
        rows.map((row) =>
          row.id === a.id ? ({ ...row, status: next } as Appointment) : row,
        ),
      );
      dispatch(toast.success(`${a.code} → ${next}`));
    } catch (e: any) {
      dispatch(toast.error("Update failed", e?.message));
    }
  };

  const todayBoard = (appointments as Appointment[]).filter(
    (a) => a.date === boardDate && !["Cancelled", "No Show"].includes(a.status),
  );

  /** doctors with visits on the selected board date (derived, never fetched) */
  const boardDoctors = useMemo(() => {
    const seen = new Map<string, any>();
    todayBoard.forEach((a: any) => {
      if (!a?.doctorId || seen.has(a.doctorId)) return;
      seen.set(a.doctorId, { id: a.doctorId, ...(a.doctor ?? {}) });
    });
    return [...seen.values()].sort((a, b) =>
      fullName(a).localeCompare(fullName(b)),
    );
  }, [todayBoard]);

  const clearParams = () => {
    if (params.get("new") || params.get("focus")) {
      params.delete("new");
      params.delete("focus");
      params.delete("patient");
      params.delete("doctor");
      setParams(params, { replace: true });
    }
  };

  return (
    <>
      <PageIntro
        title="Appointment scheduling"
        description="Book, reschedule and progress visits. The slot builder reads each doctor's clinic hours, slot length, buffer time and daily patient cap."
        module="appointments"
        createLabel="Book appointment"
        // onCreate={() => setForm({ mode: "new" })}
        onCreate={() => setBookOpen(true)}
        meta={
          <>
            <Badge tone="amber" dot>
              {
                appointments.filter(
                  (a: any) =>
                    a.date === addDays(new Date(), 0) &&
                    a.status !== "Completed",
                ).length
              }{" "}
              still open today
            </Badge>
            <Badge tone="mint">
              {appointments.filter((a: any) => a.status === "Completed").length}{" "}
              completed
            </Badge>
            <Badge tone="coral">
              {
                appointments.filter(
                  (a: any) =>
                    a.status === "Cancelled" || a.status === "No Show",
                ).length
              }{" "}
              cancelled / no-show
            </Badge>
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={view}
              onChange={(v) => setView(v)}
              options={[
                {
                  value: "list",
                  label: (
                    <span className="flex items-center gap-1.5">
                      <ListChecks className="size-3.5" /> List
                    </span>
                  ),
                },
                {
                  value: "board",
                  label: (
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" /> Day board
                    </span>
                  ),
                },
              ]}
            />
            {canCreate("appointments") ? (
              <Button
                size="sm"
                variant="outline"
                icon={<RefreshCw />}
                loading={refreshing}
                onClick={() => refreshList()}
              >
                Refresh
              </Button>
            ) : undefined}
          </div>
        }
      />

      {view === "board" ? (
        <Panel className="p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setBoardDate(addDays(new Date(), dayOffset(boardDate, -1)))
                }
              >
                ← Prev
              </Button>
              <DatePicker label="" value={boardDate} onChange={setBoardDate} />
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setBoardDate(addDays(new Date(), dayOffset(boardDate, 1)))
                }
              >
                Next →
              </Button>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-ink-500">
              <Timer className="size-4" /> {todayBoard.length} visits on the
              floor ·{" "}
              {formatDate(boardDate, {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(boardDoctors as any[]).map((doc) => {
              const rows = todayBoard
                .filter((a) => a.doctorId === doc.id)
                .sort((a, b) => a.time.localeCompare(b.time));
              const slots = generateSlots(doc, boardDate, appointments as any);
              const open = slots.filter((s) => s.state === "available").length;
              return (
                <div
                  key={doc.id}
                  className="overflow-hidden rounded-xl border border-ink-100 bg-white"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-ink-100 bg-ink-25/70 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar
                        name={fullName(doc)}
                        size="xs"
                        color="bg-brand-600"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-[12.5px] font-semibold text-ink-900">
                          Dr. {fullName(doc)}
                        </p>
                        <p className="num text-[10.5px] text-ink-400">
                          {doc.slotDuration
                            ? `${doc.slotDuration}m slots · `
                            : ""}
                          {open} open
                        </p>
                      </div>
                    </div>
                    <Badge
                      tone={
                        rows.length > Number(doc.maxPatientsPerDay || 0) * 0.8
                          ? "coral"
                          : "brand"
                      }
                      size="xs"
                    >
                      {rows.length}/{doc.maxPatientsPerDay}
                    </Badge>
                  </div>
                  <ul className="divide-y divide-ink-100">
                    {rows.length === 0 && (
                      <li className="px-3 py-6 text-center text-[12px] text-ink-400">
                        No visits booked
                      </li>
                    )}
                    {rows.map((a) => (
                      <li
                        key={a.id}
                        className="group flex items-center gap-3 px-3 py-2 transition-colors hover:bg-brand-25/60"
                      >
                        <span className="num w-12 shrink-0 text-[12px] font-bold text-ink-700">
                          {a.time}
                        </span>
                        <button
                          className="min-w-0 flex-1 text-left"
                          onClick={() => navigate(`/patients/${a.patientId}`)}
                        >
                          <span className="block truncate text-[12.5px] font-medium text-ink-800">
                            {fullName(a.patient)}
                          </span>
                          <span className="block truncate text-[11px] text-ink-400">
                            {a.type} · {a.code}
                          </span>
                        </button>
                        {canEdit("appointments") &&
                          a.status !== "Completed" && (
                            <button
                              onClick={() => advance(a, "Completed")}
                              className="rounded-md p-1 text-ink-300 opacity-0 transition-all hover:bg-mint-50 hover:text-mint-600 group-hover:opacity-100"
                              aria-label="Mark completed"
                            >
                              <CheckCheck className="size-4" />
                            </button>
                          )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Panel>
      ) : (
        <Panel>
          <TableToolbar
            search={table.query.search}
            onSearch={table.setSearch}
            searchPlaceholder="Search patient, code, notes…"
            filters={
              <>
                <Select
                  size="sm"
                  className="w-[11rem]"
                  name="doc"
                  value={filters.doctor}
                  onChange={(v) => setFilters((f) => ({ ...f, doctor: v }))}
                  options={[
                    { value: "all", label: "All doctors" },
                    ...appointmentDoctors.map((d: any) => ({
                      value: d.id,
                      label: `Dr. ${d.lastName}`,
                    })),
                  ]}
                />
                <Select
                  size="sm"
                  className="w-[11rem]"
                  name="dep"
                  value={filters.department}
                  onChange={(v) => setFilters((f) => ({ ...f, department: v }))}
                  options={[
                    { value: "all", label: "All departments" },
                    ...departments.map((d: any) => ({
                      value: d.id,
                      label: d.name,
                    })),
                  ]}
                />
                <Select
                  size="sm"
                  className="w-[10rem]"
                  name="status"
                  value={filters.status}
                  onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
                  options={[
                    { value: "all", label: "Any status" },
                    ...APPOINTMENT_STATUSES.map((s) => ({
                      value: s,
                      label: s,
                    })),
                  ]}
                />
                <div className="flex items-center gap-1.5">
                  <DatePicker
                    label=""
                    value={filters.from}
                    onChange={(v) => setFilters((f) => ({ ...f, from: v }))}
                    placeholder="From"
                  />
                  <DatePicker
                    label=""
                    value={filters.to}
                    onChange={(v) => setFilters((f) => ({ ...f, to: v }))}
                    placeholder="To"
                  />
                </div>
              </>
            }
          />
          <DataTable
            columns={[
              {
                key: "patient",
                header: "Patient",
                sortable: true,
                render: (a: any) => (
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      name={fullName(a.patient)}
                      size="xs"
                      color="bg-ink-600"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-ink-900">
                        {fullName(a.patient)}
                      </p>
                      <p className="num truncate text-[11px] text-ink-400">
                        {a.code} · {a.patient?.uhid ?? a.patient?.mrn}
                      </p>
                    </div>
                  </div>
                ),
              },
              {
                key: "doctor",
                header: "Doctor",
                hideBelow: "md",
                render: (a: any) => (
                  <span className="text-[12.5px] text-ink-600">
                    Dr. {fullName(a.doctor)}
                    {a.doctor?.specialization
                      ? ` · ${a.doctor.specialization}`
                      : ""}
                  </span>
                ),
              },
              {
                key: "date",
                header: "Slot",
                sortable: true,
                render: (a: any) => (
                  <div>
                    <p className="text-[12.5px] font-medium text-ink-800">
                      {formatDate(a.date, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    <p className="num text-[11px] text-ink-400">
                      {a.time
                        ? `${formatTime(a.time)}${a.endTime ? ` – ${formatTime(a.endTime)}` : ""}`
                        : "Walk-in"}
                      {a.duration ? ` · ${a.duration}m` : ""}
                    </p>
                  </div>
                ),
              },
              {
                key: "type",
                header: "Type",
                hideBelow: "lg",
                align: "center",
                render: (a: any) => (
                  <Badge
                    className={cn(
                      "ring-1 ring-inset",
                      APPT_TYPE_COLORS[a.type] ?? "",
                    )}
                    size="xs"
                    tone="neutral"
                  >
                    {String(a.type ?? "").replace(/_/g, " ")}
                  </Badge>
                ),
              },
              {
                key: "fee",
                header: "Fee",
                align: "right",
                sortable: true,
                hideBelow: "sm",
                render: (a: any) => (
                  <span className="num text-[12.5px] font-semibold">
                    {formatMoney(a.fee)}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
                align: "center",
                sortable: true,
                render: (a) => <StatusBadge status={a.status} />,
              },
            ]}
            rows={table.rows}
            status={
              status === "ready"
                ? "ready"
                : status === "error"
                  ? "error"
                  : "loading"
            }
            onRetry={loadAppointments}
            sort={{
              sortBy: table.query.sortBy,
              sortDir: table.query.sortDir,
              onSort: table.toggleSort,
            }}
            onRowClick={(a) => setDetailId(a.id)}
            actions={(a) => (
              <RowActions
                items={[
                  {
                    label: "Appointment details",
                    icon: <Eye />,
                    onClick: () => setDetailId(a.id),
                  },
                  {
                    label: "Collect Payment / Bill",
                    icon: <Banknote />,
                    hidden: ["Cancelled"].includes(a.status), // Available for active/completed visits
                    onClick: () => {
                      const pId = a.patientId ?? a.patient?.id ?? "";
                      navigate(
                        `/billing?new=1&appointment=${a.id}&patient=${pId}`,
                      );
                    },
                  },
                  {
                    label: "Reschedule",
                    icon: <Pencil />,
                    hidden:
                      !canEdit("appointments") ||
                      ["Completed", "Cancelled"].includes(a.status),
                    onClick: () => setEditTarget(a),
                  },
                  {
                    label: "Mark checked in",
                    icon: <UserRound />,
                    hidden:
                      !canEdit("appointments") ||
                      !["Scheduled", "Confirmed"].includes(a.status),
                    onClick: () => advance(a, "Checked In"),
                  },
                  {
                    label: "Start consultation",
                    icon: <Stethoscope />,
                    hidden:
                      !canEdit("appointments") || a.status === "In Progress",
                    onClick: () => advance(a, "In Progress"),
                  },
                  {
                    label: "Complete",
                    icon: <CheckCheck />,
                    hidden:
                      !canEdit("appointments") || a.status === "Completed",
                    onClick: () => advance(a, "Completed"),
                  },
                  {
                    label: "Cancel appointment",
                    icon: <XCircle />,
                    tone: "danger",
                    hidden:
                      !canEdit("appointments") ||
                      ["Cancelled", "Completed"].includes(a.status),
                    onClick: () => setCancelTarget(a),
                  },
                  {
                    label: "Delete record",
                    icon: <Trash2 />,
                    tone: "danger",
                    hidden: !canDelete("appointments"),
                    onClick: async () => {
                      try {
                        await appointmentService.deleteAppointment(a.id);
                        setAppointments((rows) =>
                          rows.filter((row) => row.id !== a.id),
                        );
                        dispatch(
                          toast.success(
                            "Record deleted",
                            `${a.code} was removed from the portal.`,
                          ),
                        );
                      } catch (e: any) {
                        dispatch(toast.error("Delete failed", e?.message));
                      }
                    },
                  },
                ]}
              />
            )}
            emptyTitle="No appointments match this view"
            emptyDescription="Adjust the filters, or book the first slot for this day."
            emptyAction={
              canCreate("appointments") ? (
                <Button size="sm" onClick={() => setBookOpen(true)}>
                  Book appointment
                </Button>
              ) : undefined
            }
            footer={
              <Pagination
                page={table.page}
                pageCount={table.pageCount}
                total={table.total}
                pageSize={table.pageSize}
                onPage={table.setPage}
                onPageSize={table.setPageSize}
                label="appointments"
              />
            }
          />
        </Panel>
      )}

      {/* {form && (
        <AppointmentForm
          initial={form}
          onClose={() => {
            clearParams();
          }}
        />
      )} */}

      <Dialog
        open={!!cancelTarget}
        onOpenChange={(v) => !v && setCancelTarget(null)}
        size="sm"
        title="Cancel appointment"
        description={
          cancelTarget
            ? `${cancelTarget.code} · ${formatDate(cancelTarget.date)} at ${formatTime(cancelTarget.time)}`
            : ""
        }
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCancelTarget(null)}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={cancelling}
              onClick={handleCancelAppointment}
            >
              Cancel appointment
            </Button>
          </>
        }
      >
        <Select
          name="reason"
          label="Cancellation reason"
          value={cancelReason}
          onChange={setCancelReason}
          options={[
            "Patient request",
            "Doctor unavailable",
            "Duplicate booking",
            "Travel constraint",
            "No response",
          ].map((r) => ({ value: r, label: r }))}
        />
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-amberly-50 px-3 py-2 text-[12px] text-amberly-600">
          <CircleSlash className="mt-0.5 size-3.5 shrink-0" /> The slot is
          released back to the doctor's availability grid immediately.
        </p>
      </Dialog>

      {/* details sheet */}
      <Sheet
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) {
            setDetailId(null);
            clearParams();
          }
        }}
        title={detail ? `Appointment ${detail.code}` : "Appointment"}
        description={
          detail
            ? `${formatDate(detail.date, { weekday: "long" })}${detail.time ? ` at ${formatTime(detail.time)}` : " (walk-in)"} · ${String(detail.type ?? "").replace(/_/g, " ")}`
            : undefined
        }
        footer={
          detail && (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {canEdit("appointments") &&
                  APPOINTMENT_STATUSES.filter(
                    (s) =>
                      s !== detail.status &&
                      !["Cancelled", "No Show"].includes(s),
                  )
                    .slice(0, 4)
                    .map((s) => (
                      <Tooltip key={s} content={`Move this visit to ${s}`}>
                        <button
                          onClick={() => advance(detail, s)}
                          className="rounded-full border border-ink-200 px-2.5 py-1 text-[11.5px] font-medium text-ink-600 transition-colors hover:border-brand-400 hover:bg-brand-25 hover:text-brand-700"
                        >
                          {s}
                        </button>
                      </Tooltip>
                    ))}
              </div>
              <div className="flex gap-2">
                {/* 🟢 NEW BUTTON IN SHEET FOOTER */}
                {detail.status !== "Cancelled" && (
                  <Button
                    size="sm"
                    icon={<Banknote />}
                    onClick={() => {
                      const pId = detail.patientId ?? detail.patient?.id ?? "";
                      navigate(
                        `/billing?new=1&appointment=${detail.id}&patient=${pId}`,
                      );
                    }}
                  >
                    Collect Payment
                  </Button>
                )}
                {canEdit("appointments") && (
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Pencil />}
                    onClick={() => setEditTarget(detail)}
                  >
                    Reschedule
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/patients/${detail.patientId}`)}
                >
                  Open patient chart
                </Button>
              </div>
            </div>
          )
        }
      >
        {detail && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border border-ink-100 bg-ink-25/70 p-3.5">
              <Avatar name={fullName(detail?.patient)} color="bg-brand-600" />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-ink-900">
                  {fullName(detail.patient)}
                </p>
                <p className="text-[11.5px] text-ink-400">
                  {detail.patient?.uhid ?? detail.patient?.mrn} ·{" "}
                  {detail.patient?.mobile ?? detail.patient?.mobile}
                </p>
              </div>
              <StatusBadge status={detail.status} className="ml-auto" />
            </div>
            <DetailGrid
              columns={2}
              items={[
                {
                  label: "Doctor",
                  value: `Dr. ${fullName(detail.doctor)}`,
                },
                {
                  label: "Department",
                  value:
                    detail.departmentName ??
                    departments.find((d: any) => d.id === detail.departmentId)
                      ?.name ??
                    "—",
                },
                {
                  label: "Date",
                  value: formatDate(detail.date, {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  }),
                },
                {
                  label: "Time",
                  value: detail.time
                    ? `${formatTime(detail.time)}${detail.slotEndTime ? ` – ${formatTime(detail.slotEndTime)}` : ""}`
                    : "Walk-in",
                },
                {
                  label: "Type",
                  value: String(detail.type ?? "").replace(/_/g, " "),
                },
                {
                  label: "Visit type",
                  value: detail.visitType
                    ? String(detail.visitType).replace(/_/g, " ")
                    : "—",
                },
                {
                  label: "Specialization",
                  value: detail.doctor?.specialization ?? "—",
                },
                { label: "Priority", value: detail.priority },
                { label: "Consultation fee", value: formatMoney(detail.fee) },
                {
                  label: "Booked on",
                  value: formatDate(detail.bookedAt ?? detail.createdAt),
                },
                {
                  label: "Reason for visit",
                  value: detail.reasonForVisit || "—",
                },
                { label: "Notes", value: detail.notes || "—" },
                {
                  label: "Token",
                  value: (() => {
                    const t = detail.token as any;
                    if (!t) return "—";

                    // If token is an object from new API
                    if (typeof t === "object") {
                      return (
                        `#${t.tokenNumber ?? "—"}` +
                        (t.status ? ` · ${t.status}` : "") +
                        (t.roomNo ? ` · Room ${t.roomNo}` : "")
                      );
                    }

                    // Fallback if token is still just a string/number
                    return `#${t}`;
                  })(),
                },
                {
                  label: "Allergies",
                  value: detail.patient?.allergies || "—",
                },
                {
                  label: "Chronic diseases",
                  value: detail.patient?.chronicDiseases || "—",
                },
                {
                  label: "Referred by",
                  value: detail.referredByDoctorName || "—",
                },
                ...(detail.cancelReason || detail.cancelledReason
                  ? [
                      {
                        label: "Cancellation reason",
                        value: detail.cancelReason ?? detail.cancelledReason,
                      },
                    ]
                  : []),
              ]}
            />
            <SectionPanel title="Slot context" icon={<Timer />}>
              <SlotPicker
                doctorId={detail.doctorId}
                date={detail.date}
                doctors={appointmentDoctors}
                appointments={appointments as any}
                value={detail.time}
                onChange={() => undefined}
              />
            </SectionPanel>
          </div>
        )}
      </Sheet>

      <AppointmentFormModal
        open={bookOpen || !!editTarget}
        editing={editTarget}
        onSaved={loadAppointments}
        onOpenChange={(v) => {
          setBookOpen(v);
          if (!v) setEditTarget(null);
        }}
      />
    </>
  );
}

const dayOffset = (date: string, delta: number) => {
  const d = new Date(date);
  const diff = Math.round(
    (d.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000,
  );
  return diff + delta;
};
