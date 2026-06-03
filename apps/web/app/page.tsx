import Link from 'next/link';

const modules = [
  ['Admissions', 'Inquiries, document checks, approvals, and student records.'],
  ['Attendance', 'Daily marking, corrections, monthly registers, and parent alerts.'],
  ['Fees & Receipts', 'NPR fee collection, dues, receipts, cashier close, and ledgers.'],
  ['Academics', 'Classes, subjects, exams, homework, report cards, and promotion.'],
  ['Communication', 'Notices, SMS/email delivery, consent, read tracking, and retries.'],
  ['Operations', 'HR, accounting, transport, library, canteen, and parent portal.'],
];

const stats = [
  ['12+', 'School operations modules'],
  ['NPR', 'Fees and accounting ready'],
  ['RBAC', 'Role-based access control'],
  ['NPT', 'Nepal school context'],
];

const onboardingSteps = [
  ['01', 'Request a guided demo', 'Share your school details, size, location, and priority modules.'],
  ['02', 'Verify and configure', 'SchoolOS team validates the school and prepares the tenant, roles, academic year, and fee setup.'],
  ['03', 'Launch pilot workspace', 'Your admin, teachers, accountant, parents, and students start with controlled access.'],
];

const previewRows = [
  ['Attendance Rate', '93.6%', '+2.8%'],
  ['Fee Collected', 'NPR 3,245,600', '+12.6%'],
  ['Outstanding Dues', 'NPR 742,850', 'Review'],
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-950 font-sans">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500 text-sm font-black text-white shadow-sm">S</span>
            <span>
              <span className="block text-xl font-black tracking-tight">SchoolOS</span>
              <span className="block text-xs font-semibold text-slate-500">School ERP for Nepal</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-500 md:flex">
            <a href="#modules" className="transition-colors hover:text-slate-950">Modules</a>
            <a href="#onboarding" className="transition-colors hover:text-slate-950">Onboarding</a>
            <a href="#preview" className="transition-colors hover:text-slate-950">Demo Preview</a>
            <a href="#security" className="transition-colors hover:text-slate-950">Security</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-bold text-slate-700 transition-colors hover:text-slate-950">
              Sign in
            </Link>
            <Link
              href="/request-demo"
              className="rounded-full bg-primary-500 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-primary-500/20 transition hover:bg-primary-600"
            >
              Request Demo
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#08111f] px-6 py-20 text-white md:py-28">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '36px 36px' }}
          />
          <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-primary-500/20 blur-3xl" />
          <div className="absolute -bottom-24 left-12 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
            <div>
              <div className="mb-7 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-blue-100">
                Controlled onboarding for verified schools
              </div>
              <h1 className="max-w-4xl text-5xl font-black leading-[1.04] tracking-tight md:text-7xl">
                Run school operations from one clear workspace.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                SchoolOS connects admissions, attendance, fees, academics, notices, staff, accounting, transport, canteen, library, and parent communication for Nepal-based schools.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  href="/request-demo"
                  className="rounded-full bg-primary-500 px-7 py-3.5 text-base font-black text-white shadow-xl shadow-primary-500/20 transition hover:bg-primary-600"
                >
                  Request Demo
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-white/20 px-7 py-3.5 text-base font-bold text-white transition hover:border-white/40 hover:bg-white/10"
                >
                  Login
                </Link>
              </div>
              <p className="mt-5 text-sm font-semibold text-slate-400">
                No public self-registration. School workspaces are created after verification by the SchoolOS team.
              </p>
            </div>

            <div id="preview" className="rounded-[2rem] border border-white/10 bg-white/10 p-4 shadow-2xl shadow-black/30 backdrop-blur">
              <div className="rounded-[1.5rem] bg-white p-5 text-slate-950">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Pilot workspace</p>
                    <h2 className="mt-1 text-xl font-black">Shree Janata Secondary School</h2>
                    <p className="text-sm text-slate-500">Pokhara, Gandaki Province</p>
                  </div>
                  <span className="rounded-full bg-success-50 px-3 py-1 text-xs font-black text-success-600">Verified</span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {previewRows.map(([label, value, change]) => (
                    <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-xs font-bold text-slate-500">{label}</p>
                      <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
                      <p className="mt-1 text-xs font-bold text-primary-600">{change}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-slate-100 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="font-black">Today&apos;s command center</p>
                    <span className="text-xs font-bold text-slate-400">10:30 AM NPT</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      ['New admission approved', 'Admissions', 'Approved'],
                      ['Fee receipt posted', 'Finance', 'Paid'],
                      ['PTM notice delivered', 'Notices', 'Published'],
                    ].map(([activity, module, status]) => (
                      <div key={activity} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                        <span className="font-semibold text-slate-700">{activity}</span>
                        <span className="text-xs font-bold text-slate-400">{module}</span>
                        <span className="rounded-full bg-success-50 px-2.5 py-1 text-xs font-black text-success-600">{status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-50 px-6 py-8" id="security">
          <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map(([value, label]) => (
              <div key={value} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-2xl font-black text-slate-950">{value}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="modules" className="px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-600">Modules</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
                Core school workflows, connected by design.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-500">
                Each module shares the same school tenant, role permissions, audit trail, and reporting foundation.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {modules.map(([title, desc]) => (
                <div key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-lg font-black text-primary-600">
                    {title.slice(0, 2)}
                  </div>
                  <h3 className="text-lg font-black text-slate-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="onboarding" className="bg-slate-950 px-6 py-24 text-white">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">Guided onboarding</p>
                <h2 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                  SchoolOS workspaces are created after verification.
                </h2>
                <p className="mt-5 text-base leading-7 text-slate-400">
                  This keeps tenant data clean, prevents accidental public signup, and ensures each school starts with the right academic, finance, and permission setup.
                </p>
              </div>

              <div className="grid gap-4">
                {onboardingSteps.map(([number, title, desc]) => (
                  <div key={number} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                    <p className="text-sm font-black text-primary-300">{number}</p>
                    <h3 className="mt-2 text-xl font-black">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-primary-50 px-6 py-20">
          <div className="mx-auto max-w-4xl rounded-[2rem] border border-primary-100 bg-white p-8 text-center shadow-xl shadow-primary-100/60 md:p-12">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-600">Ready for a pilot?</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
              Bring SchoolOS to your school with guided setup.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-500">
              Share your school details and the SchoolOS team will contact you for verification, demo, and onboarding planning.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/request-demo"
                className="rounded-full bg-primary-500 px-8 py-4 text-base font-black text-white shadow-lg shadow-primary-500/20 transition hover:bg-primary-600"
              >
                Request Demo
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-slate-300 bg-white px-8 py-4 text-base font-bold text-slate-700 transition hover:border-slate-400"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-500 text-xs font-black text-white">S</span>
            <span className="font-black tracking-tight text-white">SchoolOS</span>
            <span className="hidden text-sm text-slate-500 sm:inline">Complete school management for Nepal</span>
          </div>
          <div className="flex items-center gap-6 text-sm font-semibold text-slate-400">
            <Link href="/login" className="transition hover:text-white">Sign in</Link>
            <Link href="/request-demo" className="transition hover:text-white">Request Demo</Link>
            <Link href="/dashboard" className="transition hover:text-white">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
