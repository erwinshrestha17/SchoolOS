import {
  LeaveDayPart,
  LeaveRequestStatus,
  type Prisma,
  TeacherDelegationStatus,
  TimetableSubstitutionStatus,
  TimetableVersionStatus,
} from '@prisma/client';
import { eachLeaveDate } from '../hr/staff-leave-policy';
import {
  liveTimetableSlotWhere,
  toTimetableDayOfWeek,
} from './timetable-calendar';

/**
 * Phase 7.6 — durable academic coverage for staff leave.
 *
 * Coverage drafts are written in the same transaction that approves the leave
 * (or publishes a timetable), linked to the leave by `leaveRequestId`. The
 * former post-commit `staff.leave.approved` handler could be lost on a crash
 * and froze coverage at approval time. Plain functions taking a transaction
 * client keep this usable from HR (approval/cancel) and timetable (publish)
 * without a module cycle.
 */

type Client = Prisma.TransactionClient;

/** Post-commit, best-effort notification of cover cancelled with a leave. */
export const LEAVE_COVER_CANCELLED_EVENT = 'timetable.substitutions.cancelled';

export interface CoverageLeave {
  id: string;
  tenantId: string;
  staffId: string;
  startsOn: Date;
  endsOn: Date;
  dayPart: LeaveDayPart;
}

export interface RequiredCover {
  date: Date;
  slot: {
    id: string;
    dayOfWeek: number;
    startsAt: string;
    endsAt: string;
    classId: string;
    sectionId: string | null;
    subjectId: string;
  };
}

const OPEN_STATUSES = [
  TimetableSubstitutionStatus.DRAFT,
  TimetableSubstitutionStatus.ASSIGNED,
];

const LIVE_VERSION_STATUSES: TimetableVersionStatus[] = [
  TimetableVersionStatus.PUBLISHED,
  TimetableVersionStatus.LOCKED,
];

function minutes(time: string): number {
  const [hours, mins] = time.split(':').map((part) => Number(part));
  return (hours || 0) * 60 + (mins || 0);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function coverKey(slotId: string, date: Date): string {
  return `${slotId}@${dayKey(date)}`;
}

/**
 * Half-day boundary for one school day: the midpoint between the first period
 * start and the last period end across the school's live timetable that day.
 * A period belongs to the half in which it starts. Derived from the published
 * timetable, so no school-day setting has to be invented.
 */
async function halfDayBoundary(
  client: Client,
  tenantId: string,
  date: Date,
): Promise<number | null> {
  const slots = await client.timetableSlot.findMany({
    where: {
      tenantId,
      dayOfWeek: toTimetableDayOfWeek(date),
      ...liveTimetableSlotWhere(date),
    },
    select: { startsAt: true, endsAt: true },
  });
  if (!slots.length) return null;
  const first = Math.min(...slots.map((slot) => minutes(slot.startsAt)));
  const last = Math.max(...slots.map((slot) => minutes(slot.endsAt)));
  return (first + last) / 2;
}

/**
 * Every live (slot, date) the absent teacher would have taught during the
 * leave, optionally from `fromDate` on. Liveness mirrors
 * `liveTimetableSlotWhere`: published/locked version in its effective window
 * and the date inside the slot's academic year.
 */
export async function requiredLeaveCover(
  client: Client,
  leave: CoverageLeave,
  fromDate?: Date,
): Promise<RequiredCover[]> {
  const start =
    fromDate && fromDate > leave.startsOn ? fromDate : leave.startsOn;
  if (start > leave.endsOn) return [];
  const slots = await client.timetableSlot.findMany({
    where: {
      tenantId: leave.tenantId,
      staffId: leave.staffId,
      academicYear: {
        startsOn: { lte: leave.endsOn },
        endsOn: { gte: start },
      },
      OR: [
        { versionId: null },
        {
          version: {
            status: { in: LIVE_VERSION_STATUSES },
            effectiveFrom: { lte: leave.endsOn },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
          },
        },
      ],
    },
    select: {
      id: true,
      dayOfWeek: true,
      startsAt: true,
      endsAt: true,
      classId: true,
      sectionId: true,
      subjectId: true,
      academicYear: { select: { startsOn: true, endsOn: true } },
      version: { select: { effectiveFrom: true, effectiveTo: true } },
    },
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
  });

  const required: RequiredCover[] = [];
  for (const date of eachLeaveDate(start, leave.endsOn)) {
    const dayOfWeek = toTimetableDayOfWeek(date);
    const live = slots.filter(
      (slot) =>
        slot.dayOfWeek === dayOfWeek &&
        slot.academicYear.startsOn <= date &&
        slot.academicYear.endsOn >= date &&
        (!slot.version ||
          (slot.version.effectiveFrom <= date &&
            (slot.version.effectiveTo === null ||
              slot.version.effectiveTo >= date))),
    );
    if (!live.length) continue;
    let inScope = live;
    if (leave.dayPart !== LeaveDayPart.FULL_DAY) {
      const boundary = await halfDayBoundary(client, leave.tenantId, date);
      inScope =
        boundary === null
          ? []
          : live.filter((slot) =>
              leave.dayPart === LeaveDayPart.FIRST_HALF
                ? minutes(slot.startsAt) < boundary
                : minutes(slot.startsAt) >= boundary,
            );
    }
    for (const slot of inScope) {
      required.push({
        date,
        slot: {
          id: slot.id,
          dayOfWeek: slot.dayOfWeek,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          classId: slot.classId,
          sectionId: slot.sectionId,
          subjectId: slot.subjectId,
        },
      });
    }
  }
  return required;
}

/**
 * Makes the leave's coverage match the timetable: creates a DRAFT for every
 * required (slot, date) that has no open substitution, and cancels leave
 * DRAFTs (never ASSIGNED cover) whose period is no longer in force.
 */
export async function syncLeaveCover(
  client: Client,
  leave: CoverageLeave,
  actorUserId: string,
  fromDate?: Date,
): Promise<{ created: string[]; cancelled: string[] }> {
  const required = await requiredLeaveCover(client, leave, fromDate);
  const start =
    fromDate && fromDate > leave.startsOn ? fromDate : leave.startsOn;
  const requiredKeys = new Set(
    required.map(({ slot, date }) => coverKey(slot.id, date)),
  );

  const open = await client.timetableSubstitution.findMany({
    where: {
      tenantId: leave.tenantId,
      date: { gte: start, lte: leave.endsOn },
      status: { in: OPEN_STATUSES },
      OR: [
        { leaveRequestId: leave.id },
        { timetableSlotId: { in: required.map(({ slot }) => slot.id) } },
      ],
    },
    select: {
      id: true,
      timetableSlotId: true,
      date: true,
      status: true,
      leaveRequestId: true,
      substituteTeacherId: true,
    },
  });
  const openKeys = new Set(
    open.map((row) => coverKey(row.timetableSlotId, row.date)),
  );

  const created: string[] = [];
  for (const { slot, date } of required) {
    if (openKeys.has(coverKey(slot.id, date))) continue;
    const row = await client.timetableSubstitution.create({
      data: {
        tenantId: leave.tenantId,
        timetableSlotId: slot.id,
        absentTeacherId: leave.staffId,
        substituteTeacherId: null,
        date,
        reason: `Approved leave request ${leave.id}`,
        status: TimetableSubstitutionStatus.DRAFT,
        createdById: actorUserId,
        leaveRequestId: leave.id,
      },
      select: { id: true },
    });
    created.push(row.id);
  }

  const stale = open.filter(
    (row) =>
      row.leaveRequestId === leave.id &&
      row.status === TimetableSubstitutionStatus.DRAFT &&
      row.substituteTeacherId === null &&
      !requiredKeys.has(coverKey(row.timetableSlotId, row.date)),
  );
  if (stale.length) {
    await client.timetableSubstitution.updateMany({
      where: { id: { in: stale.map((row) => row.id) } },
      data: {
        status: TimetableSubstitutionStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason:
          'Timetable changed: this period is no longer taught by the teacher on leave',
      },
    });
  }
  return { created, cancelled: stale.map((row) => row.id) };
}

/**
 * Cancels every open substitution linked to a leave (and revokes the temporary
 * delegations of assigned cover). Returns the cancelled ids for notification.
 */
export async function cancelLeaveCover(
  client: Client,
  tenantId: string,
  leaveRequestId: string,
  actorUserId: string,
  reason: string,
): Promise<string[]> {
  const open = await client.timetableSubstitution.findMany({
    where: {
      tenantId,
      leaveRequestId,
      status: { in: OPEN_STATUSES },
    },
    select: { id: true },
  });
  const ids = open.map((row) => row.id);
  if (!ids.length) return [];
  const now = new Date();
  await client.teacherDelegation.updateMany({
    where: {
      tenantId,
      timetableSubstitutionId: { in: ids },
      status: TeacherDelegationStatus.ACTIVE,
    },
    data: {
      status: TeacherDelegationStatus.REVOKED,
      revokedAt: now,
      revokedById: actorUserId,
    },
  });
  await client.timetableSubstitution.updateMany({
    where: { id: { in: ids } },
    data: {
      status: TimetableSubstitutionStatus.CANCELLED,
      cancelledAt: now,
      cancellationReason: reason,
    },
  });
  return ids;
}

/**
 * Timetable publication: approved leave whose dates fall inside the newly
 * published window gets cover for the new slots, and stale leave drafts are
 * cancelled. Only today onwards is reconciled.
 */
export async function reconcileLeaveCoverForWindow(
  client: Client,
  tenantId: string,
  window: { from: Date; to: Date | null },
  today: Date,
  actorUserId: string,
): Promise<{ created: number; cancelled: number }> {
  const from = window.from > today ? window.from : today;
  if (window.to && window.to < from) return { created: 0, cancelled: 0 };
  const leaves = await client.staffLeaveRequest.findMany({
    where: {
      tenantId,
      status: LeaveRequestStatus.APPROVED,
      endsOn: { gte: from },
      ...(window.to ? { startsOn: { lte: window.to } } : {}),
    },
    select: {
      id: true,
      tenantId: true,
      staffId: true,
      startsOn: true,
      endsOn: true,
      dayPart: true,
    },
    orderBy: [{ startsOn: 'asc' }, { id: 'asc' }],
  });
  let created = 0;
  let cancelled = 0;
  for (const leave of leaves) {
    const result = await syncLeaveCover(client, leave, actorUserId, from);
    created += result.created.length;
    cancelled += result.cancelled.length;
  }
  return { created, cancelled };
}

export { coverKey as leaveCoverKey, dayKey as leaveCoverDayKey };
