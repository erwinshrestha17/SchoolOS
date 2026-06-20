'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Loader2, Settings2 } from 'lucide-react';
import { SettingsControlCenter } from './settings-control-center';

const workspaceItems = [
  { href: '/dashboard/settings', label: 'Overview' },
  { href: '/dashboard/settings/school-profile', label: 'School profile' },
  { href: '/dashboard/settings/branding-documents', label: 'Branding & documents' },
  { href: '/dashboard/settings/academic-calendar', label: 'Calendar & academic year' },
  { href: '/dashboard/settings/academic-structure', label: 'Academic structure' },
];

const migratedLegacySections: Record<string, string> = {
  overview: '/dashboard/settings',
  subscription: '/dashboard/settings',
  profile: '/dashboard/settings/school-profile',
  branding: '/dashboard/settings/branding-documents',
  'school-setup': '/dashboard/settings/academic-structure',
  setup: '/dashboard/settings/academic-structure',
  'users-access': '/dashboard/settings/users-access',
  users: '/dashboard/settings/users-access',
  'roles-permissions': '/dashboard/settings/roles-permissions',
  roles: '/dashboard/settings/roles-permissions',
  academic: '/dashboard/settings/policies/academic',
  attendance: '/dashboard/settings/policies/attendance',
  fees: '/dashboard/settings/policies/fees',
  fee: '/dashboard/settings/policies/fees',
  communication: '/dashboard/settings/policies/communication',
  payroll: '/dashboard/settings/policies/payroll',
  hr: '/dashboard/settings/policies/payroll',
  accounting: '/dashboard/settings/policies/accounting',
  security: '/dashboard/settings/policies/security',
  data: '/dashboard/settings/data-operations',
  audit: '/dashboard/settings/audit-log',
  'fee-setup': '/dashboard/fees',
  'fee-plans': '/dashboard/fees',
};

export function SettingsRouteFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const legacySection = (searchParams.get('section') ?? searchParams.get('tab') ?? '').toLowerCase();
  const migratedDestination = pathname === '/dashboard/settings' ? migratedLegacySections[legacySection] : undefined;

  useEffect(() => {
    if (migratedDestination && migratedDestination !== `${pathname}?${searchParams.toString()}`) router.replace(migratedDestination);
  }, [migratedDestination, pathname, router, searchParams]);

  if (migratedDestination) return <div className="flex min-h-[420px] items-center justify-center bg-slate-50"><div className="flex items-center gap-2 text-sm font-semibold text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Opening Settings workspace…</div></div>;

  // The root URL is the redesigned school configuration control centre. Query
  // links not yet migrated continue to load their existing screen until replaced.
  if (pathname === '/dashboard/settings' && !legacySection) return <SettingsControlCenter />;
  if (pathname === '/dashboard/settings') return <>{children}</>;

  return <div className="min-h-full bg-slate-50/60"><div className="border-b border-slate-200 bg-white px-5 py-3 lg:px-7"><div className="mx-auto flex max-w-[1440px] flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div className="flex items-center gap-3"><Link href="/dashboard/settings" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950" aria-label="Back to School Settings"><ChevronLeft className="h-4 w-4" /></Link><div className="flex items-center gap-2"><span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white"><Settings2 className="h-4 w-4" /></span><div><p className="text-sm font-bold text-slate-950">School Settings</p><p className="text-xs text-slate-500">One school’s configuration</p></div></div></div><nav aria-label="School Settings navigation" className="-mx-5 flex gap-1 overflow-x-auto px-5 pb-1 xl:mx-0 xl:px-0 xl:pb-0">{workspaceItems.map((item) => { const selected = pathname === item.href; return <Link key={item.href} href={item.href} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${selected ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>{item.label}</Link>; })}</nav></div></div><div className="mx-auto max-w-[1440px]">{children}</div></div>;
}
