import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import {
  RequireAuth,
  RequireBootstrap,
  PublicOnly,
  RequirePasswordChange,
  ModuleRoute,
} from "@/routes/guards";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Spinner } from "@/components/ui/feedback";

/* The sign-in path stays eager: it is the first screen and it is small. */
import { LoginPage } from "@/pages/auth/LoginPage";
import {
  ForgotPasswordPage,
  ResetPasswordPage,
} from "@/pages/auth/RecoveryPages";
import ForcePasswordChange from "@/pages/auth/ForcePasswordChange";
import { PermissionBootstrapPage } from "@/pages/auth/PermissionBootstrapPage";

/* Everything behind the shell loads on demand — one chunk per screen, so a
   first visit ships the shell instead of all 21 screens (report §13). The
   `m.X` mapping merely keeps the named exports the routes below already use;
   no call site or component changes. */
const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const PatientsPage = lazy(() =>
  import("@/pages/patients/PatientsPage").then((m) => ({
    default: m.PatientsPage,
  })),
);
const PatientsFormPage = lazy(() =>
  import("@/pages/patients/patientFormPage").then((m) => ({
    default: m.PatientsFormPage,
  })),
);
const PatientDetailPage = lazy(() =>
  import("@/pages/patients/patientDetailPage").then((m) => ({
    default: m.PatientDetailPage,
  })),
);
const DoctorsPage = lazy(() =>
  import("@/pages/doctors/DoctorsPage").then((m) => ({
    default: m.DoctorsPage,
  })),
);
const DoctorDetailPage = lazy(() =>
  import("@/pages/doctors/DoctorsPage").then((m) => ({
    default: m.DoctorDetailPage,
  })),
);
const DepartmentsPage = lazy(() =>
  import("@/pages/Departments/DepartmentsPage").then((m) => ({
    default: m.DepartmentsPage,
  })),
);
const SpecializationsPage = lazy(() =>
  import("@/pages/Specializations/SpecializationPage").then((m) => ({
    default: m.SpecializationsPage,
  })),
);
const AppointmentsPage = lazy(() =>
  import("@/pages/appointments/AppointmentsPage").then((m) => ({
    default: m.AppointmentsPage,
  })),
);
const ConsultationsPage = lazy(() =>
  import("@/pages/consultations/ConsultationsPage").then((m) => ({
    default: m.ConsultationsPage,
  })),
);
const ConsultationWorkspacePage = lazy(() =>
  import("@/pages/consultations/ConsultationsPage").then((m) => ({
    default: m.ConsultationWorkspacePage,
  })),
);
const BillingPage = lazy(() =>
  import("@/pages/billing/BillingPage").then((m) => ({
    default: m.BillingPage,
  })),
);
const UsersPage = lazy(() =>
  import("@/pages/users/UsersPage").then((m) => ({ default: m.UsersPage })),
);
const UsersNewPage = lazy(() =>
  import("@/pages/users/UsersNewPage").then((m) => ({
    default: m.UsersNewPage,
  })),
);
const RolesPage = lazy(() =>
  import("@/pages/admin/AdminPages").then((m) => ({ default: m.RolesPage })),
);
const SettingsPage = lazy(() =>
  import("@/pages/admin/AdminPages").then((m) => ({ default: m.SettingsPage })),
);
const NotFoundPage = lazy(() =>
  import("@/pages/admin/AdminPages").then((m) => ({ default: m.NotFoundPage })),
);
const OpdExaminationRoom = lazy(() =>
  import("@/pages/opd/Opd").then((m) => ({ default: m.OpdExaminationRoom })),
);
const MasterConfigurationPage = lazy(() =>
  import("@/pages/masterConfiguration/MasterConfigurationPage").then((m) => ({
    default: m.MasterConfigurationPage,
  })),
);

/* IPD module — ward board, admission census, admission form, patient chart and
   the discharge wizard. Pure additions: the pages live under
   `src/pages/ipd/` and touch no existing screen. */
const IpdWardBoardPage = lazy(() =>
  import("@/pages/ipd/IpdWardBoardPage").then((m) => ({
    default: m.IpdWardBoardPage,
  })),
);
const IpdAdmissionsPage = lazy(() =>
  import("@/pages/ipd/IpdAdmissionsPage").then((m) => ({
    default: m.IpdAdmissionsPage,
  })),
);
const IpdAdmissionFormPage = lazy(() =>
  import("@/pages/ipd/IpdAdmissionFormPage").then((m) => ({
    default: m.IpdAdmissionFormPage,
  })),
);
const IpdPatientChartPage = lazy(() =>
  import("@/pages/ipd/IpdPatientChartPage").then((m) => ({
    default: m.IpdPatientChartPage,
  })),
);
const IpdDischargePage = lazy(() =>
  import("@/pages/ipd/IpdDischargePage").then((m) => ({
    default: m.IpdDischargePage,
  })),
);

/**
 * Entitlement keys of the IPD module. The backend seeds the module as
 * `IPD_MANAGEMENT` on route `/ipd`; `ModuleRoute` normalises every key
 * ("ipd" → IPD, "ipd-management" → IPD_MANAGEMENT), so all spellings resolve
 * to the same module. Without the entitlement the 404 page is shown — the
 * routes stay invisible, exactly like every other module.
 */
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
      <Suspense
        fallback={
          <div className="grid h-dvh place-items-center bg-ink-25 text-brand-600">
            <Spinner size={22} />
          </div>
        }
      >
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
                <ModuleRoute
                  module="patients"
                  aliases={["patient-registration"]}
                >
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
            {/* Ward setup lives as a dialog on the Master Configuration page
                (no separate screen); both old paths land on it. */}
            <Route
              path="/master-config/ward-setup"
              element={<Navigate to="/master-config?open=ward-setup" replace />}
            />

            {/* ── IPD ───────────────────────────────────────────────────────
                Additive block: ward board (/ipd) → census → admission form →
                patient chart → discharge wizard. `aliases` only widen the
                accepted spellings of the SAME entitlement module; a user
                without it still gets the 404 page. Route order matters for
                readability only — the static "new" path outranks ":id". */}
            <Route
              path="/ipd"
              element={
                <ModuleRoute module="ipd" label="IPD Management">
                  <IpdWardBoardPage />
                </ModuleRoute>
              }
            />
            {/* Moved to Master Configuration — the old path stays alive as a
                redirect that opens the ward-setup dialog there. */}
            <Route
              path="/ipd/setup"
              element={<Navigate to="/master-config?open=ward-setup" replace />}
            />
            <Route
              path="/ipd/admissions"
              element={
                <ModuleRoute module="ipd" label="IPD Management">
                  <IpdAdmissionsPage />
                </ModuleRoute>
              }
            />
            <Route
              path="/ipd/admissions/new"
              element={
                <ModuleRoute module="ipd" label="IPD Management">
                  <IpdAdmissionFormPage />
                </ModuleRoute>
              }
            />
            <Route
              path="/ipd/admissions/:id"
              element={
                <ModuleRoute module="ipd" label="IPD Management">
                  <IpdPatientChartPage />
                </ModuleRoute>
              }
            />
            <Route
              path="/ipd/admissions/:id/discharge"
              element={
                <ModuleRoute module="ipd" label="IPD Management">
                  <IpdDischargePage />
                </ModuleRoute>
              }
            />

            <Route path="*" element={<NotFoundPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default AppRoutes;
