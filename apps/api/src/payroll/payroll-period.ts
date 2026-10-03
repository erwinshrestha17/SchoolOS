import { BadRequestException } from '@nestjs/common';
import {
  formatPayrollPeriodLabel,
  isBsPayrollPeriodLabel,
  PayrollPeriodError,
  resolvePayrollPeriod,
} from '@schoolos/core';

/**
 * Phase 7.9: the one place the API turns a payroll period label into bounds.
 *
 * New periods are BS months resolved by the core calendar (see
 * packages/core/src/payroll-period.ts). A run that already exists is read from
 * its own stored bounds, never re-derived from its label, so runs created
 * before 7.9 (Gregorian-month labels) are never reinterpreted.
 *
 * `startsOn` is the first day at 00:00:00.000 UTC and `endsOn` the last day at
 * 23:59:59.999 UTC — the convention every payroll query, attendance lock and
 * accounting entry date already uses for Nepal-local business dates.
 */
export interface PayrollPeriodWindow {
  year: number;
  month: number;
  label: string;
  startsOn: Date;
  endsOn: Date;
  startsOnIso: string;
  endsOnIso: string;
  calendarDays: number;
  bs: boolean;
}

const DAY_MS = 86_400_000;

function endOfDay(iso: string) {
  return new Date(Date.parse(`${iso}T00:00:00.000Z`) + DAY_MS - 1);
}

/** Resolves a BS payroll month; rejects anything that is not a valid one. */
export function payrollPeriodFor(
  year: number,
  month: number,
): PayrollPeriodWindow {
  try {
    const bounds = resolvePayrollPeriod(year, month);
    return {
      year,
      month,
      label: bounds.label,
      startsOn: new Date(`${bounds.startsOn}T00:00:00.000Z`),
      endsOn: endOfDay(bounds.endsOn),
      startsOnIso: bounds.startsOn,
      endsOnIso: bounds.endsOn,
      calendarDays: bounds.calendarDays,
      bs: true,
    };
  } catch (error) {
    if (error instanceof PayrollPeriodError)
      throw new BadRequestException({
        code: error.code,
        message: error.message,
      });
    throw error;
  }
}

/** The authoritative window of an existing run: its stored bounds. */
export function payrollPeriodOfRun(run: {
  periodYear: number;
  periodMonth: number;
  periodStart: Date;
  periodEnd: Date;
}): PayrollPeriodWindow {
  const startsOnIso = run.periodStart.toISOString().slice(0, 10);
  const endsOnIso = run.periodEnd.toISOString().slice(0, 10);
  return {
    year: run.periodYear,
    month: run.periodMonth,
    label: formatPayrollPeriodLabel(run.periodYear, run.periodMonth),
    startsOn: run.periodStart,
    endsOn: run.periodEnd,
    startsOnIso,
    endsOnIso,
    calendarDays:
      Math.round(
        (Date.parse(`${endsOnIso}T00:00:00Z`) -
          Date.parse(`${startsOnIso}T00:00:00Z`)) /
          DAY_MS,
      ) + 1,
    bs: isBsPayrollPeriodLabel(run.periodYear),
  };
}

/**
 * The window for a (year, month) a caller names. When a live or historical
 * run already exists for the label, its stored bounds win; otherwise the
 * label must be a valid BS month.
 */
export function payrollPeriodForLabel(
  year: number,
  month: number,
  existingRun?: {
    periodYear: number;
    periodMonth: number;
    periodStart: Date;
    periodEnd: Date;
  } | null,
): PayrollPeriodWindow {
  return existingRun
    ? payrollPeriodOfRun(existingRun)
    : payrollPeriodFor(year, month);
}
