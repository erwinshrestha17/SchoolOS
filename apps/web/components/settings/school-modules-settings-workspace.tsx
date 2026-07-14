'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, LockKeyhole } from 'lucide-react';
import { useEntitlements } from '../entitlements-provider';
import { ErrorState } from '../ui/error-state';
import { LoadingState } from '../ui/loading-state';
import { ModuleLockedState } from '../ui/module-locked-state';
import { PageHeader } from '../ui/page-header';

const modules = [
  { key: 'students', label: 'Admissions & Students', href: '/dashboard/admissions' },
  { key: 'attendance', label: 'Attendance', href: '/dashboard/attendance' },
  { key: 'fees', label: 'Fees & Receipts', href: '/dashboard/fees' },
  { key: 'exams', label: 'Academics & Report Cards', href: '/dashboard/academics' },
  { key: 'homework', label: 'Homework', href: '/dashboard/homework' },
  { key: 'timetable', label: 'Timetable', href: '/dashboard/timetable' },
  { key: 'activity', label: 'Activity Feed', href: '/dashboard/activity' },
  { key: 'hr', label: 'HR & Payroll', href: '/dashboard/hr' },
  { key: 'library', label: 'Library', href: '/dashboard/library' },
  { key: 'transport', label: 'Transport', href: '/dashboard/transport' },
  { key: 'canteen', label: 'Canteen', href: '/dashboard/canteen' },
  { key: 'accounting', label: 'Accounting', href: '/dashboard/accounting' },
  { key: 'notices', label: 'Notices & Announcements', href: '/dashboard/notices' },
  { key: 'learning', label: 'Learning', href: '/dashboard/learning' },
] as const;

export function SchoolModulesSettingsWorkspace() {
  const { entitlements, loading, error, hasModule } = useEntitlements();
  if (loading) return <div className="p-6"><LoadingState variant="page" label="Loading school modules…" /></div>;
  if (error || !entitlements) return <div className="p-6"><ErrorState title="School modules are unavailable" message="Please retry after your school access is restored." error={error} /></div>;

  const enabled = modules.filter((item) => hasModule(item.key));
  const disabled = modules.filter((item) => !hasModule(item.key));

  return <div className="space-y-6 p-5 pb-20 lg:p-7">
    <PageHeader title="School Modules" description="View this school’s enabled modules and open module-owned setup. Entitlements can only be changed through authorized Platform workflows." />
    <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950"><p className="font-bold">School-visible status only</p><p className="mt-1 leading-6">This page does not expose subscription plans, SaaS billing, or entitlement mutation controls.</p></section>
    <section><h2 className="font-bold text-slate-950">Enabled modules</h2><div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{enabled.map((item) => <Link key={item.key} href={item.href} className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /><div className="min-w-0 flex-1"><p className="font-bold text-slate-950">{item.label}</p><p className="mt-1 text-xs font-semibold text-emerald-700">Enabled for this school</p></div><ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-700" /></Link>)}</div></section>
    {enabled.length === 0 ? <ModuleLockedState moduleName="School modules" description="No school operating modules are enabled for this school. Module activation remains a Platform-controlled entitlement workflow." /> : null}
    {disabled.length ? <section><h2 className="font-bold text-slate-950">Not enabled</h2><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{disabled.map((item) => <div key={item.key} className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><LockKeyhole className="h-4 w-4 shrink-0 text-amber-700" /><div><p className="font-bold text-amber-950">{item.label}</p><p className="mt-0.5 text-xs text-amber-800">Module locked</p></div></div>)}</div></section> : null}
  </div>;
}
