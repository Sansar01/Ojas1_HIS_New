/**
 * Consultation domain API — OPD consultations, the doctor queue and vitals.
 *
 * Consultations:
 *   GET    /api/opd/consultations                          consultationApi.list
 *   GET    /api/opd/consultations/:id                      consultationApi.getById
 *   POST   /api/opd/consultations                          consultationApi.create
 *   PATCH  /api/opd/consultations/:id                      consultationApi.updateNote
 *   DELETE /api/opd/consultations/:id                      consultationApi.remove
 *   PATCH  /api/opd/consultations/:id/complete             consultationApi.complete
 *   GET    /api/opd/consultations/patient/:id/history      consultationApi.patientHistory
 *   POST   /api/opd/consultations/:id/prescriptions        consultationApi.addPrescriptionLine
 *   PATCH  /api/opd/consultations/:id/prescriptions/:line  consultationApi.updatePrescriptionLine
 *
 * Queue (same clinical workflow, different lifecycle — Rule 23):
 *   GET    /api/opd/queue/doctor/:doctorId     consultationApi Queue
 *   PATCH  /api/opd/queue/:tokenId/call        …
 *   PATCH  /api/opd/queue/call-next/:doctorId  …
 *   PATCH  /api/opd/queue/:tokenId/skip        …
 *   PATCH  /api/opd/queue/:tokenId/requeue     …
 *   GET    /api/opd/queue/nurse                …
 *
 * Vitals (recorded during a consultation):
 *   POST   /api/opd/vitals                     consultationApi.saveVitals
 *   PATCH  /api/opd/vitals/:id                 consultationApi.saveVitals (with id)
 *   GET    /api/opd/vitals/appointment/:id     consultationApi.getVitalsByAppointment
 *
 * EVERY call in this file returns an `ApiResult` (`{ ok, data }`) — the
 * screens in the consultation module only ask "did it work and what came
 * back?", so envelope handling stays here and never leaks into a page
 * (Rule 28: pages must not duplicate response parsing).
 */

import { apiClient } from "./apiClient";
import { API_ENDPOINTS } from "./endpoints";
import { safeResult, type ApiResult } from "./apiResult";

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
}

export const consultationApi = {
  /* ------------------------------ consultations --------------------------- */

  /**
   * Paged consultation list. The screen owns the filter state; the domain
   * turns it into query parameters.
   */
  list: (params: Record<string, string> = {}): Promise<ApiResult<any>> =>
    safeResult(
      apiClient(API_ENDPOINTS.consultations.list, {
        method: "GET",
        params: Object.keys(params).length ? params : undefined,
      }),
    ),

  getById: (id: string | number): Promise<ApiResult<any>> =>
    safeResult(apiClient(API_ENDPOINTS.consultations.getById(id), { method: "GET" })),

  create: (payload: { appointmentId: string | number }): Promise<ApiResult<any>> =>
    safeResult(
      apiClient(API_ENDPOINTS.consultations.create, {
        method: "POST",
        body: payload,
      }),
    ),

  /** Non-throwing note save — used by auto-save and by the explicit save. */
  updateNote: (
    id: string | number,
    payload: ConsultationNotePayload,
  ): Promise<ApiResult<any>> =>
    safeResult(
      apiClient(API_ENDPOINTS.consultations.update(id), {
        method: "PATCH",
        body: payload,
      }),
    ),

  remove: (id: string | number): Promise<ApiResult<any>> =>
    safeResult(apiClient(API_ENDPOINTS.consultations.update(id), { method: "DELETE" })),

  complete: (id: string | number): Promise<ApiResult<any>> =>
    safeResult(
      apiClient(API_ENDPOINTS.consultations.complete(id), { method: "PATCH" }),
    ),

  /** Full consultation history of one patient — used by the history panel. */
  patientHistory: (patientId: string | number) =>
    apiClient(API_ENDPOINTS.consultations.history(patientId), { method: "GET" }),

  addPrescriptionLine: (
    consultationId: string | number,
    line: PrescriptionLinePayload,
  ): Promise<ApiResult<any>> =>
    safeResult(
      apiClient(API_ENDPOINTS.consultations.prescriptions(consultationId), {
        method: "POST",
        body: line,
      }),
    ),

  updatePrescriptionLine: (
    consultationId: string | number,
    lineId: string | number,
    line: PrescriptionLinePayload,
  ): Promise<ApiResult<any>> =>
    safeResult(
      apiClient(
        API_ENDPOINTS.consultations.prescriptionLine(consultationId, lineId),
        { method: "PATCH", body: line },
      ),
    ),

  /* --------------------------------- queue -------------------------------- */

  /** Today's queue of one doctor ("waiting" / "done" tabs). */
  getDoctorQueue: (
    doctorId: string | number,
    date: string,
  ): Promise<ApiResult<any>> =>
    safeResult(
      apiClient(API_ENDPOINTS.queue.byDoctor(doctorId), {
        method: "GET",
        params: { date },
      }),
    ),

  /** Nurse station queue (date + waiting/done tab). */
  getNurseQueue: (
    date: string,
    tab: "waiting" | "done",
  ): Promise<ApiResult<any>> =>
    safeResult(
      apiClient(API_ENDPOINTS.queue.nurse, {
        method: "GET",
        params: { date, tab },
      }),
    ),

  /** Broadcast the TV/display call for one token. */
  callToken: (tokenId: string | number): Promise<ApiResult<any>> =>
    safeResult(
      apiClient(API_ENDPOINTS.queue.call(tokenId), { method: "PATCH" }),
    ),

  callNext: (doctorId: string | number, date: string): Promise<ApiResult<any>> =>
    safeResult(
      apiClient(API_ENDPOINTS.queue.callNext(doctorId), {
        method: "PATCH",
        params: { date },
      }),
    ),

  skipToken: (tokenId: string | number): Promise<ApiResult<any>> =>
    safeResult(
      apiClient(API_ENDPOINTS.queue.skip(tokenId), { method: "PATCH" }),
    ),

  requeueToken: (tokenId: string | number): Promise<ApiResult<any>> =>
    safeResult(
      apiClient(API_ENDPOINTS.queue.requeue(tokenId), { method: "PATCH" }),
    ),

  generateToken: (payload: { appointmentId: string | number }) =>
    apiClient(API_ENDPOINTS.queue.generateToken, {
      method: "POST",
      body: payload,
    }),

  /* --------------------------------- vitals ------------------------------- */

  /** Create (no id) or update (id present) the vitals of an appointment. */
  saveVitals: (
    payload: Record<string, unknown>,
    vitalsId?: string | number | null,
  ): Promise<ApiResult<any>> =>
    safeResult(
      vitalsId
        ? apiClient(API_ENDPOINTS.vitals.byId(vitalsId), {
            method: "PATCH",
            body: payload,
          })
        : apiClient(API_ENDPOINTS.vitals.create, {
            method: "POST",
            body: payload,
          }),
    ),

  getVitalsByAppointment: (
    appointmentId: string | number,
  ): Promise<ApiResult<any>> =>
    safeResult(
      apiClient(API_ENDPOINTS.vitals.byAppointment(appointmentId), {
        method: "GET",
      }),
    ),
};

