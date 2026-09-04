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
// Vite exposes env variables prefixed with VITE_ on import.meta.env
export const API_BASE_URL: string =
  (import.meta.env as any).VITE_API_BASE_URL || "http://localhost:8000/api";

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
    me: "/api/hospital/auth/me",
    changePassword: "/api/hospital/auth/change-password",
    resetPassword: "/api/hospital/auth/reset-password",
  },

  // Users
  users: "/api/hospital/users",

  //modules
  entitlement_modules: "/api/hospital/roles/entitlements/modules",

  // Roles
  roles: "/api/hospital/roles",

  // Patients
  patients: "/patients",

  // Doctors
  doctors: "/api/opd/doctors/create",

  // Departments
  departments: "/api/hospital/departments",

  // Specializations
  specializations: "/specializations",

  // Appointments
  appointments: "/appointments",

  // Consultations
  consultations: "/consultations",

  // Invoices / Billing
  invoices: "/invoices",

  // Hospital Settings
  //hospital: '/hospital',

  // Activities / Audit Log
  activities: "/activities",
} as const;

// Helper to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};

export default {
  baseUrl: API_BASE_URL,
  endpoints: API_ENDPOINTS,
  env: APP_ENV,
  debug: DEBUG,
  buildUrl: buildApiUrl,
};
