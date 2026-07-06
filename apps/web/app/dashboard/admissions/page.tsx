'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList,
  FileWarning,
  ScanSearch,
  Upload,
  UserPlus,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { AdmissionCaseQueues } from '../../../components/m1/admission-case-queues';
import { M1PageHeader } from '../../../components/m1/m1-page-header';
import { useSession } from '../../../components/session-provider';
import { KpiCard, KpiGrid } from '../../../components/ui/kpi-card';
import { api } from '../../../lib/api';

export default function AdmissionsPage() {
  const router = useRouter();
  const { hasPermissions } = useSession();
  const canCreateAdmission = hasPermissions(['enrollments:create', 'students:create', 'guardians:create']);

  const summaryQuery = useQuery({
    queryKey: ['operational-summary', 'students'],
    queryFn: () => api.getModuleSummary('students'),
  });
  const summary = summaryQuery.data;
  const isReady = summary?.status === 'ready' || summary?.status === 'empty';

  const metricValue = (key: string) => {
    if (summaryQuery.isLoading) return 'Loading';
    if (!isReady) return 'Unavailable';
    const value = summary?.summary[key];
    return value === null || value === undefined ? 'Unavailable' : value;
  };

  return (
    <DashboardPageShell>
      <M1PageHeader
        title="Admissions"
        description="Manage the school’s admission cases, review only what needs review, and admit ready students safely."
        primaryAction={canCreateAdmission ? (
          <Link
            href="/dashboard/admissions/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-admissions-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-admissions-border)] focus:ring-offset-2"
          >
            <UserPlus className="h-4 w-4" /> New admission
          </Link>
        ) : undefined}
        moreActionItems={canCreateAdmission ? [
          {
            label: 'Application pipeline',
            icon: <ClipboardList className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/admissions/applications'),
          },
          {
            label: 'Import admissions',
            icon: <Upload className="h-4 w-4" />,
            onClick: () => router.push('/dashboard/admissions/iemis'),
          },
        ] : undefined}
        kpiGrid={
          <KpiGrid className="sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Pending Admissions"
              value={metricValue('applicationsNeedingReview')}
              icon={<ClipboardList size={20} />}
              tone={
                Number(summary?.summary.applicationsNeedingReview) > 0
                  ? 'warning'
                  : 'neutral'
              }
              href="/dashboard/admissions"
              description="Applications awaiting staff review."
            />
            <KpiCard
              title="Missing Documents"
              value={metricValue('unverifiedDocuments')}
              icon={<FileWarning size={20} />}
              tone={
                Number(summary?.summary.unverifiedDocuments) > 0
                  ? 'warning'
                  : 'neutral'
              }
              href="/dashboard/admissions/documents"
              description="Active student documents not yet verified."
            />
            <KpiCard
              title="Duplicate Candidates"
              value={metricValue('duplicateCandidates')}
              icon={<ScanSearch size={20} />}
              tone={
                Number(summary?.summary.duplicateCandidates) > 0
                  ? 'warning'
                  : 'neutral'
              }
              href="/dashboard/admissions/duplicates"
              description="Import rows flagged as likely duplicates."
            />
            <KpiCard
              title="iEMIS Readiness"
              value={metricValue('iemisReadinessBlockers')}
              icon={<FileWarning size={20} />}
              tone={
                Number(summary?.summary.iemisReadinessBlockers) > 0
                  ? 'warning'
                  : 'neutral'
              }
              href="/dashboard/admissions/iemis"
              description="Active enrollments missing an admission number."
            />
          </KpiGrid>
        }
      />
      <AdmissionCaseQueues />
    </DashboardPageShell>
  );
}
