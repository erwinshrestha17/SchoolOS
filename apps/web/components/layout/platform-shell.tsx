'use client';

import type { PermissionKey } from '@schoolos/core';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useState } from 'react';
import { useSession } from '../session-provider';
import {
  Activity,
  BarChart3,
  Building2,
  ChevronDown,
  CreditCard,
  FileClock,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorCheck,
  School,
  ShieldCheck,
  X,
  type LucideIcon,
} from 'lucide-react';

type PlatformNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  permissions?: PermissionKey[];
  disabled?: boolean;
};

const platformNavItems: PlatformNavItem[] = [
  {
    href: '/platform/dashboard',
    label: 'Platform Overview',
    description: 'Global SaaS health and tenant metrics',
    icon: LayoutDashboard,
    permissions: ['platform:read'],
  },
  {
    href: '/platform/schools',
    label: 'Manage Schools',
    description: 'Tenant onboarding, status and usage',
    icon: Building2,
    permissions: ['platform:manage'],
  },
  {
    href: '#platform-usage-coming-soon',
    label: 'Tenant Usage',
    description: 'Seats, storage, modules and activity',
    icon: BarChart3,
    permissions: ['platform:read'],
    disabled: true,
  },
  {
    href: '#platform-billing-coming-soon',
    label: 'Plans & Billing',
    description: 'Subscriptions, invoices and limits',
    icon: CreditCard,
    permissions: ['platform:manage'],
    disabled: true,
  },
  {
    href: '#platform-health-coming-soon',
    label: 'System Health',
    description: 'Infrastructure, jobs and provider status',
    icon: MonitorCheck,
    permissions: ['platform:read'],
    disabled: true,
  },
  {
    href: '#platform-audit-coming-soon',
    label: 'Audit Logs',
    description: 'Cross-tenant operator actions',
    icon: FileClock,
    permissions: ['platform:manage'],
    disabled: true,
  },
];

export function PlatformShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { session, logout } = useSession();
  const pathname = usePathname();

  const visibleItems = platformNavItems.filter((item) =>
    canSeeNavItem(item, session?.user.permissions ?? []),
  );
  const displayName = session?.user.email?.split('@')[0] ?? 'Operator';
  const primaryRole = session?.user.roles[0]?.replace(/_/g, ' ') ?? 'Platform user';

  return (
    <div className="flex min-h-screen bg-slate-100">
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
          aria-label="Close platform navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[304px] flex-col border-r border-white/10 bg-slate-950 text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20">
              SO
            </div>
            <div>
              <p className="text-sm font-semibold text-white">SchoolOS</p>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                Control Plane
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close platform navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-white/10 px-5 py-4">
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              <ShieldCheck size={14} />
              Super-admin scope
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Cross-tenant operations for SchoolOS owners only. School module
              data remains tenant-scoped inside the admin workspace.
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Platform navigation">
          <p className="px-3 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Platform Control Plane
          </p>
          <div className="space-y-1">
            {visibleItems.map((item) => (
              <PlatformNavEntry
                key={item.href}
                item={item}
                pathname={pathname}
                onClick={() => setMobileOpen(false)}
              />
            ))}
          </div>
        </nav>

        <div className="border-t border-white/10 p-4">
          <Link
            href="/dashboard"
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <School size={18} />
            School workspace
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-16 items-center gap-4 border-b border-slate-200 bg-white/90 px-4 shadow-sm backdrop-blur lg:px-8">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-controls="platform-main"
            aria-label="Open platform navigation"
          >
            <Menu size={20} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
              <Activity size={14} />
              Platform operator console
            </div>
            <h1 className="truncate text-base font-semibold text-slate-950">
              Cross-tenant management, onboarding, usage and system health
            </h1>
          </div>

          <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 sm:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="max-w-[140px] truncate text-sm font-semibold capitalize text-slate-900">
                {displayName}
              </p>
              <p className="max-w-[140px] truncate text-xs capitalize text-slate-500">
                {primaryRole}
              </p>
            </div>
            <ChevronDown size={14} className="text-slate-400" />
          </div>

          <button
            type="button"
            onClick={() => void logout()}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </header>

        <main id="platform-main" className="flex-1 overflow-y-auto" tabIndex={-1}>
          <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function PlatformNavEntry({
  item,
  pathname,
  onClick,
}: {
  item: PlatformNavItem;
  pathname: string | null;
  onClick: () => void;
}) {
  const Icon = item.icon;
  const active = !item.disabled && pathname?.startsWith(item.href);
  const className = `group flex min-h-16 items-start gap-3 rounded-2xl px-3 py-3 transition-colors ${
    active
      ? 'bg-cyan-400/15 text-white ring-1 ring-cyan-400/30'
      : 'text-slate-400 hover:bg-white/10 hover:text-white'
  } ${item.disabled ? 'cursor-not-allowed opacity-55 hover:bg-transparent hover:text-slate-400' : ''}`;

  const content = (
    <>
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          active
            ? 'bg-cyan-400 text-slate-950'
            : 'bg-white/5 text-slate-400 group-hover:text-white'
        }`}
      >
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{item.label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500 group-hover:text-slate-400">
          {item.description}
        </span>
        {item.disabled && (
          <span className="mt-2 inline-flex rounded-full border border-white/10 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-slate-500">
            Later
          </span>
        )}
      </span>
    </>
  );

  if (item.disabled) {
    return (
      <button type="button" className={className} disabled aria-disabled="true">
        {content}
      </button>
    );
  }

  return (
    <Link href={item.href} className={className} onClick={onClick}>
      {content}
    </Link>
  );
}

function canSeeNavItem(item: PlatformNavItem, permissions: PermissionKey[]) {
  if (!item.permissions?.length) {
    return true;
  }

  const permissionSet = new Set(permissions);
  return item.permissions.some((permission) => permissionSet.has(permission));
}
