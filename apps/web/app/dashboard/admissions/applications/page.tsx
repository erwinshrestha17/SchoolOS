'use client';

import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { AdmissionsPipeline } from '../../../../components/admissions/admissions-pipeline';
import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { M1PageHeader } from '../../../../components/m1/m1-page-header';
import { useSession } from '../../../../components/session-provider';

export default function AdmissionApplicationsPage() {
  const { hasPermissions } = useSession();
  const canCreateAdmission = hasPermissions([
    'enrollments:create',
    'students:create',
    'guardians:create',
  ]);

  return (
    <DashboardPageShell>
      <M1PageHeader
        title="Application pipeline"
        description="Review existing applications and continue each record through the correct admission case workflow. New office admissions start as one unified case."
        primaryAction={
          canCreateAdmission ? (
            <Link
              href="/dashboard/admissions/new"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-admissions-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-admissions-border)] focus:ring-offset-2"
            >
              <UserPlus className="h-4 w-4" />
              New admission
            </Link>
          ) : undefined
        }
      />
      <AdmissionsPipeline />
    </DashboardPageShell>
  );
}
