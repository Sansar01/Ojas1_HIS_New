/**
 * Ojas1 HIMS — the ONE central endpoint file.
 *
 * `API_ENDPOINTS` is the single source of truth for every API path in the
 * application. Grouped by domain so a path is always easy to find:
 *
 *   API_ENDPOINTS.auth.login          → where is the login API?
 *   API_ENDPOINTS.patients.getById(id)→ where is one patient's API?
 *
 * Rules for this file:
 *   • Keep it LIGHTWEIGHT — paths only. No fetch calls, no createAsyncThunk,
 *     no React hooks, no toasts, no loading state, no business rules.
 *   • Groups follow the architecture spec: auth, password, modules,
 *     permissions, roles, hospitals, users, patients, doctors, departments,
 *     specializations, appointments, consultations, billing (+ masters,
 *     queue, vitals, activities used by the current Ojas1 screens).
 *   • The paths below are the ACTUAL backend routes of the Ojas1 project,
 *     not assumptions — they were migrated 1:1 from the previous scattered
 *     definitions (config/api.ts + inline service URLs).
 *
 * Every request goes through `api/apiClient.ts`; nothing else concatenates
 * URLs or origins.
 */

export const API_ENDPOINTS = {
  // =========================
  // AUTHENTICATION
  // =========================
  auth: {
    login: "/api/hospital/auth/login",
    verifyOtp: "/api/hospital/auth/verify-otp",
    logout: "/api/hospital/auth/logout",
    refreshToken: "/api/hospital/auth/refresh",
  },

  // =========================
  // PASSWORD
  // =========================
  password: {
    change: "/api/hospital/auth/change-password",
    // forced change uses the same backend route with a different DTO
    forceChange: "/api/hospital/auth/change-password",
    forgot: "/api/hospital/auth/send-reset-code",
    reset: "/api/hospital/auth/reset-password",
    resetWithCode: "/api/hospital/auth/reset-password-with-code",
  },

  // =========================
  // MODULES
  // =========================
  modules: {
    // module catalogue (+ features) granted to the signed-in user
    available: "/api/hospital/roles/entitlements/modules",
  },

  // =========================
  // PERMISSIONS
  // =========================
  permissions: {
    // module/feature assignments of one role (RBAC matrix)
    byRole: (roleId: string | number) =>
      `/api/hospital/roles/${roleId}/permissions`,
  },

  // =========================
  // ROLES
  // =========================
  roles: {
    list: "/api/hospital/roles",
    getById: (id: string | number) => `/api/hospital/roles/${id}`,
    create: "/api/hospital/roles",
    update: (id: string | number) => `/api/hospital/roles/${id}`,
    delete: (id: string | number) => `/api/hospital/roles/${id}`,
    masterCatalog: "/api/hospital/roles/master-catalog",
  },

  // =========================
  // HOSPITALS
  // =========================
  hospitals: {
    // facility profile shown on invoices / settings screens
    profile: "/hospital",
  },

  // =========================
  // USERS
  // =========================
  users: {
    list: "/api/hospital/users",
    getById: (id: string | number) => `/api/hospital/users/${id}`,
    create: "/api/hospital/users",
    update: (id: string | number) => `/api/hospital/users/${id}`,
    delete: (id: string | number) => `/api/hospital/users/${id}`,
  },

  // =========================
  // PATIENTS
  // =========================
  patients: {
    list: "/api/opd/patients",
    getById: (id: string | number) => `/api/opd/patients/${id}`,
    create: "/api/opd/patients",
    update: (id: string | number) => `/api/opd/patients/${id}`,
    delete: (id: string | number) => `/api/opd/patients/${id}`,
  },

  // =========================
  // DOCTORS
  // =========================
  doctors: {
    list: "/api/opd/doctors/list",
    getById: (id: string | number) => `/api/opd/doctors/${id}`,
    create: "/api/opd/doctors/create",
    update: (id: string | number) => `/api/opd/doctors/${id}`,
    delete: (id: string | number) => `/api/opd/doctors/${id}`,
    availability: (id: string | number) =>
      `/api/opd/doctors/${id}/availability`,
    leaves: (id: string | number) => `/api/opd/doctors/${id}/leaves`,
    cancel: (id: string | number) => `/api/opd/doctors/${id}/cancel`,
  },

  // =========================
  // DEPARTMENTS
  // =========================
  departments: {
    list: "/api/hospital/masters/departments",
    getById: (id: string | number) => `/api/hospital/masters/departments/${id}`,
    create: "/api/hospital/masters/departments",
    update: (id: string | number) => `/api/hospital/masters/departments/${id}`,
    delete: (id: string | number) => `/api/hospital/masters/departments/${id}`,
  },

  // =========================
  // SPECIALIZATIONS
  // =========================
  specializations: {
    // legacy flat path kept byte-identical to the current integration
    // (the id is accepted for the standard CRUD contract but unused)
    list: "/specializations",
    getById: (_id: string | number) => "/specializations",
    create: "/specializations",
    update: (_id: string | number) => "/specializations",
    delete: (_id: string | number) => "/specializations",
  },

  // =========================
  // APPOINTMENTS
  // =========================
  appointments: {
    list: "/api/opd/appointments",
    getById: (id: string | number) => `/api/opd/appointments/${id}`,
    create: "/api/opd/appointments",
    update: (id: string | number) => `/api/opd/appointments/${id}`,
    delete: (id: string | number) => `/api/opd/appointments/${id}`,
    slot: "/api/opd/appointments/slot",
    today: "/api/opd/appointments/today",
    edit: (id: string | number) => `/api/opd/appointments/${id}/edit`,
    cancel: (id: string | number) => `/api/opd/appointments/${id}/cancel`,
    checkIn: (id: string | number) => `/api/opd/appointments/${id}/check-in`,
    /** visit/consultation-type dropdown (global master reference data) */
    getConsultationType: (type: string) =>
      `/api/hospital/masters/global/dropdown/${type}`,
  },

  // =========================
  // CONSULTATIONS
  // =========================
  consultations: {
    list: "/api/opd/consultations",
    getById: (id: string | number) => `/api/opd/consultations/${id}`,
    create: "/api/opd/consultations",
    update: (id: string | number) => `/api/opd/consultations/${id}`,
    delete: (id: string | number) => `/api/opd/consultations/${id}`,
    history: (patientId: string | number) =>
      `/api/opd/consultations/patient/${patientId}/history`,
    complete: (id: string | number) => `/api/opd/consultations/${id}/complete`,
    prescriptions: (id: string | number) =>
      `/api/opd/consultations/${id}/prescriptions`,
    prescriptionLine: (id: string | number, lineId: string | number) =>
      `/api/opd/consultations/${id}/prescriptions/${lineId}`,
  },

  // =========================
  // BILLING
  // =========================
  billing: {
    list: "/api/opd/billing",
    getById: (id: string | number) => `/api/opd/billing/${id}`,
    create: "/api/opd/billing",
    update: (id: string | number) => `/api/opd/billing/${id}`,
    delete: (id: string | number) => `/api/opd/billing/${id}`,
    cancel: (id: string | number) => `/api/opd/billing/${id}/cancel`,
    dailySummary: "/api/opd/billing/daily-summary",
    payments: "/api/opd/billing/payments",
    collectPayment: (billId: string | number) =>
      `/api/opd/billing/${billId}/payments`,
  },

  // =========================
  // MASTERS (master configuration)
  // =========================
  masters: {
    // generic master tables — the tab supplies its slug (e.g. "departments")
    byType: (type: string) => `/api/hospital/masters/${type}`,
    byTypeId: (type: string, id: string | number) =>
      `/api/hospital/masters/${type}/${id}`,

    // global master values
    global: {
      sidebar: "/api/hospital/masters/global/sidebar",
      byType: (type: string) => `/api/hospital/masters/global/type/${type}`,
      dropdown: (type: string) =>
        `/api/hospital/masters/global/dropdown/${type}`,
      create: "/api/hospital/masters/global",
      byId: (id: string | number) => `/api/hospital/masters/global/${id}`,
      reorder: (type: string) => `/api/hospital/masters/global/reorder/${type}`,
      seed: "/api/hospital/masters/global/seed",
    },

    // panel master
    panels: {
      list: "/api/hospital/masters/panels",
      dropdown: "/api/hospital/masters/panels/dropdown",
      byId: (id: string | number) => `/api/hospital/masters/panels/${id}`,
    },

    // service master
    services: {
      list: "/api/hospital/masters/services",
      byId: (id: string | number) => `/api/hospital/masters/services/${id}`,
    },

    // tariff master
    tariffs: {
      list: "/api/hospital/masters/tariffs",
      dropdown: "/api/hospital/masters/tariffs/dropdown",
      byId: (id: string | number) => `/api/hospital/masters/tariffs/${id}`,
      rates: (tariffId: string | number) =>
        `/api/hospital/masters/tariffs/${tariffId}/rates`,
      ratesBulk: (tariffId: string | number) =>
        `/api/hospital/masters/tariffs/${tariffId}/rates/bulk`,
      rateByService: (tariffId: string | number, serviceId: string | number) =>
        `/api/hospital/masters/tariffs/${tariffId}/rates/${serviceId}`,
    },
  },

  // =========================
  // OPD QUEUE / VITALS
  // =========================
  queue: {
    generateToken: "/api/opd/queue/generate",
    nurse: "/api/opd/queue/nurse",
    byDoctor: (doctorId: string | number) =>
      `/api/opd/queue/doctor/${doctorId}`,
    callNext: (doctorId: string | number) =>
      `/api/opd/queue/call-next/${doctorId}`,
    call: (tokenId: string | number) => `/api/opd/queue/${tokenId}/call`,
    skip: (tokenId: string | number) => `/api/opd/queue/${tokenId}/skip`,
    requeue: (tokenId: string | number) => `/api/opd/queue/${tokenId}/requeue`,
  },

  vitals: {
    create: "/api/opd/vitals",
    byId: (id: string | number) => `/api/opd/vitals/${id}`,
    byAppointment: (appointmentId: string | number) =>
      `/api/opd/vitals/appointment/${appointmentId}`,
  },

  // =========================
  // ACTIVITIES / AUDIT LOG
  // =========================
  activities: {
    // legacy flat path kept byte-identical to the current integration
    // (the id is accepted for the standard CRUD contract but unused)
    list: "/activities",
    getById: (_id: string | number) => "/activities",
    create: "/activities",
    update: (_id: string | number) => "/activities",
    delete: (_id: string | number) => "/activities",
  },
} as const;

export default API_ENDPOINTS;
