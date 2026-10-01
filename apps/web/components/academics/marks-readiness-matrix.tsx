'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  toNepalLocalDateTime,
  type MarkReadinessCell,
  type MarkReadinessState,
} from '@schoolos/core';
import { Surface } from '@/components/schoolos';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { api } from '@/lib/api';
import { formatSchoolDate } from '@/lib/date-utils';

const STATE_LABEL: Record<MarkReadinessState, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  SUBMITTED: 'Submitted',
  RETURNED: 'Returned',
  REVIEWED: 'Reviewed',
  LOCKED: 'Locked',
};

/** Status tone keys understood by the shared status table. */
const STATE_STATUS: Record<MarkReadinessState, string> = {
  NOT_STARTED: 'DRAFT',
  IN_PROGRESS: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  RETURNED: 'RETURNED',
  REVIEWED: 'REVIEWED',
  LOCKED: 'LOCKED',
};

function cellLabel(cell: MarkReadinessCell) {
  if (cell.state === 'IN_PROGRESS' || cell.state === 'NOT_STARTED') {
    const missing = cell.studentCount - cell.finalCount;
    return missing > 0 ? `${missing} missing` : 'Entered, not submitted';
  }
  return STATE_LABEL[cell.state];
}

/** School date plus Nepal clock time; never the browser's local zone. */
function formatAsOf(iso: string) {
  const local = toNepalLocalDateTime(iso);
  const time = `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`;
  return `${formatSchoolDate(iso)}, ${time} NPT`;
}

function sectionColumnKey(cell: MarkReadinessCell) {
  return `${cell.classId}:${cell.sectionId ?? ''}`;
}

/**
 * Phase 6E readiness matrix (ASTRA M4-A): rows are subject components,
 * columns are class sections, every cell is the backend's exact sheet state.
 * Read-only; actions happen in the marks workspace.
 */
export function MarksReadinessMatrix() {
  const termsQuery = useQuery({
    queryKey: ['exam-terms'],
    queryFn: () => api.listExamTerms(),
  });
  const terms = termsQuery.data ?? [];
  const [selectedTermId, setSelectedTermId] = useState('');
  const examTermId =
    selectedTermId ||
    terms.find((term) => !term.isLocked)?.id ||
    terms[0]?.id ||
    '';

  const readinessQuery = useQuery({
    queryKey: ['mark-readiness', examTermId],
    queryFn: () => api.getMarkReadiness({ examTermId }),
    enabled: Boolean(examTermId),
  });
  const readiness = readinessQuery.data;

  const { columns, rows } = useMemo(() => {
    const cells = readiness?.cells ?? [];
    const columnMap = new Map<string, string>();
    const rowMap = new Map<
      string,
      { label: string; cells: Map<string, MarkReadinessCell> }
    >();
    for (const cell of cells) {
      const columnKey = sectionColumnKey(cell);
      columnMap.set(
        columnKey,
        cell.sectionName
          ? `${cell.className} ${cell.sectionName}`
          : `${cell.className} (whole class)`,
      );
      const rowKey = cell.assessmentComponentId;
      const row = rowMap.get(rowKey) ?? {
        label: `${cell.subjectName} · ${cell.componentName}`,
        cells: new Map<string, MarkReadinessCell>(),
      };
      row.cells.set(columnKey, cell);
      rowMap.set(rowKey, row);
    }
    return {
      columns: [...columnMap.entries()].sort((a, b) =>
        a[1].localeCompare(b[1]),
      ),
      rows: [...rowMap.entries()].sort((a, b) =>
        a[1].label.localeCompare(b[1].label),
      ),
    };
  }, [readiness]);

  const attention = (readiness?.cells ?? []).filter(
    (cell) => cell.state === 'RETURNED' || cell.state === 'SUBMITTED',
  );

  return (
    <Surface
      title="Marks readiness"
      description="Every class section and assessment component for the selected term, from saved mark sheets. A term can be locked only when every cell is locked."
      actions={
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span>Exam term</span>
          <select
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
            value={examTermId}
            onChange={(event) => setSelectedTermId(event.target.value)}
            disabled={terms.length === 0}
          >
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name}
                {term.isLocked ? ' (locked)' : ''}
              </option>
            ))}
          </select>
        </label>
      }
    >
      {termsQuery.isLoading || readinessQuery.isLoading ? (
        <LoadingState label="Loading marks readiness…" />
      ) : termsQuery.isError || readinessQuery.isError ? (
        <ErrorState
          title="Marks readiness is unavailable"
          message="The readiness matrix could not be loaded. Nothing is shown as complete until it loads."
          onRetry={() => {
            void termsQuery.refetch();
            void readinessQuery.refetch();
          }}
        />
      ) : !readiness || rows.length === 0 ? (
        <EmptyState
          title="No assessment components for this term"
          description="Add assessment components to the exam term to track marks readiness."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            {readiness.totals.LOCKED} of {readiness.cells.length} locked ·{' '}
            {readiness.totals.SUBMITTED} awaiting review ·{' '}
            {readiness.totals.RETURNED} returned ·{' '}
            {readiness.totals.IN_PROGRESS + readiness.totals.NOT_STARTED} still
            in entry
            <span className="ml-2 text-xs text-slate-400">
              As of {formatAsOf(readiness.asOf)}
            </span>
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">
                Marks readiness by subject component and class section
              </caption>
              <thead className="bg-slate-50">
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-10 bg-slate-50 px-3 py-2 font-semibold text-slate-700"
                  >
                    Subject · component
                  </th>
                  {columns.map(([key, label]) => (
                    <th
                      key={key}
                      scope="col"
                      className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(([rowKey, row]) => (
                  <tr key={rowKey}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 font-medium text-slate-900"
                    >
                      {row.label}
                    </th>
                    {columns.map(([columnKey]) => {
                      const cell = row.cells.get(columnKey);
                      return (
                        <td key={columnKey} className="px-3 py-2">
                          {cell ? (
                            <StatusBadge
                              status={STATE_STATUS[cell.state]}
                              label={cellLabel(cell)}
                            />
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {attention.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Requires attention
              </h3>
              <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {attention.map((cell) => (
                  <li
                    key={`${cell.assessmentComponentId}:${cell.sectionId ?? ''}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <span>
                      {cell.className}
                      {cell.sectionName ? ` ${cell.sectionName}` : ''} ·{' '}
                      {cell.subjectName} · {cell.componentName}
                    </span>
                    <span className="flex items-center gap-3">
                      <StatusBadge
                        status={STATE_STATUS[cell.state]}
                        label={STATE_LABEL[cell.state]}
                      />
                      <Link
                        href="/dashboard/academics/marks"
                        className="text-sm font-semibold text-[var(--color-mod-academics-text)] underline-offset-2 hover:underline"
                      >
                        Open marks
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </Surface>
  );
}
