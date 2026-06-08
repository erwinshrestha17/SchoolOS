import { Suspense } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Database,
  GraduationCap,
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
    title: 'Role-aware access',
    description:
      'Admins, accountants, teachers, and staff enter only the workspace they are allowed to use.',
    icon: LockKeyhole,
  },
  {
    title: 'School data isolation',
    description:
      'Every request is scoped to the correct school workspace for safer multi-school operation.',
    icon: ShieldCheck,
  },
  {
    title: 'Audit-ready operations',
    description:
      'Attendance, fees, grades, and finance actions stay traceable for accountability.',
    icon: ClipboardCheck,
  },
];

const moduleSignals = [
  { label: 'Attendance', value: 'Live', icon: Activity },
  { label: 'Fees', value: 'Secure', icon: WalletCards },
  { label: 'Academics', value: 'Ready', icon: GraduationCap },
  { label: 'People', value: 'Synced', icon: UsersRound },
];

const securityStats = [
  { label: 'Session security', value: 'Protected' },
  { label: 'Workspace scope', value: 'School-level' },
  { label: 'Audit mode', value: 'Traceable' },
];

export default function LoginPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 font-sans text-white lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#155EEF_0%,transparent_28%),radial-gradient(circle_at_80%_12%,rgba(124,58,237,.55)_0%,transparent_26%),linear-gradient(135deg,#04183A_0%,#0F172A_46%,#020617_100%)] p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.2) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
          }}
        />

        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/[0.03] blur-sm" />
        <div className="pointer-events-none absolute -left-32 top-20 h-80 w-80 rounded-full bg-primary-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-28 bottom-20 h-96 w-96 rounded-full bg-secondary-500/20 blur-3xl" />

        <SchoolOSLoginScene />

        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-85">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-lg font-black text-primary-600 shadow-2xl shadow-black/30">
              S
            </span>
            <div>
              <p className="text-xl font-black tracking-tight">SchoolOS</p>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-200">
                Nepal School Suite
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-100 backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,.9)]" />
            Secure Portal
          </div>
        </div>

        <div className="relative z-10 grid max-w-[44rem] gap-6">
          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-primary-100 backdrop-blur-xl">
              <Sparkles className="h-4 w-4" />
              Staff & Admin Command Center
            </div>

            <h1 className="max-w-xl text-5xl font-black leading-[0.96] tracking-[-0.065em] text-white xl:text-6xl">
              Login to the school intelligence layer.
            </h1>

            <p className="mt-6 max-w-lg text-base leading-8 text-slate-300">
              A secure role-based workspace for admissions, attendance, fees, academics, people operations, reports, and school-wide decisions.
            </p>
          </div>

          <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
            {securityStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-3xl border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-black/10 backdrop-blur-xl"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  {stat.label}
                </p>
                <p className="mt-2 text-sm font-black text-white">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
            {moduleSignals.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="group flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/35 p-4 shadow-2xl shadow-black/10 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white/[0.08]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-primary-200 ring-1 ring-white/10">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-white">{item.label}</p>
                      <p className="text-xs text-slate-400">module signal</p>
                    </div>
                  </div>

                  <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-primary-100">
                    {item.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 grid gap-3 xl:grid-cols-[1fr_auto] xl:items-end">
          <div className="grid max-w-3xl gap-3 xl:grid-cols-3">
            {trustPoints.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-3xl border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-black/10 backdrop-blur-xl"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-primary-200 ring-1 ring-white/10">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-sm font-black text-white">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{item.description}</p>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-6 text-xs font-medium text-slate-400 xl:block xl:text-right">
            <p>Parents & Guardians: Please use the SchoolOS mobile app.</p>
            <Link href="/request-demo" className="mt-2 inline-flex items-center gap-1 text-primary-200 hover:text-white">
              Request demo <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-5 py-8 text-slate-900 sm:px-8 lg:px-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#EAF1FF_0%,transparent_34%),radial-gradient(circle_at_bottom_left,#F3E8FF_0%,transparent_28%)]" />
        <div className="absolute right-8 top-8 hidden rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 shadow-sm backdrop-blur-md sm:flex">
          Staff Access
        </div>

        <div className="relative z-10 w-full max-w-md">
          <div className="mb-10 flex items-center justify-between lg:hidden">
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

          <div className="mb-5 rounded-[1.75rem] border border-slate-200/80 bg-white/75 p-4 shadow-xl shadow-slate-200/60 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                <Database className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-950">School workspace verification</p>
                <p className="text-xs leading-5 text-slate-500">
                  Your school code scopes the session before staff credentials are checked.
                </p>
              </div>
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success-500" />
            </div>
          </div>

          <div className="rounded-[2.25rem] border border-white bg-white/90 p-6 shadow-2xl shadow-slate-200/80 backdrop-blur-xl sm:p-8">
            <div className="mb-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-primary-600">
                <LockKeyhole className="h-3.5 w-3.5" />
                Welcome back
              </div>

              <h2 className="text-3xl font-black tracking-[-0.04em] text-slate-950">
                Sign in to SchoolOS
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Enter your school code and staff credentials to continue to your protected workspace.
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

          <div className="mt-8 space-y-1 text-center text-xs text-slate-500">
            <p>Need access? Contact your school administrator.</p>
            <p>
              New school?{' '}
              <Link
                href="/request-demo"
                className="font-bold text-[var(--primary)] transition-colors hover:text-[var(--primary-dark)]"
              >
                Request a demo.
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
