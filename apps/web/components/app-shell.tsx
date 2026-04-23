import Link from 'next/link';
import { ReactNode } from 'react';

const navItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/admissions', label: 'Admissions' },
  { href: '/dashboard/attendance', label: 'Attendance' },
  { href: '/dashboard/finance', label: 'Fees & Ledger' },
  { href: '/dashboard/notices', label: 'Notices & Events' },
  { href: '/dashboard/settings', label: 'Settings' },
];

const deferredItems = ['Academics', 'Library', 'Transport', 'Payroll'];

export function AppShell({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="shell-card rounded-[32px] p-6">
          <div className="mb-8">
            <p className="label mb-2">SchoolOS</p>
            <h1 className="text-3xl font-black tracking-tight text-[var(--ink)]">
              Nepal-ready school operations
            </h1>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Multi-tenant admin workspace for admissions, attendance, finance, and communications.
            </p>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-2xl border border-transparent px-4 py-3 transition hover:border-[var(--line)] hover:bg-white/70"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-8 rounded-3xl border border-dashed border-[var(--line)] p-4">
            <p className="label mb-3">Deferred Modules</p>
            <div className="flex flex-wrap gap-2">
              {deferredItems.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]"
                >
                  {item} soon
                </span>
              ))}
            </div>
          </div>
        </aside>

        <main className="space-y-4">
          <section className="shell-card rounded-[32px] p-8">
            <p className="label mb-3">{eyebrow}</p>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-4xl font-black tracking-tight text-[var(--ink)]">
                  {title}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                  Web admin/staff is the v1 focus. Parent and teacher mobile surfaces stay API-ready
                  but intentionally deferred.
                </p>
              </div>
              <div className="grid gap-2 text-right text-sm text-[var(--muted)]">
                <span>Tenant mode: Multi-tenant SaaS</span>
                <span>API base: {process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1'}</span>
              </div>
            </div>
          </section>

          {children}
        </main>
      </div>
    </div>
  );
}
