'use client';

import { formatBsDateTime } from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  RefreshCcw,
  Repeat,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useSession } from '@/components/session-provider';
import { withOfflineReadCache } from '@/lib/offline-read-cache';
import type {
  TeacherTodayAssignedClass,
  TeacherTodayPeriod,
} from '@/lib/api/teacher-workspace';
import { LoadingState } from '@/components/ui/loading-state';
import { SectionCard } from '@/components/ui/section-card';

function ModuleUnavailableNotice({ moduleName }: { moduleName: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-warning-100 bg-warning-50 p-3">
      <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-warning-700" aria-hidden="true" />
      <p className="text-sm leading-5 text-warning-900">
        {moduleName} is not enabled for your school, so this section is unavailable.
      </p>
    </div>
  );
}

/**
 * Teacher Home/Today (Teacher Persona spec 10.1 / 21.1). Every number here
 * comes straight from GET /teacher-workspace/today, which is itself only a
 * composition of already assignment-scoped backend calls (attendance,
 * homework, timetable) -- nothing here re-derives scope or shows
 * school-wide figures.
 */
export function TeacherTodayWorkspace() {
  const { session } = useSession();
  const todayQuery = useQuery({
    queryKey: ['teacher-today'],
    queryFn: () =>
      withOfflineReadCache(
        `teacher-today:${session?.tenant.id ?? ''}:${session?.user.id ?? ''}`,
        session?.tenant.id && session.user.id
          ? { tenantId: session.tenant.id, userId: session.user.id }
          : null,
        () => api.getTeacherToday(),
      ),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (todayQuery.isLoading) {
    return <LoadingState variant="page" label="Preparing your teaching day..." />;
  }

  if (todayQuery.isError || !todayQuery.data) {
    return (
      <SectionCard title="Unable to load your day">
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-slate-600">
            Something went wrong while loading your Today summary.
          </p>
          <button
            type="button"
            onClick={() => void todayQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      </SectionCard>
    );
  }

  const data = todayQuery.data;
  const hasAttendanceClasses = data.assignedClasses.length > 0;
  const hasTeachingWork =
    hasAttendanceClasses ||
    data.todaysPeriods.length > 0 ||
    Boolean(data.substitutions?.length);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          Updated {formatBsDateTime(data.generatedAt)}
        </p>
        <button
          type="button"
          onClick={() => void todayQuery.refetch()}
          disabled={todayQuery.isFetching}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 transition hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-50"
        >
          <RefreshCcw
            className={todayQuery.isFetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'}
            aria-hidden="true"
          />
          Refresh
        </button>
      </div>

      {!hasTeachingWork ? (
        <SectionCard title="No active teaching assignments">
          <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <p className="text-sm leading-5 text-slate-600">
              You have no active Class Teacher or Subject Teacher assignment for the current
              academic year yet. Contact your school administrator if this is unexpected.
            </p>
          </div>
        </SectionCard>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <PeriodCard label="Current period" period={data.currentPeriod} emptyText="No class right now" />
            <PeriodCard label="Next period" period={data.nextPeriod} emptyText="Nothing else scheduled today" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              title="Attendance Classes"
              description="Assigned homeroom sections available for attendance."
              headerAction={
                hasAttendanceClasses && data.pendingAttendanceCount > 0 ? (
                  <span className="inline-flex items-center rounded-full border border-warning-100 bg-warning-50 px-2.5 py-1 text-xs font-bold text-warning-700">
                    {data.pendingAttendanceCount} pending
                  </span>
                ) : hasAttendanceClasses ? (
                  <CheckCircle2 className="h-5 w-5 text-success-600" aria-hidden="true" />
                ) : null
              }
              footer={
                hasAttendanceClasses ? (
                  <Link
                    href="/dashboard/attendance"
                    className="text-sm font-bold text-[var(--primary)] transition hover:text-[var(--primary-dark)]"
                  >
                    Go to Attendance
                  </Link>
                ) : undefined
              }
            >
              {hasAttendanceClasses ? (
                <ul className="space-y-2">
                  {data.assignedClasses.map((item) => (
                    <ClassRow key={item.id} item={item} />
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm leading-5 text-slate-600">
                  Your subject or substitution periods are shown above. No homeroom attendance
                  class is assigned for this day.
                </p>
              )}
            </SectionCard>

            <SectionCard
              title="Homework"
              description="Assigned-subject homework awaiting your review."
              headerAction={
                data.homework && data.homework.awaitingReviewCount > 0 ? (
                  <span className="inline-flex items-center rounded-full border border-warning-100 bg-warning-50 px-2.5 py-1 text-xs font-bold text-warning-700">
                    {data.homework.awaitingReviewCount} to review
                  </span>
                ) : data.homework ? (
                  <CheckCircle2 className="h-5 w-5 text-success-600" aria-hidden="true" />
                ) : null
              }
              footer={
                data.homework ? (
                  <Link
                    href="/dashboard/homework"
                    className="text-sm font-bold text-[var(--primary)] transition hover:text-[var(--primary-dark)]"
                  >
                    Go to Homework
                  </Link>
                ) : undefined
              }
            >
              {data.homework ? (
                <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <p className="text-sm leading-5 text-slate-600">
                    {data.homework.givenToday} assigned today, {data.homework.dueToday} due today,{' '}
                    {data.homework.awaitingReviewCount} submission
                    {data.homework.awaitingReviewCount === 1 ? '' : 's'} not yet checked.
                  </p>
                </div>
              ) : (
                <ModuleUnavailableNotice moduleName="Homework" />
              )}
            </SectionCard>
          </div>

          {data.substitutions === null ? (
            <SectionCard
              title="Substitution Alerts"
              description="Timetable changes affecting you today."
            >
              <ModuleUnavailableNotice moduleName="Timetable" />
            </SectionCard>
          ) : data.substitutions.length > 0 ? (
            <SectionCard
              title="Substitution Alerts"
              description="Timetable changes affecting you today."
            >
              <ul className="space-y-2">
                {data.substitutions.map((substitution) => (
                  <li
                    key={substitution.id}
                    className="flex items-start gap-3 rounded-xl border border-warning-100 bg-warning-50 p-3"
                  >
                    <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-warning-700" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">
                        {substitution.role === 'SUBSTITUTE'
                          ? `You are substituting for ${substitution.absentTeacherName ?? 'a colleague'}`
                          : `${substitution.substituteTeacherName ?? 'A substitute'} is covering your class`}
                      </p>
                      <p className="text-xs font-medium text-slate-600">
                        {substitution.className}
                        {substitution.sectionName ? ` - ${substitution.sectionName}` : ''} •{' '}
                        {substitution.subjectName} • {substitution.startsAt}-{substitution.endsAt}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}

          {data.marksDeadlines === null ? (
            <SectionCard
              title="Marks Deadlines"
              description="Upcoming exam terms for your assigned subjects."
            >
              <ModuleUnavailableNotice moduleName="Exams" />
            </SectionCard>
          ) : data.marksDeadlines.length > 0 ? (
            <SectionCard
              title="Marks Deadlines"
              description="Upcoming exam terms for your assigned subjects."
              footer={
                <Link
                  href="/dashboard/academics/exams"
                  className="text-sm font-bold text-[var(--primary)] transition hover:text-[var(--primary-dark)]"
                >
                  Go to Assessments & Marks
                </Link>
              }
            >
              <ul className="space-y-2">
                {data.marksDeadlines.map((deadline) => (
                  <li
                    key={deadline.examTermId}
                    className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    <p className="text-sm leading-5 text-slate-600">
                      <span className="font-bold text-slate-900">{deadline.examTermName}</span>{' '}
                      ends {formatBsDateTime(deadline.endsOn)}
                    </p>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}
        </>
      )}
    </div>
  );
}

function PeriodCard({
  label,
  period,
  emptyText,
}: {
  label: string;
  period: TeacherTodayPeriod | null;
  emptyText: string;
}) {
  return (
    <SectionCard>
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[color:var(--primary-dark)]">
          <Clock className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
          {period ? (
            <>
              <p className="truncate text-base font-bold text-slate-900">{period.subjectName}</p>
              <p className="truncate text-xs font-medium text-slate-600">
                {period.className} • {period.startsAt}-{period.endsAt}
              </p>
              {['SUBSTITUTING', 'COVERED'].includes(period.coverageStatus ?? '') ? (
                <p className="mt-1 text-xs font-bold text-warning-700">
                  {period.coverageStatus === 'SUBSTITUTING'
                    ? 'You are substituting for this period'
                    : 'A substitute is covering this period'}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-500">{emptyText}</p>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function ClassRow({ item }: { item: TeacherTodayAssignedClass }) {
  const { attendance } = item;
  const status = attendance.isSubmitted
    ? { label: 'Submitted', className: 'bg-success-50 text-success-700 border-success-100' }
    : attendance.isLocked
      ? { label: 'Locked', className: 'bg-slate-100 text-slate-600 border-slate-200' }
      : { label: 'Pending', className: 'bg-warning-50 text-warning-700 border-warning-100' };

  return (
    <li className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-500">
        <Users className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-900">{item.name}</p>
        <p className="truncate text-xs font-medium text-slate-600">{item.subject}</p>
      </div>
      <span
        className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide ${status.className}`}
      >
        {status.label}
      </span>
    </li>
  );
}
