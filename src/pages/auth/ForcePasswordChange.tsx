import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { AuthLayout } from "@/layouts/AuthLayout";
import { useAppDispatch, useRootSelector } from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { changePassword, logout } from "@/features/auth/authSlice";
import { clearEntitlements } from "@/features/entitlement/entitlementSlice";
import { authApi } from "@/services/apiClient";
import { Button } from "@/components/ui/primitives";
import { Input } from "@/components/ui/fields";
import { Banner } from "@/components/ui/feedback";
import { cn } from "@/utils/cn";
import { fullName } from "@/utils";

/* ---------------------------------------------------------------------------
 * Force password change
 *
 * Shown only when the login response carried `forcePasswordChange: true`
 * (temporary password, admin reset, expiring credentials…). The user stays
 * signed in, sets a new password for their own account and is then released to
 * the dashboard. Route: /accounts/force-password-change
 *
 * Payload mirrors HospitalChangePasswordDto:
 *   { oldPassword: string (not empty), newPassword: string (min 8) }
 * ------------------------------------------------------------------------- */

const MIN_LENGTH = 8;

const rules = (value: string) => [
  { label: `At least ${MIN_LENGTH} characters`, ok: value.length >= MIN_LENGTH },
  { label: "One upper case letter", ok: /[A-Z]/.test(value) },
  { label: "One number", ok: /[0-9]/.test(value) },
  { label: "One symbol", ok: /[^A-Za-z0-9]/.test(value) },
];

function strengthOf(value: string) {
  const passed = rules(value).filter((r) => r.ok).length;
  return { passed, pct: (passed / 4) * 100 };
}

export function ForcePasswordChange() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const session = useRootSelector((s) => s.auth.session);
  const user = session?.user;

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    initialValues: { oldPassword: "", newPassword: "" },
    labels: {
      oldPassword: "Current password",
      newPassword: "New password",
    },
    // field-level feedback: on blur, and everything revealed on submit
    validateOnChange: false,
    validateOnBlur: true,
    schema: {
      oldPassword: [
        { required: "Enter the password you signed in with" },
        { min: 1, message: "Enter the password you signed in with" },
      ],
      newPassword: [
        { required: "New password is required" },
        {
          min: MIN_LENGTH,
          message: `New password must be at least ${MIN_LENGTH} characters`,
        },
        {
          message: "New password must be different from the current password",
          validate: (value: string, all: any) =>
            value && value === all.oldPassword
              ? "New password must be different from the current password"
              : true,
        },
      ],
    },
  });

  const strength = strengthOf(form.values.newPassword);

  const submit = form.handleSubmit(async (values) => {
    setServerError(null);
    setSubmitting(true);
    try {
      // the shared changePassword thunk (no new thunk): passing
      // { oldPassword, newPassword } sends HospitalChangePasswordDto and
      // clears the forcePasswordChange flag. An API error (wrong current
      // password) rejects, so it lands in the catch below.
      await dispatch(
        changePassword({
          oldPassword: values.oldPassword,
          newPassword: values.newPassword,
        }),
      ).unwrap();

      // // Password replaced → end the session and make the user sign in again
      // // with the new credentials (the flag is already cleared, so the login
      // // screen will send them straight to the dashboard afterwards).
      // authApi.logout().catch(() => undefined); // best-effort: clear the refresh cookie
      // dispatch(clearEntitlements());
      // dispatch(logout()); // clears the session + localStorage (no toast)
      navigate("/accounts/login", { replace: true });
    } catch (error: any) {
      const message =
        typeof error === "string"
          ? error
          : error?.message || "Could not update the password. Please try again.";
      setServerError(message);
      // keep focus on the field the user most likely got wrong
      form.focusField(/current|old/i.test(message) ? "oldPassword" : "newPassword");
    } finally {
      setSubmitting(false);
    }
  });

  const signOut = () => {
    authApi.logout().catch(() => undefined);
    dispatch(clearEntitlements());
    dispatch(logout());
    navigate("/accounts/login", { replace: true });
  };

  return (
    <AuthLayout
      eyebrow="Password change required"
      title="Your account needs a new password before you continue."
      aside={
        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-5 text-[11.5px] text-white/40">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-brand-300" /> Temporary
            password detected
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3.5 text-brand-300" /> You stay signed in
          </span>
        </div>
      }
    >
      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card sm:p-7">
        <span className="inline-flex items-center gap-2 rounded-lg bg-amberly-50 px-2.5 py-1 text-[11.5px] font-semibold text-amberly-600 ring-1 ring-inset ring-amberly-500/25">
          <ShieldAlert className="size-3.5" /> Action required
        </span>

        <h1 className="mt-3 font-display text-[24px] font-bold leading-tight text-ink-900">
          Set a new password
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-400">
          {user ? (
            <>
              You signed in as{" "}
              <strong className="font-semibold text-ink-700">
                {fullName(user)}
              </strong>{" "}
              <span className="num">({user.email})</span>. Choose a new password
              for this account to unlock the portal.
            </>
          ) : (
            "Choose a new password for your account to unlock the portal."
          )}
        </p>

        {serverError && (
          <Banner
            tone="danger"
            className="mt-5"
            title="Could not update the password"
          >
            {serverError}
          </Banner>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <Input
            ref={form.registerRef("oldPassword")}
            name="oldPassword"
            type={showOld ? "text" : "password"}
            autoComplete="current-password"
            label="Current password"
            required
            placeholder="The password you just signed in with"
            leadingIcon={<Lock />}
            value={form.values.oldPassword}
            onChange={(e) => form.setValue("oldPassword", e.target.value)}
            error={form.errorFor("oldPassword")}
            trailingIcon={
              <button
                type="button"
                onClick={() => setShowOld((v) => !v)}
                aria-label={showOld ? "Hide password" : "Show password"}
                className="pointer-events-auto rounded p-0.5 text-ink-400 transition-colors hover:text-ink-700"
              >
                {showOld ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
          />

          <div>
            <Input
              ref={form.registerRef("newPassword")}
              name="newPassword"
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              label="New password"
              required
              placeholder={`Minimum ${MIN_LENGTH} characters`}
              leadingIcon={<KeyRound />}
              value={form.values.newPassword}
              onChange={(e) => form.setValue("newPassword", e.target.value)}
              error={form.errorFor("newPassword")}
              hint={
                form.values.newPassword && strength.passed === 4
                  ? undefined
                  : "Your new password must satisfy the rules below."
              }
              trailingIcon={
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  aria-label={showNew ? "Hide password" : "Show password"}
                  className="pointer-events-auto rounded p-0.5 text-ink-400 transition-colors hover:text-ink-700"
                >
                  {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              }
            />

            {/* strength + requirements (guidance — the API only enforces ≥ 8) */}
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex h-1.5 flex-1 gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      "flex-1 rounded-full transition-colors",
                      i < strength.passed
                        ? strength.passed >= 3
                          ? "bg-mint-500"
                          : "bg-amberly-500"
                        : "bg-ink-100",
                    )}
                  />
                ))}
              </div>
              <span className="text-[11px] font-medium text-ink-400">
                {["Too weak", "Weak", "Fair", "Strong", "Excellent"][strength.passed]}
              </span>
            </div>

            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {rules(form.values.newPassword).map((rule) => (
                <li
                  key={rule.label}
                  className={cn(
                    "flex items-center gap-1.5 text-[11.5px]",
                    rule.ok ? "text-mint-600" : "text-ink-400",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-3.5 shrink-0 place-items-center rounded-full",
                      rule.ok ? "bg-mint-500 text-white" : "bg-ink-100",
                    )}
                  >
                    <Check className="size-2.5" strokeWidth={3.5} />
                  </span>
                  {rule.label}
                </li>
              ))}
            </ul>
          </div>

          <Button
            type="submit"
            size="lg"
            block
            loading={submitting}
            iconRight={<ArrowRight />}
          >
            {submitting ? "Updating…" : "Update password & continue"}
          </Button>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
          <p className="text-[11.5px] leading-relaxed text-ink-400">
            You remain signed in while changing the password. Your other
            sessions stay active until you sign out.
          </p>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-medium text-ink-500 transition-colors hover:text-coral-600"
          >
            <LogOut className="size-3.5" /> Sign out instead
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}

export default ForcePasswordChange;
