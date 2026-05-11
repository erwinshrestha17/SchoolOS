import Link from 'next/link';

const modules = [
  {
    icon: '🎓',
    title: 'Admissions & Student Profiles',
    desc: 'Enrollment, guardians, documents, student photos, transfers, ID cards, certificates, and iEMIS-ready student records.',
  },
  {
    icon: '📋',
    title: 'Smart Attendance',
    desc: 'Fast 3-tap attendance, absence/late/leave tracking, correction workflow, monthly history, and parent alerts.',
  },
  {
    icon: '💰',
    title: 'Fees & Receipts',
    desc: 'Fee setup, invoices, dues, discounts, waivers, payments, receipts, defaulters, and cashier day-end reports.',
  },
  {
    icon: '📝',
    title: 'Exams, CAS & Report Cards',
    desc: 'Exam setup, marks entry, CAS tracking, grading, report cards, academic reports, and promotion support.',
  },
  {
    icon: '📸',
    title: 'Activity Feed & Milestones',
    desc: 'Classroom photos, child-specific posts, daily updates, mood logs, milestones, reactions, and parent engagement.',
  },
  {
    icon: '📢',
    title: 'Notices & Communication',
    desc: 'Notices, announcements, consent, read/unread tracking, delivery records, retry/resend, SMS and push alerts.',
  },
  {
    icon: '📚',
    title: 'Homework & Timetable',
    desc: 'Assignments, due reminders, submission tracking, class timetable, teacher schedules, and substitution support.',
  },
  {
    icon: '👥',
    title: 'HR & Payroll',
    desc: 'Staff profiles, staff attendance, leave, salary structures, payroll processing, salary slips, PF and TDS support.',
  },
  {
    icon: '📖',
    title: 'Library Management',
    phase: 'Later',
    desc: 'Book catalog, QR/barcode copy tracking, issue/return, overdue fines, lost-book charges, and library reports.',
  },
  {
    icon: '🚌',
    title: 'Transport Management',
    phase: 'Later',
    desc: 'Routes, stops, vehicles, drivers, student transport enrollment, boarding/drop tracking, live GPS, ETA, and trip history.',
  },
  {
    icon: '🍱',
    title: 'Canteen Management',
    phase: 'Later',
    desc: 'Menus, meal plans, QR meal serving, wallet, POS sales, parent spending controls, allergy warnings, and reports.',
  },
  {
    icon: '📊',
    title: 'Accounting & Finance',
    desc: 'Double-entry ledger, chart of accounts, journal posting, reversals, trial balance, day-end reports, and audit-ready records.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Register your school',
    desc: 'Create an isolated tenant workspace in minutes. Configure academic year, class levels, sections, fee structures, and staff roles.',
  },
  {
    number: '02',
    title: 'Onboard students & staff',
    desc: 'Enroll students, link guardians, import records, assign teachers, define RBAC permissions, and prepare daily workflows.',
  },
  {
    number: '03',
    title: 'Run daily operations',
    desc: 'Take attendance, collect fees, publish notices, post activity updates, serve canteen meals, and track transport safely.',
  },
];

const stats = [
  { value: '12 Domains', label: 'Integrated school operations' },
  { value: 'MoEST & IRD', label: 'Nepal-ready compliance' },
  { value: 'Montessori–10', label: 'Supported class levels' },
  { value: 'Real-time', label: 'Ledger, alerts, and tracking' },
];

const pricingPlans = [
  {
    name: 'Basic Plan',
    phase: 'Phase 1 Core',
    desc: 'Essential operations for daily school management and early pilot schools.',
    features: [
      'Admissions & Student Profiles',
      'Smart Attendance',
      'Fees & Receipts',
      'Activity Feed & Milestones',
      'Notices & Communication',
    ],
    cta: 'Start with Basic',
    highlighted: false,
  },
  {
    name: 'Standard Plan',
    phase: 'Phase 2 Academic + Finance',
    desc: 'Complete academic, HR, payroll, and financial control for growing schools.',
    features: [
      'Everything in Basic',
      'Exams, CAS & Report Cards',
      'Homework & Timetable',
      'HR & Payroll',
      'Accounting & Finance',
      'Advanced reports and exports',
    ],
    cta: 'Upgrade to Standard',
    highlighted: true,
  },
  {
    name: 'Operations Add-ons',
    phase: 'Phase 3 Auxiliary',
    desc: 'Operational modules for schools that run library, transport, and canteen services.',
    features: [
      'Library Management',
      'Transport Management with live GPS',
      'Canteen Management',
      'Canteen wallet and POS',
      'Parent child-specific bus tracking',
      'Inventory and vendor tracking later',
    ],
    cta: 'Explore Add-ons',
    highlighted: false,
  },
];

const phasePlan = [
  {
    done: true,
    title: 'Phase 1A: Core Workflows',
    sub: 'Admissions, Attendance, Fees, Activity Feed, and Notices working end-to-end.',
  },
  {
    done: true,
    title: 'Phase 1B: Operational Depth',
    sub: 'Student detail/edit, fee ledger, attendance reports, notification center, global search, tests, and PDF polish.',
  },
  {
    done: false,
    active: true,
    title: 'Phase 2: Academics, HR & Accounting',
    sub: 'Exams/CAS/report cards, Homework/Timetable, HR/Payroll, and full M9 Accounting & Finance.',
  },
  {
    done: false,
    title: 'Phase 3: Auxiliary Operations',
    sub: 'Library, Transport with live GPS, Canteen wallet/POS, and parent/mobile expansion.',
  },
  {
    done: false,
    title: 'Phase 4: Scale and Enterprise SaaS',
    sub: 'Enterprise controls, analytics foundations, developer experience, and scale optimizations after core modules are stable.',
  },
];

const faqs = [
  {
    q: 'Does attendance tracking work offline?',
    a: 'Yes. The attendance workflow is designed around a fast teacher-first 3-tap flow, with offline draft/sync support planned for real school conditions where internet may be unstable.',
  },
  {
    q: 'How does live transport tracking work?',
    a: 'The driver app sends GPS location during an active pickup or drop trip. SchoolOS stores the latest location in Redis and streams updates through WebSocket or SSE. Parents only see the vehicle assigned to their own child.',
  },
  {
    q: 'What does the Canteen module include?',
    a: 'Canteen Management includes menu setup, meal plans, QR/student ID meal serving, canteen wallet, parent/manual top-up, POS sales, parent spending limits, allergy warnings, low-balance alerts, and daily meal/sales reports.',
  },
  {
    q: 'Is student data secure?',
    a: 'Yes. SchoolOS is designed as a multi-tenant SaaS platform where every tenant-owned query is scoped by tenantId. Sensitive data should use encryption, strict RBAC, audit logs, and signed private file URLs.',
  },
  {
    q: 'How does the auto-posting ledger work?',
    a: 'Fees, payroll, canteen wallet transactions, and future operational payments should post through AccountingPostingService. Confirmed financial records are handled with double-entry rules, audit trails, and reversal/correction workflows.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-sm font-black text-white">S</span>
            <span className="text-lg font-black tracking-tight">SchoolOS</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-500 md:flex">
            <a href="#modules" className="hover:text-slate-900 transition-colors">Modules</a>
            <a href="#demo" className="hover:text-slate-900 transition-colors">Ledger Demo</a>
            <a href="#parents" className="hover:text-slate-900 transition-colors">Parent App</a>
            <a href="#roadmap" className="hover:text-slate-900 transition-colors">Roadmap</a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
            >
              Register school →
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-slate-950 px-6 py-24 md:py-32">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}
        />
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-amber-500 opacity-10 blur-3xl" />
        <div className="absolute -bottom-20 left-20 h-64 w-64 rounded-full bg-indigo-600 opacity-10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs font-semibold tracking-widest text-amber-400 uppercase mb-8">
            Built for Nepali schools | Montessori to Class 10
          </div>

          <h1 className="max-w-4xl text-5xl font-black tracking-tight text-white md:text-7xl leading-[1.05]">
            Run your entire school from one modern platform.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
            Admissions, attendance, fees, exams, notices, homework, timetable, HR, payroll, and accounting for Nepal-based schools.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/register"
              className="rounded-full bg-amber-500 px-7 py-3.5 text-base font-bold text-white hover:bg-amber-400 transition-colors"
            >
              Request demo
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-slate-600 px-7 py-3.5 text-base font-semibold !text-slate-300 hover:border-slate-400 hover:!text-white transition-colors"
            >
              Login
            </Link>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.value} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <p className="text-2xl font-black text-white">{stat.value}</p>
                <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust & Compliance Band ── */}
      <section className="border-b border-slate-100 bg-slate-50 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-8 md:justify-between opacity-70 grayscale">
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <span className="text-xl">🛡️</span> Privacy Act 2075 Aware
          </div>
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <span className="text-xl">🇳🇵</span> Nepal MoEST Ready
          </div>
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <span className="text-xl">🧾</span> IRD VAT Ready
          </div>
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <span className="text-xl">🔒</span> Tenant-Isolated SaaS
          </div>
        </div>
      </section>

      {/* ── Killer Demo Spotlight ── */}
      <section id="demo" className="px-6 py-24 bg-white">
        <div className="mx-auto max-w-6xl lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
          <div>
            <div className="mb-4 text-xs font-bold tracking-widest text-amber-600 uppercase">The Game Changer</div>
            <h2 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
              Real-time ledger integration.
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Most school tools stop at fee collection. SchoolOS is designed to connect operational transactions to accounting through a controlled posting boundary, so fees, payroll, and future canteen wallet transactions remain audit-ready.
            </p>
            <p className="mt-4 text-base font-medium text-slate-500 italic border-l-4 border-amber-500 pl-4">
              Collect a fee payment at the counter, then show the principal the journal entry that auto-posted to the ledger in real time.
            </p>
          </div>
          <div className="mt-12 lg:mt-0 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-100 to-indigo-100 transform skew-y-3 rounded-3xl opacity-50" />
            <div className="relative bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800">
              <div className="bg-slate-800 px-4 py-3 flex justify-between items-center border-b border-slate-700">
                <span className="text-xs text-slate-400">M3 Fees → M9 Accounting</span>
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div className="bg-white rounded-lg p-4 shadow-inner">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-slate-800">Fee Counter Collection</span>
                    <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-bold">PAID</span>
                  </div>
                  <div className="text-sm text-slate-500 flex justify-between">
                    <span>Student: Aarav Sharma (Class 5)</span>
                    <span className="font-bold text-slate-800">Rs. 15,000</span>
                  </div>
                </div>

                <div className="flex justify-center text-amber-500">
                  <svg className="w-6 h-6 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>

                <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-amber-400 text-sm tracking-wide uppercase">Auto-Journal Entry</span>
                    <span className="text-xs text-slate-400">System Generated</span>
                  </div>
                  <div className="space-y-2 text-sm text-slate-300">
                    <div className="flex justify-between border-b border-slate-700 pb-1">
                      <span>Dr. Cash in Hand</span>
                      <span className="text-green-400">15,000</span>
                    </div>
                    <div className="flex justify-between pl-4">
                      <span>Cr. Tuition Fee Income</span>
                      <span className="text-slate-400">15,000</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Parent App / Product Moat ── */}
      <section id="parents" className="bg-slate-50 px-6 py-24 border-y border-slate-100 overflow-hidden">
        <div className="mx-auto max-w-6xl lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
          <div className="order-2 lg:order-1 mt-16 lg:mt-0 flex justify-center relative">
            <div className="relative border-slate-900 bg-slate-900 border-[14px] rounded-[3rem] h-[600px] w-[300px] shadow-2xl flex-shrink-0">
              <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-20">
                <div className="w-32 h-6 bg-slate-900 rounded-b-2xl" />
              </div>

              <div className="relative h-full w-full bg-slate-50 rounded-[2.25rem] overflow-hidden flex flex-col">
                <div className="bg-amber-500 pt-12 pb-4 px-5 text-white shrink-0">
                  <h3 className="font-bold text-lg leading-tight">Parent App</h3>
                  <p className="text-xs font-medium opacity-90 mt-0.5">Live school updates</p>
                </div>

                <div className="p-4 flex-1 relative">
                  <div className="absolute top-2 left-2 right-2 bg-white/95 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl p-4 border border-slate-100/80 z-10">
                    <div className="flex gap-3 items-start">
                      <span className="text-xl leading-none">🚌</span>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Bus Update</p>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">Your child boarded Route A at Yogikuti Stop. ETA: 18 minutes.</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mt-20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-sm">👩‍🏫</div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Teacher Reema</p>
                        <p className="text-[10px] text-slate-500">10 mins ago</p>
                      </div>
                    </div>
                    <div className="h-32 bg-slate-100 rounded-xl w-full mb-3 flex items-center justify-center text-slate-400 text-xs font-medium">
                      Activity photo
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Aarav demonstrated excellent fine motor skills during craft time. ✂️
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white p-3 border border-slate-100 shadow-sm">
                      <p className="text-[10px] text-slate-500">Canteen Wallet</p>
                      <p className="text-sm font-black text-slate-900">Rs. 920</p>
                    </div>
                    <div className="rounded-xl bg-white p-3 border border-slate-100 shadow-sm">
                      <p className="text-[10px] text-slate-500">Attendance</p>
                      <p className="text-sm font-black text-green-600">Present</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="mb-4 text-xs font-bold tracking-widest text-amber-600 uppercase">
              Parent Trust Layer
            </div>
            <h2 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl leading-[1.1]">
              Parents stay connected to every important moment.
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-500">
              The parent experience combines activity posts, absence alerts, fee receipts, bus updates, canteen wallet visibility, and report cards in one secure app.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                'Push notifications for absences, notices, fee receipts, and bus boarding.',
                'Child-specific vehicle tracking during active pickup/drop trips only.',
                'Canteen wallet balance, purchase history, spending limits, and low-balance alerts.',
                'Secure guardian access scoped only to their own child or children.',
              ].map((item) => (
                <li key={item} className="flex gap-3 items-start">
                  <span className="text-amber-500 font-bold text-lg leading-none mt-0.5">✓</span>
                  <span className="text-base text-slate-600">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Modules Grid ── */}
      <section id="modules" className="px-6 py-24 bg-white">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 text-xs font-bold tracking-widest text-amber-600 uppercase">Complete SchoolOS Modules</div>
          <h2 className="max-w-2xl text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
            Every core workflow, designed as one system.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-500">
            From admissions to accounting, transport, and canteen operations, every module shares the same tenant boundary, audit discipline, and real API foundation.
          </p>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((module) => (
              <div
                key={module.title}
                className="group rounded-2xl border border-slate-100 bg-white p-7 shadow-sm hover:border-amber-200 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-3xl">{module.icon}</span>
                  {'phase' in module && module.phase ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">
                      {module.phase}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{module.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{module.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="bg-slate-950 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 text-xs font-bold tracking-widest text-amber-400 uppercase">Simple by design</div>
          <h2 className="max-w-2xl text-4xl font-black tracking-tight text-white md:text-5xl">
            Up and running without operational chaos.
          </h2>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="relative">
                <div className="mb-4 text-5xl font-black text-amber-500 opacity-60">{step.number}</div>
                <h3 className="text-xl font-bold text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roadmap Focus ── */}
      <section id="roadmap" className="px-6 py-24 bg-white">
        <div className="mx-auto max-w-6xl lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
          <div>
            <div className="mb-4 text-xs font-bold tracking-widest text-amber-600 uppercase">Phase-wise Development Plan</div>
            <h2 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
              Build depth first, then expand modules.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-500">
              SchoolOS should finish Phase 1B operational depth before starting Phase 2. Library, Transport, and Canteen belong in Phase 3 after the core school workflows are stable.
            </p>
          </div>

          <div className="mt-12 lg:mt-0 space-y-4">
            {phasePlan.map((item) => (
              <div key={item.title} className={`flex items-start gap-4 rounded-xl border p-4 ${item.active ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${item.done ? 'bg-amber-500 text-white' : item.active ? 'bg-white border border-amber-400 text-amber-500' : 'border border-slate-300 text-slate-400'}`}>
                  {item.done ? '✓' : item.active ? '!' : '○'}
                </span>
                <div>
                  <p className={`text-sm font-semibold ${item.done || item.active ? 'text-slate-900' : 'text-slate-400'}`}>{item.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing Tiers ── */}
      <section id="pricing" className="px-6 py-24 bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl text-center">
          <div className="mb-4 text-xs font-bold tracking-widest text-amber-400 uppercase">Subscription Plans</div>
          <h2 className="text-4xl font-black tracking-tight md:text-5xl">
            Scale module-by-module with your school.
          </h2>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
            One modular platform with subscription-based activation, tenant isolation, and production-grade workflows.
          </p>

          <div className="mt-16 grid gap-8 text-left lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <div key={plan.name} className={`rounded-3xl p-8 border ${plan.highlighted ? 'border-amber-500 bg-slate-900' : 'border-slate-800 bg-slate-900/50'}`}>
                <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                <p className="text-sm font-semibold text-amber-400 mt-2">{plan.phase}</p>
                <p className="text-slate-400 mt-4 text-sm">{plan.desc}</p>
                <ul className="mt-8 space-y-4 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm text-slate-300">
                      <span className="text-amber-500">✓</span> {feature}
                    </li>
                  ))}
                </ul>
                <button className={`w-full py-3 rounded-full font-bold transition-colors ${plan.highlighted ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ Section ── */}
      <section className="px-6 py-24 bg-slate-50">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <details key={idx} className="group border border-slate-200 rounded-xl bg-white [&_summary::-webkit-details-marker]:hidden shadow-sm">
                <summary className="flex cursor-pointer items-center justify-between gap-1.5 p-6 font-bold text-slate-900">
                  <h2 className="font-medium text-lg">{faq.q}</h2>
                  <span className="relative h-5 w-5 shrink-0 text-amber-500">
                    <svg className="absolute inset-0 h-5 w-5 opacity-100 group-open:opacity-0 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <svg className="absolute inset-0 h-5 w-5 opacity-0 group-open:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                    </svg>
                  </span>
                </summary>
                <div className="px-6 pb-6 text-slate-600 leading-relaxed border-t border-slate-100 pt-4 mt-2">
                  <p>{faq.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-amber-50 border-y border-amber-100 px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
            Ready to modernise your school?
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Join the early-access program. Set up your tenant workspace today—no credit card required.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/register"
              className="rounded-full bg-amber-500 px-8 py-4 text-base font-bold text-white hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/30"
            >
              Register your school
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-slate-300 bg-white px-8 py-4 text-base font-semibold text-slate-700 hover:border-slate-400 transition-colors shadow-sm"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-950 px-6 py-12 border-t border-slate-900">
        <div className="mx-auto max-w-6xl flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500 text-xs font-black text-white shadow-inner">S</span>
            <span className="font-black text-white tracking-tight">SchoolOS</span>
            <span className="text-slate-600 text-sm ml-2 hidden sm:inline-block">· Complete School Management for Nepal</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-400 font-medium">
            <Link href="/login" className="hover:text-white transition-colors">Sign in</Link>
            <Link href="/register" className="hover:text-white transition-colors">Register</Link>
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
