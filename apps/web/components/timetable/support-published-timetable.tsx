'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { api } from '@/lib/api';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { ModuleHeader } from '@/components/ui/module-header';
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

const PAGE_SIZE = 25;
const DAY_LABELS = [
  'Day unavailable',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export function SupportPublishedTimetable() {
  const [page, setPage] = useState(1);
  const timetableQuery = useQuery({
    queryKey: ['support-published-timetable', page],
    queryFn: () =>
      api.listSupportPublishedTimetable({ page, limit: PAGE_SIZE }),
  });

  const items = timetableQuery.data?.items ?? [];
  const meta = timetableQuery.data?.meta;

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="Read-only support"
        title="Published timetable"
        description="Inspect published or locked timetable slots. Draft versions, builder setup, conflicts, substitutions, and workload records remain unavailable."
      />

      <div className="flex items-start gap-3 rounded-xl border border-info-100 bg-info-50 p-4 text-sm text-info-800">
        <ShieldCheck className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
        <p>
          This purpose-limited support session can read the active schedule but
          cannot open or change timetable setup.
        </p>
      </div>

      <WorkSurface
        title="Schedule slots"
        description="Server-paginated rows from the school’s published timetable only."
      >
        {timetableQuery.isLoading ? (
          <LoadingState label="Loading published timetable…" />
        ) : timetableQuery.isError ? (
          <ErrorState
            title="Published timetable unavailable"
            message="The active timetable could not be loaded. Draft or setup data was not requested."
            onRetry={() => void timetableQuery.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={28} />}
            title="No published timetable slots"
            description="This school has no published or locked timetable rows in the current support scope."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <Table>
              <caption className="sr-only">
                Published timetable slots. Total records: {meta?.total ?? 0}.
              </caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Day and time</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Room</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((slot) => (
                  <TableRow key={slot.id}>
                    <TableCell>
                      <p className="font-semibold text-slate-900">
                        {DAY_LABELS[slot.dayOfWeek] ?? 'Day unavailable'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {slot.startsAt}–{slot.endsAt}
                      </p>
                    </TableCell>
                    <TableCell>
                      {slot.class?.name ?? 'Class unavailable'}
                      {slot.section?.name ? ` · ${slot.section.name}` : ''}
                    </TableCell>
                    <TableCell>
                      {slot.subject?.name ?? 'Subject unavailable'}
                    </TableCell>
                    <TableCell>
                      {slot.staff
                        ? `${slot.staff.firstName} ${slot.staff.lastName}`.trim()
                        : 'Teacher not assigned'}
                    </TableCell>
                    <TableCell>
                      {slot.roomRef?.name ?? slot.room ?? 'Room not set'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              page={meta?.page ?? page}
              pageSize={meta?.limit ?? PAGE_SIZE}
              total={meta?.total ?? 0}
              onPageChange={setPage}
            />
          </div>
        )}
      </WorkSurface>
    </DashboardPageShell>
  );
}
