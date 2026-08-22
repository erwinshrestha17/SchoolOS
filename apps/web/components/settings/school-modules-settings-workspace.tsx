'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, LockKeyhole } from 'lucide-react';
import { useEntitlements } from '../entitlements-provider';
import { useSchoolWebPersona } from '../../lib/school-web-persona';
import { ErrorState } from '../ui/error-state';
import { LoadingState } from '../ui/loading-state';
import { ModuleLockedState } from '../ui/module-locked-state';
import { SchoolSettingsPageHeader } from './settings-page-header';

const modules = [
  {
    key: 'students',
    label: 'Admissions & Students',
    href: '/dashboard/admissions',
  },
  { key: 'attendance', label: 'Attendance', href: '/dashboard/attendance' },
  { key: 'fees', label: 'Fees & Receipts', href: '/dashboard/fees' },
  {
    key: 'exams',
    label: 'Academics & Report Cards',
    href: '/dashboard/academics',
  },
  { key: 'homework', label: 'Homework & Timetable', href: '/dashboard/homework' },
  { key: 'activity', label: 'Activity Feed', href: '/dashboard/activity' },
  { key: 'hr', label: 'HR & Payroll', href: '/dashboard/hr' },
  { key: 'library', label: 'Library', href: '/dashboard/library' },
  { key: 'transport', label: 'Transport', href: '/dashboard/transport' },
  { key: 'canteen', label: 'Canteen', href: '/dashboard/canteen' },
  { key: 'accounting', label: 'Accounting', href: '/dashboard/accounting' },
  {
    key: 'notices',
    label: 'Notices & Announcements',
    href: '/dashboard/notices',
  },
] as const;

type ModuleDefinition = (typeof modules)[number];

export function SchoolModulesSettingsWorkspace() {
  const { entitlements, loading, error, hasModule } = useEntitlements();
  const persona = useSchoolWebPersona();
  if (loading)
    return (
      <div className="p-6">
        <LoadingState variant="page" label="Loading school modules…" />
      </div>
    );
  if (error || !entitlements)
    return (
      <div className="p-6">
        <ErrorState
          title="School modules are unavailable"
          message="Please retry after your school access is restored."
          error={error}
        />
      </div>
    );

  const enabled = modules.filter((item) => hasModule(item.key));
  const disabled = modules.filter((item) => !hasModule(item.key));

  return (
    <div className="space-y-6 p-5 pb-20 lg:p-7">
      <SchoolSettingsPageHeader
        title="School Modules"
        description="View this school’s enabled modules and open only the workspaces appropriate to your current school role. Entitlements can only be changed through authorized Platform workflows."
        access="platform-managed"
      />
      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950">
        <p className="font-bold">School-visible status only</p>
        <p className="mt-1 leading-6">
          This page does not expose subscription plans, SaaS billing, frozen
          Learning scope, or entitlement mutation controls.
        </p>
      </section>
      <section>
        <h2 className="font-bold text-slate-950">Enabled modules</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {enabled.map((item) => {
            const href = moduleWorkspaceHref(item, persona, hasModule);
            const content = (
              <>
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-950">{item.label}</p>
                  <p className="mt-1 text-xs font-semibold text-emerald-700">
                    {href
                      ? 'Enabled for this school'
                      : 'Enabled · no role-safe setup link from this page'}
                  </p>
                </div>
                {href ? (
                  <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-700" />
                ) : null}
              </>
            );
            return href ? (
              <Link
                key={item.key}
                href={href}
                className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200"
              >
                {content}
              </Link>
            ) : (
              <div
                key={item.key}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                {content}
              </div>
            );
          })}
        </div>
      </section>
      {enabled.length === 0 ? (
        <ModuleLockedState
          moduleName="School modules"
          description="No school operating modules are enabled for this school. Module activation remains a Platform-controlled entitlement workflow."
        />
      ) : null}
      {disabled.length ? (
        <section>
          <h2 className="font-bold text-slate-950">Not enabled</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {disabled.map((item) => (
              <div
                key={item.key}
                className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
              >
                <LockKeyhole className="h-4 w-4 shrink-0 text-amber-700" />
                <div>
                  <p className="font-bold text-amber-950">{item.label}</p>
                  <p className="mt-0.5 text-xs text-amber-800">Module locked</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function moduleWorkspaceHref(
  item: ModuleDefinition,
  persona: ReturnType<typeof useSchoolWebPersona>,
  hasModule: (module: string) => boolean,
): string | null {
  if (persona !== 'principal') return item.href;

  switch (item.key) {
    case 'students':
      return '/dashboard/students/overview';
    case 'attendance':
      return '/dashboard/attendance/overview';
    case 'exams':
      return '/dashboard/academics/readiness';
    case 'hr':
      return '/dashboard/hr/overview';
    case 'accounting':
      return '/dashboard/finance-overview';
    case 'fees':
      return hasModule('accounting') ? '/dashboard/finance-overview' : null;
    case 'activity':
      return '/dashboard/activity/oversight';
    case 'notices':
      return '/dashboard/communications/oversight';
    case 'library':
    case 'transport':
    case 'canteen':
      return '/dashboard/operations/overview';
    case 'homework':
      return null;
    default:
      return null;
  }
}
