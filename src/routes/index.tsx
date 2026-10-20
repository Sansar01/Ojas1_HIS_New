import { Suspense, lazy, useEffect, type ComponentType } from "react";
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

/* Each screen is its own chunk. `page` keeps the named exports the routes use
   and records every loader so `PreloadPages` can warm the chunks in the
   background — the first visit to a module then opens without a network wait. */
const pageLoaders: Array<() => Promise<unknown>> = [];
function page<K extends string>(
  load: () => Promise<Record<K, ComponentType<any>>>,
  name: K,
) {
  pageLoaders.push(load);
  return lazy(() => load().then((m) => ({ default: m[name] })));
}

/**
 * Idle-time chunk warm-up, mounted only behind the login (see the shell route).
 *
 * The chunks are warmed ONE AT A TIME, on idle, instead of firing all 21
 * imports 1.5s after sign-in: a 21-way burst competes with the dashboard's own
 * API calls for bandwidth and hands the main thread every route's JS to parse
 * in one go — which is what made the first scroll and the first navigation feel
 * sticky. Page components are still lazy; this only removes the network wait
 * from the *second* visit to a module.
 */
function PreloadPages() {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let index = 0;

    const schedule = (cb: () => void) => {
      const ric = (window as any).requestIdleCallback as
        | ((fn: () => void, opts?: { timeout: number }) => number)
        | undefined;
      if (typeof ric === "function") {
        ric(cb, { timeout: 2500 });
        return;
      }
      timer = setTimeout(cb, 400);
    };

    const step = () => {
      if (cancelled || index >= pageLoaders.length) return;
      const load = pageLoaders[index++];
      // a failed warm-up is irrelevant: the route still lazy-loads on demand
      void load().catch(() => {});
      schedule(step);
    };

    timer = setTimeout(step, 1500);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);
  return null;
}

/* Everything behind the shell loads on demand — one chunk per screen, so a
   first visit ships the shell instead of all 21 screens (report §13). */
const DashboardPage = page(() => import("@/pages/DashboardPage"), "DashboardPage");
const PatientsPage = page(() => import("@/pages/patients/PatientsPage"), "PatientsPage");
const PatientsFormPage = page(() => import("@/pages/patients/patientFormPage"), "PatientsFormPage");
const PatientDetailPage = page(() => import("@/pages/patients/patientDetailPage"), "PatientDetailPage");
const DoctorsPage = page(() => import("@/pages/doctors/DoctorsPage"), "DoctorsPage");
const DoctorDetailPage = page(() => import("@/pages/doctors/DoctorsPage"), "DoctorDetailPage");
const DepartmentsPage = page(() => import("@/pages/Departments/DepartmentsPage"), "DepartmentsPage");
const SpecializationsPage = page(() => import("@/pages/Specializations/SpecializationPage"), "SpecializationsPage");
const AppointmentsPage = page(() => import("@/pages/appointments/AppointmentsPage"), "AppointmentsPage");
const ConsultationsPage = page(() => import("@/pages/consultations/ConsultationsPage"), "ConsultationsPage");
const ConsultationWorkspacePage = page(() => import("@/pages/consultations/ConsultationsPage"), "ConsultationWorkspacePage");
const BillingPage = page(() => import("@/pages/billing/BillingPage"), "BillingPage");
const UsersPage = page(() => import("@/pages/users/UsersPage"), "UsersPage");
const UsersNewPage = page(() => import("@/pages/users/UsersNewPage"), "UsersNewPage");
const RolesPage = page(() => import("@/pages/admin/AdminPages"), "RolesPage");
const SettingsPage = page(() => import("@/pages/admin/AdminPages"), "SettingsPage");
const NotFoundPage = page(() => import("@/pages/admin/AdminPages"), "NotFoundPage");
const OpdExaminationRoom = page(() => import("@/pages/opd/Opd"), "OpdExaminationRoom");
const MasterConfigurationPage = page(() => import("@/pages/masterConfiguration/MasterConfigurationPage"), "MasterConfigurationPage");

/* IPD module — ward board, admission census, admission form, patient chart and
   the discharge wizard. Pure additions: the pages live under
   `src/pages/ipd/` and touch no existing screen. */
const IpdWardBoardPage = page(() => import("@/pages/ipd/IpdWardBoardPage"), "IpdWardBoardPage");
const IpdAdmissionsPage = page(() => import("@/pages/ipd/IpdAdmissionsPage"), "IpdAdmissionsPage");
const IpdAdmissionFormPage = page(() => import("@/pages/ipd/IpdAdmissionFormPage"), "IpdAdmissionFormPage");
const IpdPatientChartPage = page(() => import("@/pages/ipd/IpdPatientChartPage"), "IpdPatientChartPage");
const IpdDischargePage = page(() => import("@/pages/ipd/IpdDischargePage"), "IpdDischargePage");

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
                  <PreloadPages />
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
