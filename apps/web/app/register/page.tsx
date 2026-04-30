import Link from 'next/link';
import { TenantRegistrationForm } from '../../components/forms/tenant-registration-form';

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex bg-white font-sans">
      
      {/* ── Left Panel: Brand & Value Prop (Hidden on Mobile) ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-950 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background Textures */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="absolute -left-32 -bottom-32 h-96 w-96 rounded-full bg-amber-500 opacity-20 blur-3xl" />
        
        {/* Top: Logo */}
        <div className="relative z-10 flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-sm font-black text-white">S</span>
            <span className="text-xl font-black tracking-tight text-white">SchoolOS</span>
          </Link>
        </div>

        {/* Middle: Value Proposition */}
        <div className="relative z-10 max-w-md mt-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1 text-xs font-semibold tracking-widest text-amber-400 uppercase mb-6 backdrop-blur-sm">
            Automated Provisioning
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white leading-[1.1]">
            Set up your school's digital infrastructure in seconds.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-slate-400">
            Creating your workspace automatically provisions a completely isolated backend tailored for Nepal's educational and financial standards.
          </p>

          <ul className="mt-10 space-y-5">
            <li className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-amber-500">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              </div>
              <div>
                <p className="text-sm font-bold text-white">Isolated Tenant Database</p>
                <p className="text-xs text-slate-400 mt-1">Data is strictly scoped to your school.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-amber-500">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              </div>
              <div>
                <p className="text-sm font-bold text-white">Pre-configured Financials</p>
                <p className="text-xs text-slate-400 mt-1">Nepal standard Chart of Accounts & fee heads.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-amber-500">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <div>
                <p className="text-sm font-bold text-white">Compliance & RBAC defaults</p>
                <p className="text-xs text-slate-400 mt-1">MoEST grading systems and role-based access.</p>
              </div>
            </li>
          </ul>
        </div>

        {/* Bottom: Support/Footer */}
        <div className="relative z-10 text-xs text-slate-500 font-medium">
          Need help? Contact <a href="mailto:support@schoolos.com.np" className="text-amber-500 hover:underline">support@schoolos.com.np</a>
        </div>
      </div>

      {/* ── Right Panel: Registration Form ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16 bg-slate-50 lg:bg-white relative">
        
        {/* Mobile Header (Shows only on small screens) */}
        <div className="absolute top-6 left-6 lg:hidden flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-sm font-black text-white">S</span>
          <span className="text-xl font-black tracking-tight text-slate-900">SchoolOS</span>
        </div>

        <div className="w-full max-w-md mt-12 lg:mt-0">
          <div className="mb-8">
            <h2 className="text-3xl font-black tracking-tight text-slate-900">
              Create workspace
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Enter your school details to provision your tenant.
            </p>
          </div>

          {/* Registration Form Component */}
          <div className="bg-white lg:bg-transparent rounded-2xl shadow-sm lg:shadow-none border border-slate-100 lg:border-none p-6 lg:p-0">
            <TenantRegistrationForm />
          </div>

          <p className="mt-8 text-center text-xs text-slate-500">
            Already have a workspace?{' '}
            <Link href="/login" className="font-bold text-amber-600 hover:text-amber-500 transition-colors">
              Sign in to your account
            </Link>
          </p>
        </div>
      </div>

    </main>
  );
}