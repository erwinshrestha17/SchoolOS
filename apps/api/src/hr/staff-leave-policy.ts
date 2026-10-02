import { BadRequestException } from '@nestjs/common';
import { LeaveDayPart, Prisma } from '@prisma/client';
import { getNepalSchoolDay } from '@schoolos/core';

/**
 * Phase 7.6 — the one definition of the leave rules every leave path uses
 * (HR, attendance, staff self-service, reports). Previously each path carried
 * its own copy and they disagreed: approval counted allocated + carried - used
 * while the self-service balance also counted opening, accrued and adjusted
 * days, so a balance the employee could see was not the balance approval used.
 */

const UNPAID_LEAVE_TYPES = new Set(['UNPAID', 'LWP']);

export function normalizeLeaveType(leaveType: string): string {
  return leaveType.trim().toUpperCase().replace(/\s+/g, '_');
}

function titleCaseLeaveType(normalized: string): string {
  return normalized
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Spellings under which a balance row for this leave type may be stored. */
export function leaveTypeAliases(leaveType: string): string[] {
  const normalized = normalizeLeaveType(leaveType);
  return Array.from(
    new Set([normalized, titleCaseLeaveType(normalized), leaveType.trim()]),
  );
}

export function isUnpaidLeaveType(leaveType: string): boolean {
  return UNPAID_LEAVE_TYPES.has(normalizeLeaveType(leaveType));
}

export interface LeaveBalanceAmounts {
  opening: Prisma.Decimal;
  accrued: Prisma.Decimal;
  allocated: Prisma.Decimal;
  carried: Prisma.Decimal;
  adjusted: Prisma.Decimal;
  used: Prisma.Decimal;
}

/** Canonical available days: every credit on the balance minus days used. */
export function availableLeaveDays(
  balance: LeaveBalanceAmounts,
): Prisma.Decimal {
  return balance.opening
    .add(balance.accrued)
    .add(balance.allocated)
    .add(balance.carried)
    .add(balance.adjusted)
    .sub(balance.used);
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Leave dates are school calendar days, stored as UTC midnight of the Nepal
 * date (the convention attendance and timetable substitutions already use).
 * A bare `YYYY-MM-DD` is taken literally; an instant is mapped to its Nepal
 * school day, so `2026-10-05T00:00:00+05:45` is 5 October, not 4 October.
 */
export function parseLeaveDate(input: string, field: string): Date {
  const text = input.trim();
  if (DATE_ONLY.test(text)) {
    const date = new Date(`${text}T00:00:00.000Z`);
    if (!Number.isNaN(date.getTime())) return date;
  } else {
    const instant = new Date(text);
    if (!Number.isNaN(instant.getTime())) {
      return new Date(
        `${getNepalSchoolDay(instant).gregorianDate}T00:00:00.000Z`,
      );
    }
  }
  throw new BadRequestException(`${field} must be a valid date`);
}

const DAY_MS = 86_400_000;

/** Inclusive calendar days, or 0.5 for a half-day request. */
export function leaveDayCount(
  startsOn: Date,
  endsOn: Date,
  dayPart: LeaveDayPart,
): Prisma.Decimal {
  if (dayPart !== LeaveDayPart.FULL_DAY) return new Prisma.Decimal('0.5');
  return new Prisma.Decimal(
    Math.round((endsOn.getTime() - startsOn.getTime()) / DAY_MS) + 1,
  );
}

/** Each school day of the leave, as UTC-midnight dates. */
export function eachLeaveDate(startsOn: Date, endsOn: Date): Date[] {
  const dates: Date[] = [];
  for (
    let time = startsOn.getTime();
    time <= endsOn.getTime();
    time += DAY_MS
  ) {
    dates.push(new Date(time));
  }
  return dates;
}

export function validateLeaveShape(input: {
  startsOn: Date;
  endsOn: Date;
  dayPart: LeaveDayPart;
}) {
  if (input.endsOn < input.startsOn) {
    throw new BadRequestException('Leave end date cannot be before start date');
  }
  if (
    input.dayPart !== LeaveDayPart.FULL_DAY &&
    input.startsOn.getTime() !== input.endsOn.getTime()
  ) {
    throw new BadRequestException(
      'A half-day leave request must start and end on the same day',
    );
  }
}
