'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  FileClock,
  LockKeyhole,
  SearchX,
} from 'lucide-react';
import { formatBsDateTime } from '@schoolos/core';
import { schoolSettingsApi } from '../../lib/api/school-settings';
import {
  SETTINGS_NAVIGATION_GROUPS,
  type SettingsNavigationGroupId,
} from './settings-navigation.config';
import type { ResolvedSettingsNavigationItem } from './settings-route-frame';

export function SettingsControlCenter({
  items,
  canLoadSchoolOverview,
  searchQuery = '',
}: {
  items: ResolvedSettingsNavigationItem[];
  canLoadSchoolOverview: boolean;
  searchQuery?: string;
}) {
  const overviewQuery = useQuery({
    queryKey: ['school-settings', 'overview'],
    queryFn: schoolSettingsApi.getSchoolSettingsOverview,
    enabled: canLoadSchoolOverview,
  });

  const groups = SETTINGS_NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: items.filter((item) => item.groupId === group.id),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="min-h-full space-y-6 p-4 pb-20 sm:p-6 lg:p-7">
      <section aria-labelledby="settings-directory-title">
        <h2
          id="settings-directory-title"
          className="text-lg font-semibold text-slate-950"
        >
          Choose a settings area
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Only settings supported for your account and current school are shown.
        </p>

        {groups.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <SearchX className="mx-auto h-7 w-7 text-slate-400" />
            <h3 className="mt-3 font-semibold text-slate-950">
              No settings found
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {searchQuery.trim()
                ? 'Try a broader search such as “password”, “calendar”, or “roles”.'
                : 'No settings are available for this account.'}
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {groups.map((group) => (
              <SettingsGroupCard key={group.id} group={group} />
            ))}
          </div>
        )}
      </section>

      {canLoadSchoolOverview ? (
        overviewQuery.isLoading ? (
          <div
            className="h-28 animate-pulse rounded-2xl bg-slate-100"
            aria-label="Loading school setup status"
          />
        ) : overviewQuery.isError || !overviewQuery.data ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">School setup status unavailable</p>
            <p className="mt-1 leading-6">
              Navigation is still available. Retry to review readiness and
              recent changes.
            </p>
            <button
              type="button"
              onClick={() => void overviewQuery.refetch()}
              className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              Retry
            </button>
          </section>
        ) : (
          <SchoolSetupSummary overview={overviewQuery.data} items={items} />
        )
      ) : null}
    </div>
  );
}

function SettingsGroupCard({
  group,
}: {
  group: {
    id: SettingsNavigationGroupId;
    label: string;
    items: ResolvedSettingsNavigationItem[];
  };
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <h3 className="border-b border-slate-100 px-5 py-3 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
        {group.label}
      </h3>
      <div className="divide-y divide-slate-100">
        {group.items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className="group flex min-h-16 items-center gap-3 px-5 py-3 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-200"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">
                  {item.label}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                  {item.description}
                </span>
              </span>
              {item.status === 'platform-managed' ? (
                <span
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-slate-400"
                  aria-label="Platform managed"
                  title="Platform managed"
                >
                  <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                </span>
              ) : (
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-blue-700"
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function SchoolSetupSummary({
  overview,
  items,
}: {
  overview: Awaited<
    ReturnType<typeof schoolSettingsApi.getSchoolSettingsOverview>
  >;
  items: ResolvedSettingsNavigationItem[];
}) {
  const visibleHrefs = new Set(
    items.flatMap((item) => [item.href, ...(item.legacyHrefs ?? [])]),
  );
  const visibleAttention = overview.attention.filter((item) =>
    visibleHrefs.has(item.href),
  );
  const canOpenAuditLog = items.some((item) => item.id === 'system-audit-log');

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-950">
            School setup status
          </h2>
        </div>
        {visibleAttention.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {visibleAttention.slice(0, 4).map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-200"
              >
                <CircleAlert
                  className="h-4 w-4 shrink-0 text-amber-600"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-sm leading-5 text-slate-600">
                    {item.description}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-blue-700">
                  Review
                </span>
              </Link>
            ))}
          </div>
        ) : overview.attention.length === 0 ? (
          <div className="flex items-start gap-3 px-5 py-4 text-sm text-emerald-900">
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
              aria-hidden="true"
            />
            <p className="leading-6">
              Backend-confirmed setup items are complete. This covers school
              identity, branding, and the academic calendar only.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-3 px-5 py-4 text-sm text-slate-700">
            <CircleAlert
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <p className="leading-6">
              Some school setup items need attention, but your role cannot open
              those settings.
            </p>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <FileClock className="h-4 w-4 text-slate-500" aria-hidden="true" />
            Recent configuration changes
          </h2>
          {canOpenAuditLog ? (
            <Link
              href="/dashboard/settings/system/audit-log"
              className="text-sm font-semibold text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
            >
              Open audit log
            </Link>
          ) : null}
        </div>
        {overview.recentChanges.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-600">
            No recorded configuration changes yet for this school.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {overview.recentChanges.slice(0, 5).map((change) => (
              <div
                key={change.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm"
              >
                <span className="font-semibold text-slate-900">
                  {formatChangeLabel(change.action, change.settingKey)}
                </span>
                <span className="text-slate-500">by {change.actorLabel}</span>
                <span className="ml-auto text-xs text-slate-500">
                  {formatBsDateTime(change.changedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function formatChangeLabel(action: string, settingKey: string | null) {
  const readableAction = action.replace(/[_:-]/g, ' ');
  if (!settingKey) return readableAction;
  return `${readableAction} · ${settingKey.replace(/_/g, ' ')}`;
}
