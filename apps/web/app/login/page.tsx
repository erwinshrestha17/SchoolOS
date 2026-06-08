import { Suspense } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BellRing,
  BookOpenCheck,
  CalendarCheck2,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  HeartHandshake,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  UsersRound,
  WalletCards,
} from 'lucide-react';

import { LoginForm } from '../../components/forms/login-form';
import { SchoolOSLoginScene } from '../../components/three/schoolos-login-scene';

const dailyWorkItems = [
  {
    title: 'Take attendance quickly',
    description: 'See today\'s classes, absences, and follow-ups without paper registers.',
    icon: CalendarCheck2,
  },
  {
    title: 'Keep fees organized',
    description: 'Track paid, pending, and overdue fees with less manual checking.',
    icon: WalletCards,
  },
  {
    title: 'Share updates with parents',
    description: 'Help staff communicate notices, reminders, and student updates clearly.',
    icon: MessageCircle,
  },
];

const quickBenefits = [
  { label: 'Attendance', icon: CalendarCheck2 },
  { label: 'Fees', icon: WalletCards },
  { label: 'Students', icon: UsersRound },
  { label: 'Reports', icon: ClipboardList },
];

export default function LoginPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[linear-gradient(135deg,#F8FBFF_0%,#EEF5FF_42%,#FDFBFF_100%)] px-4 py-6 font-sans text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-white bg-white shadow-[0_28px_90px_rgba(15,23,42,0.12)] lg:grid-cols-[1fr_0.92fr]">
          <section className="relative hidden min-h-[720px] overflow-hidden bg-[radial-gradient(circle_at_15%_8%,rgba(234,241,255,.95)_0%,transparent_32%),radial-gradient(circle_at_90%_18%,rgba(243,232,255,.75)_0%,transparent_30%),linear-gradient(145deg,#FFFFFF_0%,#F7FAFF_48%,#EEF5FF_100%)] p-9 lg:flex lg:flex-col lg:justify-between xl:p-11">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.42]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(21,94,239,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(21,94,239,.08) 1px, transparent 1px)',
                backgroundSize: '52px 52px',
              }}
            />
            <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-primary-100/80 blur-3xl" />
            <div className="pointer-events-none absolute -right-24 bottom-24 h-80 w-80 rounded-full bg-secondary-50/90 blur-3xl" />

            <div className="relative z-10 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-85">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)] text-lg font-black text-white shadow-lg shadow-primary-500/20">
                  S
                </span>
                <div>
                  <p className="text-xl font-black tracking-tight text-slate-950">SchoolOS</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Simple school management
                  </p>
                </div>
              </Link>

              <div className="flex items-center gap-2 rounded-full border border-success-100 bg-success-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-success-700">
                <span className="h-2 w-2 rounded-full bg-success-500" />
                Safe sign in
              </div>
            </div>

            <div className="relative z-10 mt-8 grid gap-7">
              <div className="max-w-2xl">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary-100 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-primary-600 shadow-sm">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Built for school teams
                </div>

                <h1 className="max-w-xl text-5xl font-black leading-[1.02] tracking-[-0.055em] text-slate-950 xl:text-6xl">
                  Start every school day with everything in order.
                </h1>

                <p className="mt-5 max-w-xl text-base leading-8 text-slate-600">
                  SchoolOS helps the front office, teachers, accountants, and management work from one clear place — attendance, fees, students, notices, and reports.
                </p>
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.04fr_0.96fr]">
                <div className="relative h-[330px] overflow-hidden rounded-[2rem] border border-primary-100 bg-[linear-gradient(145deg,#FFFFFF_0%,#EEF5FF_100%)] shadow-xl shadow-primary-100/70">
                  <div className="absolute left-6 top-6 z-10 rounded-2xl border border-white bg-white/85 px-4 py-3 shadow-sm backdrop-blur-xl">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-600">
                      Your school workspace
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      Calm, organized, and easy to use
                    </p>
                  </div>
                  <SchoolOSLoginScene />
                </div>

                <div className="grid gap-3">
                  <div className="rounded-[1.5rem] border border-primary-100 bg-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                      <HeartHandshake className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-lg font-black tracking-[-0.02em] text-slate-950">
                      Made for real school routines
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Less switching between notebooks, spreadsheets, phone calls, and separate apps.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {quickBenefits.map((item) => {
                      const Icon = item.icon;

                      return (
                        <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-primary-600 ring-1 ring-slate-100">
                            <Icon className="h-4 w-4" />
                          </div>
                          <p className="text-xs font-black text-slate-800">{item.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 grid gap-3 xl:grid-cols-3">
              {dailyWorkItems.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.title} className="rounded-3xl border border-slate-200 bg-white/82 p-4 shadow-sm backdrop-blur-xl">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="mt-4 text-sm font-black text-slate-950">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="relative flex min-h-[680px] items-center justify-center overflow-hidden bg-white px-5 py-10 sm:px-8 lg:min-h-[720px] lg:px-12 xl:px-16">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(21,94,239,.075)_0%,transparent_34%),radial-gradient(circle_at_90%_80%,rgba(124,58,237,.065)_0%,transparent_30%)]" />

            <div className="relative z-10 w-full max-w-[30rem]">
              <div className="mb-10 flex items-center justify-between lg:hidden">
                <Link href="/" className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--primary)] text-base font-black text-white">
                    S
                  </span>
                  <div>
                    <p className="text-lg font-black tracking-tight text-slate-950">SchoolOS</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Simple school management
                    </p>
                  </div>
                </Link>
              </div>

              <div className="mb-6 rounded-[1.5rem] border border-success-100 bg-success-50/70 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-success-600 shadow-sm">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-950">Only approved school staff can sign in</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Use your school code, email, and password given by your school administrator.
                    </p>
                  </div>
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-success-500" />
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,0.11)] sm:p-9">
                <div className="mb-8">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-primary-600">
                    <LockKeyhole className="h-3.5 w-3.5" />
                    Staff login
                  </div>

                  <h2 className="text-4xl font-black tracking-[-0.05em] text-slate-950">
                    Welcome back
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    Sign in to continue your school work for today.
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

              <div className="mt-7 grid gap-3 text-xs text-slate-500 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                  <div className="mb-2 flex items-center gap-2 font-black text-slate-800">
                    <BellRing className="h-4 w-4 text-primary-600" />
                    Need help?
                  </div>
                  <p>Ask your school administrator to reset your access.</p>
                </div>

                <Link
                  href="/request-demo"
                  className="rounded-2xl border border-primary-100 bg-primary-50/70 p-4 font-bold text-primary-700 transition-colors hover:bg-primary-50"
                >
                  <span className="flex items-center gap-2">
                    New school? Request a demo <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
