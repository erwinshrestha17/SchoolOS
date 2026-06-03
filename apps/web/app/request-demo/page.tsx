import Link from 'next/link';

const modules = [
  'Admissions',
  'Attendance',
  'Fees & Receipts',
  'Academics',
  'Notices',
  'HR & Payroll',
  'Accounting',
  'Transport',
  'Library',
  'Canteen',
  'Parent Portal',
];

export default function RequestDemoPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 font-sans text-slate-950">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500 text-sm font-black text-white">S</span>
            <span>
              <span className="block text-xl font-black tracking-tight">SchoolOS</span>
              <span className="block text-xs font-semibold text-slate-500">Guided onboarding</span>
            </span>
          </Link>
          <Link href="/login" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300">
            Sign in
          </Link>
        </header>

        <section className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div className="rounded-[2rem] bg-[#08111f] p-8 text-white shadow-2xl shadow-slate-200 lg:sticky lg:top-8">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-300">Request Demo</p>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight md:text-5xl">
              Request a SchoolOS demo.
            </h1>
            <p className="mt-5 text-base leading-7 text-slate-300">
              Tell us about your school and our team will contact you for verification, demo, and onboarding planning.
            </p>

            <div className="mt-8 space-y-4">
              {[
                ['Verified setup', 'SchoolOS workspaces are created after school verification.'],
                ['Tenant isolation', 'Each school receives its own protected workspace and role setup.'],
                ['Nepal-ready defaults', 'Academic year, NPR fees, notices, and reports can be configured for local workflows.'],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-black">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <form className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 md:p-8">
            <div className="mb-8">
              <h2 className="text-3xl font-black tracking-tight">Tell us about your school</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                SchoolOS workspaces are created after verification by the SchoolOS team.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="schoolName" className="label mb-2 block">School Name</label>
                <input id="schoolName" name="schoolName" placeholder="Shree Janata Secondary School" />
              </div>
              <div>
                <label htmlFor="contactName" className="label mb-2 block">Contact Person Name</label>
                <input id="contactName" name="contactName" placeholder="Ramesh Adhikari" />
              </div>
              <div>
                <label htmlFor="role" className="label mb-2 block">Role / Designation</label>
                <input id="role" name="role" placeholder="Principal / Admin / Director" />
              </div>
              <div>
                <label htmlFor="phone" className="label mb-2 block">Phone Number</label>
                <input id="phone" name="phone" placeholder="98XXXXXXXX" />
              </div>
              <div>
                <label htmlFor="email" className="label mb-2 block">Email</label>
                <input id="email" name="email" type="email" placeholder="school@example.edu.np" />
              </div>
              <div>
                <label htmlFor="location" className="label mb-2 block">School Location</label>
                <input id="location" name="location" placeholder="Pokhara, Gandaki Province" />
              </div>
              <div>
                <label htmlFor="students" className="label mb-2 block">Number of Students</label>
                <select id="students" name="students" defaultValue="">
                  <option value="" disabled>Select range</option>
                  <option>Below 200</option>
                  <option>200 - 500</option>
                  <option>500 - 1,000</option>
                  <option>1,000 - 2,000</option>
                  <option>2,000+</option>
                </select>
              </div>
              <div>
                <label htmlFor="timeline" className="label mb-2 block">Expected Timeline</label>
                <select id="timeline" name="timeline" defaultValue="">
                  <option value="" disabled>Select timeline</option>
                  <option>Immediately</option>
                  <option>Within 1 month</option>
                  <option>Within 3 months</option>
                  <option>Exploring only</option>
                </select>
              </div>
            </div>

            <div className="mt-6">
              <p className="label mb-3 block">Interested Modules</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {modules.map((module) => (
                  <label key={module} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" name="modules" value={module} className="h-4 w-4 rounded border-slate-300 p-0" />
                    {module}
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <label htmlFor="message" className="label mb-2 block">Message / Requirements</label>
              <textarea id="message" name="message" rows={5} placeholder="Tell us what problems you want SchoolOS to solve first..." />
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-500">
                Submitting this request does not create a public tenant. Our team will contact you first.
              </p>
              <button type="button" className="rounded-full bg-primary-500 px-7 py-3 text-sm font-black text-white shadow-lg shadow-primary-500/20 transition hover:bg-primary-600">
                Submit Demo Request
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
