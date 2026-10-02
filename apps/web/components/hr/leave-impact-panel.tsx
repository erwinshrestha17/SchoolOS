'use client';

import { formatBsDate, type StaffLeaveCoverItem } from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Users } from 'lucide-react';
import { api } from '../../lib/api';

const coverageLabel: Record<StaffLeaveCoverItem['coverage'], string> = {
  UNCOVERED: 'Needs cover',
  DRAFT: 'Cover drafted',
  ASSIGNED: 'Covered',
};

const coverageTone: Record<StaffLeaveCoverItem['coverage'], string> = {
  UNCOVERED: 'bg-rose-50 text-rose-700 border-rose-100',
  DRAFT: 'bg-amber-50 text-amber-700 border-amber-100',
  ASSIGNED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

function periodLabel(item: StaffLeaveCoverItem) {
  return [item.className, item.sectionName].filter(Boolean).join(' · ');
}

/**
 * Phase 7.6 — academic impact of a leave request, computed by the server from
 * the live timetable: affected periods, their current cover and how many
 * timetabled teachers are free then. Nothing here is calculated client-side.
 */
export function LeaveImpactPanel({
  leaveRequestId,
}: {
  leaveRequestId: string;
}) {
  const impactQuery = useQuery({
    queryKey: ['leave-impact', leaveRequestId],
    queryFn: () => api.getLeaveRequestImpact(leaveRequestId),
  });

  if (impactQuery.isLoading) {
    return (
      <p className="text-xs font-semibold text-slate-500">
        Checking timetable impact…
      </p>
    );
  }
  if (impactQuery.isError || !impactQuery.data) {
    return (
      <p className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">
        Timetable impact could not be loaded. The decision is still checked on
        the server.
      </p>
    );
  }

  const impact = impactQuery.data;
  if (impact.totals.periods === 0) {
    return (
      <p className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-600">
        No timetabled periods fall in this leave.
      </p>
    );
  }

  return (
    <section aria-label="Academic impact" className="space-y-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 font-bold text-slate-900">
          <CalendarClock size={14} aria-hidden />
          {impact.totals.periods} period
          {impact.totals.periods === 1 ? '' : 's'} affected
        </span>
        <span className="rounded-full border border-rose-100 bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">
          {impact.totals.unresolved} without a substitute
        </span>
        {impact.totals.withoutFreeTeacher > 0 ? (
          <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">
            {impact.totals.withoutFreeTeacher} with no free teacher
          </span>
        ) : null}
      </div>
      {impact.truncated ? (
        <p className="text-slate-500">
          Showing the first 31 days (until {formatBsDate(impact.previewEndsOn)}
          ).
        </p>
      ) : null}
      <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
        {impact.days.map((day) => (
          <div key={day.date}>
            <p className="mb-1 font-bold uppercase text-slate-400">
              {formatBsDate(day.date)}
            </p>
            <ul className="divide-y divide-slate-100 rounded-xl border">
              {day.periods.map((item) => (
                <li
                  key={`${item.slotId}-${item.date}`}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 tabular-nums">
                      {item.startsAt}–{item.endsAt}{' '}
                      <span className="font-medium text-slate-600">
                        {item.subjectName ?? 'Period'}
                      </span>
                    </p>
                    <p className="truncate text-slate-500">
                      {periodLabel(item)}
                      {item.substituteName
                        ? ` · Substitute: ${item.substituteName}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.freeTeacherCount !== null ? (
                      <span
                        className="inline-flex items-center gap-1 text-slate-500"
                        title="Timetabled teachers free at this time"
                      >
                        <Users size={12} aria-hidden />
                        {item.freeTeacherCount} free
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full border px-2 py-0.5 font-semibold ${coverageTone[item.coverage]}`}
                    >
                      {coverageLabel[item.coverage]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-slate-500">
        Approving creates a cover draft for every period without one. Free
        teachers are availability only; assigning a substitute still checks
        eligibility.
      </p>
    </section>
  );
}
