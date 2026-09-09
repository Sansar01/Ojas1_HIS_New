/**
 * Centralized API Configuration
 *
 * This file reads the API Base URL from environment variables.
 * All API service calls should import from here instead of hardcoding URLs.
 *
 * To change the backend URL, simply update the VITE_API_BASE_URL
 * in the appropriate .env file (no code changes required).
 */

// Get the API base URL from Vite environment variables
export const API_BASE_URL: string =
  (import.meta.env as any).VITE_API_BASE_URL || "https://cloud-his-backend.onrender.com";

// Application environment
export const APP_ENV: string =
  (import.meta.env as any).VITE_APP_ENV || "development";

// Debug mode flag
export const DEBUG: boolean = (import.meta.env as any).VITE_DEBUG === "true";

// API Endpoints (relative paths - base URL is prepended by the API client)
export const API_ENDPOINTS = {
  // Authentication
  auth: {
    login: "/api/hospital/auth/login",
    logout: "/api/hospital/auth/logout",
    refresh: "/api/hospital/auth/refresh",
    //me: "/api/hospital/auth/me",
    changePassword: "/api/hospital/auth/change-password",
    resetPassword: "/api/hospital/auth/reset-password",
  },

  // Users
  users: "/api/hospital/users",

  // Modules
  entitlement_modules: "/api/hospital/roles/entitlements/modules",

  // Roles
  roles: "/api/hospital/roles",
  roleMasterCatalog: "/api/hospital/roles/master-catalog",
  rolePermissions: (roleId: string | number) =>
    `/api/hospital/roles/${roleId}/permissions`,

  // Patients
  patients: "/api/opd/patients",

  // Doctors
  // doctors: "/api/opd/doctors/create",
  doctors: {
    create: "/api/opd/doctors/create",
    list: "/api/opd/doctors/list",
    getSlotById: (Id: string | number) => `/api/opd/doctors/${Id}/availability`,
  },
  // Doctors / OPD Module
  createDoctor: "/api/opd/doctors/create",
  doctorDetail: (doctorId: string | number) =>
    `/api/opd/doctors/${doctorId}`,
  doctorAvailability: (doctorId: string | number) =>
    `/api/opd/doctors/${doctorId}/availability`,
  doctorLeaves: (doctorId: string | number) =>
    `/api/opd/doctors/${doctorId}/leaves`,

  // Departments
  departments: "/api/hospital/masters/departments",

  // Specializations
   specializations: "/specializations",

  // Appointments (grouped — the appointments slice resolves list/create/getById from here)
  appointment: {
    list: "/api/opd/appointments",
    create: "/api/opd/appointments",
    slot: "/api/opd/appointments/slot",
    getById: (Id: string | number) => `/api/opd/appointments/${Id}`,
    today: '/api/opd/appointments/today'
  },

  // Consultations
  consultations: "/consultations",

  // Invoices / Billing
  invoices: "/invoices",

  // Activities / Audit Log
  activities: "/activities",
} as const;

// Helper to build fully-qualified API URLs cleanly
export const buildApiUrl = (endpoint: string): string => {
  const base = API_BASE_URL.replace(/\/$/, ""); // Strip trailing slash if present
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  // If the base URL ends with "/api" and path starts with "/api/", trim duplicate segment
  if (base.endsWith("/api") && path.startsWith("/api/")) {
    return `${base}${path.substring(4)}`;
  }
  return `${base}${path}`;
};

export default {
  baseUrl: API_BASE_URL,
  endpoints: API_ENDPOINTS,
  env: APP_ENV,
  debug: DEBUG,
  buildUrl: buildApiUrl,
};