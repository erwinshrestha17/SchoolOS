'use client';

import type { PermissionKey } from '@schoolos/core';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { useSession } from './session-provider';

const navItems: Array<{
  href: string;
  label: string;
  permission: PermissionKey;
}> = [
  { href: '/dashboard', label: 'Overview', permission: 'tenants:read' },
  {
    href: '/dashboard/admissions',
    label: 'Admissions',
    permission: 'students:create',
  },
  {
    href: '/dashboard/attendance',
    label: 'Attendance',
    permission: 'attendance:mark',
  },
  {
    href: '/dashboard/finance',
    label: 'Fees & Ledger',
    permission: 'fees:manage',
  },
  {
    href: '/dashboard/notices',
    label: 'Notices & Events',
    permission: 'notices:create',
  },
  { href: '/dashboard/settings', label: 'Settings', permission: 'roles:read' },
];

const deferredItems = ['Academics', 'Library', 'Transport', 'Payroll'];

export function AppShell({
  title,
  eyebrow,
  children,
  requiredPermissions = [],
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  requiredPermissions?: PermissionKey[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, status, hasPermissions, logout } = useSession();

  useEffect(() => {
    if (status === 'anonymous') {
      router.replace(`/login?next=${encodeURIComponent(pathname || '/dashboard')}`);
    }
  }, [pathname, router, status]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-3xl">
          <section className="shell-card rounded-[32px] p-8">
            <p className="label mb-3">Session</p>
            <h1 className="text-3xl font-black tracking-tight">
              Restoring your SchoolOS workspace
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Refresh-cookie validation is running so the dashboard can recover
              the latest access token before protected actions appear.
            </p>
          </section>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-3xl">
          <section className="shell-card rounded-[32px] p-8">
            <p className="label mb-3">Redirecting</p>
            <h1 className="text-3xl font-black tracking-tight">
              Sending you back to sign in
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Protected admin pages require an active SchoolOS session.
            </p>
          </section>
        </div>
      </div>
    );
  }

  if (!hasPermissions(requiredPermissions)) {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="mx-auto max-w-3xl">
          <section className="shell-card rounded-[32px] p-8">
            <p className="label mb-3">Access Control</p>
            <h1 className="text-3xl font-black tracking-tight">
              This workspace role cannot open this module
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Required permissions: {requiredPermissions.join(', ')}.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-full bg-[var(--ink)] px-5 py-3 font-semibold text-white"
              >
                Return to overview
              </Link>
              <button
                type="button"
                className="rounded-full border border-[var(--line)] px-5 py-3 font-semibold"
                onClick={() => void logout()}
              >
                Sign out
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

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
              Multi-tenant admin workspace for admissions, attendance, finance,
              and communications.
            </p>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const enabled = hasPermissions([item.permission]);
              const active =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname?.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-disabled={!enabled}
                  className={`block rounded-2xl border px-4 py-3 transition ${
                    active
                      ? 'border-[var(--line)] bg-white/85'
                      : enabled
                        ? 'border-transparent hover:border-[var(--line)] hover:bg-white/70'
                        : 'border-transparent opacity-45'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
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

          <div className="mt-8 rounded-3xl border border-[var(--line)] bg-white/50 p-4">
            <p className="label mb-3">Current Session</p>
            <div className="grid gap-2 text-sm text-[var(--muted)]">
              <span>{session.tenant.name}</span>
              <span>{session.user.email ?? session.tenant.slug}</span>
              <span>{session.user.roles.join(', ')}</span>
            </div>
            <button
              type="button"
              className="mt-4 w-full rounded-2xl border border-[var(--line)] px-4 py-3 font-semibold"
              onClick={() => void logout()}
            >
              Sign out
            </button>
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
                  Web admin and staff workflows are the v1 focus. Parent and
                  teacher mobile surfaces stay API-ready but intentionally
                  deferred.
                </p>
              </div>
              <div className="grid gap-2 text-right text-sm text-[var(--muted)]">
                <span>Tenant mode: {session.tenant.mode ?? 'MULTI'}</span>
                <span>
                  API base:{' '}
                  {process.env.NEXT_PUBLIC_API_BASE_URL ??
                    'http://localhost:4000/api/v1'}
                </span>
              </div>
            </div>
          </section>

          {children}
        </main>
      </div>
    </div>
  );
}
