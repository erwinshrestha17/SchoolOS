'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, CircleAlert, SearchX, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../ui/page-header';
import { ErrorState } from '../ui/error-state';
import { schoolSettingsApi } from '../../lib/api/school-settings';
import { SCHOOL_SETTINGS_CATEGORIES } from './school-settings-catalog';

export function SettingsControlCenter({ searchQuery = '' }: { searchQuery?: string }) {
  const overviewQuery = useQuery({ queryKey: ['school-settings', 'overview'], queryFn: schoolSettingsApi.getSchoolSettingsOverview });

  if (overviewQuery.isLoading) return <div className="space-y-6 p-5 lg:p-7"><div className="h-28 animate-pulse rounded-2xl bg-slate-100" /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 9 }, (_, index) => <div key={index} className="h-40 animate-pulse rounded-2xl bg-slate-100" />)}</div></div>;
  if (overviewQuery.isError || !overviewQuery.data) return <div className="p-5 lg:p-7"><ErrorState title="Could not load School Settings" message="Please retry to load your school’s configuration access and setup readiness." error={overviewQuery.error} onRetry={() => void overviewQuery.refetch()} /></div>;

  const overview = overviewQuery.data;
  const accessItems = overview.navigation.groups.flatMap((group) => group.items);
  const canManage = accessItems.some((item) => item.access === 'manage');
  const readiness = new Map(overview.readiness.map((item) => [item.id, item]));
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const categories = normalizedQuery ? SCHOOL_SETTINGS_CATEGORIES.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(normalizedQuery)) : SCHOOL_SETTINGS_CATEGORIES;

  return (
    <div className="min-h-full p-5 pb-20 lg:p-7">
      <div className="space-y-6">
        <PageHeader title="School Settings" description="Configure your school profile, academic setup, users, rules, templates, and school-wide preferences." actions={<span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ${canManage ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}><ShieldCheck className="h-3.5 w-3.5" />{canManage ? 'Configuration access' : 'View-only access'}</span>} />

        <section className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" /><div><p className="font-bold">School only</p><p className="mt-1 leading-6">These settings apply only to this school and are visible to authorized school users. Platform billing, provider credentials, queues, support override, and multi-school controls remain under the Platform workspace.</p></div></section>

        {categories.length ? <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{categories.map((category) => {
          const Icon = category.icon;
          const realReadiness = category.readinessId ? readiness.get(category.readinessId) : undefined;
          const status = realReadiness?.status === 'ready' ? 'Configured' : realReadiness?.status === 'needs_attention' ? 'Needs review' : 'Open settings';
          return <Link key={category.id} href={category.href} className="group flex min-h-44 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"><div className="flex items-start justify-between gap-4"><span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100"><Icon className="h-5 w-5" /></span><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${realReadiness?.status === 'ready' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : realReadiness ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-slate-50 text-slate-600 ring-slate-200'}`}>{status}</span></div><h2 className="mt-4 font-bold text-slate-950">{category.label}</h2><p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{realReadiness?.description ?? category.description}</p><span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-blue-700">Open settings <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span></Link>;
        })}</section> : <section className="rounded-2xl border border-slate-200 bg-white p-12 text-center"><SearchX className="mx-auto h-7 w-7 text-slate-400" /><h2 className="mt-3 font-bold text-slate-950">No settings found</h2><p className="mt-1 text-sm text-slate-600">Try a broader search such as “fees”, “users”, or “academic”.</p></section>}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div><h2 className="font-bold text-slate-950">Configuration status is intentionally conservative</h2><p className="mt-1 text-sm leading-6 text-slate-600">Only profile, branding, and academic-calendar readiness currently come from the backend overview contract. Other cards do not invent completion percentages, provider status, audit activity, or module readiness.</p></div></div></section>
      </div>
    </div>
  );
}
