/**
 * Phase 7.9 — deterministic payroll proration.
 *
 * Pure functions, no I/O and no floating point: money is whole paisa (bigint),
 * day counts are hundredths of a day (bigint), and every division rounds half
 * up (away from zero) exactly once, in a documented place. The same inputs
 * always produce the same persisted breakdown, so a run can be explained and
 * reproduced from its stored lineage.
 *
 * What this module owns
 *   - which employed days of the period have a compensation source (salary
 *     structure, or contract when the staff member has no structure), so a
 *     structure that starts or ends mid-period pays each part at its own rate
 *     and employed days with no authoritative rate are reported, not guessed;
 *   - the period day counts (present, paid leave, unpaid leave) taken once per
 *     calendar day, so overlapping records are never counted twice;
 *   - the paid-day figure under the existing payroll day rules, now exact to
 *     two decimals instead of rounded to a whole day for partial employment;
 *   - segment money (gross, basic, fixed deductions) and its allocation.
 *
 * What it deliberately does not do: statutory amounts (7.8 policy engine),
 * weekly-off/holiday modelling (no authoritative rule; the divisor is the
 * calendar days of the BS period unless the operator supplies one), or
 * annualised tax.
 */

export const DAY_MS = 86_400_000;
const CENTI = 100n;

export type PayrollDivisorBasisValue =
  | 'CALENDAR_DAYS_OF_PERIOD'
  | 'OPERATOR_SUPPLIED';

/** `a / b` rounded half away from zero; `b` must be positive. */
export function divRoundHalfUp(a: bigint, b: bigint): bigint {
  if (b <= 0n) throw new RangeError('divisor must be positive');
  const negative = a < 0n;
  const abs = negative ? -a : a;
  const quotient = (abs * 2n + b) / (b * 2n);
  return negative ? -quotient : quotient;
}

/** Parses a decimal (string / number / Decimal) to paisa, rounding half up. */
export function toMinor(value: { toString(): string } | number | string) {
  const text = String(value).trim();
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new RangeError(`"${text}" is not a plain decimal amount`);
  const [, sign, whole, fraction = ''] = match;
  const padded = (fraction + '00').slice(0, 2);
  let minor = BigInt(whole) * 100n + BigInt(padded);
  if (fraction.length > 2 && Number(fraction[2]) >= 5) minor += 1n;
  return sign ? -minor : minor;
}

export function formatMinor(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const whole = abs / 100n;
  const cents = (abs % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${cents}`;
}

export function formatCenti(centi: bigint): string {
  return formatMinor(centi);
}

function dayNumber(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS);
}

export function dayIso(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export interface ProrationPeriod {
  /** Inclusive first and last day of the period (UTC calendar days). */
  startsOn: Date;
  endsOn: Date;
}

export interface ProrationEmployment {
  effectiveFrom: Date;
  /** Exclusive end (the first day NOT employed); null = open. */
  effectiveTo: Date | null;
}

export interface CompensationSource {
  kind: 'SALARY_STRUCTURE' | 'CONTRACT';
  id: string;
  /** Inclusive start day. */
  from: Date;
  /** Inclusive last day; null = open. */
  to: Date | null;
  basic: bigint;
  allowances: bigint;
  fixedDeductions: bigint;
  pfEnabled: boolean;
  tdsEnabled: boolean;
}

export interface ProrationLeave {
  startsOn: Date;
  endsOn: Date;
  isPaid: boolean;
  /** Request length in days; a one-day request below 1 is a part-day leave. */
  days: number;
}

export interface StaffProrationInput {
  period: ProrationPeriod;
  employments: ProrationEmployment[];
  sources: CompensationSource[];
  divisorDays: number;
  /** Dates with a PRESENT or LATE attendance record. */
  presentDates: Date[];
  leaves: ProrationLeave[];
}

export type ProrationUnresolvedCode =
  | 'PRORATION_DIVISOR_INVALID'
  | 'PRORATION_NO_EMPLOYED_DAYS'
  | 'PRORATION_EMPLOYED_DAYS_WITHOUT_COMPENSATION';

export interface ProrationSegment {
  source: CompensationSource;
  /** First and last employed day assigned to this source. */
  from: string;
  to: string;
  days: number;
  paidCenti: bigint;
  gross: bigint;
  basic: bigint;
  fixedDeductions: bigint;
  /** Entitlement for the employed days before attendance (salary for being employed). */
  employedEntitlement: bigint;
}

/** One employed day of the period as it was counted (persisted for audit and for pricing later corrections). */
export interface ProrationLedgerDay {
  /** Gregorian business date, YYYY-MM-DD. */
  d: string;
  /** PRESENT/LATE attendance recorded. */
  p: boolean;
  /** Approved leave covering the day: centi-days claimed and whether paid. */
  l?: { c: number; paid: boolean };
  /** Index of the compensation segment this day was priced under. */
  s: number;
}

export interface StaffProrationPlan {
  status: 'RESOLVED';
  divisorDays: number;
  periodCalendarDays: number;
  employedDays: number;
  presentDays: number;
  paidLeaveCenti: bigint;
  unpaidLeaveCenti: bigint;
  /** Days of leave/attendance that fell on the same date and were counted once. */
  overlappingRecordDays: number;
  paidCenti: bigint;
  unpaidCenti: bigint;
  segments: ProrationSegment[];
  ledger: ProrationLedgerDay[];
  totals: {
    gross: bigint;
    basic: bigint;
    fixedDeductions: bigint;
    employedEntitlement: bigint;
  };
}

export interface UnresolvedProration {
  status: 'UNRESOLVED';
  code: ProrationUnresolvedCode;
  message: string;
  /** Employed days that no compensation source covers (for the message). */
  uncoveredDays?: string[];
}

export function planStaffProration(
  input: StaffProrationInput,
): StaffProrationPlan | UnresolvedProration {
  const { period, divisorDays } = input;
  if (!Number.isInteger(divisorDays) || divisorDays < 1 || divisorDays > 32) {
    return {
      status: 'UNRESOLVED',
      code: 'PRORATION_DIVISOR_INVALID',
      message:
        'The payroll divisor must be a whole number of days from 1 to 32',
    };
  }
  const first = dayNumber(period.startsOn);
  const last = dayNumber(period.endsOn);
  const periodCalendarDays = last - first + 1;

  const presentSet = new Set(input.presentDates.map(dayNumber));
  const employed: number[] = [];
  for (let day = first; day <= last; day += 1) {
    const inside = input.employments.some(
      (window) =>
        dayNumber(window.effectiveFrom) <= day &&
        (window.effectiveTo === null || day < dayNumber(window.effectiveTo)),
    );
    if (inside) employed.push(day);
  }
  if (!employed.length) {
    return {
      status: 'UNRESOLVED',
      code: 'PRORATION_NO_EMPLOYED_DAYS',
      message: 'No authoritative employment covers any day of the period',
    };
  }

  // One source per employed day: the covering source that started latest.
  const ordered = [...input.sources].sort(
    (a, b) => dayNumber(b.from) - dayNumber(a.from) || a.id.localeCompare(b.id),
  );
  const assigned = new Map<string, number[]>();
  const uncovered: number[] = [];
  for (const day of employed) {
    const source = ordered.find(
      (candidate) =>
        dayNumber(candidate.from) <= day &&
        (candidate.to === null || day <= dayNumber(candidate.to)),
    );
    if (!source) {
      uncovered.push(day);
      continue;
    }
    const key = `${source.kind}:${source.id}`;
    assigned.set(key, [...(assigned.get(key) ?? []), day]);
  }
  if (uncovered.length) {
    return {
      status: 'UNRESOLVED',
      code: 'PRORATION_EMPLOYED_DAYS_WITHOUT_COMPENSATION',
      message: `${uncovered.length} employed day(s) have no salary structure or contract covering them (${dayIso(uncovered[0])}${uncovered.length > 1 ? ` … ${dayIso(uncovered[uncovered.length - 1])}` : ''})`,
      uncoveredDays: uncovered.map(dayIso),
    };
  }

  // Day counts, once per calendar day. Attendance wins over a leave record on
  // the same date; a one-day request shorter than a day counts as that part.
  const employedSet = new Set(employed);
  const overlay = new Map<number, { centi: bigint; paid: boolean }>();
  for (const leave of input.leaves) {
    const startsOn = dayNumber(leave.startsOn);
    const endsOn = dayNumber(leave.endsOn);
    const partDay = startsOn === endsOn && leave.days > 0 && leave.days < 1;
    const centi = partDay ? BigInt(Math.round(leave.days * 100)) : CENTI;
    for (
      let day = Math.max(startsOn, first);
      day <= Math.min(endsOn, last);
      day += 1
    ) {
      if (!employedSet.has(day)) continue;
      const existing = overlay.get(day);
      // Approved leave cannot overlap in the database; if data ever does, the
      // larger claim wins so the same date is never counted twice.
      if (!existing || centi > existing.centi)
        overlay.set(day, { centi, paid: leave.isPaid });
    }
  }
  const counts = countLedgerDays(
    employed.map((day) => {
      const leave = overlay.get(day);
      return {
        p: presentSet.has(day),
        l: leave ? { c: Number(leave.centi), paid: leave.paid } : undefined,
      };
    }),
  );
  const presentDays = counts.presentDays;
  const paidLeaveCenti = counts.paidLeaveCenti;
  const unpaidLeaveCenti = counts.unpaidLeaveCenti;
  const overlappingRecordDays = counts.overlappingRecordDays;

  const W = BigInt(divisorDays) * CENTI;
  const E = BigInt(employed.length);
  const N = BigInt(periodCalendarDays);
  const present = BigInt(presentDays) * CENTI;
  const effective = bmin(W, present + paidLeaveCenti);
  const unpaidCenti = bmax(0n, bmax(W - effective, unpaidLeaveCenti));
  const employedWorking = E >= N ? W : bmin(W, divRoundHalfUp(W * E, N));
  const paidCenti = bmin(employedWorking, bmax(0n, W - unpaidCenti));

  // Allocate paid days over the segments by employed days; the last segment
  // takes the remainder so the allocation always sums to paidCenti exactly.
  const sourceByKey = new Map(ordered.map((s) => [`${s.kind}:${s.id}`, s]));
  const groups = [...assigned.entries()]
    .flatMap(([key, days]) => {
      const source = sourceByKey.get(key);
      return source ? [{ source, days }] : [];
    })
    .sort((a, b) => a.days[0] - b.days[0]);
  let allocated = 0n;
  const segments: ProrationSegment[] = groups.map((group, index) => {
    const days = BigInt(group.days.length);
    const share =
      index === groups.length - 1
        ? paidCenti - allocated
        : divRoundHalfUp(paidCenti * days, E);
    allocated += share;
    const monthly = group.source.basic + group.source.allowances;
    return {
      source: group.source,
      from: dayIso(group.days[0]),
      to: dayIso(group.days[group.days.length - 1]),
      days: group.days.length,
      paidCenti: share,
      gross: divRoundHalfUp(monthly * share, W),
      basic: divRoundHalfUp(group.source.basic * share, W),
      fixedDeductions: divRoundHalfUp(group.source.fixedDeductions * days, N),
      employedEntitlement: divRoundHalfUp(monthly * days, N),
    };
  });

  const segmentIndexByDay = new Map<number, number>();
  groups.forEach((group, index) => {
    group.days.forEach((day) => segmentIndexByDay.set(day, index));
  });
  const ledger: ProrationLedgerDay[] = employed.map((day) => {
    const leave = overlay.get(day);
    return {
      d: dayIso(day),
      p: presentSet.has(day),
      ...(leave ? { l: { c: Number(leave.centi), paid: leave.paid } } : {}),
      s: segmentIndexByDay.get(day) ?? 0,
    };
  });

  return {
    status: 'RESOLVED',
    divisorDays,
    periodCalendarDays,
    employedDays: employed.length,
    presentDays,
    paidLeaveCenti,
    unpaidLeaveCenti,
    overlappingRecordDays,
    paidCenti,
    unpaidCenti,
    segments,
    ledger,
    totals: {
      gross: sum(segments, (s) => s.gross),
      basic: sum(segments, (s) => s.basic),
      fixedDeductions: sum(segments, (s) => s.fixedDeductions),
      employedEntitlement: sum(segments, (s) => s.employedEntitlement),
    },
  };
}

function bmin(a: bigint, b: bigint) {
  return a < b ? a : b;
}
function bmax(a: bigint, b: bigint) {
  return a > b ? a : b;
}
function sum<T>(items: T[], pick: (item: T) => bigint) {
  return items.reduce((total, item) => total + pick(item), 0n);
}

/**
 * Counts a ledger once per day: a present day is one present day (and an
 * overlapping leave record is only noted); a non-present day counts as the
 * leave it carries, paid or unpaid.
 */
export function countLedgerDays(
  days: Array<{ p: boolean; l?: { c: number; paid: boolean } }>,
) {
  let presentDays = 0;
  let paidLeaveCenti = 0n;
  let unpaidLeaveCenti = 0n;
  let overlappingRecordDays = 0;
  for (const day of days) {
    if (day.p) {
      presentDays += 1;
      if (day.l) overlappingRecordDays += 1;
    } else if (day.l) {
      if (day.l.paid) paidLeaveCenti += BigInt(day.l.c);
      else unpaidLeaveCenti += BigInt(day.l.c);
    }
  }
  return {
    presentDays,
    paidLeaveCenti,
    unpaidLeaveCenti,
    overlappingRecordDays,
  };
}

/** The period's day counts from raw counts; also used to project corrections. */
export function periodDayCounts(input: {
  divisorDays: number;
  presentCenti: bigint;
  paidLeaveCenti: bigint;
  unpaidLeaveCenti: bigint;
  employedDays: number;
  periodCalendarDays: number;
}) {
  const W = BigInt(input.divisorDays) * CENTI;
  const effective = bmin(W, input.presentCenti + input.paidLeaveCenti);
  const unpaid = bmax(0n, bmax(W - effective, input.unpaidLeaveCenti));
  const employedWorking =
    input.employedDays >= input.periodCalendarDays
      ? W
      : bmin(
          W,
          divRoundHalfUp(
            W * BigInt(input.employedDays),
            BigInt(input.periodCalendarDays),
          ),
        );
  return {
    paidCenti: bmin(employedWorking, bmax(0n, W - unpaid)),
    unpaidCenti: unpaid,
  };
}

/** JSON persisted on PayrollLine.prorationBreakdown (schemaVersion 1). */
export function prorationBreakdownJson(
  plan: StaffProrationPlan,
  basis: PayrollDivisorBasisValue,
  period: { label: string; startsOn: string; endsOn: string },
) {
  return {
    schemaVersion: 1,
    period,
    divisor: { days: plan.divisorDays, basis },
    periodCalendarDays: plan.periodCalendarDays,
    employedDays: plan.employedDays,
    presentDays: plan.presentDays,
    paidLeaveDays: formatCenti(plan.paidLeaveCenti),
    unpaidLeaveDays: formatCenti(plan.unpaidLeaveCenti),
    overlappingRecordDays: plan.overlappingRecordDays,
    paidDays: formatCenti(plan.paidCenti),
    unpaidDays: formatCenti(plan.unpaidCenti),
    segments: plan.segments.map((segment) => ({
      sourceKind: segment.source.kind,
      sourceId: segment.source.id,
      from: segment.from,
      to: segment.to,
      days: segment.days,
      paidDays: formatCenti(segment.paidCenti),
      monthlyBasic: formatMinor(segment.source.basic),
      monthlyAllowances: formatMinor(segment.source.allowances),
      monthlyFixedDeductions: formatMinor(segment.source.fixedDeductions),
      gross: formatMinor(segment.gross),
      basic: formatMinor(segment.basic),
      fixedDeductions: formatMinor(segment.fixedDeductions),
    })),
    ledger: plan.ledger,
  };
}
