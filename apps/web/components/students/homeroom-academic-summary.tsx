'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AlertTriangle, BookOpen, Info, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { SectionCard } from '@/components/ui/section-card';
import { Select } from '@/components/ui/form-field';
import { StatusBadge } from '@/components/ui/status-badge';
import { SummaryCard, SummaryGrid } from '@/components/ui/summary-card';
import { formatSchoolDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

/**
 * Class Teacher cross-subject homeroom view.
 *
 * Everything here is read-only, and deliberately so: these records belong to
 * the Subject Teachers who authored them. The Class Teacher's sanctioned
 * actions are to notice gaps and coordinate — so the UI names who set each
 * piece of work rather than offering an edit control it would have to reject.
 *
 * Drafts never reach this component: the backend excludes them at the query
 * level for `HOMEROOM_ACADEMIC_SUMMARY_READ`.
 */
export function HomeroomAcademicSummary() {
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  const homeroomsQuery = useQuery({
    queryKey: ['teacher-homerooms'],
    queryFn: () => api.getMyHomerooms(),
    staleTime: 5 * 60_000,
  });

  const homerooms = homeroomsQuery.data ?? [];
  const activeHomeroom =
    homerooms.find((item) => item.sectionId === selectedSectionId) ??
    homerooms[0];

  const summaryQuery = useQuery({
    queryKey: ['homeroom-academic-summary', activeHomeroom?.sectionId],
    queryFn: () =>
      api.getHomeroomAcademicSummary({
        classId: activeHomeroom!.classId,
        sectionId: activeHomeroom!.sectionId,
        academicYearId: activeHomeroom!.academicYearId,
      }),
    enabled: Boolean(activeHomeroom),
    staleTime: 60_000,
  });

  if (homeroomsQuery.isLoading) {
    return <LoadingState variant="page" label="Loading your homeroom..." />;
  }

  if (homeroomsQuery.isError) {
    return (
      <ErrorState
        title="Could not load your homeroom"
        message="Your Class Teacher assignments could not be loaded just now."
        onRetry={() => void homeroomsQuery.refetch()}
      />
    );
  }

  if (homerooms.length === 0) {
    return (
      <EmptyState
        title="You are not a Class Teacher this year"
        description="The homeroom view is for the section you are Class Teacher of. Your subject classes are under My Subject Students."
        icon={<Users size={28} aria-hidden="true" />}
      />
    );
  }

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      {homerooms.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="homeroom-picker"
            className="text-sm font-semibold text-slate-600"
          >
            Homeroom
          </label>
          <Select
            id="homeroom-picker"
            value={activeHomeroom?.sectionId ?? ''}
            onChange={(event) => setSelectedSectionId(event.target.value)}
          >
            {homerooms.map((homeroom) => (
              <option key={homeroom.sectionId} value={homeroom.sectionId}>
                {homeroom.className}
                {homeroom.sectionName ? ` ${homeroom.sectionName}` : ''}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      <div
        className="flex items-start gap-2.5 rounded-xl border border-info-100 bg-info-50 px-3.5 py-2.5 text-sm text-info-900"
        role="note"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          As Class Teacher you can see submitted and published work across every
          subject in this homeroom. Records set by other subject teachers are
          view-only — contact the subject teacher to change them.
        </span>
      </div>

      {summaryQuery.isLoading ? (
        <LoadingState label="Loading the homeroom picture..." />
      ) : summaryQuery.isError ? (
        <ErrorState
          title="Could not load the homeroom summary"
          message="This homeroom's cross-subject summary could not be loaded just now."
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : summary ? (
        <>
          <SummaryGrid>
            <SummaryCard
              label="Students"
              value={summary.studentCount}
              icon={<Users size={20} />}
              tone="module"
              description="Active students in your homeroom."
            />
            <SummaryCard
              label="Subjects awaiting marks"
              value={summary.subjectsWithNoMarks.length}
              icon={<BookOpen size={20} />}
              tone={summary.subjectsWithNoMarks.length > 0 ? 'info' : 'module'}
              description="Subjects with nothing reported yet this year."
            />
            <SummaryCard
              label="Attendance follow-ups"
              value={summary.studentsNeedingFollowUp}
              icon={<AlertTriangle size={20} />}
              tone={summary.studentsNeedingFollowUp > 0 ? 'warning' : 'module'}
              description="Students below 80% over the last 30 days."
            />
          </SummaryGrid>

          <SectionCard
            title="Marks reported by subject"
            description="Submitted and published entries only. Draft marks stay private to the subject teacher."
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Reported mark counts for each subject in this homeroom
                </caption>
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <th scope="col" className="py-2 pr-3">Subject</th>
                    <th scope="col" className="py-2 pr-3">Reported entries</th>
                    <th scope="col" className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.subjectCoverage.map((subject) => (
                    <tr
                      key={subject.subjectId}
                      className="border-b border-slate-50 last:border-0"
                    >
                      <td className="py-2 pr-3 font-bold text-slate-900">
                        {subject.subjectName}
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-slate-700">
                        {subject.reportedMarkCount}
                      </td>
                      <td className="py-2 pr-3">
                        {subject.hasAnyReportedMarks ? (
                          <span className="text-success-700">Reporting</span>
                        ) : (
                          // Early in a term this is normal, so it is phrased
                          // as a fact rather than a fault.
                          <span className="text-slate-500">
                            Nothing reported yet
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            title="Homework across all subjects"
            description="Published homework for this homeroom, newest first."
          >
            {summary.homework.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">
                No published homework for this homeroom yet.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {summary.homework.slice(0, 20).map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm"
                  >
                    <span className="font-bold text-slate-900">
                      {item.title}
                    </span>
                    <span className="text-slate-600">{item.subjectName}</span>
                    <span className="text-slate-500">
                      Due {formatSchoolDate(item.dueDate)}
                    </span>
                    <StatusBadge status={item.status} />
                    <span
                      className={cn(
                        'text-xs',
                        item.isMine
                          ? 'font-bold text-primary-700'
                          : 'text-slate-500',
                      )}
                    >
                      {item.isMine ? 'Set by you' : `Set by ${item.setBy ?? 'another teacher'}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
