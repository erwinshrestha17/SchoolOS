'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Loader2, Search, Settings2, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SettingsControlCenter } from './settings-control-center';
import { SCHOOL_SETTINGS_CATEGORIES, getSchoolSettingsCategory } from './school-settings-catalog';

const migratedLegacySections: Record<string, string> = {
  overview: '/dashboard/settings',
  subscription: '/dashboard/settings/modules',
  profile: '/dashboard/settings/profile',
  branding: '/dashboard/settings/documents-templates',
  'school-setup': '/dashboard/settings/academic',
  setup: '/dashboard/settings/academic',
  'users-access': '/dashboard/settings/users-roles',
  users: '/dashboard/settings/users-roles',
  'roles-permissions': '/dashboard/settings/users-roles',
  roles: '/dashboard/settings/users-roles',
  academic: '/dashboard/settings/academic',
  attendance: '/dashboard/settings/attendance',
  fees: '/dashboard/settings/fees',
  fee: '/dashboard/settings/fees',
  communication: '/dashboard/settings/communication',
  security: '/dashboard/settings/security',
  data: '/dashboard/settings/audit-export',
  audit: '/dashboard/settings/audit-export',
  payroll: '/dashboard/hr',
  hr: '/dashboard/hr',
  accounting: '/dashboard/accounting',
  'fee-setup': '/dashboard/fees',
  'fee-plans': '/dashboard/fees',
};

export function SettingsRouteFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const legacySection = (searchParams.get('section') ?? searchParams.get('tab') ?? '').toLowerCase();
  const migratedDestination = pathname === '/dashboard/settings' ? migratedLegacySections[legacySection] : undefined;
  const activeCategory = getSchoolSettingsCategory(pathname);
  const filteredCategories = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return SCHOOL_SETTINGS_CATEGORIES;
    return SCHOOL_SETTINGS_CATEGORIES.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(normalized));
  }, [query]);

  useEffect(() => {
    if (migratedDestination) router.replace(migratedDestination);
  }, [migratedDestination, router]);

  if (migratedDestination) {
    return <div className="flex min-h-[420px] items-center justify-center"><div className="flex items-center gap-2 text-sm font-semibold text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Opening School Settings…</div></div>;
  }

  const content = pathname === '/dashboard/settings' && !legacySection ? <SettingsControlCenter searchQuery={query} /> : children;

  return (
    <div className="-mx-4 -my-5 min-h-[calc(100vh-4rem)] bg-slate-50 sm:-mx-6 lg:-mx-7 xl:-mx-8">
      <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-7">
        <div className="mx-auto flex max-w-[1560px] flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white"><Settings2 className="h-5 w-5" /></span>
            <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-950">School Settings</p><p className="truncate text-xs text-slate-500">Dashboard / Settings{activeCategory ? ` / ${activeCategory.shortLabel}` : ''}</p></div>
          </div>
          <label className="relative block w-full xl:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <span className="sr-only">Search settings</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search settings" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100" />
          </label>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1560px] lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white lg:min-h-[calc(100vh-8.5rem)] lg:border-b-0 lg:border-r" aria-label="School Settings sections">
          <div className="border-b border-slate-100 px-4 py-4">
            <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-950"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" /><span><strong>School only.</strong> Visible to authorised school users.</span></div>
          </div>
          <nav className="flex gap-1 overflow-x-auto p-3 lg:block lg:space-y-1 lg:overflow-visible">
            <Link href="/dashboard/settings" className={cn('flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition', pathname === '/dashboard/settings' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950')}><Settings2 className="h-4 w-4" />Overview</Link>
            {filteredCategories.map((item) => {
              const Icon = item.icon;
              const selected = activeCategory?.id === item.id;
              return <Link key={item.id} href={item.href} className={cn('group flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition lg:w-full', selected ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950')} aria-current={selected ? 'page' : undefined}><Icon className="h-4 w-4 shrink-0" /><span className="whitespace-nowrap lg:min-w-0 lg:flex-1 lg:whitespace-normal">{item.shortLabel}</span><ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-slate-400 lg:block" /></Link>;
            })}
            {filteredCategories.length === 0 ? <p className="px-3 py-6 text-sm text-slate-500">No settings match “{query}”.</p> : null}
          </nav>
        </aside>
        <main className="min-w-0">{content}</main>
      </div>
    </div>
  );
}
