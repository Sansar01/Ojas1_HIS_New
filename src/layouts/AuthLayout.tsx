import * as React from "react";
import { Link } from "react-router-dom";
import { Activity, HeartPulse, ShieldCheck, Sparkles } from "lucide-react";
import { APP_NAME } from "@/constants";

const HERO_IMAGE =
  "https://images.pexels.com/photos/17356792/pexels-photo-17356792.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1400&w=900";

export function AuthLayout({
  title,
  eyebrow,
  children,
  aside,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-ink-950">
      {/* brand panel */}
      <aside className="relative hidden w-[46%] max-w-[720px] shrink-0 overflow-hidden lg:block">
        <img
          src={HERO_IMAGE}
          alt="Meridian Care hospital atrium"
          className="absolute inset-0 size-full object-cover opacity-[0.34]"
          loading="eager"
        />
        <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(10,23,28,.94),rgba(15,53,50,.82)_45%,rgba(10,23,28,.96))]" />
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.05) 1px, transparent 1px)",
            backgroundSize: "54px 54px",
          }}
        />

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-12">
          <Link to="/accounts/login" className="flex items-center gap-3">
            <span className="relative grid size-11 place-items-center rounded-2xl bg-brand-500 text-white shadow-[0_18px_36px_-18px_rgba(64,190,174,.95)]">
              <HeartPulse className="size-6" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-[19px] font-bold tracking-tight text-white">
                {APP_NAME}
              </span>
              <span className="block text-[10.5px] uppercase tracking-[0.2em] text-brand-200/80">
                Hospital Management Portal
              </span>
            </span>
          </Link>

          <div className="max-w-lg">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1 text-[11.5px] font-medium text-brand-100 ring-1 ring-inset ring-white/12">
              <Sparkles className="size-3.5" /> {eyebrow}
            </p>
            <h2 className="font-display text-[34px] font-bold leading-[1.12] tracking-tight text-white xl:text-[40px]">
              {title}
            </h2>
            <p className="mt-4 text-[14px] leading-relaxed text-white/55">
              One secure workspace for registration, clinical notes, slot
              builder and revenue — governed by granular roles, modules and
              permissions.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                { k: "Modules", v: "11", i: Activity },
                { k: "RBAC rules", v: "44", i: ShieldCheck },
                { k: "Uptime", v: "99.9%", i: HeartPulse },
              ].map((s) => (
                <div
                  key={s.k}
                  className="rounded-xl border border-white/10 bg-white/[0.045] p-3 backdrop-blur-sm"
                >
                  <s.i className="size-4 text-brand-300" />
                  <p className="num mt-3 text-[20px] font-semibold text-white">
                    {s.v}
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-white/40">
                    {s.k}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            {aside}
            <svg viewBox="0 0 720 46" className="h-10 w-full" aria-hidden>
              <path
                className="ekg-line"
                d="M0 23h120l14-17 16 34 13-17h96l12-10 10 20 12-10h148l14-17 16 34 13-17h198"
                fill="none"
                stroke="rgb(113 216 202)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </aside>

      {/* form panel */}
      <main className="relative flex min-w-0 flex-1 items-center justify-center bg-ink-25 px-4 py-10 sm:px-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-70 lg:hidden"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% -10%, rgba(30,158,144,.16), transparent 55%)",
          }}
        />
        <div className="relative w-full max-w-[27rem] animate-fade-up">
          {children}
        </div>
      </main>
    </div>
  );
}
