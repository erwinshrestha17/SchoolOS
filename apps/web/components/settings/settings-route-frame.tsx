'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Loader2, Search, Settings2, ShieldCheck } from 'lucide-react';
import type { SchoolSettingsNavigationItem } from '@schoolos/core';
import { cn } from '../../lib/utils';
import { schoolSettingsApi } from '../../lib/api/school-settings';
import { SettingsControlCenter } from './settings-control-center';
import {
  SCHOOL_SETTINGS_FALLBACK_ICON,
  SCHOOL_SETTINGS_ITEM_ICONS,
} from './school-settings-catalog';

const migratedLegacySections: Record<string, string> = {
  overview: '/dashboard/settings',
  subscription: '/dashboard/settings/modules',
  profile: '/dashboard/settings/school-profile',
  branding: '/dashboard/settings/branding-documents',
  'school-setup': '/dashboard/settings/academic-structure',
  setup: '/dashboard/settings/academic-structure',
  'users-access': '/dashboard/settings/users-access',
  users: '/dashboard/settings/users-access',
  'roles-permissions': '/dashboard/settings/roles-permissions',
  roles: '/dashboard/settings/roles-permissions',
  academic: '/dashboard/settings/academic-calendar',
  attendance: '/dashboard/settings/attendance',
  fees: '/dashboard/settings/fees',
  fee: '/dashboard/settings/fees',
  communication: '/dashboard/settings/communication',
  notifications: '/dashboard/settings/communication',
  security: '/dashboard/settings/security',
  data: '/dashboard/settings/audit-export',
  audit: '/dashboard/settings/audit-export',
  payroll: '/dashboard/settings/hr-payroll',
  hr: '/dashboard/settings/hr-payroll',
  accounting: '/dashboard/settings/accounting',
  'fee-setup': '/dashboard/fees',
  'fee-plans': '/dashboard/fees',
};

function matchesItem(item: SchoolSettingsNavigationItem, pathname: string) {
  if (item.href === '/dashboard/settings') return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function SettingsRouteFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const legacySection = (searchParams.get('section') ?? searchParams.get('tab') ?? '').toLowerCase();
  const migratedDestination =
    pathname === '/dashboard/settings' && legacySection
      ? (migratedLegacySections[legacySection] ?? '/dashboard/settings')
      : undefined;

  const navigationQuery = useQuery({
    queryKey: ['school-settings', 'navigation'],
    queryFn: schoolSettingsApi.getSchoolSettingsNavigation,
  });

  const groups = useMemo(() => {
    const allGroups = navigationQuery.data?.groups ?? [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return allGroups;
    return allGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          `${item.label} ${item.description}`.toLowerCase().includes(normalized),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [navigationQuery.data, query]);

  const allItems = useMemo(
    () => (navigationQuery.data?.groups ?? []).flatMap((group) => group.items),
    [navigationQuery.data],
  );
  const activeItem = allItems.find((item) => matchesItem(item, pathname));

  useEffect(() => {
    if (migratedDestination) router.replace(migratedDestination);
  }, [migratedDestination, router]);

  if (migratedDestination) {
    return <div className="flex min-h-[420px] items-center justify-center"><div className="flex items-center gap-2 text-sm font-semibold text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Opening School Settings…</div></div>;
  }

  const content = pathname === '/dashboard/settings' ? <SettingsControlCenter searchQuery={query} /> : children;

  return (
    <div className="-mx-4 -my-5 min-h-[calc(100vh-4rem)] bg-slate-50 sm:-mx-6 lg:-mx-7 xl:-mx-8">
      <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-7">
        <div className="mx-auto flex max-w-[1560px] flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white"><Settings2 className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-950">School Settings</p>
              <p className="truncate text-xs text-slate-500">Dashboard / Settings{activeItem && activeItem.id !== 'overview' ? ` / ${activeItem.label}` : ''}</p>
            </div>
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800 sm:inline-flex"><ShieldCheck className="h-3.5 w-3.5" />Applies only to this school</span>
          </div>
          <label className="relative block w-full xl:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <span className="sr-only">Search settings</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your authorised settings" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100" />
          </label>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1560px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white lg:min-h-[calc(100vh-8.5rem)] lg:border-b-0 lg:border-r" aria-label="School Settings sections">
          <div className="border-b border-slate-100 px-4 py-4">
            <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-950"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" /><span><strong>School only.</strong> Only settings your role may see are listed. Billing, credentials, and queues stay with SchoolOS Platform.</span></div>
          </div>
          <nav className="flex gap-1 overflow-x-auto p-3 lg:block lg:space-y-4 lg:overflow-visible">
            {navigationQuery.isLoading ? (
              <div className="w-full space-y-2 p-1">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-9 animate-pulse rounded-lg bg-slate-100" />)}</div>
            ) : navigationQuery.isError ? (
              <div className="p-3 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">Navigation unavailable</p>
                <p className="mt-1 leading-5">Your settings access could not be loaded.</p>
                <button type="button" onClick={() => void navigationQuery.refetch()} className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Retry</button>
              </div>
            ) : groups.length === 0 ? (
              <p className="px-3 py-6 text-sm text-slate-500">{query.trim() ? `No authorised settings match “${query}”.` : 'Your role has no School Settings access.'}</p>
            ) : (
              groups.map((group) => (
                <div key={group.id} className="min-w-max lg:min-w-0">
                  <p className="hidden px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 lg:block">{group.label}</p>
                  <div className="flex gap-1 lg:block lg:space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = SCHOOL_SETTINGS_ITEM_ICONS[item.id] ?? SCHOOL_SETTINGS_FALLBACK_ICON;
                      const selected = activeItem?.id === item.id;
                      return (
                        <Link key={item.id} href={item.href} className={cn('group flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition lg:w-full', selected ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950')} aria-current={selected ? 'page' : undefined}>
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="whitespace-nowrap lg:min-w-0 lg:flex-1 lg:whitespace-normal">{item.label}</span>
                          {item.access === 'view' ? <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 lg:inline">View only</span> : null}
                          <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-slate-400 lg:block" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </nav>
        </aside>
        <main className="min-w-0">{content}</main>
      </div>
    </div>
  );
}
