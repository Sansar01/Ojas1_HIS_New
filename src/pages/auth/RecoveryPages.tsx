import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { AuthLayout } from "@/layouts/AuthLayout";
import { useRootSelector } from "@/hooks";
import { useForm } from "@/hooks/useForm";
import { authApi } from "@/services/apiClient";
import { Button } from "@/components/ui/primitives";
import { Input } from "@/components/ui/fields";
import { Banner } from "@/components/ui/feedback";
import { toast } from "@/features/ui/uiSlice";
import { useDispatch } from "react-redux";

/* ------------------------------ Change password ----------------------------- */

export function ChangePasswordPage() {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<number | null>(null);

  const form = useForm({
    initialValues: { email: "" },
    schema: { email: [{ required: "Email address is required", email: true }] },
  });

  // Countdown that re-enables the resend button after 60 seconds.
  const startCountdown = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    setSecondsLeft(60);
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (timerRef.current !== null) window.clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  // Clear any running timer when the page unmounts.
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    },
    [],
  );

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    setError("");
    try {
      await authApi.sendResetCode(values.email);
      setCodeSent(true);
      startCountdown();
      dispatch(
        toast.success(
          "If an account with that email exists, a verification code has been sent. It expires in 5 minutes.",
        ),
      );
    } catch (e: any) {
      dispatch(
        toast.error(e?.message || "Could not send the reset code. Try again."),
      );
    } finally {
      setLoading(false);
    }
  });

  // The email is locked to the address the code was sent to, so only the
  // resend button honours the cooldown once a code has been dispatched.
  const locked = codeSent;
  const cooldown = secondsLeft > 0;

  return (
    <AuthLayout
      eyebrow="Account recovery"
      title="Verify your identity to restore access."
    >
      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card sm:p-7">
        <Link
          to="/accounts/login"
          className="mb-5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-400 transition-colors hover:text-brand-600"
        >
          <ArrowLeft className="size-3.5" /> Back to sign in
        </Link>

        <h1 className="font-display text-[24px] font-bold text-ink-900">
          Forgot your password?
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-400">
          Enter the email linked to your hospital directory profile. We will
          send a single-use verification code valid for 15 minutes.
        </p>

        {error && <Banner tone="danger" className="mt-5" title={error} />}

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <Input
            name="email"
            type="email"
            label="Work email"
            required
            readOnly={locked}
            disabled={locked}
            placeholder="name@meridian.care"
            leadingIcon={<Mail />}
            value={form.values.email}
            onChange={(e) => form.setValue("email", e.target.value)}
            error={form.errors.email}
            hint={
              locked
                ? "This address is locked to the verification code we just sent. Go back to sign in to start over."
                : undefined
            }
          />
          <Button
            type="submit"
            size="lg"
            block
            loading={loading}
            disabled={locked && cooldown}
            iconRight={codeSent ? <CheckCircle2 /> : <ArrowRight />}
          >
            {cooldown
              ? `Resend code in ${secondsLeft}s`
              : codeSent
                ? "Resend code"
                : "Send reset code"}
          </Button>
        </form>

        {codeSent && (
          <Link
            to="/accounts/reset-password"
            className="mt-4 flex items-center justify-center gap-1.5 text-[13px] font-semibold text-brand-600 hover:underline"
          >
            Continue to choose a new password{" "}
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
    </AuthLayout>
  );
}

/* ------------------------------ Reset password ------------------------------ */

const score = (pw: string): number => {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
};

export function ResetPasswordPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const storeEmail = useRootSelector((s) => s.auth.reset.email) ?? "";
  const hasResetRef = Boolean(useRootSelector((s) => s.auth.reset.token));
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Prefer the email captured on the previous step; fall back to whatever the
  // user types here when they land on this page directly.
  const [email, setEmail] = useState(storeEmail);
  useEffect(() => {
    if (storeEmail && !email) setEmail(storeEmail);
  }, [storeEmail, email]);

  // When a reset code was already requested the email is locked — editing it
  // would invalidate the code that was sent.
  const lockedEmail = Boolean(storeEmail) || hasResetRef;

  const form = useForm({
    initialValues: { email: storeEmail, code: "", password: "", confirm: "" },
    schema: {
      email: [{ required: "Email address is required", email: true }],
      code: [
        {
          required: "Enter the 6-digit code from your email",
          pattern: /^[A-Za-z0-9_]{4,12}$/,
        },
      ],
      password: [
        { required: "New password is required", min: 8 },
        {
          validate: (v: string) =>
            score(v) < 3 ? "Use upper case, a number and a symbol" : true,
        },
      ],
      confirm: [
        { required: "Confirm your new password" },
        {
          validate: (v: string, all: any) =>
            v === all.password ? true : "Passwords do not match",
        },
      ],
    },
  });

  const strength = score(form.values.password);

  const onSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    try {
      await authApi.resetPasswordWithCode({
        email: lockedEmail ? storeEmail : values.email,
        code: values.code,
        // send the new password only — never the confirmation field
        newPassword: values.password,
      });
      setDone(true);
      setTimeout(() => navigate("/accounts/login"), 2200);
    } catch (e: any) {
      dispatch(
        toast.error(e?.message || "Could not reset the password. Try again."),
      );
    } finally {
      setLoading(false);
    }
  });

  return (
    <AuthLayout
      eyebrow="Account recovery"
      title="Choose a strong new password."
    >
      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card sm:p-7">
        {done ? (
          <div className="py-6 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-mint-50 text-mint-500 ring-1 ring-mint-500/25">
              <CheckCircle2 className="size-6" />
            </span>
            <h1 className="mt-4 font-display text-[20px] font-semibold text-ink-900">
              Password updated
            </h1>
            <p className="mt-1.5 text-[13px] text-ink-400">
              Redirecting you to the sign-in screen…
            </p>
          </div>
        ) : (
          <>
            <span className="inline-flex items-center gap-2 rounded-lg bg-brand-25 px-2.5 py-1 text-[11.5px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-100">
              <KeyRound className="size-3.5" /> Step 2 of 2
            </span>
            <h1 className="mt-3 font-display text-[24px] font-bold text-ink-900">
              Reset password
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-400">
              Enter the verification code we emailed you along with your new
              credentials.
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
              <Input
                name="email"
                type="email"
                label="Work email"
                required
                readOnly={lockedEmail}
                disabled={lockedEmail}
                leadingIcon={<Mail />}
                value={form.values.email}
                onChange={(e) => {
                  if (lockedEmail) return;
                  setEmail(e.target.value);
                  form.setValue("email", e.target.value);
                }}
                error={form.errors.email}
              />
              <Input
                name="code"
                label="Verification code"
                required
                placeholder="rst_xxxxxx"
                leadingIcon={<ShieldCheck />}
                value={form.values.code}
                onChange={(e) => form.setValue("code", e.target.value)}
                error={form.errors.code}
                hint="Demo environments accept any 4–12 character code."
              />
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
                      <span
                        key={i}
                        className={`flex-1 rounded-full transition-colors ${i < strength ? (strength >= 3 ? "bg-mint-500" : "bg-amberly-500") : "bg-ink-100"}`}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-medium text-ink-400">
                    {
                      ["Too weak", "Weak", "Fair", "Strong", "Excellent"][
                        strength
                      ]
                    }
                  </span>
                </div>
              </div>
              <Input
                name="confirm"
                type="password"
                label="Confirm password"
                required
                value={form.values.confirm}
                onChange={(e) => form.setValue("confirm", e.target.value)}
                error={form.errors.confirm}
              />
              <Button type="submit" size="lg" block loading={loading}>
                Update password
              </Button>
              <Link
                to="/accounts/login"
                className="flex items-center justify-center gap-1.5 pt-1 text-[12.5px] font-medium text-ink-400 hover:text-brand-600"
              >
                <ArrowLeft className="size-3.5" /> Return to sign in
              </Link>
            </form>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
