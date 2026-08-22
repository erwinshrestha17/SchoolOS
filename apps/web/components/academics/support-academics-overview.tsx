'use client';

import { useQuery } from '@tanstack/react-query';
import { BookOpenCheck, GraduationCap, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { api } from '@/lib/api';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { ModuleHeader } from '@/components/ui/module-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { SummaryCard, SummaryGrid } from '@/components/ui/summary-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { WorkSurface } from '@/components/ui/work-surface';

const MARKS_PAGE_SIZE = 20;
const REPORT_CARD_PREVIEW_LIMIT = 20;

export function SupportAcademicsOverview() {
  const [marksPage, setMarksPage] = useState(1);
  const termsQuery = useQuery({
    queryKey: ['support-academics-exam-terms'],
    queryFn: api.listExamTerms,
  });
  const marksQuery = useQuery({
    queryKey: ['support-academics-marks', marksPage],
    queryFn: () =>
      api.listMarksPage({ page: marksPage, limit: MARKS_PAGE_SIZE }),
  });
  const reportCardsQuery = useQuery({
    queryKey: ['support-academics-report-cards'],
    queryFn: () => api.listReportCards(),
  });

  const marks = marksQuery.data?.items ?? [];
  const markMeta = marksQuery.data?.meta;
  const reportCards = reportCardsQuery.data ?? [];

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="Read-only support"
        title="Academic evidence"
        description="Inspect academic setup, mark records, and recent report-card evidence. Entry, locking, publishing, correction, promotion, PDF, and protected-file actions remain unavailable."
      />

      <div className="flex items-start gap-3 rounded-xl border border-info-100 bg-info-50 p-4 text-sm text-info-800">
        <ShieldCheck className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
        <p>
          Counts below describe only the real API result named on each card.
          Report-card preview rows are capped and are not presented as an
          authoritative school total.
        </p>
      </div>

      <SummaryGrid>
        <SummaryCard
          label="Exam terms returned"
          value={
            termsQuery.isError ? 'Unavailable' : (termsQuery.data?.length ?? 0)
          }
          loading={termsQuery.isLoading}
          icon={<GraduationCap size={20} />}
          tone="module"
          description="Tenant-scoped exam terms returned by the academic setup API."
        />
        <SummaryCard
          label="Mark records"
          value={marksQuery.isError ? 'Unavailable' : (markMeta?.total ?? 0)}
          loading={marksQuery.isLoading}
          icon={<BookOpenCheck size={20} />}
          tone="module"
          description="Authoritative total from the paginated marks response."
        />
        <SummaryCard
          label="Report cards returned"
          value={reportCardsQuery.isError ? 'Unavailable' : reportCards.length}
          loading={reportCardsQuery.isLoading}
          icon={<GraduationCap size={20} />}
          tone="module"
          description="Recent API rows (currently capped at 100), not an official total."
        />
      </SummaryGrid>

      <WorkSurface
        title="Marks evidence"
        description="Server-paginated mark rows with narrow student identity only."
      >
        {marksQuery.isLoading ? (
          <LoadingState label="Loading mark records…" />
        ) : marksQuery.isError ? (
          <ErrorState
            title="Marks unavailable"
            message="The mark evidence page could not be loaded. No write or publishing action was attempted."
            onRetry={() => void marksQuery.refetch()}
          />
        ) : marks.length === 0 ? (
          <EmptyState
            title="No mark records"
            description="No mark entries were returned for this school."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <Table>
              <caption className="sr-only">
                Tenant-scoped mark records. Total records:{' '}
                {markMeta?.total ?? 0}.
              </caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Subject / component</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Lock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {marks.map((mark) => (
                  <TableRow key={mark.id}>
                    <TableCell>
                      <p className="font-semibold text-slate-900">
                        {studentName(mark.student)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {mark.student?.studentSystemId ?? 'ID unavailable'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p>{mark.subject?.name ?? 'Subject unavailable'}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {mark.assessmentComponent?.name ??
                          'Component unavailable'}
                      </p>
                    </TableCell>
                    <TableCell>{mark.marksObtained}</TableCell>
                    <TableCell>
                      <StatusBadge status={mark.status} />
                    </TableCell>
                    <TableCell>{mark.isLocked ? 'Locked' : 'Open'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              page={markMeta?.page ?? marksPage}
              pageSize={markMeta?.limit ?? MARKS_PAGE_SIZE}
              total={markMeta?.total ?? 0}
              onPageChange={setMarksPage}
            />
          </div>
        )}
      </WorkSurface>

      <WorkSurface
        title="Recent report-card evidence"
        description="A bounded preview of the most recently updated report cards. History, correction requests, and PDFs are excluded from support responses."
      >
        {reportCardsQuery.isLoading ? (
          <LoadingState label="Loading report-card evidence…" />
        ) : reportCardsQuery.isError ? (
          <ErrorState
            title="Report cards unavailable"
            message="Recent report-card evidence could not be loaded."
            onRetry={() => void reportCardsQuery.refetch()}
          />
        ) : reportCards.length === 0 ? (
          <EmptyState
            title="No report cards"
            description="No report-card rows were returned for this school."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <Table>
              <caption className="sr-only">
                Up to {REPORT_CARD_PREVIEW_LIMIT} recent report-card rows from a
                response capped at 100 records.
              </caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Percentage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Lock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportCards.slice(0, REPORT_CARD_PREVIEW_LIMIT).map((card) => (
                  <TableRow key={card.id}>
                    <TableCell>
                      <p className="font-semibold text-slate-900">
                        {studentName(card.student)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {card.student?.studentSystemId ?? 'ID unavailable'}
                      </p>
                    </TableCell>
                    <TableCell>{card.grade}</TableCell>
                    <TableCell>{card.percentage}%</TableCell>
                    <TableCell>
                      <StatusBadge status={card.status} />
                    </TableCell>
                    <TableCell>{card.lockedAt ? 'Locked' : 'Open'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </WorkSurface>
    </DashboardPageShell>
  );
}

function studentName(
  student:
    | { firstNameEn?: string | null; lastNameEn?: string | null }
    | null
    | undefined,
) {
  if (!student) return 'Student unavailable';
  const name = [student.firstNameEn, student.lastNameEn]
    .filter(Boolean)
    .join(' ')
    .trim();
  return name || 'Student unavailable';
}
