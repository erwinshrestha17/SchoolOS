import { StaffEmploymentStatus, type Prisma } from '@prisma/client';

/**
 * Phase 7.1 — StaffEmployment is the single authority for "employed on day X".
 *
 * An employment is *authoritative* only after the maker-checker review: it
 * must carry `verifiedAt` and be VERIFIED (current) or ENDED (historical).
 * PENDING and REJECTED rows are never evidence of employment. A Teacher role,
 * a StaffContract window or Staff.status alone is not employment evidence
 * either; those remain supporting terms.
 *
 * Windows are half-open [effectiveFrom, effectiveTo) on UTC calendar days, the
 * same convention the database EXCLUDE constraint
 * (StaffEmployment_no_authoritative_overlap) enforces.
 */
export const AUTHORITATIVE_EMPLOYMENT_STATUSES = [
  StaffEmploymentStatus.VERIFIED,
  StaffEmploymentStatus.ENDED,
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface EmploymentWindow {
  id: string;
  staffId: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

/** Prisma `where` selecting authoritative employments touching [start, end]. */
export function authoritativeEmploymentWhere(
  tenantId: string,
  period: { startsOn: Date; endsOn: Date },
  staffIds?: string[],
): Prisma.StaffEmploymentWhereInput {
  return {
    tenantId,
    ...(staffIds ? { staffId: { in: staffIds } } : {}),
    verifiedAt: { not: null },
    status: { in: [...AUTHORITATIVE_EMPLOYMENT_STATUSES] },
    effectiveFrom: { lte: period.endsOn },
    OR: [{ effectiveTo: null }, { effectiveTo: { gt: period.startsOn } }],
  };
}

function utcDay(value: Date): number {
  return Math.floor(value.getTime() / DAY_MS);
}

/**
 * Calendar days of the period (inclusive of the last day) that fall inside the
 * employment window. Used to cap payable days for staff who joined or left
 * mid-period.
 */
export function employedDaysInPeriod(
  windows: Array<Pick<EmploymentWindow, 'effectiveFrom' | 'effectiveTo'>>,
  period: { startsOn: Date; endsOn: Date },
): number {
  const first = utcDay(period.startsOn);
  const last = utcDay(period.endsOn);
  let days = 0;
  for (let day = first; day <= last; day += 1) {
    const inside = windows.some(
      (window) =>
        utcDay(window.effectiveFrom) <= day &&
        (window.effectiveTo === null || day < utcDay(window.effectiveTo)),
    );
    if (inside) days += 1;
  }
  return days;
}

export function calendarDaysInPeriod(period: {
  startsOn: Date;
  endsOn: Date;
}): number {
  return utcDay(period.endsOn) - utcDay(period.startsOn) + 1;
}

/** Group by staff, ordered latest start first. */
export function groupEmploymentsByStaff<T extends EmploymentWindow>(
  rows: T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const list = grouped.get(row.staffId) ?? [];
    list.push(row);
    grouped.set(row.staffId, list);
  }
  for (const list of grouped.values()) {
    list.sort(
      (a, b) =>
        b.effectiveFrom.getTime() - a.effectiveFrom.getTime() ||
        a.id.localeCompare(b.id),
    );
  }
  return grouped;
}
