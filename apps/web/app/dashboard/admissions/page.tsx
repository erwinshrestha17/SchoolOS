'use client';

import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { AdmissionsPipeline } from '../../../components/admissions/admissions-pipeline';
import { M1PageHeader } from '../../../components/m1/m1-page-header';
import Link from 'next/link';
import { Upload, UserPlus } from 'lucide-react';

export default function AdmissionsPage() {
  return (
    <DashboardPageShell>
      <M1PageHeader
        title="Admissions Pipeline"
        description="Review and track incoming admissions from intake through enrollment using the current student and enrollment contracts."
        primaryAction={
          <Link
            href="/dashboard/admissions/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-admissions-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-admissions-border)] focus:ring-offset-2"
          >
            <UserPlus className="h-4 w-4" /> New Application
          </Link>
        }
        secondaryActions={
          <Link href="/dashboard/admissions/new?mode=bulk" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"><Upload className="h-4 w-4" /> Import Enrollments</Link>
        }
      />
      <AdmissionsPipeline />
    </DashboardPageShell>
  );
}
