import Link from 'next/link';

const features = [
  {
    icon: '🎓',
    title: 'Admissions & Profiles',
    desc: 'Digital application forms, guardian linkage, document uploads, and instant invoice generation on enrolment.',
  },
  {
    icon: '📋',
    title: '3-Tap Attendance',
    desc: 'Lightning-fast roll-call with present-by-default submission. Real-time absentee alerts pushed to parents instantly.',
  },
  {
    icon: '💰',
    title: 'Fees & Auto-Ledger',
    desc: 'Collect fees online or at the counter. Every payment auto-posts a double-entry journal to the accounting module.',
  },
  {
    icon: '📸',
    title: 'Activity Feed & Milestones',
    desc: 'Engage parents daily with class photos, developmental milestones, and behavior logs. The ultimate product moat.',
  },
  {
    icon: '📝',
    title: 'MoEST Academics & CAS',
    desc: 'Terminal exams and Continuous Assessment System (CAS) with auto-computed GPA based on Nepal MoEST standards.',
  },
  {
    icon: '📢',
    title: 'Notices & Messaging',
    desc: 'The central notification layer. Send targeted pushes, SMS fallbacks, and manage digital consent forms seamlessly.',
  },
];

const steps = [
  {
    number: '01',
    title: 'Register your school',
    desc: 'Create an isolated tenant workspace in minutes. Configure your MoEST class levels, fee structures, and staff roles.',
  },
  {
    number: '02',
    title: 'Onboard students & staff',
    desc: 'Import students, link family profiles for sibling discounts, and assign strict RBAC roles to your staff.',
  },
  {
    number: '03',
    title: 'Run daily operations',
    desc: 'Take attendance in seconds, collect counter fees, post to the activity feed, and watch your ledger update in real time.',
  },
];

const stats = [
  { value: '10 Modules', label: 'Fully integrated platform' },
  { value: 'MoEST & IRD', label: '100% compliance ready' },
  { value: 'Montessori–10', label: 'Supported class levels' },
  { value: 'Real-time', label: 'Auto-posting ledger' },
];

const pricingPlans = [
  {
    name: 'Basic Plan',
    phase: 'Phase 1 Core',
    desc: 'Essential operations for daily school management.',
    features: ['Admissions & Student Profiles', 'Attendance (Student + Staff)', 'Fee Management', 'Activity Feed & Milestones', 'Notices, Events & Messaging'],
    cta: 'Start with Basic',
    highlighted: false,
  },
  {
    name: 'Standard Plan',
    phase: 'Phase 2 Academic + HR',
    desc: 'Complete academic cycle and financial control.',
    features: ['Everything in Basic', 'Exams, CAS & Grading', 'Homework & Timetable', 'Staff HR & Payroll', 'Accounting & Financial Management', 'Library & Transport Modules'],
    cta: 'Upgrade to Standard',
    highlighted: true,
  }
];

const faqs = [
  {
    q: 'Does attendance tracking work offline?',
    a: 'Yes. Attendance data is saved to the device SQLite database on submission. A network check runs every 30 seconds, and on reconnection, unsynced records are queued and uploaded in order.'
  },
  {
    q: 'How does SchoolOS handle online fee payments?',
    a: 'We support cash, cheque, and bank transfers, with Phase 2 introducing direct payment gateway webhooks for eSewa and Khalti. All confirmed payments automatically generate a Nepal IRD-compliant VAT receipt.'
  },
  {
    q: 'Is student data secure?',
    a: 'Absolutely. We enforce multi-tenant isolation at the database query layer so cross-school data access is architecturally impossible. Sensitive PII, such as health data, citizenship numbers, and bank accounts, is encrypted using AES-256 at rest.'
  },
  {
    q: 'How does the auto-posting ledger work?',
    a: 'SchoolOS fully integrates fees and accounting. Every rupee collected from fees and every salary paid flows automatically through a double-entry general ledger. For example, a cash fee payment instantly posts: Dr Cash in hand → Cr Tuition fee income.'
  }
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
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#demo" className="hover:text-slate-900 transition-colors">The Ledger Demo</a>
            <a href="#parents" className="hover:text-slate-900 transition-colors">Parent App</a>
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
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-amber-500 opacity-10 blur-3xl" />
        <div className="absolute -bottom-20 left-20 h-64 w-64 rounded-full bg-indigo-600 opacity-10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs font-semibold tracking-widest text-amber-400 uppercase mb-8">
            Built for Nepali schools | Montessori to Class 10
          </div>

          <h1 className="max-w-4xl text-5xl font-black tracking-tight text-white md:text-7xl leading-[1.05]">
            One platform for every school operation.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
            SchoolOS brings admissions, attendance, fee collection, HR, and complete double-entry accounting under one roof—designed from the ground up for Nepal's educational and financial standards.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/register"
              className="rounded-full bg-amber-500 px-7 py-3.5 text-base font-bold text-white hover:bg-amber-400 transition-colors"
            >
              Register your school — it's free
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-slate-600 px-7 py-3.5 text-base font-semibold !text-slate-300 hover:border-slate-400 hover:!text-white transition-colors"
            >
              Open dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* ── Trust & Compliance Band ── */}
      <section className="border-b border-slate-100 bg-slate-50 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-8 md:justify-between opacity-70 grayscale">
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <span className="text-xl">🛡️</span> Privacy Act 2075 Compliant
          </div>
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <span className="text-xl">🇳🇵</span> Nepal MoEST Standard
          </div>
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <span className="text-xl">🧾</span> IRD VAT Ready
          </div>
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <span className="text-xl">🔒</span> AES-256 Data Encryption
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
              Most Nepal school software has basic fee collection OR basic accounting—never both properly integrated. SchoolOS integrates them fully. Every rupee collected posts automatically through a double-entry general ledger.
            </p>
            <p className="mt-4 text-base font-medium text-slate-500 italic border-l-4 border-amber-500 pl-4">
              "Collect a fee payment at the counter screen. Show the principal the journal entry that auto-posted to the ledger in real time. No one in Nepal has seen this before."
            </p>
          </div>
          <div className="mt-12 lg:mt-0 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-100 to-indigo-100 transform skew-y-3 rounded-3xl opacity-50"></div>
            <div className="relative bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800">
              <div className="bg-slate-800 px-4 py-3 flex justify-between items-center border-b border-slate-700">
                <span className="text-xs text-slate-400 font-mono">Module 3 → Module 9 Flow</span>
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
              </div>
              <div className="p-6 space-y-6">
                {/* Fee Collection UI Mock */}
                <div className="bg-white rounded-lg p-4 shadow-inner">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-slate-800">Fee Counter Collection</span>
                    <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-bold">PAID</span>
                  </div>
                  <div className="text-sm text-slate-500 flex justify-between">
                    <span>Student: Aarav Sharma (Cl-5)</span>
                    <span className="font-mono text-slate-800">Rs. 15,000</span>
                  </div>
                </div>
                {/* Auto-Posting Arrow */}
                <div className="flex justify-center text-amber-500">
                  <svg className="w-6 h-6 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
                </div>
                {/* Journal Entry UI Mock */}
                <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-amber-400 text-sm tracking-wide uppercase">Auto-Journal Entry</span>
                    <span className="text-xs text-slate-400">System Generated</span>
                  </div>
                  <div className="space-y-2 text-sm font-mono text-slate-300">
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

          {/* Left: Mobile Phone Mockup */}
          <div className="order-2 lg:order-1 mt-16 lg:mt-0 flex justify-center relative">
            {/* Phone Hardware */}
            <div className="relative border-slate-900 bg-slate-900 border-[14px] rounded-[3rem] h-[600px] w-[300px] shadow-2xl flex-shrink-0">
              
              {/* Notch */}
              <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-20">
                <div className="w-32 h-6 bg-slate-900 rounded-b-2xl"></div>
              </div>

              {/* Screen Content */}
              <div className="relative h-full w-full bg-slate-50 rounded-[2.25rem] overflow-hidden flex flex-col">
                
                {/* App Header */}
                <div className="bg-amber-500 pt-12 pb-4 px-5 text-white shrink-0">
                  <h3 className="font-bold text-lg leading-tight">Activity Feed</h3>
                  <p className="text-xs font-medium opacity-90 mt-0.5">Montessori Section A</p>
                </div>

                {/* App Feed Area */}
                <div className="p-4 flex-1 relative">
                  
                  {/* Floating Notification Alert (Overlapping) */}
                  <div className="absolute top-2 left-2 right-2 bg-white/95 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl p-4 border border-slate-100/80 z-10">
                    <div className="flex gap-3 items-start">
                      <span className="text-xl leading-none">🔔</span>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Attendance Alert</p>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">Your child was marked absent today. Please contact the office.</p>
                      </div>
                    </div>
                  </div>

                  {/* Activity Post */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mt-12 opacity-40">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-sm">👩‍🏫</div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Teacher Reema</p>
                        <p className="text-[10px] text-slate-500">10 mins ago</p>
                      </div>
                    </div>
                    {/* Image Placeholder */}
                    <div className="h-32 bg-slate-100 rounded-xl w-full mb-3 flex items-center justify-center text-slate-400 text-xs font-medium">
                      Image
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Aarav demonstrating excellent fine motor skills during craft time! ✂️
                    </p>
                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* Right: Text Content */}
          <div className="order-1 lg:order-2">
            <div className="mb-4 text-xs font-bold tracking-widest text-amber-600 uppercase">
              The Product Moat
            </div>
            <h2 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl leading-[1.1]">
              Parents will love your school app.
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-500">
              The activity feed is our #1 retention feature. Parents open the app daily for teacher photo posts, building deep emotional investment over time.
            </p>
            <ul className="mt-8 space-y-4">
              <li className="flex gap-3 items-start">
                <span className="text-amber-500 font-bold text-lg leading-none mt-0.5">✓</span>
                <span className="text-base text-slate-600">Push notifications for absences and bus boarding.</span>
              </li>
              <li className="flex gap-3 items-start">
                <span className="text-amber-500 font-bold text-lg leading-none mt-0.5">✓</span>
                <span className="text-base text-slate-600">Real-time developmental milestone tracking for ECE.</span>
              </li>
              <li className="flex gap-3 items-start">
                <span className="text-amber-500 font-bold text-lg leading-none mt-0.5">✓</span>
                <span className="text-base text-slate-600">Secure PIN and OTP login via registered phone number.</span>
              </li>
              <li className="flex gap-3 items-start">
                <span className="text-amber-500 font-bold text-lg leading-none mt-0.5">✓</span>
                <span className="text-base text-slate-600">Immediate access to fee receipts and report cards.</span>
              </li>
            </ul>
          </div>

        </div>
      </section>

      {/* ── Features Grid ── */}
      <section id="features" className="px-6 py-24 bg-white">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 text-xs font-bold tracking-widest text-amber-600 uppercase">Everything you need</div>
          <h2 className="max-w-2xl text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
            Core operations, fully covered.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-500">
            From the first admission to daily attendance, term-end finances, and MoEST-compliant report cards—SchoolOS handles it all.
          </p>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-slate-100 bg-white p-7 shadow-sm hover:border-amber-200 hover:shadow-md transition-all"
              >
                <span className="text-3xl">{f.icon}</span>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{f.desc}</p>
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
            Up and running in a day.
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
            <div className="mb-4 text-xs font-bold tracking-widest text-amber-600 uppercase">Strategic Rollout</div>
            <h2 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
              Engineered in focused phases.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-500">
              We ship in structured phases to ensure every module is production-tested and perfectly integrated before expanding capabilities.
            </p>
          </div>

          <div className="mt-12 lg:mt-0 space-y-4">
            {[
              { done: true, title: 'Phase 1: Core Operations', sub: 'Admissions, Attendance, Fees, Activity Feed, and Notices.' },
              { done: false, title: 'Phase 2: Academic & HR', sub: 'Exams, CAS, Homework, HR, Payroll, and Accounting.' },
              { done: false, title: 'Phase 3: Auxiliary Systems', sub: 'Library circulation and GPS Transport Management.' },
              { done: false, title: 'Phase 4: AI Capabilities', sub: 'AI photo captions, developmental narratives, and smart templates.' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${item.done ? 'bg-amber-500 text-white' : 'border border-slate-300 text-slate-400'}`}>
                  {item.done ? '✓' : '○'}
                </span>
                <div>
                  <p className={`text-sm font-semibold ${item.done ? 'text-slate-900' : 'text-slate-400'}`}>{item.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.sub}</p>
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
            Scale seamlessly with your school.
          </h2>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
            Deployed as a single API with modular activation per your subscription tier.
          </p>

          <div className="mt-16 grid md:grid-cols-2 gap-8 max-w-4xl mx-auto text-left">
            {pricingPlans.map((plan) => (
              <div key={plan.name} className={`rounded-3xl p-8 border ${plan.highlighted ? 'border-amber-500 bg-slate-900' : 'border-slate-800 bg-slate-900/50'}`}>
                <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                <p className="text-sm font-mono text-amber-400 mt-2">{plan.phase}</p>
                <p className="text-slate-400 mt-4 text-sm">{plan.desc}</p>
                <ul className="mt-8 space-y-4 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className="flex gap-3 text-sm text-slate-300">
                      <span className="text-amber-500">✓</span> {f}
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