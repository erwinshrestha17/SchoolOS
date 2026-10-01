import { TimetableVersionStatus, type Prisma } from '@prisma/client';
import { getNepalSchoolDay } from '@schoolos/core';

/**
 * ISO weekday (Mon=1 … Sun=7) of the Nepal school day containing `date`.
 *
 * Timetable days are Nepal calendar days. Using the server's local weekday
 * (`Date#getDay`) is wrong on a UTC host between 00:00 and 05:45 NPT, when
 * the UTC date is still the previous day.
 */
export function toTimetableDayOfWeek(date: Date): number {
  const { gregorianDate } = getNepalSchoolDay(date);
  const jsDay = new Date(`${gregorianDate}T00:00:00.000Z`).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * Canonical "which timetable slots are in force on this school day" filter.
 *
 * A slot is live only when its version is PUBLISHED or LOCKED, the school day
 * lies inside the version's effective window, and the day lies inside the
 * slot's academic year. Drafts, archived versions, future-dated versions and
 * previous-year slots never leak into operational views (Teacher Today, HR
 * coverage, principal walkthroughs, parent timetable).
 *
 * Legacy slots without a version keep their historical behaviour but are
 * still bounded by their academic year.
 */
export function liveTimetableSlotWhere(
  onDate: Date = new Date(),
): Prisma.TimetableSlotWhereInput {
  const day = new Date(
    `${getNepalSchoolDay(onDate).gregorianDate}T00:00:00.000Z`,
  );
  const academicYear = {
    startsOn: { lte: day },
    endsOn: { gte: day },
  };
  return {
    academicYear,
    OR: [
      { versionId: null },
      {
        version: {
          status: {
            in: [
              TimetableVersionStatus.PUBLISHED,
              TimetableVersionStatus.LOCKED,
            ],
          },
          effectiveFrom: { lte: day },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: day } }],
        },
      },
    ],
  };
}

/** The version-level counterpart of {@link liveTimetableSlotWhere}. */
export function liveTimetableVersionWhere(
  onDate: Date = new Date(),
): Prisma.TimetableVersionWhereInput {
  const day = new Date(
    `${getNepalSchoolDay(onDate).gregorianDate}T00:00:00.000Z`,
  );
  return {
    status: {
      in: [TimetableVersionStatus.PUBLISHED, TimetableVersionStatus.LOCKED],
    },
    effectiveFrom: { lte: day },
    AND: [
      { OR: [{ effectiveTo: null }, { effectiveTo: { gte: day } }] },
      { academicYear: { startsOn: { lte: day }, endsOn: { gte: day } } },
    ],
  };
}
