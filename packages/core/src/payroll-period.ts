import {
  BS_CALENDAR_MAX_YEAR,
  BS_MONTH_NAMES_EN,
  daysInBsMonth,
  shiftGregorianDateOnly,
  toBsDateFromGregorian,
  toGregorianDateFromBs,
} from "./nepal-date.js";

/**
 * Phase 7.9: the single authority for what a Nepali payroll period is.
 *
 * A payroll period is one Bikram Sambat month. Its Gregorian start and end
 * dates are derived once, here, from the canonical BS calendar table in
 * `nepal-date.ts` (no second converter exists) and are stored on the payroll
 * run as authoritative bounds. They are Nepal-local business dates
 * (YYYY-MM-DD), never instants, so the result does not depend on the server
 * time zone.
 *
 * `periodYear`/`periodMonth` on a run are the BS year and month. Payroll BS
 * years start at `PAYROLL_BS_MIN_YEAR`; runs created before 7.9 carry
 * Gregorian labels (years below that floor) and are never reinterpreted: their
 * stored bounds stay authoritative and the labels stay disjoint from BS ones.
 */
export const PAYROLL_BS_MIN_YEAR = 2075;
export const PAYROLL_BS_MAX_YEAR = BS_CALENDAR_MAX_YEAR;

export interface PayrollPeriodBounds {
  /** BS year (e.g. 2083). */
  bsYear: number;
  /** BS month, 1 = Baisakh … 12 = Chaitra. */
  bsMonth: number;
  /** e.g. "Ashwin 2083". */
  label: string;
  /** Inclusive Gregorian business dates, YYYY-MM-DD. */
  startsOn: string;
  endsOn: string;
  /** Inclusive BS dates, YYYY-MM-DD. */
  startsOnBs: string;
  endsOnBs: string;
  /** Number of calendar days in the period (29–32). */
  calendarDays: number;
}

export type PayrollPeriodErrorCode =
  | "PAYROLL_PERIOD_INVALID_MONTH"
  | "PAYROLL_PERIOD_YEAR_OUT_OF_RANGE"
  | "PAYROLL_PERIOD_DATE_OUT_OF_RANGE";

export class PayrollPeriodError extends Error {
  constructor(
    readonly code: PayrollPeriodErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PayrollPeriodError";
  }
}

function pad(value: number, width = 2) {
  return String(value).padStart(width, "0");
}

function bsIso(year: number, month: number, day: number) {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

function gregorianIso(value: { year: number; month: number; day: number }) {
  return `${pad(value.year, 4)}-${pad(value.month)}-${pad(value.day)}`;
}

/** Resolves a BS payroll month to its authoritative Gregorian bounds. */
export function resolvePayrollPeriod(
  bsYear: number,
  bsMonth: number,
): PayrollPeriodBounds {
  if (!Number.isInteger(bsMonth) || bsMonth < 1 || bsMonth > 12) {
    throw new PayrollPeriodError(
      "PAYROLL_PERIOD_INVALID_MONTH",
      "A payroll period month must be a whole BS month between 1 (Baisakh) and 12 (Chaitra).",
    );
  }
  if (
    !Number.isInteger(bsYear) ||
    bsYear < PAYROLL_BS_MIN_YEAR ||
    bsYear > PAYROLL_BS_MAX_YEAR
  ) {
    throw new PayrollPeriodError(
      "PAYROLL_PERIOD_YEAR_OUT_OF_RANGE",
      `A payroll period year must be a BS year between ${PAYROLL_BS_MIN_YEAR} and ${PAYROLL_BS_MAX_YEAR}.`,
    );
  }
  const calendarDays = daysInBsMonth(bsYear, bsMonth);
  const start = toGregorianDateFromBs({
    year: bsYear,
    month: bsMonth,
    day: 1,
  });
  const end = toGregorianDateFromBs({
    year: bsYear,
    month: bsMonth,
    day: calendarDays,
  });
  return {
    bsYear,
    bsMonth,
    label: `${BS_MONTH_NAMES_EN[bsMonth - 1]} ${bsYear}`,
    startsOn: gregorianIso(start),
    endsOn: gregorianIso(end),
    startsOnBs: bsIso(bsYear, bsMonth, 1),
    endsOnBs: bsIso(bsYear, bsMonth, calendarDays),
    calendarDays,
  };
}

/** The BS payroll period that contains a Gregorian business date. */
export function findPayrollPeriodContaining(
  gregorianDate: string,
): PayrollPeriodBounds {
  let bs;
  try {
    bs = toBsDateFromGregorian(gregorianDate);
  } catch {
    throw new PayrollPeriodError(
      "PAYROLL_PERIOD_DATE_OUT_OF_RANGE",
      "The date is outside the supported BS payroll calendar.",
    );
  }
  return resolvePayrollPeriod(bs.year, bs.month);
}

/** The BS payroll period immediately after the given one. */
export function nextPayrollPeriod(
  period: Pick<PayrollPeriodBounds, "endsOn">,
): PayrollPeriodBounds {
  return findPayrollPeriodContaining(shiftGregorianDateOnly(period.endsOn, 1));
}

/** True when a stored run label is a BS label rather than a pre-7.9 Gregorian one. */
export function isBsPayrollPeriodLabel(year: number): boolean {
  return year >= PAYROLL_BS_MIN_YEAR;
}

/** Human label for a stored run label, e.g. "Ashwin 2083" or legacy "2026-09". */
export function formatPayrollPeriodLabel(year: number, month: number): string {
  if (isBsPayrollPeriodLabel(year) && month >= 1 && month <= 12) {
    return `${BS_MONTH_NAMES_EN[month - 1]} ${year}`;
  }
  return `${year}-${pad(month)}`;
}
