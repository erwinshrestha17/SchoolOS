'use client';

import Link from 'next/link';
import { Upload, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { AdmissionCaseQueues } from '../../../components/m1/admission-case-queues';
import { M1PageHeader } from '../../../components/m1/m1-page-header';

export default function AdmissionsPage() {
  const router = useRouter();

  return (
    <DashboardPageShell>
      <M1PageHeader
        title="Admissions"
        description="Manage the school’s admission cases, review only what needs review, and admit ready students safely."
        primaryAction={
          <Link
            href="/dashboard/admissions/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-admissions-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-admissions-border)] focus:ring-offset-2"
          >
            <UserPlus className="h-4 w-4" /> New admission
          </Link>
        }
        moreActionItems={[
          {
            label: 'Import admissions',
            icon: <Upload className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/admissions/new?mode=bulk'),
          },
        ]}
      />
      <AdmissionCaseQueues />
    </DashboardPageShell>
  );
}
