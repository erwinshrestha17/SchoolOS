'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, CircleAlert, Settings2 } from 'lucide-react';
import { PageHeader } from '../ui/page-header';
import { ErrorState } from '../ui/error-state';
import { schoolSettingsApi } from '../../lib/api/school-settings';

export function SettingsOverviewWorkspace() {
  const overviewQuery = useQuery({
    queryKey: ['school-settings', 'overview'],
    queryFn: schoolSettingsApi.getSchoolSettingsOverview,
  });

  if (overviewQuery.isLoading) {
    return <div className="space-y-4 p-6"><div className="h-24 animate-pulse rounded-2xl bg-slate-100" /><div className="h-72 animate-pulse rounded-2xl bg-slate-100" /></div>;
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return <ErrorState error={overviewQuery.error} onRetry={() => void overviewQuery.refetch()} />;
  }

  const overview = overviewQuery.data;
  const attention = overview.readiness.filter((item) => item.status === 'needs_attention');

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="School Settings"
        description="Configure your school safely. Only settings you are authorised to manage are shown here."
        actions={<span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">Tenant-scoped</span>}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-slate-900 p-2 text-white"><Settings2 className="h-5 w-5" /></div>
            <div>
              <h2 className="font-bold text-slate-950">Your settings access</h2>
              <p className="mt-1 text-sm text-slate-600">Open a configuration area to review or manage its school policy.</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {overview.navigation.groups.flatMap((group) => group.items).map((item) => (
              <span key={item.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{item.label} · {item.access === 'manage' ? 'Can manage' : 'View only'}</span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Needs attention</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{attention.length}</p>
          <p className="mt-1 text-sm text-slate-600">Required setup items are incomplete.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-bold text-slate-950">Configuration readiness</h2>
          <p className="mt-1 text-sm text-slate-600">Complete these items before relying on related school workflows.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {overview.readiness.map((item) => {
            const ready = item.status === 'ready';
            return (
              <Link key={item.id} href={item.href} className="flex items-center gap-3 px-5 py-4 transition hover:bg-slate-50">
                {ready ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <CircleAlert className="h-5 w-5 shrink-0 text-amber-600" />}
                <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{item.label}</p><p className="mt-0.5 text-sm text-slate-600">{item.description}</p></div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {overview.navigation.groups.map((group) => (
          <div key={group.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-950">{group.label}</h2>
            <div className="mt-4 space-y-3">
              {group.items.map((item) => (
                <Link key={item.id} href={item.href} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-3 transition hover:border-slate-200 hover:bg-slate-50">
                  <div><p className="font-semibold text-slate-900">{item.label}</p><p className="mt-1 text-sm text-slate-600">{item.description}</p></div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
