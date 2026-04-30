import { Suspense } from 'react';
import Link from 'next/link';
import { LoginForm } from '../../components/forms/login-form';

export default function LoginPage() {
  return (
    <main className="min-h-screen flex bg-white font-sans">
      
      {/* ── Left Panel: Security & Brand (Hidden on Mobile) ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-950 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background Textures */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-indigo-600 opacity-20 blur-3xl" />
        <div className="absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-amber-500 opacity-10 blur-3xl" />
        
        {/* Top: Logo */}
        <div className="relative z-10 flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-sm font-black text-white">S</span>
            <span className="text-xl font-black tracking-tight text-white">SchoolOS</span>
          </Link>
        </div>

        {/* Middle: Security Value Proposition */}
        <div className="relative z-10 max-w-md mt-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1 text-xs font-semibold tracking-widest text-indigo-400 uppercase mb-6 backdrop-blur-sm">
            Staff & Admin Portal
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white leading-[1.1]">
            Secure school workspace access.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-slate-400">
            Authentication is powered by secure cookies, refresh token rotation, strict role-based access control (RBAC), and school-level data isolation.
          </p>

          <ul className="mt-10 space-y-5">
            <li className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-indigo-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
              <div>
                <p className="text-sm font-bold text-white">Enterprise Security</p>
                <p className="text-xs text-slate-400 mt-1">Brute-force protection, bcrypt hashing, and AES-256 data encryption at rest.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-indigo-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <div>
                <p className="text-sm font-bold text-white">School Data Isolation</p>
                <p className="text-xs text-slate-400 mt-1">Every request is scoped to your school workspace so each school's data remains strictly isolated.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-indigo-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              </div>
              <div>
                <p className="text-sm font-bold text-white">Full Audit Trail</p>
                <p className="text-xs text-slate-400 mt-1">Every write operation is logged automatically for absolute accountability.</p>
              </div>
            </li>
          </ul>
        </div>

        {/* Bottom: Support/Footer */}
        <div className="relative z-10 text-xs text-slate-500 font-medium">
          Parents & Guardians: Please use the SchoolOS mobile app to log in.
        </div>
      </div>

      {/* ── Right Panel: Login Form ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16 bg-slate-50 lg:bg-white relative">
        
        {/* Mobile Header (Shows only on small screens) */}
        <div className="absolute top-6 left-6 lg:hidden flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-sm font-black text-white">S</span>
          <span className="text-xl font-black tracking-tight text-slate-900">SchoolOS</span>
        </div>

        <div className="w-full max-w-md mt-12 lg:mt-0">
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl font-black tracking-tight text-slate-900">
              Welcome back
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Sign in to your school workspace.
            </p>
          </div>

          {/* Login Form Component Wrapped in Suspense */}
          <div className="bg-white lg:bg-transparent rounded-2xl shadow-sm lg:shadow-none border border-slate-100 lg:border-none p-6 lg:p-0">
            <Suspense fallback={
              <div className="flex animate-pulse space-x-4 p-4">
                <div className="flex-1 space-y-4 py-1">
                  <div className="h-4 w-3/4 rounded bg-slate-200"></div>
                  <div className="space-y-2">
                    <div className="h-10 rounded bg-slate-200"></div>
                    <div className="h-10 rounded bg-slate-200"></div>
                  </div>
                </div>
              </div>
            }>
              <LoginForm />
            </Suspense>
          </div>

          <p className="mt-8 text-center text-xs text-slate-500">
            Need to register your school?{' '}
            <Link href="/register" className="font-bold text-amber-600 hover:text-amber-500 transition-colors">
              Register here
            </Link>
          </p>
        </div>
      </div>

    </main>
  );
}