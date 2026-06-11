import { Suspense } from 'react';
import Link from 'next/link';
import { ClipboardCheck, LockKeyhole, ShieldCheck } from 'lucide-react';

import { LoginForm } from '../../components/forms/login-form';

const trustItems = [
  {
    title: 'Staff access',
    description: 'School teams sign in with secure cookies using school code, email, and password.',
    icon: LockKeyhole,
  },
  {
    title: 'School workspace',
    description: 'Each school uses its own workspace for day-to-day operations with school-level data isolation.',
    icon: ShieldCheck,
  },
  {
    title: 'Organized records',
    description: 'Attendance, fees, students, and reports stay easier to manage.',
    icon: ClipboardCheck,
  },
];

export default function LoginPage() {
  return (
    <main className="flex min-h-screen bg-white font-sans">
      <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[var(--color-sidebar-900)] p-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)] text-sm font-black text-white">
              S
            </span>
            <span className="text-xl font-black tracking-tight text-white">SchoolOS</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-md">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-indigo-400 backdrop-blur-sm">
            Staff & Admin Portal
          </div>

          <h1 className="text-4xl font-black leading-[1.1] tracking-tight text-white">
            Simple access to your school workspace.
          </h1>

          <p className="mt-6 text-base leading-relaxed text-slate-400">
            Sign in to manage attendance, fees, students, reports, and daily school operations from one clear place.
          </p>

          <ul className="mt-10 space-y-5">
            {trustItems.map((item) => {
              const Icon = item.icon;

              return (
                <li key={item.title} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-indigo-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.description}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="relative z-10 text-xs font-medium text-slate-500">
          Parents & Guardians: Please use the SchoolOS mobile app to log in.
        </div>
      </section>

      <section className="relative flex w-full items-center justify-center bg-slate-50 p-6 sm:p-12 lg:w-1/2 lg:bg-white lg:p-16">
        <div className="absolute left-6 top-6 flex items-center gap-2 lg:hidden">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)] text-sm font-black text-white">
            S
          </span>
          <span className="text-xl font-black tracking-tight text-slate-900">SchoolOS</span>
        </div>

        <div className="mt-12 w-full max-w-md lg:mt-0">
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl font-black tracking-tight text-slate-900">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-500">Sign in to your school workspace.</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm lg:border-none lg:bg-transparent lg:p-0 lg:shadow-none">
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
