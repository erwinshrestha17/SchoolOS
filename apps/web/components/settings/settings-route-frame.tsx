'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronLeft, Settings2 } from 'lucide-react';
import { SettingsControlCenter } from './settings-control-center';

const workspaceItems = [
  { href: '/dashboard/settings', label: 'Overview' },
  { href: '/dashboard/settings/school-profile', label: 'School profile' },
  { href: '/dashboard/settings/branding-documents', label: 'Branding & documents' },
  { href: '/dashboard/settings/academic-calendar', label: 'Calendar & academic year' },
];

export function SettingsRouteFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const legacySectionRequested = Boolean(searchParams.get('section') || searchParams.get('tab'));

  // The root URL is now the redesigned control centre. Existing bookmarked query
  // routes remain available while their individual workspaces are migrated.
  if (pathname === '/dashboard/settings' && !legacySectionRequested) {
    return <SettingsControlCenter />;
  }

  if (pathname === '/dashboard/settings') return <>{children}</>;

  return (
    <div className="min-h-full bg-slate-50/60">
      <div className="border-b border-slate-200 bg-white px-5 py-3 lg:px-7">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/settings" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950" aria-label="Back to School Settings">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2"><span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white"><Settings2 className="h-4 w-4" /></span><div><p className="text-sm font-bold text-slate-950">School Settings</p><p className="text-xs text-slate-500">One school’s configuration</p></div></div>
          </div>
          <nav aria-label="School Settings navigation" className="-mx-5 flex gap-1 overflow-x-auto px-5 pb-1 xl:mx-0 xl:px-0 xl:pb-0">
            {workspaceItems.map((item) => {
              const selected = pathname === item.href;
              return <Link key={item.href} href={item.href} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${selected ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>{item.label}</Link>;
            })}
          </nav>
        </div>
      </div>
      <div className="mx-auto max-w-[1440px]">{children}</div>
    </div>
  );
}
