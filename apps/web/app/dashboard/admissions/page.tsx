'use client';

import { AdmissionForm } from '../../../components/forms/admission-form';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { PageHeader } from '../../../components/ui/page-header';
import Link from 'next/link';

export default function AdmissionsPage() {
  return (
    <DashboardPageShell>
      <PageHeader
        title="Student Admissions"
        description="Enroll new students, manage bulk imports, and review recent admissions."
        actions={
          <Link
            href="/dashboard/students"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-admissions-border)] focus:ring-offset-2"
          >
            Student Directory
          </Link>
        }
      />
      
      <div className="animate-in fade-in duration-300">
        <AdmissionForm />
      </div>
    </DashboardPageShell>
  );
}
