import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";
import { APP_NAME } from "@/constants";
import { AuthLayout } from "@/layouts/AuthLayout";
import { useAppDispatch, useAuthStatus } from "@/hooks";
import { login } from "@/features/auth/authSlice";
import { useForm } from "@/hooks/useForm";
import { Button } from "@/components/ui/primitives";
import { Checkbox, Input } from "@/components/ui/fields";
import { Banner } from "@/components/ui/feedback";
import { cn } from "@/utils/cn";

const DEMO = [
  {
    role: "SUPER_ADMIN",
    email: "admin@meridian.care",
    password: "admin123",
    note: "Full portal control",
  },
  {
    role: "DOCTOR",
    email: "doctor@meridian.care",
    password: "doctor123",
    note: "Consultations & patients",
  },
  {
    role: "RECEPTIONIST",
    email: "frontdesk@meridian.care",
    password: "desk123",
    note: "Booking & registration",
  },
  {
    role: "BILLING_STAFF",
    email: "billing@meridian.care",
    password: "bill123",
    note: "Invoices & payments",
  },
  {
    role: "SUPER_ADMIN",
    email: "ops@meridian.care",
    password: "admin123",
    note: "Operations, no RBAC edits",
  },
];

export function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const status = useAuthStatus();
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const authError = useLocationStateError(location);

  const form = useForm({
    initialValues: { email: "admin@meridian.care", password: "admin123" },
    schema: {
      email: [{ required: "Email address is required", email: true }],
      password: [{ required: "Password is required", min: 6 }],
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const result: any = await dispatch(login(values));
    if (login.fulfilled.match(result)) {
      form.reset();
      navigate((location.state as any)?.from ?? "/dashboard", {
        replace: true,
      });
    }
  });

  const fillDemo = (account: (typeof DEMO)[number]) => {
    form.setMany({ email: account.email, password: account.password });
  };

  return (
    <AuthLayout
      eyebrow="Secure staff sign-in"
      title="Care operations, orchestrated from one console."
      aside={
        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-5 text-[11.5px] text-white/40">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-brand-300" /> HIPAA-aligned
            audit trail
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5 text-brand-300" /> Role-scoped modules
          </span>
        </div>
      }
    >
      <div className="lg:hidden">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-600 text-white">
            <HeartIcon />
          </span>
          <span className="font-display text-[17px] font-bold text-ink-900">
            {APP_NAME}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card sm:p-7">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-brand-600">
          Welcome back
        </p>
        <h1 className="mt-2 font-display text-[26px] font-bold leading-tight text-ink-900">
          Sign in to the portal
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-400">
          Use your hospital directory credentials. Sessions expire after 8 hours
          of inactivity.
        </p>

        {authError && (
          <Banner tone="danger" className="mt-5" title="Sign-in failed">
            {authError}
          </Banner>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <Input
            name="email"
            type="email"
            autoComplete="username"
            label="Email address"
            required
            placeholder="name@meridian.care"
            leadingIcon={<Mail />}
            value={form.values.email}
            onChange={(e) => form.setValue("email", e.target.value)}
            error={form.errors.email}
          />

          <div className="relative">
            <Input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              label="Password"
              required
              placeholder="••••••••"
              leadingIcon={<Lock />}
              value={form.values.password}
              onChange={(e) => form.setValue("password", e.target.value)}
              error={form.errors.password}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2.5 top-[30px] rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-700"
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 pt-0.5">
            <Checkbox
              checked={remember}
              onCheckedChange={setRemember}
              label="Keep me signed in on this device"
            />
            <Link
              to="/accounts/forgot-password"
              className="shrink-0 text-[12.5px] font-semibold text-brand-600 hover:underline"
            >
              Forgot?
            </Link>
          </div>

          <Button
            type="submit"
            size="lg"
            block
            loading={status === "authenticating"}
            iconRight={<ArrowRight />}
          >
            {status === "authenticating" ? "Verifying…" : "Sign in"}
          </Button>
        </form>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
        <p className="flex items-center gap-2 border-b border-ink-100 bg-ink-25/70 px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-500">
          <KeyRound className="size-3.5 text-brand-600" /> Demo accounts — click
          to autofill
          <span className="ml-auto rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-700">
            SUPER_ADMIN pre-filled
          </span>
        </p>
        <ul className="divide-y divide-ink-100">
          {DEMO.map((account) => (
            <li key={account.email}>
              <button
                onClick={() => fillDemo(account)}
                className={cn(
                  "group flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-brand-25",
                  form.values.email === account.email && "bg-brand-25",
                )}
              >
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold text-ink-800">
                    {account.role}
                  </span>
                  <span className="num block truncate text-[11.5px] text-ink-400">
                    {account.email}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[11px] text-ink-400">
                    {account.note}
                  </span>
                  <span className="num block text-[11px] font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
                    {account.password}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-6 text-center text-[11.5px] leading-relaxed text-ink-400">
        Protected facility environment · Access attempts are logged.{" "}
        <span className="text-ink-300">Need help? Call ext. 4101</span>
      </p>
    </AuthLayout>
  );
}

function HeartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A4.5 4.5 0 0 0 12 5 4.5 4.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
    </svg>
  );
}

function useLocationStateError(location: ReturnType<typeof useLocation>) {
  const state = location.state as { error?: string } | null;
  return state?.error ?? null;
}
