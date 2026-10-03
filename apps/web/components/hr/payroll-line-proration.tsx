'use client';

import type {
  PayrollDivisorBasis,
  PayrollProrationBreakdown,
} from '@schoolos/core';
import { divisorBasisLabel } from '../../lib/payroll-run-view';

/**
 * Phase 7.9: how a payroll line's pay was derived — period, divisor, paid and
 * unpaid days, each compensation segment and any consumed attendance
 * adjustments. The server's per-day ledger is deliberately not sent; this is
 * the reviewable summary.
 */
export function PayrollLineProration({
  breakdown,
}: {
  breakdown: PayrollProrationBreakdown | null | undefined;
}) {
  if (!breakdown) return null;
  return (
    <details className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs">
      <summary className="cursor-pointer font-bold text-gray-700">
        How this was calculated
      </summary>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        <dt className="text-gray-400">Period</dt>
        <dd className="font-semibold text-gray-800">
          {breakdown.period.label} ({breakdown.period.startsOn} –{' '}
          {breakdown.period.endsOn})
        </dd>
        <dt className="text-gray-400">Divisor</dt>
        <dd className="font-semibold text-gray-800">
          {breakdown.divisor.days} days ·{' '}
          {divisorBasisLabel(breakdown.divisor.basis as PayrollDivisorBasis)}
        </dd>
        <dt className="text-gray-400">Employed days</dt>
        <dd className="font-semibold text-gray-800">
          {breakdown.employedDays} of {breakdown.periodCalendarDays}
        </dd>
        <dt className="text-gray-400">Paid / unpaid days</dt>
        <dd className="font-semibold text-gray-800">
          {breakdown.paidDays} / {breakdown.unpaidDays}
        </dd>
        <dt className="text-gray-400">Present · paid leave · unpaid leave</dt>
        <dd className="font-semibold text-gray-800">
          {breakdown.presentDays} · {breakdown.paidLeaveDays} ·{' '}
          {breakdown.unpaidLeaveDays}
        </dd>
      </dl>
      {breakdown.overlappingRecordDays > 0 && (
        <p className="mt-2 font-semibold text-amber-700">
          {breakdown.overlappingRecordDays} day
          {breakdown.overlappingRecordDays === 1 ? '' : 's'} had overlapping
          attendance and leave records; the stricter rule was applied once.
        </p>
      )}
      <ul className="mt-2 space-y-1">
        {breakdown.segments.map((segment) => (
          <li
            key={`${segment.sourceId}-${segment.from}`}
            className="text-gray-600"
          >
            {segment.from} – {segment.to} · {segment.days} day
            {segment.days === 1 ? '' : 's'} ·{' '}
            {segment.sourceKind === 'SALARY_STRUCTURE'
              ? 'salary structure'
              : 'contract'}{' '}
            · gross {segment.gross}
          </li>
        ))}
      </ul>
    </details>
  );
}
