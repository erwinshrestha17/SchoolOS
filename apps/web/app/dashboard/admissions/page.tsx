'use client';

import Link from 'next/link';
import { useQueries } from '@tanstack/react-query';
import {
  CalendarClock,
  ClipboardList,
  FileCheck2,
  FileWarning,
  QrCode,
  ScanSearch,
  UserPlus,
  UserRoundCheck,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { AdmissionCaseQueues } from '../../../components/m1/admission-case-queues';
import { M1PageHeader } from '../../../components/m1/m1-page-header';
import { SummaryCard, SummaryGrid } from '../../../components/ui/summary-card';
import { useSession } from '../../../components/session-provider';
import { Button } from '../../../components/ui/primitives/button';
import {
  admissionCasesApi,
  type AdmissionCaseQueue,
} from '../../../lib/api/admission-cases';

// Phase 5A: compact stage strip in pipeline order (ASTRA M1-A), plus the
// duplicate-warning attention count. Counts are server totals per queue.
const ADMISSION_STAGE_STRIP: ReadonlyArray<{
  queue: AdmissionCaseQueue;
  label: string;
  description: string;
  tone?: 'warning';
}> = [
  {
    queue: 'NEEDS_INFORMATION',
    label: 'Needs information',
    description: 'New cases and cases missing details or documents.',
  },
  {
    queue: 'WAITING_FOR_REVIEW',
    label: 'In review',
    description: 'Cases waiting for staff review or interview.',
  },
  {
    queue: 'APPROVED',
    label: 'Approved',
    description: 'Approved cases not yet finalized.',
  },
  {
    queue: 'READY_TO_ADMIT',
    label: 'Ready to admit',
    description: 'Cases ready for final admission.',
  },
  {
    queue: 'WAITLISTED',
    label: 'Waitlisted',
    description: 'Cases waiting for a seat.',
  },
  {
    queue: 'COMPLETED',
    label: 'Completed',
    description: 'Finalized admissions.',
  },
  {
    queue: 'DUPLICATE_WARNINGS',
    label: 'Duplicate warnings',
    description: 'Open cases that may match an existing student.',
    tone: 'warning',
  },
];
const ADMISSION_SUMMARY_QUEUES = ADMISSION_STAGE_STRIP.map(
  (stage) => stage.queue,
);

export default function AdmissionsPage() {
  const router = useRouter();
  const { hasPermissions } = useSession();
  const canCreateAdmission = hasPermissions([
    'enrollments:create',
    'students:create',
    'guardians:create',
  ]);
  const canManageDuplicates = hasPermissions(['students:manage_lifecycle']);
  const canReadAdmissionPolicies = hasPermissions(['admission_policy:read']);

  const summaryQueries = useQueries({
    queries: ADMISSION_SUMMARY_QUEUES.map((queue) => ({
      queryKey: ['admission-case-queue-summary', queue],
      queryFn: () => admissionCasesApi.listQueues({ queue, page: 1, limit: 1 }),
    })),
  });
  const summaryQuery = (queue: AdmissionCaseQueue) =>
    summaryQueries[ADMISSION_SUMMARY_QUEUES.indexOf(queue)];

  return (
    <DashboardPageShell className="gap-5">
      <M1PageHeader
        title="Admissions"
        description="Review admission cases, collect missing information, resolve warnings, and admit ready students safely."
        primaryAction={
          canCreateAdmission ? (
            <Button asChild>
              <Link href="/dashboard/admissions/new">
                <UserPlus data-icon="inline-start" />
                New admission
              </Link>
            </Button>
          ) : undefined
        }
        moreActionItems={[
          {
            label: 'Online applications',
            icon: <ClipboardList />,
            onClick: () => router.push('/dashboard/admissions/applications'),
          },
          ...(canCreateAdmission
            ? [
                {
                  label: 'Assessment & interview',
                  icon: <CalendarClock />,
                  onClick: () =>
                    router.push('/dashboard/admissions/assessments'),
                },
              ]
            : []),
          {
            label: 'Document issues',
            icon: <FileWarning />,
            onClick: () => router.push('/dashboard/admissions/documents'),
          },
          ...(canManageDuplicates
            ? [
                {
                  label: 'Duplicate review',
                  icon: <ScanSearch />,
                  onClick: () =>
                    router.push('/dashboard/admissions/duplicates'),
                },
              ]
            : []),
          {
            label: 'Imports & iEMIS readiness',
            icon: <FileCheck2 />,
            onClick: () => router.push('/dashboard/admissions/iemis'),
          },
          {
            label: 'QR / ID cards',
            icon: <QrCode />,
            onClick: () => router.push('/dashboard/admissions/qr'),
          },
          ...(canReadAdmissionPolicies
            ? [
                {
                  label: 'Admission policies',
                  icon: <FileCheck2 />,
                  onClick: () => router.push('/dashboard/settings/admissions'),
                },
              ]
            : []),
        ]}
      />

      <SummaryGrid variant="strip" aria-label="Admission stages">
        {ADMISSION_STAGE_STRIP.map((stage) => (
          <SummaryCard
            key={stage.queue}
            label={stage.label}
            value={summaryQuery(stage.queue)?.data?.total ?? 'Unavailable'}
            loading={summaryQuery(stage.queue)?.isLoading}
            href={`/dashboard/admissions?queue=${stage.queue}`}
            description={stage.description}
            tone={stage.tone}
          />
        ))}
      </SummaryGrid>
      <AdmissionCaseQueues />
    </DashboardPageShell>
  );
}
