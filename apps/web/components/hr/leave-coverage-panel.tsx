'use client';

import { Surface } from '@/components/schoolos';
import { formatBsDate, type StaffLeaveCoverItem } from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/primitives/table';
import { api } from '../../lib/api';

const coverageBadge: Record<
  StaffLeaveCoverItem['coverage'],
  { label: string; variant: 'success' | 'warning' | 'destructive' }
> = {
  UNCOVERED: { label: 'Needs cover', variant: 'destructive' },
  DRAFT: { label: 'Cover drafted', variant: 'warning' },
  ASSIGNED: { label: 'Covered', variant: 'success' },
};

/**
 * Phase 7.6 — periods affected by approved leave over the next two weeks,
 * today first. Server-derived from the live timetable and the substitutions
 * linked to each leave; coordinators assign cover in the timetable workspace.
 */
export function LeaveCoveragePanel() {
  const coverageQuery = useQuery({
    queryKey: ['leave-coverage'],
    queryFn: () => api.getLeaveCoverage({ days: 14 }),
  });

  if (coverageQuery.isLoading) {
    return <LoadingState label="Loading leave coverage..." />;
  }
  if (coverageQuery.isError || !coverageQuery.data) {
    return (
      <ErrorState
        title="Leave coverage unavailable"
        message="Coverage for approved leave could not be loaded. No period has been marked as covered."
        error={coverageQuery.error}
        onRetry={() => void coverageQuery.refetch()}
      />
    );
  }

  const { items, totals, from, to } = coverageQuery.data;
  return (
    <Surface
      title="Leave coverage"
      description={`Periods affected by approved leave, ${formatBsDate(from)} – ${formatBsDate(to)}. ${totals.uncovered} of ${totals.periods} still need a substitute.`}
      actions={
        <Link
          href="/dashboard/timetable/substitutions"
          className="text-sm font-semibold text-[var(--color-mod-hr-text)] hover:underline"
        >
          Assign cover
        </Link>
      }
      padding="flush"
    >
      {items.length === 0 ? (
        <EmptyState
          title="No periods affected"
          description="No approved leave falls on a timetabled period in the next two weeks."
          className="m-5 min-h-40"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Date</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Teacher on leave</TableHead>
              <TableHead className="pr-6">Cover</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={`${item.slotId}-${item.date}`}>
                <TableCell className="pl-6">
                  {formatBsDate(item.date)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {item.startsAt}–{item.endsAt}
                  <span className="block text-xs text-muted-foreground">
                    {item.subjectName ?? 'Period'}
                  </span>
                </TableCell>
                <TableCell>
                  {[item.className, item.sectionName]
                    .filter(Boolean)
                    .join(' · ')}
                </TableCell>
                <TableCell>{item.absentTeacher.name}</TableCell>
                <TableCell className="pr-6">
                  <Badge variant={coverageBadge[item.coverage].variant}>
                    {coverageBadge[item.coverage].label}
                  </Badge>
                  {item.substituteName ? (
                    <span className="block text-xs text-muted-foreground">
                      {item.substituteName}
                    </span>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Surface>
  );
}
