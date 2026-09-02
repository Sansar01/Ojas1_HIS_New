import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/layouts/AuthLayout";
import { useAppDispatch, useAuthStatus, useRootSelector } from "@/hooks";
import { forgotPassword, resetPassword, setResetEmail } from "@/features/auth/authSlice";
import { useForm } from "@/hooks/useForm";
import { Button } from "@/components/ui/primitives";
import { Input } from "@/components/ui/fields";
import { Banner } from "@/components/ui/feedback";

/* ------------------------------ Forgot password ----------------------------- */

export function ForgotPasswordPage() {
  const dispatch = useAppDispatch();
  const status = useAuthStatus();
  const email = useRootSelector((s) => s.auth.reset.email);
  const sent = Boolean(email);
  const resetRef = useRootSelector((s) => s.auth.reset.token);

  const form = useForm({
    initialValues: { email: "" },
    schema: { email: [{ required: "Email address is required", email: true }] },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await dispatch(forgotPassword(values.email));
  });

  return (
    <AuthLayout eyebrow="Account recovery" title="Verify your identity to restore access.">
      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card sm:p-7">
        <Link to="/accounts/login" className="mb-5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-400 transition-colors hover:text-brand-600">
          <ArrowLeft className="size-3.5" /> Back to sign in
        </Link>

        <h1 className="font-display text-[24px] font-bold text-ink-900">Forgot your password?</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-400">
          Enter the email linked to your hospital directory profile. We will send a single-use verification code valid for 15 minutes.
        </p>

        {sent && (
          <Banner tone="brand" className="mt-5" title={`Reset code dispatched to ${email}`}>
            <span className="num inline-flex items-center gap-1.5 rounded-md bg-white/70 px-2 py-0.5 font-semibold text-brand-700">
              <ShieldCheck className="size-3.5" /> {resetRef}
            </span>
          </Banner>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <Input
            name="email"
            type="email"
            label="Work email"
            required
            placeholder="name@meridian.care"
            leadingIcon={<Mail />}
            value={form.values.email}
            onChange={(e) => form.setValue("email", e.target.value)}
            error={form.errors.email}
          />
          <Button type="submit" size="lg" block loading={status === "authenticating" && !sent} iconRight={sent ? <CheckCircle2 /> : <ArrowRight />}>
            {sent ? "Resend code" : "Send reset link"}
          </Button>
        </form>

        {sent && (
          <Link to="/reset-password" className="mt-4 flex items-center justify-center gap-1.5 text-[13px] font-semibold text-brand-600 hover:underline">
            Continue to choose a new password <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
    </AuthLayout>
  );
}

/* ------------------------------ Reset password ------------------------------ */

const score = (pw: string) => {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
};

export function ResetPasswordPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const email = useRootSelector((s) => s.auth.reset.email) ?? "";
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initialValues: { email, code: "", password: "", confirm: "" },
    schema: {
      email: [{ required: "Email address is required", email: true }],
      code: [{ required: "Enter the 6-digit code from your email", pattern: /^[A-Za-z0-9_]{4,12}$/ }],
      password: [
        { required: "New password is required", min: 8 },
        {
          validate: (v: string) => (score(v) < 3 ? "Use upper case, a number and a symbol" : true),
        },
      ],
      confirm: [
        { required: "Confirm your new password" },
        { validate: (v: string, all: any) => (v === all.password ? true : "Passwords do not match") },
      ],
    },
  });

  const strength = score(form.values.password);

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    try {
      await dispatch(resetPassword({ email: values.email, password: values.password }));
      dispatch(setResetEmail(""));
      setDone(true);
      setTimeout(() => navigate("/accounts/login"), 2200);
    } finally {
      setLoading(false);
    }
  });

  return (
    <AuthLayout eyebrow="Account recovery" title="Choose a strong new password.">
      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card sm:p-7">
        {done ? (
          <div className="py-6 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-mint-50 text-mint-500 ring-1 ring-mint-500/25">
              <CheckCircle2 className="size-6" />
            </span>
            <h1 className="mt-4 font-display text-[20px] font-semibold text-ink-900">Password updated</h1>
            <p className="mt-1.5 text-[13px] text-ink-400">Redirecting you to the sign-in screen…</p>
          </div>
        ) : (
          <>
            <span className="inline-flex items-center gap-2 rounded-lg bg-brand-25 px-2.5 py-1 text-[11.5px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-100">
              <KeyRound className="size-3.5" /> Step 2 of 2
            </span>
            <h1 className="mt-3 font-display text-[24px] font-bold text-ink-900">Reset password</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-400">Enter the verification code we emailed you along with your new credentials.</p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
              <Input name="email" type="email" label="Work email" required leadingIcon={<Mail />} value={form.values.email} onChange={(e) => form.setValue("email", e.target.value)} error={form.errors.email} />
              <Input name="code" label="Verification code" required placeholder="rst_xxxxxx" leadingIcon={<ShieldCheck />} value={form.values.code} onChange={(e) => form.setValue("code", e.target.value)} error={form.errors.code} hint="Demo environments accept any 4–12 character code." />
              <div>
                <Input
                  name="password"
                  type="password"
                  label="New password"
                  required
                  placeholder="Minimum 8 characters"
                  leadingIcon={<KeyRound />}
                  value={form.values.password}
                  onChange={(e) => form.setValue("password", e.target.value)}
                  error={form.errors.password}
                />
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex h-1.5 flex-1 gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className={`flex-1 rounded-full transition-colors ${i < strength ? (strength >= 3 ? "bg-mint-500" : "bg-amberly-500") : "bg-ink-100"}`} />
                    ))}
                  </div>
                  <span className="text-[11px] font-medium text-ink-400">{["Too weak", "Weak", "Fair", "Strong", "Excellent"][strength]}</span>
                </div>
              </div>
              <Input name="confirm" type="password" label="Confirm password" required value={form.values.confirm} onChange={(e) => form.setValue("confirm", e.target.value)} error={form.errors.confirm} />
              <Button type="submit" size="lg" block loading={loading}>
                Update password
              </Button>
              <Link to="/accounts/login" className="flex items-center justify-center gap-1.5 pt-1 text-[12.5px] font-medium text-ink-400 hover:text-brand-600">
                <ArrowLeft className="size-3.5" /> Return to sign in
              </Link>
            </form>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
