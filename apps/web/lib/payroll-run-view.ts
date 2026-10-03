import {
  findPayrollPeriodContaining,
  formatPayrollPeriodLabel,
  getNepalSchoolDay,
  PAYROLL_BS_MAX_YEAR,
  PAYROLL_BS_MIN_YEAR,
  BS_MONTH_NAMES_EN,
  type PayrollRunSummary,
} from '@schoolos/core';

/**
 * Phase 7.9 presentation helpers for payroll runs. Pure functions only: the
 * server owns every amount, period bound and permission decision; these only
 * decide how those facts are worded and which controls to offer.
 */

/** Run statuses in which a payment hold may be placed or released. */
export const PAYROLL_HOLDABLE_STATUSES: readonly string[] = [
  'GENERATED',
  'VALIDATED',
  'UNDER_REVIEW',
  'REVIEWED',
  'APPROVED',
  'FINALIZED',
  'POSTED',
];

/** The bank payment advice exists only for finalized or posted runs. */
export const PAYROLL_BANK_ADVICE_STATUSES: readonly string[] = [
  'FINALIZED',
  'POSTED',
];

export const BS_MONTH_OPTIONS = BS_MONTH_NAMES_EN.map((label, index) => ({
  value: index + 1,
  label,
}));

/** The BS payroll period that contains today (Nepal business date). */
export function currentPayrollBsPeriod() {
  return findPayrollPeriodContaining(getNepalSchoolDay().gregorianDate);
}

/** BS year choices around the current one, clamped to the supported calendar. */
export function payrollBsYearOptions(currentBsYear: number, span = 2) {
  const years: number[] = [];
  for (let year = currentBsYear - span; year <= currentBsYear + 1; year += 1) {
    if (year >= PAYROLL_BS_MIN_YEAR && year <= PAYROLL_BS_MAX_YEAR) {
      years.push(year);
    }
  }
  return years;
}

type PeriodFields = Pick<PayrollRunSummary, 'periodMonth' | 'periodYear'> &
  Partial<
    Pick<
      PayrollRunSummary,
      'periodLabel' | 'periodStartsOn' | 'periodEndsOn' | 'divisorDays'
    >
  >;

/** "Kartik 2083" for BS runs; "2026-05" for runs created before BS periods. */
export function payrollRunPeriodLabel(run: PeriodFields) {
  return (
    run.periodLabel ?? formatPayrollPeriodLabel(run.periodYear, run.periodMonth)
  );
}

/** "2026-10-18 – 2026-11-16 · 30 days" when the server sent bounds. */
export function payrollRunPeriodRange(run: PeriodFields) {
  if (!run.periodStartsOn || !run.periodEndsOn) return null;
  const days = run.divisorDays ? ` · ${run.divisorDays}-day divisor` : '';
  return `${run.periodStartsOn} – ${run.periodEndsOn}${days}`;
}

export function divisorBasisLabel(basis: string | null | undefined) {
  switch (basis) {
    case 'CALENDAR_DAYS_OF_PERIOD':
      return 'Calendar days of the BS month';
    case 'OPERATOR_SUPPLIED':
      return 'Operator-supplied working days';
    default:
      return null;
  }
}

export function canPlaceHold(
  status: string,
  access: { can: (action: string) => boolean },
) {
  return PAYROLL_HOLDABLE_STATUSES.includes(status) && access.can('HOLD');
}

export function canReleaseHold(
  status: string,
  access: { can: (action: string) => boolean },
) {
  return (
    PAYROLL_HOLDABLE_STATUSES.includes(status) && access.can('RELEASE_HOLD')
  );
}

export function canExportBankAdvice(
  status: string,
  access: { can: (action: string) => boolean },
) {
  return (
    PAYROLL_BANK_ADVICE_STATUSES.includes(status) &&
    access.can('EXPORT_BANK_ADVICE')
  );
}

/** A line whose deductions exceed its gross: never shown as zero, blocks the run. */
export function isNegativeNet(line: {
  netSalary?: number | string | null;
  netNegative?: boolean;
}) {
  if (line.netNegative) return true;
  const net = Number(line.netSalary ?? 0);
  return Number.isFinite(net) && net < 0;
}

/** Clear wording for the 7.9 readiness / exception codes. */
const BLOCKER_COPY: Record<string, string> = {
  NEGATIVE_NET_PAY:
    'A staff line has deductions greater than gross pay. Correct the salary structure, deductions or adjustments, then regenerate.',
  PRORATION_INPUT_UNRESOLVED:
    'Employed days without a salary structure or contract cannot be priced. Add compensation covering those days, then regenerate.',
  PAYROLL_PERIOD_OVERLAP:
    'This period overlaps another live payroll run. Void or cancel that run first.',
  INVALID_PAYROLL_PERIOD:
    'The payroll period is not a valid BS month in the supported calendar.',
  PAYROLL_ADJUSTMENT_UNRESOLVED:
    'An approved attendance correction could not be priced against its source payroll line. Review it before approving.',
  PAYROLL_HOLD_ACTIVE:
    'An active payment hold must be released before the run can be marked paid.',
  INVALID_BANK_DETAILS:
    'Bank details are missing or invalid for one or more staff. Fix the staff record, then export again.',
  PAYROLL_ADJUSTMENT_RUN_LOCKED:
    'Adjustments are frozen once the run is approved or finalized.',
};

export function payrollBlockerCopy(code: string): string | null {
  return BLOCKER_COPY[code] ?? null;
}

export function holdReasonValid(reason: string) {
  const trimmed = reason.trim();
  return trimmed.length >= 3 && trimmed.length <= 500;
}
