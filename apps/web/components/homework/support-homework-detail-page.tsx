'use client';

import { formatBsDate, formatBsDateTime } from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { api } from '@/lib/api';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { ModuleHeader } from '@/components/ui/module-header';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';

export function SupportHomeworkDetailPage({
  homeworkId,
}: {
  homeworkId: string;
}) {
  const homeworkQuery = useQuery({
    queryKey: ['support-homework-detail', homeworkId],
    queryFn: () => api.getHomework(homeworkId),
    enabled: Boolean(homeworkId),
  });

  if (homeworkQuery.isLoading) {
    return <LoadingState variant="page" label="Loading published homework…" />;
  }

  if (homeworkQuery.isError) {
    return (
      <ErrorState
        title="Published homework unavailable"
        message="This assignment is not published, is outside the selected school, or is no longer available to this support session."
        onRetry={() => void homeworkQuery.refetch()}
      />
    );
  }

  const homework = homeworkQuery.data;
  if (!homework) {
    return (
      <EmptyState
        title="Homework not found"
        description="Only published or closed homework is available during read-only support access."
      />
    );
  }

  const teacherName = homework.assignedByStaff
    ? `${homework.assignedByStaff.firstName} ${homework.assignedByStaff.lastName}`.trim()
    : 'Teacher not assigned';

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="Read-only support"
        title={homework.title}
        description="Published assignment information only. Student submissions, completion registers, reminders, and protected files remain unavailable."
        metadata={
          <StatusBadge
            status={homework.status ?? 'ASSIGNED'}
            label={homework.status === 'CLOSED' ? 'Closed' : 'Published'}
          />
        }
        secondaryActions={
          <Link
            href="/dashboard/homework"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            <ArrowLeft size={16} />
            Back to homework
          </Link>
        }
      />

      <div className="flex items-start gap-3 rounded-xl border border-info-100 bg-info-50 p-4 text-sm text-info-800">
        <ShieldCheck className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
        <p>
          This support session is read-only and purpose-limited. No assignment,
          student, notification, or file state can be changed from this view.
        </p>
      </div>

      <SectionCard
        title="Assignment"
        description="The same published instructions visible in the school homework record."
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <BookOpen size={18} aria-hidden="true" />
              Instructions
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {homework.instructions?.trim() || 'Instructions not recorded.'}
            </p>
          </div>

          <dl className="grid content-start gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <DetailRow
              label="Class"
              value={`${homework.class?.name ?? 'Class unavailable'}${homework.section?.name ? ` · Section ${homework.section.name}` : ''}`}
            />
            <DetailRow
              label="Subject"
              value={homework.subject?.name ?? 'Subject unavailable'}
            />
            <DetailRow label="Assigned by" value={teacherName} />
            <DetailRow
              label="Assigned"
              value={safeDate(homework.assignedDate)}
            />
            <DetailRow label="Due" value={safeDateTime(homework.dueAt)} />
          </dl>
        </div>
      </SectionCard>
    </DashboardPageShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function safeDate(value: string | Date | undefined) {
  if (!value) return 'Date unavailable';
  try {
    return formatBsDate(value);
  } catch {
    return 'Date unavailable';
  }
}

function safeDateTime(value: string | Date | undefined) {
  if (!value) return 'Date unavailable';
  try {
    return formatBsDateTime(value);
  } catch {
    return 'Date unavailable';
  }
}
