'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  FileClock,
  SearchX,
  ShieldCheck,
} from 'lucide-react';
import { formatBsDateTime } from '@schoolos/core';
import type { SchoolSettingsAccess } from '@schoolos/core';
import { ErrorState } from '../ui/error-state';
import { schoolSettingsApi } from '../../lib/api/school-settings';
import {
  SCHOOL_SETTINGS_ACCESS_LABELS,
  SCHOOL_SETTINGS_FALLBACK_ICON,
  SCHOOL_SETTINGS_ITEM_ICONS,
  canEditSchoolSettings,
} from './school-settings-catalog';

const ACCESS_RANK: Record<SchoolSettingsAccess, number> = {
  view: 0,
  edit: 1,
  approve: 2,
  manage: 3,
  delegate: 4,
};

export function SettingsControlCenter({ searchQuery = '' }: { searchQuery?: string }) {
  const overviewQuery = useQuery({ queryKey: ['school-settings', 'overview'], queryFn: schoolSettingsApi.getSchoolSettingsOverview });

  if (overviewQuery.isLoading) {
    return <div className="space-y-5 p-5 lg:p-7"><div className="h-24 animate-pulse rounded-2xl bg-slate-100" /><div className="h-40 animate-pulse rounded-2xl bg-slate-100" /><div className="h-72 animate-pulse rounded-2xl bg-slate-100" /></div>;
  }
  if (overviewQuery.isError || !overviewQuery.data) {
    return <div className="p-5 lg:p-7"><ErrorState title="Could not load School Settings" message="Please retry to load your school’s configuration access and setup readiness." error={overviewQuery.error} onRetry={() => void overviewQuery.refetch()} /></div>;
  }

  const overview = overviewQuery.data;
  const allItems = overview.navigation.groups.flatMap((group) => group.items);
  const highestAccess = allItems.reduce<SchoolSettingsAccess | null>(
    (highest, item) => (!highest || ACCESS_RANK[item.access] > ACCESS_RANK[highest] ? item.access : highest),
    null,
  );
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const groups = normalizedQuery
    ? overview.navigation.groups
        .map((group) => ({ ...group, items: group.items.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(normalizedQuery)) }))
        .filter((group) => group.items.length > 0)
    : overview.navigation.groups;

  return (
    <div className="min-h-full p-5 pb-20 lg:p-7">
      <div className="space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">{overview.schoolName ?? 'School Settings'}</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">Role-aware configuration for this school only. Billing, credentials, queues, and multi-school controls are managed by SchoolOS Platform.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800"><ShieldCheck className="h-3.5 w-3.5" />Applies only to this school</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ${highestAccess && canEditSchoolSettings(highestAccess) ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                Your access: {highestAccess ? SCHOOL_SETTINGS_ACCESS_LABELS[highestAccess] : 'None'}
              </span>
            </div>
          </div>
          <Link href={overview.primaryAction.href} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800">
            {overview.primaryAction.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        {overview.attention.length > 0 ? (
          <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
            <div className="border-b border-amber-100 bg-amber-50 px-5 py-3"><h2 className="flex items-center gap-2 text-sm font-bold text-amber-900"><CircleAlert className="h-4 w-4" />Needs attention</h2></div>
            <div className="divide-y divide-slate-100">
              {overview.attention.slice(0, 5).map((item) => (
                <Link key={item.id} href={item.href} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50">
                  <CircleAlert className="h-4 w-4 shrink-0 text-amber-600" />
                  <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">{item.label}</p><p className="mt-0.5 text-sm text-slate-600">{item.description}</p></div>
                  <span className="shrink-0 text-sm font-bold text-blue-700">Complete setup</span>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <section className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /><p className="font-semibold">Backend-confirmed setup items are complete. Readiness covers profile, branding, and the academic calendar only.</p></section>
        )}

        {groups.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-12 text-center"><SearchX className="mx-auto h-7 w-7 text-slate-400" /><h2 className="mt-3 font-bold text-slate-950">No settings found</h2><p className="mt-1 text-sm text-slate-600">{normalizedQuery ? 'Try a broader search such as “fees”, “users”, or “calendar”.' : 'Your role has no School Settings access. Ask a School Configuration Owner if you need it.'}</p></section>
        ) : (
          <section className="grid gap-4 xl:grid-cols-2">
            {groups.map((group) => (
              <div key={group.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-3"><h2 className="text-sm font-bold uppercase tracking-[0.1em] text-slate-500">{group.label}</h2></div>
                <div className="divide-y divide-slate-100">
                  {group.items.filter((item) => item.id !== 'overview').map((item) => {
                    const Icon = SCHOOL_SETTINGS_ITEM_ICONS[item.id] ?? SCHOOL_SETTINGS_FALLBACK_ICON;
                    const readiness = overview.readiness.find((entry) => entry.href === item.href);
                    const actionLabel = readiness?.status === 'needs_attention'
                      ? 'Complete setup'
                      : item.module
                        ? 'Open module'
                        : canEditSchoolSettings(item.access)
                          ? 'Manage'
                          : 'View policy';
                    return (
                      <Link key={item.id} href={item.href} className="group flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Icon className="h-4 w-4" /></span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{item.label}</p>
                          <p className="truncate text-xs text-slate-500">{item.description}</p>
                        </div>
                        <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold sm:inline ${canEditSchoolSettings(item.access) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{SCHOOL_SETTINGS_ACCESS_LABELS[item.access]}</span>
                        <span className="shrink-0 text-sm font-bold text-blue-700 opacity-0 transition group-hover:opacity-100">{actionLabel}</span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-blue-700" />
                      </Link>
                    );
                  })}
                </div>
                {group.id === 'school-setup' ? <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">Module entitlements are managed by SchoolOS Platform.</p> : null}
              </div>
            ))}
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-950"><FileClock className="h-4 w-4 text-slate-500" />Recent configuration changes</h2>
            <Link href="/dashboard/settings/audit-export" className="text-sm font-bold text-blue-700 hover:text-blue-900">Open audit log</Link>
          </div>
          {overview.recentChanges.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-600">No recorded configuration changes yet for this school.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {overview.recentChanges.slice(0, 5).map((change) => (
                <div key={change.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                  <span className="font-semibold text-slate-900">{formatChangeLabel(change.action, change.settingKey)}</span>
                  <span className="text-slate-500">by {change.actorLabel}</span>
                  <span className="ml-auto text-xs text-slate-500">{formatBsDateTime(change.changedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function formatChangeLabel(action: string, settingKey: string | null) {
  const readableAction = action.replace(/[_:-]/g, ' ');
  if (!settingKey) return readableAction;
  return `${readableAction} · ${settingKey.replace(/_/g, ' ')}`;
}
