'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpenCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  FileClock,
  KeyRound,
  MessageSquare,
  Palette,
  ReceiptText,
  Scale,
  Settings2,
  ShieldCheck,
  UserCog,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { PageHeader } from '../ui/page-header';
import { ErrorState } from '../ui/error-state';
import { schoolSettingsApi } from '../../lib/api/school-settings';

const categories: Array<{
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: string;
  items: Array<{ label: string; description: string; href: string; icon: LucideIcon; primary?: boolean }>;
}> = [
  {
    id: 'foundation',
    title: 'School foundation',
    description: 'The official identity, document defaults, and academic calendar used across school workflows.',
    icon: Building2,
    tone: 'bg-blue-50 text-blue-700 ring-blue-100',
    items: [
      { label: 'School profile', description: 'Official identity, address, contacts, registration and reporting details.', href: '/dashboard/settings/school-profile', icon: Building2, primary: true },
      { label: 'Branding & documents', description: 'School logo, paper defaults, receipts, certificates, report-card and payslip copy.', href: '/dashboard/settings/branding-documents', icon: Palette, primary: true },
      { label: 'Calendar, academic year & holidays', description: 'Bikram Sambat academic years, Nepal school-day boundaries, closures and working-day exceptions.', href: '/dashboard/settings/academic-calendar', icon: CalendarDays, primary: true },
      { label: 'Academic structure', description: 'Classes, sections and foundational academic setup.', href: '/dashboard/settings?section=school-setup', icon: BookOpenCheck },
    ],
  },
  {
    id: 'access',
    title: 'People & access',
    description: 'Control who can enter SchoolOS and what configuration responsibilities they hold.',
    icon: UsersRound,
    tone: 'bg-violet-50 text-violet-700 ring-violet-100',
    items: [
      { label: 'Users & access', description: 'School staff accounts, account status, role assignment and access review.', href: '/dashboard/settings?section=users-access', icon: UserCog },
      { label: 'Roles & permissions', description: 'Role coverage and permission boundaries for school operations.', href: '/dashboard/settings?section=roles-permissions', icon: KeyRound },
      { label: 'Security & privacy', description: 'Session policy, masking rules, sensitive-reveal reasons and export controls.', href: '/dashboard/settings?section=security', icon: ShieldCheck },
    ],
  },
  {
    id: 'policies',
    title: 'Operational policies',
    description: 'Rules that guide daily school work. Configure only the policy—not the daily records themselves.',
    icon: Settings2,
    tone: 'bg-amber-50 text-amber-800 ring-amber-100',
    items: [
      { label: 'Academic & grading rules', description: 'Grading defaults, promotion policy and academic behaviour.', href: '/dashboard/settings?section=academic', icon: Scale },
      { label: 'Attendance rules', description: 'Lock windows, correction policy, late thresholds and parent visibility.', href: '/dashboard/settings?section=attendance', icon: Clock3 },
      { label: 'Fee & payment rules', description: 'Receipt numbering, late-fee policy, approvals and accepted methods.', href: '/dashboard/settings?section=fees', icon: ReceiptText },
      { label: 'Communication rules', description: 'Notice defaults, quiet hours, consent and controlled parent-teacher chat.', href: '/dashboard/settings?section=communication', icon: MessageSquare },
      { label: 'HR & payroll rules', description: 'Leave approvals, statutory defaults and payroll policy.', href: '/dashboard/settings?section=payroll', icon: WalletCards },
      { label: 'Accounting defaults', description: 'Fiscal labels, source account defaults and controlled period policy.', href: '/dashboard/settings?section=accounting', icon: Scale },
    ],
  },
  {
    id: 'governance',
    title: 'Data & governance',
    description: 'Review school-level data movement, audit history and accountable configuration activity.',
    icon: ShieldCheck,
    tone: 'bg-slate-100 text-slate-700 ring-slate-200',
    items: [
      { label: 'Import & export', description: 'Bulk data movement, official-readiness work and migration controls.', href: '/dashboard/settings?section=data', icon: Database },
      { label: 'Audit log', description: 'Tenant-scoped history of sensitive settings and operational configuration changes.', href: '/dashboard/settings?section=audit', icon: FileClock },
    ],
  },
];

export function SettingsControlCenter() {
  const overviewQuery = useQuery({
    queryKey: ['school-settings', 'overview'],
    queryFn: schoolSettingsApi.getSchoolSettingsOverview,
  });

  if (overviewQuery.isLoading) {
    return <div className="space-y-6 p-5 lg:p-7"><div className="h-36 animate-pulse rounded-2xl bg-slate-100" /><div className="h-72 animate-pulse rounded-2xl bg-slate-100" /><div className="h-96 animate-pulse rounded-2xl bg-slate-100" /></div>;
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return <div className="p-5 lg:p-7"><ErrorState title="Could not load School Settings" message="Please retry to load your school’s configuration access and setup readiness." error={overviewQuery.error} onRetry={() => void overviewQuery.refetch()} /></div>;
  }

  const overview = overviewQuery.data;
  const allNavigationItems = overview.navigation.groups.flatMap((group) => group.items);
  const canManage = allNavigationItems.some((item) => item.access === 'manage');
  const readiness = overview.readiness;
  const readyCount = readiness.filter((item) => item.status === 'ready').length;
  const completion = readiness.length ? Math.round((readyCount / readiness.length) * 100) : 0;

  return (
    <div className="min-h-full bg-slate-50/60 p-5 pb-20 lg:p-7">
      <div className="mx-auto max-w-[1440px] space-y-7">
        <PageHeader
          title="School Settings"
          description="Configure this school’s foundation, access, operating policies, documents, and governance. Platform billing and provider controls are kept separate."
          actions={<span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${canManage ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'}`}><ShieldCheck className="h-3.5 w-3.5" />{canManage ? 'Configuration access' : 'View-only access'}</span>}
        />

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-0 xl:grid-cols-[1.45fr_0.85fr]">
            <div className="p-6 lg:p-7">
              <div className="flex items-start gap-3"><span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white"><Settings2 className="h-5 w-5" /></span><div><p className="text-sm font-bold text-slate-950">Set up the school before daily operations depend on it</p><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Start with the official school profile, document branding, and the active Bikram Sambat academic year. Each workspace shows only what your current school role may view or manage.</p></div></div>
              <div className="mt-6 flex flex-wrap gap-2">
                {readiness.map((item) => <Link key={item.id} href={item.href} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${item.status === 'ready' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'}`}>{item.status === 'ready' ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}{item.label}</Link>)}
              </div>
            </div>
            <div className="border-t border-slate-100 bg-slate-50 p-6 xl:border-l xl:border-t-0 lg:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Foundation readiness</p>
              <div className="mt-3 flex items-end justify-between"><p className="text-4xl font-black tracking-tight text-slate-950">{completion}%</p><p className="pb-1 text-sm font-semibold text-slate-600">{readyCount} of {readiness.length} complete</p></div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${completion}%` }} /></div>
              <p className="mt-4 text-sm leading-6 text-slate-600">Complete setup items before relying on receipts, reporting, academic workflows, and school-day policies.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="settings-areas-heading">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><h2 id="settings-areas-heading" className="text-lg font-bold text-slate-950">Configuration areas</h2><p className="mt-1 text-sm text-slate-600">Choose one focused workspace. Daily module records remain in their respective operating modules.</p></div><p className="text-xs font-semibold text-slate-500">School-scoped · role-aware · audited writes</p></div>
          <div className="grid gap-5 xl:grid-cols-2">
            {categories.map((category) => <SettingsCategory key={category.id} category={category} canManage={canManage} />)}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><UsersRound className="mt-0.5 h-5 w-5 text-slate-700" /><div><h2 className="font-bold text-slate-950">Role-based settings access</h2><p className="mt-1 text-sm leading-6 text-slate-600">School owners and authorised administrators configure school-wide settings. Academic, finance, HR, and operations staff should only receive the focused policy workspaces relevant to their responsibility. Teachers, parents, students, drivers, and staff self-service users do not receive broad Settings access.</p></div></div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-slate-700" /><div><h2 className="font-bold text-slate-950">Safe configuration boundary</h2><p className="mt-1 text-sm leading-6 text-slate-600">This area is for one school only. It does not contain SchoolOS SaaS billing, provider secrets, queues, platform support controls, or other-school data. Sensitive changes remain backend-authorised and audited.</p></div></div></div>
        </section>
      </div>
    </div>
  );
}

function SettingsCategory({ category, canManage }: { category: (typeof categories)[number]; canManage: boolean }) {
  const Icon = category.icon;
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-start gap-3 border-b border-slate-100 p-5"><span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${category.tone}`}><Icon className="h-5 w-5" /></span><div><h3 className="font-bold text-slate-950">{category.title}</h3><p className="mt-1 text-sm leading-5 text-slate-600">{category.description}</p></div></div><div className="divide-y divide-slate-100">{category.items.map((item) => <SettingsAreaLink key={item.href} item={item} canManage={canManage} />)}</div></section>;
}

function SettingsAreaLink({ item, canManage }: { item: (typeof categories)[number]['items'][number]; canManage: boolean }) {
  const Icon = item.icon;
  if (!canManage) return <div className="flex items-center gap-3 px-5 py-4 opacity-65"><span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="font-semibold text-slate-800">{item.label}</p><p className="mt-0.5 text-sm leading-5 text-slate-500">View-only access does not allow this configuration area.</p></div><ShieldCheck className="h-4 w-4 text-slate-400" /></div>;
  return <Link href={item.href} className={`group flex items-center gap-3 px-5 py-4 transition hover:bg-slate-50 ${item.primary ? 'bg-blue-50/35' : ''}`}><span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition group-hover:bg-white"><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{item.label}</p><p className="mt-0.5 text-sm leading-5 text-slate-600">{item.description}</p></div><ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-800" /></Link>;
}
