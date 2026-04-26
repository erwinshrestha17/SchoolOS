import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="shell-card rounded-[36px] p-8 md:p-12">
          <p className="label mb-3">SchoolOS Monorepo</p>
          <h1 className="max-w-3xl text-5xl font-black tracking-tight">
            One workspace for Nepal-ready admissions, attendance, finance, and school communications.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--muted)]">
            The backend keeps multi-tenant auth, RBAC, ledger posting, and academic structure together.
            The web app is focused on admin and staff operations first.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
           <Link
  href="/login"
  className="rounded-full bg-amber-600 px-5 py-3 font-semibold text-white hover:bg-amber-700"

>
  Sign in
</Link>
            <Link
              href="/register"
              className="rounded-full border border-[var(--line)] px-5 py-3 font-semibold"
            >
              Register tenant
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-[var(--line)] px-5 py-3 font-semibold"
            >
              Open dashboard
            </Link>
          </div>
        </section>

        <section className="shell-card rounded-[36px] p-8">
          <p className="label mb-4">Phase 1 Focus</p>
          <div className="space-y-3 text-sm leading-6 text-[var(--muted)]">
            <p>Admissions with guardian linkage and initial invoice generation.</p>
            <p>Fast attendance sessions with present-by-default submission.</p>
            <p>Fee collection that posts to the ledger automatically.</p>
            <p>Notices and events with audience targeting.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
