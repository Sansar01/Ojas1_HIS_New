import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import {
  RequireAuth,
  RequireBootstrap,
  PublicOnly,
  RequirePasswordChange,
  ModuleRoute,
} from "@/routes/guards";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { LoginPage } from "@/pages/auth/LoginPage";
import {
  ForgotPasswordPage,
  ResetPasswordPage,
} from "@/pages/auth/RecoveryPages";
import { DashboardPage } from "@/pages/DashboardPage";
import { PatientsPage } from "@/pages/patients/PatientsPage";
import { DoctorsPage, DoctorDetailPage } from "@/pages/doctors/DoctorsPage";
import { AppointmentsPage } from "@/pages/appointments/AppointmentsPage";
import {
  ConsultationsPage,
  ConsultationWorkspacePage,
} from "@/pages/consultations/ConsultationsPage";
import { BillingPage } from "@/pages/billing/BillingPage";
import { UsersPage } from "@/pages/users/UsersPage";
import { UsersNewPage } from "@/pages/users/UsersNewPage";
import {
  RolesPage,
  SettingsPage,
  NotFoundPage,
} from "@/pages/admin/AdminPages";
import { PatientsFormPage } from "@/pages/patients/patientFormPage";
import { PatientDetailPage } from "@/pages/patients/patientDetailPage";
import ForcePasswordChange from "@/pages/auth/ForcePasswordChange";
import { PermissionBootstrapPage } from "@/pages/auth/PermissionBootstrapPage";
import { OpdExaminationRoom } from "@/pages/opd/Opd";
import { MasterConfigurationPage } from "@/pages/masterConfiguration/MasterConfigurationPage";
import { SpecializationsPage } from "@/pages/Specializations/SpecializationPage";
import { DepartmentsPage } from "@/pages/Departments/DepartmentsPage";

/**
 * Public routes → auth screens.
 * Protected routes → RequireAuth (session) + ModuleRoute (entitlement check).
 *
 * How access is decided (see `ModuleRoute` in ./guards.tsx):
 *   • the URL must exist as a `<Route>` below, otherwise the catch-all `*`
 *     renders the 404 page;
 *   • `module="…"` must name a module the entitlements API actually returned
 *     for this user (exact code / route / name match). If it did not, the same
 *     404 page is shown — the page's existence is never leaked;
 *   • if the module exists but the required `action` is missing, the 403
 *     "access restricted" page is shown instead.
 *
 * So: only modules the API grants are reachable; everything else is a 404.
 * Adding a page = adding one `<Route>` here with its `module="…"`.
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
              <ForgotPasswordPage />
            </PublicOnly>
          }
        />
        {/* shown only when the login response carried forcePasswordChange: true */}
        <Route
          path="/accounts/force-password-change"
          element={
            <RequirePasswordChange>
              <ForcePasswordChange />
            </RequirePasswordChange>
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

        {/*
          Authentication success lands here — never on the Dashboard (doc §37,
          §38, §49). This route owns modules → permissions and forwards the
          user to the page they asked for once the store is ready.
        */}
        <Route
          path="/permission"
          element={
            <RequireAuth>
              <PermissionBootstrapPage />
            </RequireAuth>
          }
        />

        <Route
          path="/"
          element={
            <RequireAuth>
              <RequireBootstrap>
                <DashboardLayout />
              </RequireBootstrap>
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <ModuleRoute module="dashboard">
                <DashboardPage />
              </ModuleRoute>
            }
          />
          <Route
            path="/patients"
            element={
              <ModuleRoute
                module="patients"
                aliases={["patient", "patient-registration"]}
              >
                <PatientsPage />
              </ModuleRoute>
            }
          />

          <Route
            path="/opd"
            element={
              <ModuleRoute module="patients" aliases={["opd"]}>
                <OpdExaminationRoom />
              </ModuleRoute>
            }
          />
          <Route
            path="patients/register"
            element={
              <ModuleRoute module="patients" aliases={["patient-registration"]}>
                <PatientsFormPage />
              </ModuleRoute>
            }
          />
          <Route
            path="patients/:id/edit"
            element={
              <ModuleRoute module="patients">
                <PatientsFormPage />
              </ModuleRoute>
            }
          />
          <Route
            path="patients/:id/detail"
            element={
              <ModuleRoute module="patients">
                <PatientDetailPage />
              </ModuleRoute>
            }
          />
          <Route
            path="/doctors"
            element={
              <ModuleRoute module="doctors">
                <DoctorsPage />
              </ModuleRoute>
            }
          />
          <Route
            path="doctors/:id"
            element={
              <ModuleRoute module="doctors">
                <DoctorDetailPage />
              </ModuleRoute>
            }
          />
          <Route
            path="/departments"
            element={
              <ModuleRoute module="departments">
                <DepartmentsPage />
              </ModuleRoute>
            }
          />
          <Route
            path="/specializations"
            element={
              <ModuleRoute module="specializations">
                <SpecializationsPage />
              </ModuleRoute>
            }
          />
          <Route
            path="/appointments"
            element={
              <ModuleRoute module="appointments">
                <AppointmentsPage />
              </ModuleRoute>
            }
          />

          <Route
            path="/consultation"
            element={
              <ModuleRoute module="consultation">
                <ConsultationsPage />
              </ModuleRoute>
            }
          />
          <Route
            path="/consultation/:id"
            element={
              <ModuleRoute module="consultation">
                <ConsultationWorkspacePage />
              </ModuleRoute>
            }
          />
          <Route
            path="/billing"
            element={
              <ModuleRoute module="billing">
                <BillingPage />
              </ModuleRoute>
            }
          />
          <Route
            path="/users"
            element={
              // no "user" alias on purpose: a bare USER/PROFILE module must not
              // unlock user administration
              <ModuleRoute module="users">
                <UsersPage />
              </ModuleRoute>
            }
          />
          <Route
            path="/users/new"
            element={
              <ModuleRoute module="users/new">
                <UsersNewPage />
              </ModuleRoute>
            }
          />
          <Route
            path="/roles"
            element={
              <ModuleRoute module="roles">
                <RolesPage />
              </ModuleRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ModuleRoute module="settings">
                <SettingsPage />
              </ModuleRoute>
            }
          />

          <Route
            path="/master-config"
            element={
              <ModuleRoute
                module="master-config"
                aliases={["master-configuration"]}
              >
                <MasterConfigurationPage />
              </ModuleRoute>
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
