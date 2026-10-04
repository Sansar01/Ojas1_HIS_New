/**
 * Consultation feature service — consultations, the OPD queue and vitals.
 *
 *   GET    /api/opd/consultations                       fetchConsultations(params?)
 *   GET    /api/opd/consultations/:id                   fetchConsultationById(id)
 *   POST   /api/opd/consultations                       createConsultation(payload)
 *   PATCH  /api/opd/consultations/:id                   updateConsultationNote(id, payload)
 *   DELETE /api/opd/consultations/:id                   deleteConsultation(id)
 *   PATCH  /api/opd/consultations/:id/complete          completeConsultation(id)
 *   GET    /api/opd/consultations/patient/:id/history   fetchPatientHistory(patientId)
 *   POST   /api/opd/consultations/:id/prescriptions     addPrescriptionLine(id, line)
 *   PATCH  /api/opd/consultations/:id/prescriptions/:ln updatePrescriptionLine(id, ln, line)
 *
 *   GET    /api/opd/queue/doctor/:doctorId              fetchDoctorQueue(doctorId, date)
 *   GET    /api/opd/queue/nurse                         fetchNurseQueue(date, tab)
 *   PATCH  /api/opd/queue/:tokenId/call                 callToken(tokenId)
 *   PATCH  /api/opd/queue/call-next/:doctorId           callNextToken(doctorId, date)
 *   PATCH  /api/opd/queue/:tokenId/skip                 skipToken(tokenId)
 *   PATCH  /api/opd/queue/:tokenId/requeue              requeueToken(tokenId)
 *   POST   /api/opd/queue/generate                      generateOpdToken(appointmentId)
 *
 *   POST   /api/opd/vitals                              saveVitals(payload)
 *   PATCH  /api/opd/vitals/:id                          saveVitals(payload, vitalsId)
 *   GET    /api/opd/vitals/appointment/:appointmentId   fetchVitalsByAppointment(id)
 *
 * Return shape: the clinical screens only ask "did it work, and what came
 * back?", so the action/queue/vitals calls answer with an `ApiResult`
 * (`{ ok, data, error }`) and never throw — exactly the contract the
 * consultation workspace and the nurse station are written against. The list
 * and history calls answer with the standard `ApiResponse` envelope so a page
 * reads `res.data`.
 */

import { axios } from "@/api/axios";

/* ------------------------------ endpoints -------------------------------- */

const CONSULTATIONS = "/api/opd/consultations";
const consultationPath = (id: string | number) => `${CONSULTATIONS}/${id}`;

const QUEUE = "/api/opd/queue";
const VITALS = "/api/opd/vitals";

/* -------------------------------- types ---------------------------------- */

export interface ConsultationQueryParams {
  page?: number | string;
  limit?: number | string;
  search?: string;
  status?: string;
  doctorId?: string | number;
  from?: string;
  to?: string;
  [key: string]: unknown;
}

/** Fields the backend accepts when saving a consultation note. */
export interface ConsultationNotePayload {
  chiefComplaints?: string;
  provisionalDiagnosis?: string;
  specialInstructions?: string;
  followUpDate?: string | null;
  [key: string]: unknown;
}

export interface PrescriptionLinePayload {
  medicineName: string;
  dosage?: string;
  frequency?: string;
  durationDays?: number;
  mealRelation?: string;
  [key: string]: unknown;
}

/* ---------------------------- consultations ------------------------------- */

/** Paged/filtered consultation list — parameters only, never new methods. */

/* --------------------------------------------------------------------------
 * Service object — every method returns the axios request directly.
 * ----------------------------------------------------------------------- */

export const consultationService = {
  fetchConsultations: (params?: ConsultationQueryParams) =>
    axios.get(CONSULTATIONS, { params }),
  fetchConsultationById: (id: string | number) =>
    axios.get(consultationPath(id)),
  /** Open (or resume) the workspace session of one appointment. */
  createConsultation: (payload: { appointmentId: string | number }) =>
    axios.post(CONSULTATIONS, payload),
  /** Save the note (used by auto-save and by the explicit save action). */
  updateConsultationNote: (
    id: string | number,
    payload: ConsultationNotePayload,
  ) => axios.patch(consultationPath(id), payload),
  deleteConsultation: (id: string | number) =>
    axios.delete(consultationPath(id)),
  completeConsultation: (id: string | number) =>
    axios.patch(consultationPath(id) + "/complete", undefined),
  /** Full consultation history of one patient (patient detail / history panel). */
  fetchPatientHistory: (patientId: string | number) =>
    axios.get(`${CONSULTATIONS}/patient/${patientId}/history`),
  addPrescriptionLine: (
    consultationId: string | number,
    line: PrescriptionLinePayload,
  ) => axios.post(`${consultationPath(consultationId)}/prescriptions`, line),
  updatePrescriptionLine: (
    consultationId: string | number,
    lineId: string | number,
    line: PrescriptionLinePayload,
  ) =>
    axios.patch(
      `${consultationPath(consultationId)}/prescriptions/${lineId}`,
      line,
    ),
  /* --------------------------------- queue ---------------------------------- */
  /** Today's queue of one doctor (waiting / skipped / done tokens). */
  fetchDoctorQueue: (doctorId: string | number, date: string) =>
    axios.get(`${QUEUE}/doctor/${doctorId}`, { params: { date } }),
  /** Nurse-station queue for a date and tab. */
  fetchNurseQueue: (date: string, tab: "waiting" | "done") =>
    axios.get(`${QUEUE}/nurse`, { params: { date, tab } }),
  /** Broadcast the call for one token on the TV/display. */
  callToken: (tokenId: string | number) =>
    axios.patch(`${QUEUE}/${tokenId}/call`, undefined),
  /** Call the next waiting token of a doctor. */
  callNextToken: (doctorId: string | number, date: string) =>
    axios.patch(`${QUEUE}/call-next/${doctorId}`, undefined, {
      params: { date },
    }),
  skipToken: (tokenId: string | number) =>
    axios.patch(`${QUEUE}/${tokenId}/skip`, undefined),
  requeueToken: (tokenId: string | number) =>
    axios.patch(`${QUEUE}/${tokenId}/requeue`, undefined),
  /**
   * Generate the OPD queue token of an appointment (appointment list action).
   * Returns the standard envelope so the caller can read `data.tokenNumber`.
   */
  generateOpdToken: (appointmentId: string | number) =>
    axios.post(`${QUEUE}/generate`, { appointmentId }),
  /* --------------------------------- vitals --------------------------------- */
  /** Create (no id) or update (id) the vitals of an appointment. */
  saveVitals: (
    payload: Record<string, unknown>,
    vitalsId?: string | number | null,
  ) =>
    vitalsId
      ? axios.patch(`${VITALS}/${vitalsId}`, payload)
      : axios.post(VITALS, payload),
  fetchVitalsByAppointment: (appointmentId: string | number) =>
    axios.get(`${VITALS}/appointment/${appointmentId}`),
};
