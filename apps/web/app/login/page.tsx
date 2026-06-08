import { Suspense } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpenCheck,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WalletCards,
} from 'lucide-react';

import { LoginForm } from '../../components/forms/login-form';
import { SchoolOSLoginScene } from '../../components/three/schoolos-login-scene';

const trustPoints = [
  {
    title: 'Role-based access',
    description: 'Staff only see the modules and actions allowed for their school role.',
    icon: LockKeyhole,
  },
  {
    title: 'School-scoped data',
    description: 'Each login is tied to one verified school workspace before access is granted.',
    icon: Building2,
  },
  {
    title: 'Audit-ready records',
    description: 'Important attendance, fee, academic, and admin actions stay traceable.',
    icon: ClipboardCheck,
  },
];

const moduleSignals = [
  { label: 'Attendance', icon: CalendarCheck2 },
  { label: 'Fees', icon: WalletCards },
  { label: 'Academics', icon: BookOpenCheck },
  { label: 'People', icon: UsersRound },
];

export default function LoginPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#EAF1FF_0%,transparent_30%),radial-gradient(circle_at_bottom_right,#F3E8FF_0%,transparent_28%),linear-gradient(135deg,#F8FAFC_0%,#EEF4FF_46%,#F8FAFC_100%)] px-4 py-6 font-sans text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2.25rem] border border-white/80 bg-white/78 shadow-[0_30px_120px_rgba(15,23,42,0.14)] backdrop-blur-2xl lg:grid-cols-[1.02fr_0.98fr]">
          <section className="relative hidden min-h-[720px] overflow-hidden bg-[radial-gradient(circle_at_20%_10%,rgba(115,167,255,.38)_0%,transparent_30%),radial-gradient(circle_at_84%_20%,rgba(124,58,237,.32)_0%,transparent_28%),linear-gradient(145deg,#04183A_0%,#0F172A_54%,#020617_100%)] p-9 text-white lg:flex lg:flex-col lg:justify-between xl:p-11">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.075]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,.25) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.25) 1px, transparent 1px)',
                backgroundSize: '44px 44px',
              }}
            />
            <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-primary-500/30 blur-3xl" />
            <div className="pointer-events-none absolute -right-24 bottom-24 h-80 w-80 rounded-full bg-secondary-500/25 blur-3xl" />

            <div className="relative z-10 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-85">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-lg font-black text-primary-600 shadow-xl shadow-black/20">
                  S
                </span>
                <div>
                  <p className="text-xl font-black tracking-tight">SchoolOS</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-200">
                    Nepal School Suite
                  </p>
                </div>
              </Link>

              <div className="flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-100 backdrop-blur-xl">
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,.9)]" />
                Secure
              </div>
            </div>

            <div className="relative z-10 mt-8 grid gap-7">
              <div className="max-w-xl">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-primary-100 backdrop-blur-xl">
                  <Sparkles className="h-3.5 w-3.5" />
                  Staff workspace
                </div>

                <h1 className="text-5xl font-black leading-[0.98] tracking-[-0.06em] xl:text-6xl">
                  Manage your school from one calm workspace.
                </h1>

                <p className="mt-5 max-w-lg text-base leading-8 text-slate-300">
                  Sign in to access attendance, fees, academics, people records, reports, and admin operations from a protected SchoolOS workspace.
                </p>
              </div>

              <div className="relative h-[340px] overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.07] shadow-2xl shadow-black/20 backdrop-blur-xl">
                <div className="absolute left-6 top-6 z-10 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 backdrop-blur-xl">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary-200">
                    Live school network
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-300">
                    Modules connect after workspace verification
                  </p>
                </div>
                <SchoolOSLoginScene />
              </div>

              <div className="grid grid-cols-4 gap-3">
                {moduleSignals.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-white/10 bg-slate-950/30 p-3 shadow-xl shadow-black/10 backdrop-blur-xl"
                    >
                      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-primary-200 ring-1 ring-white/10">
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="text-xs font-black text-white">{item.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative z-10 grid gap-3 xl:grid-cols-3">
              {trustPoints.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="rounded-3xl border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-black/10 backdrop-blur-xl"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-primary-200 ring-1 ring-white/10">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="mt-4 text-sm font-black text-white">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{item.description}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="relative flex min-h-[680px] items-center justify-center px-5 py-10 sm:px-8 lg:min-h-[720px] lg:px-12 xl:px-16">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(21,94,239,.08)_0%,transparent_36%)]" />

            <div className="relative z-10 w-full max-w-[30rem]">
              <div className="mb-8 flex items-center justify-between lg:hidden">
                <Link href="/" className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--primary)] text-base font-black text-white">
                    S
                  </span>
                  <div>
                    <p className="text-lg font-black tracking-tight text-slate-950">SchoolOS</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                      Secure Portal
                    </p>
                  </div>
                </Link>
              </div>

              <div className="mb-6 rounded-[1.5rem] border border-primary-100 bg-primary-50/70 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-primary-600 shadow-sm">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-950">Protected staff access</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Your school code is verified first, then your staff credentials are checked securely.
                    </p>
                  </div>
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-success-500" />
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,0.12)] sm:p-9">
                <div className="mb-8">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">
                    <LockKeyhole className="h-3.5 w-3.5" />
                    Welcome back
                  </div>

                  <h2 className="text-4xl font-black tracking-[-0.05em] text-slate-950">
                    Sign in
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    Continue to your SchoolOS dashboard using your assigned school workspace.
                  </p>
                </div>

                <Suspense
                  fallback={
                    <div className="flex animate-pulse space-x-4 p-4">
                      <div className="flex-1 space-y-4 py-1">
                        <div className="h-4 w-3/4 rounded bg-slate-200" />
                        <div className="space-y-2">
                          <div className="h-10 rounded bg-slate-200" />
                          <div className="h-10 rounded bg-slate-200" />
                        </div>
                      </div>
                    </div>
                  }
                >
                  <LoginForm />
                </Suspense>
              </div>

              <div className="mt-7 flex flex-col items-center justify-between gap-3 text-center text-xs text-slate-500 sm:flex-row sm:text-left">
                <p>Need access? Contact your school administrator.</p>
                <Link
                  href="/request-demo"
                  className="inline-flex items-center gap-1 font-bold text-[var(--primary)] transition-colors hover:text-[var(--primary-dark)]"
                >
                  Request demo <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
