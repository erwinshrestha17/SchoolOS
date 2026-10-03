import { periodDayCounts } from '../payroll/payroll-proration';

/**
 * Existing payroll day rules. Attendance contributes one day for PRESENT/LATE;
 * approved leave and employment caps remain authoritative inputs.
 *
 * Phase 7.9: partial employment is prorated exactly (two decimals) instead of
 * being rounded to a whole day; the arithmetic lives in payroll-proration.ts
 * so the payroll run and the 7.7 correction projection can never diverge.
 */
export function payrollDayCounts(input: {
  workingDays: number;
  presentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  employedDays: number;
  periodCalendarDays: number;
}) {
  const centi = (days: number) => BigInt(Math.round(days * 100));
  const counts = periodDayCounts({
    divisorDays: input.workingDays,
    presentCenti: centi(input.presentDays),
    paidLeaveCenti: centi(input.paidLeaveDays),
    unpaidLeaveCenti: centi(input.unpaidLeaveDays),
    employedDays: input.employedDays,
    periodCalendarDays: input.periodCalendarDays,
  });
  return {
    paidDays: Number(counts.paidCenti) / 100,
    unpaidDays: Number(counts.unpaidCenti) / 100,
  };
}

export function attendancePaidContribution(status: string) {
  return status === 'PRESENT' || status === 'LATE' ? 1 : 0;
}

/** Same inclusive UTC calendar-day overlap used by payroll preparation. */
export function payrollLeaveOverlapDays(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date,
): number {
  const start = new Date(Math.max(start1.getTime(), start2.getTime()));
  const end = new Date(Math.min(end1.getTime(), end2.getTime()));
  if (start > end) return 0;
  const first = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  const last = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate(),
  );
  return Math.round((last - first) / 86400000) + 1;
}
