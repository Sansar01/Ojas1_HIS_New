/**
 * Appointment feature service — the ONLY place appointment endpoints are known.
 *
 *   GET    /api/opd/appointments                    fetchAppointments(params?)
 *   GET    /api/opd/appointments/:id                fetchAppointmentById(id)
 *   POST   /api/opd/appointments                    createAppointment(payload)
 *   PATCH  /api/opd/appointments/:id                updateAppointment(id, payload)
 *   DELETE /api/opd/appointments/:id                deleteAppointment(id)
 *   PATCH  /api/opd/appointments/:id/cancel         cancelAppointment(id, reason)
 *   PATCH  /api/opd/appointments/:id/check-in       checkInAppointment(id)
 *   GET    .../masters/global/dropdown/CONSULTATION_TYPE   fetchConsultationTypes()
 *
 * Appointment list, booking, rescheduling and cancellation all live here; the
 * booking form additionally uses `patient.service`, `doctor.service` and
 * `consultation.service` for its dropdowns — no Redux involved.
 */

import { axios } from "@/api/axios";
import type { Appointment, AppointmentStatus } from "@/types";

/** Appointment endpoints — owned by the appointment feature. */
const APPOINTMENTS = "/api/opd/appointments";
const appointmentPath = (id: string | number) => `${APPOINTMENTS}/${id}`;
const CONSULTATION_TYPES =
  "/api/hospital/masters/global/dropdown/CONSULTATION_TYPE";

/* --------------------- backend DTO → UI model mapping ---------------------- */

/**
 * The API answers with its own DTO (`appointmentNo`, `appointmentDate`,
 * `slotStartTime`, `appointmentType`, `consultationFee`, SNAKE_CASE statuses,
 * ids only inside `patient`/`doctor`), while every screen renders the UI model
 * (`code`, `date`, `time`, `type`, `fee`, "Title Case" statuses, `patientId`,
 * `doctorId`). One normaliser at the service boundary keeps every page —
 * dashboard, patients, doctors, billing, appointments — on the same shape.
 */

const STATUS_TO_UI: Record<string, AppointmentStatus> = {
  BOOKED: "Scheduled",
  SCHEDULED: "Scheduled",
  PENDING: "Scheduled",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked In",
  IN_QUEUE: "Checked In",
  WAITING: "Checked In",
  IN_PROGRESS: "In Progress",
  CONSULTING: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  CANCELED: "Cancelled",
  NO_SHOW: "No Show",
  NOSHOW: "No Show",
};

/** UI status → the status enum the write endpoints expect. */
const STATUS_TO_API: Record<string, string> = {
  Scheduled: "SCHEDULED",
  Confirmed: "CONFIRMED",
  "Checked In": "CHECKED_IN",
  "In Progress": "IN_PROGRESS",
  Completed: "COMPLETED",
  Cancelled: "CANCELLED",
  "No Show": "NO_SHOW",
};

const PRIORITY_LABELS: Record<string, string> = {
  0: "Routine",
  1: "Urgent",
  2: "Emergency",
};

/** "COMPLETED" → "Completed" — for statuses neither side knows yet. */
const titleCase = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Backend status enum → the UI status every screen filters/compares on. */
export const toUiAppointmentStatus = (raw: unknown): AppointmentStatus =>
  STATUS_TO_UI[String(raw ?? "").trim().toUpperCase()] ?? titleCase(raw);

/** UI status ("Checked In") → the enum the PATCH endpoint expects. */
export const toApiAppointmentStatus = (ui: string): string =>
  STATUS_TO_API[ui] ?? String(ui ?? "").toUpperCase().replace(/\s+/g, "_");

/**
 * One appointment row → the UI model. Non-destructive: every backend field is
 * spread through, so screens that already read the raw DTO keep working, and
 * re-running the mapper over an already-normalised row is a no-op.
 */
export function normaliseAppointment(raw: any): Appointment {
  const doctor = raw?.doctor
    ? {
        ...raw.doctor,
        // the board/slot picker reads `slotDuration`, the DTO sends `slotDurationMins`
        slotDuration: raw.doctor.slotDuration ?? raw.doctor.slotDurationMins,
      }
    : raw?.doctor;

  return {
    ...raw,
    code: raw?.code ?? raw?.appointmentNo ?? "—",
    patientId: raw?.patientId ?? raw?.patient?.id ?? "",
    doctorId: raw?.doctorId ?? raw?.doctor?.id ?? "",
    departmentId: raw?.departmentId ?? "",
    departmentName: raw?.departmentName ?? "",
    date: raw?.date ?? raw?.appointmentDate ?? "",
    time: raw?.time ?? raw?.slotStartTime ?? "",
    endTime: raw?.endTime ?? raw?.slotEndTime ?? undefined,
    duration: Number(raw?.duration ?? raw?.doctor?.slotDurationMins ?? 0) || 0,
    type: raw?.type ?? raw?.appointmentType ?? "WALK_IN",
    fee: Number(raw?.fee ?? raw?.consultationFee ?? 0) || 0,
    priority: PRIORITY_LABELS[String(raw?.priority ?? "")]
      ? PRIORITY_LABELS[String(raw?.priority ?? "")]
      : titleCase(raw?.priority ?? "Routine"),
    status: toUiAppointmentStatus(raw?.status),
    notes: raw?.notes ?? "",
    createdAt: raw?.createdAt ?? raw?.bookedAt ?? "",
    bookedAt: raw?.bookedAt ?? "",
    token: raw?.token ?? null,
    patient: raw?.patient,
    doctor,
  } as unknown as Appointment;
}

/** Optional query parameters of the appointment list (date / status / paging). */
export interface AppointmentQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  date?: string;
  from?: string;
  to?: string;
  status?: string;
  doctorId?: string | number;
  patientId?: string | number;
  [key: string]: unknown;
}

/**
 * Appointment write payload. The backend DTO uses its own field names
 * (`appointmentDate`, `slotStartTime`, `doctorProfileId`, …), so the caller
 * passes the DTO it already builds and the service forwards it untouched.
 */
export type AppointmentPayload = Record<string, any>;

/** Appointment list — filters/paging are optional parameters, not new methods. */

/* --------------------------------------------------------------------------
 * Service object — every method returns the axios request directly.
 * ----------------------------------------------------------------------- */

export const appointmentService = {
  /**
   * Appointment list. Rows are normalised to the UI model before they leave
   * the service (see `normaliseAppointment`), so every screen that renders an
   * appointment — dashboard, patients, doctors, billing, this page — reads the
   * same field names regardless of the backend DTO.
   */
  fetchAppointments: async (params?: AppointmentQueryParams) => {
    const response = await axios.get(APPOINTMENTS, { params });
    const body: any = response.data;
    if (Array.isArray(body?.data)) {
      body.data = body.data.map(normaliseAppointment);
    }
    return response;
  },
  /** Today's appointments of the signed-in doctor / facility. */
  fetchTodayAppointments: async (params?: AppointmentQueryParams) => {
    const response = await axios.get(APPOINTMENTS + "/today", { params });
    const body: any = response.data;
    if (Array.isArray(body?.data)) {
      body.data = body.data.map(normaliseAppointment);
    }
    return response;
  },
  fetchAppointmentById: (id: string | number) => axios.get(appointmentPath(id)),
  /** One appointment prepared for editing (server-side edit payload). */
  fetchAppointmentForEdit: (id: string | number) =>
    axios.get(appointmentPath(id) + "/edit"),
  createAppointment: (payload: AppointmentPayload) =>
    axios.post(APPOINTMENTS, payload),
  updateAppointment: (id: string | number, payload: AppointmentPayload) =>
    axios.patch(appointmentPath(id), payload),
  deleteAppointment: (id: string | number) => axios.delete(appointmentPath(id)),
  /** Cancel with a reason (non-destructive on the server). */
  cancelAppointment: (id: string | number, cancelReason: string) =>
    axios.patch(appointmentPath(id) + "/cancel", { cancelReason }),
  /** Move a booked appointment to "checked in" (nurse station / front desk). */
  checkInAppointment: (id: string | number) =>
    axios.patch(appointmentPath(id) + "/check-in", undefined),
  /** Available slot of a doctor — reference lookup used while booking. */
  fetchAppointmentSlot: (params: Record<string, unknown>) =>
    axios.get(APPOINTMENTS + "/slot", { params }),
  /**
   * Visit/consultation types of the booking form (global master dropdown).
   * One method for the dropdown — no per-type duplicates.
   */
  fetchConsultationTypes: () => axios.get(CONSULTATION_TYPES),
};
