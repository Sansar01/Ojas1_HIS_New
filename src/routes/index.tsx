import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth, RequireModule, PublicOnly } from "@/routes/guards";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { LoginPage } from "@/pages/auth/LoginPage";
import {
  ChangePasswordPage,
  ResetPasswordPage,
} from "@/pages/auth/RecoveryPages";
import { DashboardPage } from "@/pages/DashboardPage";
import { PatientsPage, PatientDetailPage } from "@/pages/patients/PatientsPage";
import { PatientsNewPage } from "@/pages/patients/PatientsNewPage";
import { DoctorsPage, DoctorDetailPage } from "@/pages/doctors/DoctorsPage";
import { AppointmentsPage } from "@/pages/appointments/AppointmentsPage";
import {
  ConsultationsPage,
  ConsultationWorkspacePage,
} from "@/pages/consultations/ConsultationsPage";
import { BillingPage } from "@/pages/billing/BillingPage";
import { DepartmentsPage, SpecializationsPage } from "@/pages/org/OrgPages";
import { UsersPage } from "@/pages/users/UsersPage";
import { UsersNewPage } from "@/pages/users/UsersNewPage";
import {
  RolesPage,
  SettingsPage,
  NotFoundPage,
} from "@/pages/admin/AdminPages";

/**
 * Public routes → auth screens.
 * Protected routes → RequireAuth (session) + RequireModule (RBAC per module).
 */
export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/accounts/login"
          element={
            <PublicOnly>
              <LoginPage />
            </PublicOnly>
          }
        />
        <Route
          path="/accounts/forgot-password"
          element={
            <PublicOnly>
              <ChangePasswordPage />
            </PublicOnly>
          }
        />
        <Route
          path="/accounts/reset-password"
          element={
            <PublicOnly>
              <ResetPasswordPage />
            </PublicOnly>
          }
        />

        <Route
          path="/"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <RequireModule module="dashboard">
                <DashboardPage />
              </RequireModule>
            }
          />
          <Route
            path="/patients"
            element={
              <RequireModule module="patients">
                <PatientsPage />
              </RequireModule>
            }
          />
          <Route
            path="patients/new"
            element={
              <RequireModule module="patients">
                <PatientsNewPage />
              </RequireModule>
            }
          />
          <Route
            path="patients/:id"
            element={
              <RequireModule module="patients">
                <PatientDetailPage />
              </RequireModule>
            }
          />
          <Route
            path="/doctors"
            element={
              <RequireModule module="doctors">
                <DoctorsPage />
              </RequireModule>
            }
          />
          <Route
            path="doctors/:id"
            element={
              <RequireModule module="doctors">
                <DoctorDetailPage />
              </RequireModule>
            }
          />
          <Route
            path="/departments"
            element={
              <RequireModule module="departments">
                <DepartmentsPage />
              </RequireModule>
            }
          />
          <Route
            path="/specializations"
            element={
              <RequireModule module="specializations">
                <SpecializationsPage />
              </RequireModule>
            }
          />
          <Route
            path="/appointments"
            element={
              <RequireModule module="appointments">
                <AppointmentsPage />
              </RequireModule>
            }
          />
          <Route
            path="/consultation"
            element={
              <RequireModule module="consultations">
                <ConsultationsPage />
              </RequireModule>
            }
          />
          <Route
            path="/consultation/:id"
            element={
              <RequireModule module="consultations">
                <ConsultationWorkspacePage />
              </RequireModule>
            }
          />
          <Route
            path="/billing"
            element={
              <RequireModule module="billing">
                <BillingPage />
              </RequireModule>
            }
          />
          <Route
            path="/users"
            element={
              <RequireModule module="users">
                <UsersPage />
              </RequireModule>
            }
          />
          <Route
            path="/users/new"
            element={
              <RequireModule module="users">
                <UsersNewPage />
              </RequireModule>
            }
          />
          <Route
            path="/roles"
            element={
              <RequireModule module="roles">
                <RolesPage />
              </RequireModule>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireModule module="settings">
                <SettingsPage />
              </RequireModule>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
