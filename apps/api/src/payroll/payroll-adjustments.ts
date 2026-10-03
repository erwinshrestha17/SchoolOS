import { attendancePaidContribution } from '../hr/payroll-day-policy';
import {
  countLedgerDays,
  divRoundHalfUp,
  formatCenti,
  formatMinor,
  periodDayCounts,
  toMinor,
  type ProrationLedgerDay,
} from './payroll-proration';

/**
 * Phase 7.9 — pricing a 7.7 attendance correction that was approved after its
 * payroll period locked (StaffAttendanceCorrection.status =
 * PENDING_PAYROLL_ADJUSTMENT).
 *
 * The correction is priced against the *source* payroll line that paid the
 * period it belongs to, using that line's persisted day ledger and divisor, so
 * the figure is the exact paid-day change the same payroll day rules would
 * have produced had the corrected attendance been known — never a live
 * recomputation against today's salary. A correction that cannot be priced
 * that way is reported as unresolved, not guessed.
 */
export interface CorrectionToPrice {
  id: string;
  staffId: string;
  /** Gregorian business date, YYYY-MM-DD. */
  attendanceDate: string;
  originalStatus: string;
  requestedStatus: string;
}

export interface SourceLineBreakdown {
  schemaVersion: number;
  divisor: { days: number };
  periodCalendarDays: number;
  employedDays: number;
  paidDays: string;
  segments: Array<{
    sourceKind: string;
    sourceId: string;
    monthlyBasic: string;
    monthlyAllowances: string;
  }>;
  ledger: ProrationLedgerDay[];
}

export interface SourceLineForPricing {
  runId: string;
  lineId: string;
  periodLabel: string;
  breakdown: unknown;
}

export type AdjustmentPricing =
  | {
      outcome: 'PRICED';
      kind: 'ARREARS' | 'RECOVERY';
      deltaCenti: bigint;
      amount: bigint;
      /** Gross pay per divisor day of the priced segment, 4 decimals. */
      dailyRate: string;
      pricing: Record<string, unknown>;
    }
  | { outcome: 'NO_PAYROLL_EFFECT' }
  | {
      outcome: 'UNRESOLVED';
      code:
        | 'SOURCE_LINE_MISSING'
        | 'SOURCE_LINE_WITHOUT_LEDGER'
        | 'SOURCE_LINE_INCONSISTENT'
        | 'DATE_NOT_IN_SOURCE_LEDGER';
      message: string;
    };

export function isSourceLineBreakdown(
  value: unknown,
): value is SourceLineBreakdown {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.schemaVersion === 1 &&
    typeof (v.divisor as { days?: unknown } | undefined)?.days === 'number' &&
    typeof v.periodCalendarDays === 'number' &&
    typeof v.employedDays === 'number' &&
    typeof v.paidDays === 'string' &&
    Array.isArray(v.segments) &&
    Array.isArray(v.ledger)
  );
}

export function priceCorrection(
  correction: CorrectionToPrice,
  source: SourceLineForPricing | null,
): AdjustmentPricing {
  const contribution =
    attendancePaidContribution(correction.requestedStatus) -
    attendancePaidContribution(correction.originalStatus);
  if (contribution === 0) return { outcome: 'NO_PAYROLL_EFFECT' };
  if (!source)
    return {
      outcome: 'UNRESOLVED',
      code: 'SOURCE_LINE_MISSING',
      message:
        'No approved payroll line paid this staff member for the corrected date',
    };
  if (!isSourceLineBreakdown(source.breakdown))
    return {
      outcome: 'UNRESOLVED',
      code: 'SOURCE_LINE_WITHOUT_LEDGER',
      message:
        'The payroll line that paid this date predates proration lineage and cannot be priced',
    };
  const breakdown = source.breakdown;
  const ledger = breakdown.ledger;
  const index = ledger.findIndex((day) => day.d === correction.attendanceDate);
  if (index < 0)
    return {
      outcome: 'UNRESOLVED',
      code: 'DATE_NOT_IN_SOURCE_LEDGER',
      message:
        'The corrected date was not an employed day in the payroll line that paid it',
    };

  const dayCounts = (days: typeof ledger) => {
    const counts = countLedgerDays(days);
    return {
      counts,
      result: periodDayCounts({
        divisorDays: breakdown.divisor.days,
        presentCenti: BigInt(counts.presentDays) * 100n,
        paidLeaveCenti: counts.paidLeaveCenti,
        unpaidLeaveCenti: counts.unpaidLeaveCenti,
        employedDays: breakdown.employedDays,
        periodCalendarDays: breakdown.periodCalendarDays,
      }),
    };
  };
  const before = dayCounts(ledger);
  if (formatCenti(before.result.paidCenti) !== breakdown.paidDays)
    return {
      outcome: 'UNRESOLVED',
      code: 'SOURCE_LINE_INCONSISTENT',
      message:
        'The source payroll line does not reproduce its own paid days from its ledger',
    };
  const corrected = ledger.map((day, i) =>
    i === index ? { ...day, p: contribution > 0 } : day,
  );
  const after = dayCounts(corrected);

  // The ledger must reproduce the paid days the source line actually paid;
  // otherwise it is not a faithful basis for pricing.
  const segment = breakdown.segments[ledger[index].s];
  if (!segment)
    return {
      outcome: 'UNRESOLVED',
      code: 'SOURCE_LINE_INCONSISTENT',
      message:
        'The source payroll line has no compensation segment for the date',
    };

  const deltaCenti = after.result.paidCenti - before.result.paidCenti;
  if (deltaCenti === 0n) return { outcome: 'NO_PAYROLL_EFFECT' };

  const monthly =
    toMinor(segment.monthlyBasic) + toMinor(segment.monthlyAllowances);
  const divisor = BigInt(breakdown.divisor.days) * 100n;
  const magnitude = deltaCenti < 0n ? -deltaCenti : deltaCenti;
  const amount = divRoundHalfUp(monthly * magnitude, divisor);
  if (amount === 0n) return { outcome: 'NO_PAYROLL_EFFECT' };
  const dailyRateScaled = divRoundHalfUp(
    monthly * 100n,
    BigInt(breakdown.divisor.days),
  );
  return {
    outcome: 'PRICED',
    kind: deltaCenti > 0n ? 'ARREARS' : 'RECOVERY',
    deltaCenti,
    amount,
    dailyRate: formatScaled4(dailyRateScaled),
    pricing: {
      schemaVersion: 1,
      sourceRunId: source.runId,
      sourceLineId: source.lineId,
      sourcePeriod: source.periodLabel,
      divisorDays: breakdown.divisor.days,
      segment: {
        kind: segment.sourceKind,
        id: segment.sourceId,
        monthlyGross: formatMinor(monthly),
      },
      originalStatus: correction.originalStatus,
      requestedStatus: correction.requestedStatus,
      paidDaysBefore: formatCenti(before.result.paidCenti),
      paidDaysAfter: formatCenti(after.result.paidCenti),
    },
  };
}

/** Whole 1/10,000 units → "123.4567". */
function formatScaled4(scaled: bigint): string {
  const negative = scaled < 0n;
  const abs = negative ? -scaled : scaled;
  return `${negative ? '-' : ''}${abs / 10000n}.${(abs % 10000n).toString().padStart(4, '0')}`;
}
