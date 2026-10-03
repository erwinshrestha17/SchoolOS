import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AttendanceStatus,
  LeaveDayPart,
  LeaveRequestStatus,
  PayrollRunStatus,
  Prisma,
  StaffLifecycleEventType,
  StaffStatus,
  TimetableSubstitutionStatus,
  type StaffLeaveRequest,
} from '@prisma/client';
import { getNepalSchoolDay } from '@schoolos/core';
import type { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { withSchoolAuthorizationTransaction } from '../auth/school-authorization-transaction';
import {
  hasDomainPermission,
  requireIndependentActor,
} from '../authorization/policies/domain-permission';
import type { PrismaService } from '../prisma/prisma.service';
import {
  LEAVE_COVER_CANCELLED_EVENT,
  cancelLeaveCover,
  leaveCoverKey,
  requiredLeaveCover,
  syncLeaveCover,
  type CoverageLeave,
} from '../timetable/leave-coverage';
import {
  liveTimetableSlotWhere,
  toTimetableDayOfWeek,
} from '../timetable/timetable-calendar';
import {
  authoritativeEmploymentWhere,
  calendarDaysInPeriod,
  employedDaysInPeriod,
} from './employment-timeline';
import {
  availableLeaveDays,
  eachLeaveDate,
  isUnpaidLeaveType,
  leaveDayCount,
  leaveTypeAliases,
  normalizeLeaveType,
  parseLeaveDate,
  validateLeaveShape,
} from './staff-leave-policy';

type Client = Prisma.TransactionClient;

export interface CreateLeaveInput {
  staffId: string;
  leaveType: string;
  startsOn: string;
  endsOn: string;
  reason: string;
  dayPart?: LeaveDayPart;
  isPaid?: boolean;
}

export interface LeaveCoverItem {
  date: string;
  slotId: string;
  startsAt: string;
  endsAt: string;
  className: string | null;
  sectionName: string | null;
  subjectName: string | null;
  coverage: 'UNCOVERED' | 'DRAFT' | 'ASSIGNED';
  substitutionId: string | null;
  substituteName: string | null;
  /** Timetabled teachers free at that time; null when not computed. */
  freeTeacherCount: number | null;
}

export interface ReviewLeaveInput {
  status: 'APPROVED' | 'REJECTED';
  reviewNote?: string | null;
}

/**
 * Payroll runs whose inputs are fixed. Approval and cancellation write staff
 * attendance even for paid leave, so both must preserve finalized history.
 * Historical changes must go through an attendance correction/adjustment.
 */
const FIXED_PAYROLL_STATUSES: PayrollRunStatus[] = [
  PayrollRunStatus.APPROVED,
  PayrollRunStatus.FINALIZED,
  PayrollRunStatus.POSTED,
  PayrollRunStatus.PAID,
];

const IMPACT_PREVIEW_MAX_DAYS = 31;

/** Who may file, view, withdraw or cancel leave on behalf of other staff. */
export function canManageStaffLeave(actor: AuthContext): boolean {
  return (
    hasDomainPermission(actor, 'hr:leave:approve') ||
    hasDomainPermission(actor, 'hr:manage') ||
    hasDomainPermission(actor, 'hr:staff:update')
  );
}

function leaveConflict(code: string, message: string) {
  return new ConflictException({ code, message });
}

function isLeaveOverlapViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('StaffLeaveRequest_no_active_overlap')
  );
}

function rethrowLeaveOverlap(error: unknown): never {
  if (isLeaveOverlapViolation(error)) {
    throw leaveConflict(
      'LEAVE_OVERLAP',
      'A pending or approved leave request already overlaps this date range',
    );
  }
  throw error;
}

function toCoverageLeave(leave: StaffLeaveRequest): CoverageLeave {
  return {
    id: leave.id,
    tenantId: leave.tenantId,
    staffId: leave.staffId,
    startsOn: leave.startsOn,
    endsOn: leave.endsOn,
    dayPart: leave.dayPart,
  };
}

function schoolToday(): Date {
  return new Date(`${getNepalSchoolDay().gregorianDate}T00:00:00.000Z`);
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function minutes(time: string): number {
  const [hours, mins] = time.split(':').map((part) => Number(part));
  return (hours || 0) * 60 + (mins || 0);
}

/**
 * Phase 7.6 — the single staff-leave workflow behind every route (HR,
 * attendance, staff self-service). Approval is one transaction: live actor and
 * session re-check, compare-and-set on PENDING, employment window, payroll
 * period guard, balance debited by an atomic row update and re-checked,
 * attendance, lifecycle, audit and timetable cover. The database EXCLUDE
 * constraint is the final word on overlapping leave.
 */
export class StaffLeaveWorkflow {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly events?: EventEmitter2,
  ) {}

  async create(input: CreateLeaveInput, actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: input.staffId, tenantId: actor.tenantId },
      select: { id: true, userId: true, status: true },
    });
    if (!staff) {
      throw new NotFoundException('Staff not found in this tenant');
    }
    if (staff.userId !== actor.userId && !canManageStaffLeave(actor)) {
      throw new ForbiddenException(
        'You cannot create leave requests for another staff member',
      );
    }
    if (
      staff.status === StaffStatus.TERMINATED ||
      staff.status === StaffStatus.RESIGNED
    ) {
      throw leaveConflict(
        'STAFF_INACTIVE',
        'Inactive staff cannot request leave',
      );
    }
    const reason = input.reason?.trim();
    if (!reason) {
      throw new BadRequestException('A reason is required for leave');
    }

    const dayPart = input.dayPart ?? LeaveDayPart.FULL_DAY;
    const startsOn = parseLeaveDate(input.startsOn, 'startsOn');
    const endsOn = parseLeaveDate(input.endsOn, 'endsOn');
    validateLeaveShape({ startsOn, endsOn, dayPart });
    const leaveType = normalizeLeaveType(input.leaveType);
    if (!leaveType) {
      throw new BadRequestException('A leave type is required');
    }
    const isPaid = isUnpaidLeaveType(leaveType)
      ? false
      : (input.isPaid ?? true);
    const days = leaveDayCount(startsOn, endsOn, dayPart);

    await this.assertEmployedThroughout(
      this.prisma,
      actor.tenantId,
      staff.id,
      startsOn,
      endsOn,
    );
    if (isPaid) {
      const available = await this.availableBalance(
        this.prisma,
        actor.tenantId,
        staff.id,
        leaveType,
        startsOn.getUTCFullYear(),
      );
      if (available.lt(days)) {
        throw leaveConflict(
          'LEAVE_BALANCE_INSUFFICIENT',
          `Insufficient ${leaveType} leave balance for the requested ${days.toString()} day(s)`,
        );
      }
    }

    const leave = await this.prisma.staffLeaveRequest
      .create({
        data: {
          tenantId: actor.tenantId,
          staffId: staff.id,
          leaveType,
          isPaid,
          startsOn,
          endsOn,
          days,
          dayPart,
          reason,
          status: LeaveRequestStatus.PENDING,
        },
      })
      .catch(rethrowLeaveOverlap);

    await this.auditService.record({
      action: staff.userId === actor.userId ? 'self_request' : 'create',
      resource: 'staff_leave_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: leave.id,
      after: {
        staffId: staff.id,
        leaveType,
        isPaid,
        startsOn: dateOnly(startsOn),
        endsOn: dateOnly(endsOn),
        dayPart,
        days: days.toString(),
      },
    });
    return leave;
  }

  async review(
    leaveRequestId: string,
    input: ReviewLeaveInput,
    actor: AuthContext,
  ) {
    if (input.status !== 'APPROVED' && input.status !== 'REJECTED') {
      throw new BadRequestException('Leave review must approve or reject');
    }
    const reviewNote = input.reviewNote?.trim() || null;
    if (input.status === 'REJECTED' && !reviewNote) {
      throw new BadRequestException(
        'A review note is required when rejecting a leave request',
      );
    }
    // The permission the decision is re-authorized against, live, inside
    // the transaction (both existing routes stay valid).
    const permission = hasDomainPermission(actor, 'hr:leave:approve')
      ? 'hr:leave:approve'
      : 'hr:manage';

    const result = await withSchoolAuthorizationTransaction(
      this.prisma,
      actor,
      permission,
      [],
      async (tx) => {
        const leave = await tx.staffLeaveRequest.findFirst({
          where: { id: leaveRequestId, tenantId: actor.tenantId },
          include: { staff: { select: { userId: true, status: true } } },
        });
        if (!leave) {
          throw new NotFoundException('Leave request not found in this tenant');
        }
        if (input.status === 'APPROVED') {
          requireIndependentActor(actor, [leave.staff.userId]);
        }

        const claimed = await tx.staffLeaveRequest.updateMany({
          where: {
            id: leave.id,
            tenantId: actor.tenantId,
            status: LeaveRequestStatus.PENDING,
          },
          data: {
            status: input.status,
            reviewedById: actor.userId,
            reviewedAt: new Date(),
            reviewNote,
          },
        });
        if (claimed.count !== 1) {
          throw leaveConflict(
            'LEAVE_REQUEST_STALE',
            'This leave request was already reviewed or withdrawn. Refresh and try again.',
          );
        }
        const reviewed = await tx.staffLeaveRequest.findUniqueOrThrow({
          where: { id: leave.id },
        });

        let overlapAnomalies: Array<{
          date: string;
          existingStatus: AttendanceStatus;
        }> = [];
        let coverage = { created: 0 };
        if (input.status === 'APPROVED') {
          if (
            leave.staff.status === StaffStatus.TERMINATED ||
            leave.staff.status === StaffStatus.RESIGNED
          ) {
            throw leaveConflict(
              'STAFF_INACTIVE',
              'Cannot approve leave for a staff member who is no longer active',
            );
          }
          await this.assertEmployedThroughout(
            tx,
            actor.tenantId,
            reviewed.staffId,
            reviewed.startsOn,
            reviewed.endsOn,
          );
          await this.assertPayrollUnaffected(tx, reviewed, 'approve');
          if (reviewed.isPaid) {
            await this.debitBalance(tx, reviewed);
            if (reviewed.dayPart === LeaveDayPart.FULL_DAY) {
              overlapAnomalies = await this.markLeaveAttendance(
                tx,
                reviewed,
                actor.userId,
              );
            }
          }
          await tx.staffLifecycleEvent.create({
            data: {
              tenantId: actor.tenantId,
              staffId: reviewed.staffId,
              eventType: StaffLifecycleEventType.ON_LEAVE,
              eventDate: reviewed.startsOn,
              reason: reviewed.reason,
              metadata: {
                leaveRequestId: reviewed.id,
                leaveType: reviewed.leaveType,
                startsOn: dateOnly(reviewed.startsOn),
                endsOn: dateOnly(reviewed.endsOn),
                dayPart: reviewed.dayPart,
                days: reviewed.days.toString(),
                isPaid: reviewed.isPaid,
              },
              createdById: actor.userId,
            },
          });
          const synced = await syncLeaveCover(
            tx,
            toCoverageLeave(reviewed),
            actor.userId,
          );
          coverage = { created: synced.created.length };
        }

        await this.auditService.record(
          {
            action: input.status === 'APPROVED' ? 'approve' : 'reject',
            resource: 'staff_leave_request',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: reviewed.id,
            before: { status: leave.status },
            after: {
              status: reviewed.status,
              reviewNote,
              overlapAnomalies,
              coverageDraftsCreated: coverage.created,
            },
          },
          tx,
        );
        return { reviewed, overlapAnomalies, coverage };
      },
    ).catch(rethrowLeaveOverlap);

    return {
      ...result.reviewed,
      overlapAnomalies: result.overlapAnomalies,
      coverage: result.coverage,
    };
  }

  /**
   * Withdraw (requester, while PENDING) or cancel (leave manager, PENDING or
   * APPROVED). Cancelling approved leave restores the balance, removes the
   * attendance it generated and cancels its open timetable cover.
   */
  async cancel(leaveRequestId: string, actor: AuthContext) {
    const leave = await this.prisma.staffLeaveRequest.findFirst({
      where: { id: leaveRequestId, tenantId: actor.tenantId },
    });
    if (!leave) {
      throw new NotFoundException('Leave request not found');
    }
    if (leave.status === LeaveRequestStatus.CANCELLED) {
      return { ...leave, cancelledCoverCount: 0 };
    }
    if (
      leave.status !== LeaveRequestStatus.PENDING &&
      leave.status !== LeaveRequestStatus.APPROVED
    ) {
      throw leaveConflict(
        'LEAVE_NOT_CANCELLABLE',
        `A ${leave.status.toLowerCase()} leave request cannot be cancelled`,
      );
    }
    const requester = await this.prisma.staff.findFirst({
      where: { id: leave.staffId, tenantId: actor.tenantId },
      select: { userId: true },
    });
    const manager = canManageStaffLeave(actor);
    const owner = requester?.userId === actor.userId;
    if (!manager && !(owner && leave.status === LeaveRequestStatus.PENDING)) {
      throw new ForbiddenException(
        owner
          ? 'Approved leave can only be cancelled by a leave manager'
          : 'You can only withdraw your own leave requests',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.staffLeaveRequest.updateMany({
        where: {
          id: leave.id,
          tenantId: actor.tenantId,
          status: leave.status,
        },
        data: { status: LeaveRequestStatus.CANCELLED },
      });
      if (claimed.count !== 1) {
        throw leaveConflict(
          'LEAVE_REQUEST_STALE',
          'This leave request changed while it was being cancelled. Refresh and try again.',
        );
      }
      const cancelled = await tx.staffLeaveRequest.findUniqueOrThrow({
        where: { id: leave.id },
      });
      let cancelledCover: string[] = [];
      if (leave.status === LeaveRequestStatus.APPROVED) {
        await this.assertPayrollUnaffected(tx, leave, 'cancel');
        if (leave.isPaid) {
          await this.creditBalance(tx, leave);
          await this.removeLeaveAttendance(tx, leave);
        }
        cancelledCover = await cancelLeaveCover(
          tx,
          actor.tenantId,
          leave.id,
          actor.userId,
          'Leave cancelled',
        );
      }
      await this.auditService.record(
        {
          action: owner && !manager ? 'withdraw' : 'cancel',
          resource: 'staff_leave_request',
          tenantId: actor.tenantId,
          userId: actor.userId,
          resourceId: leave.id,
          before: { status: leave.status },
          after: {
            status: cancelled.status,
            cancelledSubstitutionIds: cancelledCover,
          },
        },
        tx,
      );
      return { cancelled, cancelledCover };
    });

    if (result.cancelledCover.length) {
      this.events?.emit(LEAVE_COVER_CANCELLED_EVENT, {
        tenantId: actor.tenantId,
        substitutionIds: result.cancelledCover,
        actor,
      });
    }
    return {
      ...result.cancelled,
      cancelledCoverCount: result.cancelledCover.length,
    };
  }

  /**
   * Academic impact of a leave request, for the reviewer: every period the
   * teacher would have taught, its current cover and how many timetabled
   * teachers are free at that time. Free-teacher counts are availability only;
   * assigning a substitute still runs the Phase 6 eligibility gate.
   */
  async impact(leaveRequestId: string, actor: AuthContext) {
    const leave = await this.prisma.staffLeaveRequest.findFirst({
      where: { id: leaveRequestId, tenantId: actor.tenantId },
    });
    if (!leave) {
      throw new NotFoundException('Leave request not found in this tenant');
    }
    const previewEnd = new Date(
      Math.min(
        leave.endsOn.getTime(),
        leave.startsOn.getTime() + (IMPACT_PREVIEW_MAX_DAYS - 1) * 86_400_000,
      ),
    );
    const truncated = previewEnd < leave.endsOn;
    return this.prisma.$transaction(async (tx) => {
      const required = await requiredLeaveCover(tx, {
        ...toCoverageLeave(leave),
        endsOn: previewEnd,
      });
      const items = await this.describeCover(
        tx,
        actor.tenantId,
        leave.staffId,
        required,
        true,
      );
      const days = new Map<string, typeof items>();
      for (const item of items) {
        days.set(item.date, [...(days.get(item.date) ?? []), item]);
      }
      return {
        leaveRequestId: leave.id,
        staffId: leave.staffId,
        status: leave.status,
        startsOn: dateOnly(leave.startsOn),
        endsOn: dateOnly(leave.endsOn),
        dayPart: leave.dayPart,
        truncated,
        previewEndsOn: dateOnly(previewEnd),
        totals: {
          periods: items.length,
          assigned: items.filter((item) => item.coverage === 'ASSIGNED').length,
          unresolved: items.filter((item) => item.coverage !== 'ASSIGNED')
            .length,
          withoutFreeTeacher: items.filter(
            (item) =>
              item.coverage !== 'ASSIGNED' && item.freeTeacherCount === 0,
          ).length,
        },
        days: Array.from(days.entries()).map(([date, periods]) => ({
          date,
          periods,
        })),
      };
    });
  }

  /**
   * Coverage status for approved leave, today first: every period that still
   * needs a substitute (and those already covered) over the next `days` days.
   */
  async coverageStatus(
    actor: AuthContext,
    query: { from?: string; days?: number },
  ) {
    const from = query.from
      ? parseLeaveDate(query.from, 'from')
      : schoolToday();
    const span = Math.min(Math.max(query.days ?? 14, 1), 31);
    const to = new Date(from.getTime() + (span - 1) * 86_400_000);
    return this.prisma.$transaction(async (tx) => {
      const leaves = await tx.staffLeaveRequest.findMany({
        where: {
          tenantId: actor.tenantId,
          status: LeaveRequestStatus.APPROVED,
          startsOn: { lte: to },
          endsOn: { gte: from },
        },
        include: {
          staff: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
            },
          },
        },
        orderBy: [{ startsOn: 'asc' }, { id: 'asc' }],
        take: 200,
      });
      const items: Array<
        LeaveCoverItem & {
          leaveRequestId: string;
          absentTeacher: {
            id: string;
            name: string;
            employeeId: string;
          };
        }
      > = [];
      for (const leave of leaves) {
        const required = await requiredLeaveCover(
          tx,
          {
            ...toCoverageLeave(leave),
            endsOn: leave.endsOn < to ? leave.endsOn : to,
          },
          from,
        );
        const described = await this.describeCover(
          tx,
          actor.tenantId,
          leave.staffId,
          required,
          false,
        );
        for (const item of described) {
          items.push({
            ...item,
            leaveRequestId: leave.id,
            absentTeacher: {
              id: leave.staff.id,
              name: `${leave.staff.firstName} ${leave.staff.lastName}`.trim(),
              employeeId: leave.staff.employeeId,
            },
          });
        }
      }
      items.sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          minutes(a.startsAt) - minutes(b.startsAt) ||
          a.slotId.localeCompare(b.slotId),
      );
      return {
        from: dateOnly(from),
        to: dateOnly(to),
        totals: {
          periods: items.length,
          assigned: items.filter((item) => item.coverage === 'ASSIGNED').length,
          uncovered: items.filter((item) => item.coverage !== 'ASSIGNED')
            .length,
        },
        items,
      };
    });
  }

  private async describeCover(
    tx: Client,
    tenantId: string,
    absentStaffId: string,
    required: Awaited<ReturnType<typeof requiredLeaveCover>>,
    countFreeTeachers: boolean,
  ): Promise<LeaveCoverItem[]> {
    if (!required.length) return [];
    const slotIds = Array.from(new Set(required.map(({ slot }) => slot.id)));
    const dates = required.map(({ date }) => date);
    const [slots, open] = await Promise.all([
      tx.timetableSlot.findMany({
        where: { tenantId, id: { in: slotIds } },
        select: {
          id: true,
          class: { select: { name: true } },
          section: { select: { name: true } },
          subject: { select: { name: true } },
        },
      }),
      tx.timetableSubstitution.findMany({
        where: {
          tenantId,
          timetableSlotId: { in: slotIds },
          date: {
            gte: new Date(Math.min(...dates.map((d) => d.getTime()))),
            lte: new Date(Math.max(...dates.map((d) => d.getTime()))),
          },
          status: {
            in: [
              TimetableSubstitutionStatus.DRAFT,
              TimetableSubstitutionStatus.ASSIGNED,
            ],
          },
        },
        select: {
          id: true,
          timetableSlotId: true,
          date: true,
          status: true,
          substituteTeacher: {
            select: { firstName: true, lastName: true },
          },
        },
      }),
    ]);
    const slotById = new Map(slots.map((slot) => [slot.id, slot]));
    const openByKey = new Map(
      open.map((row) => [leaveCoverKey(row.timetableSlotId, row.date), row]),
    );
    const freeByDate = new Map<
      string,
      (startsAt: string, endsAt: string) => number
    >();

    const result: LeaveCoverItem[] = [];
    for (const { slot, date } of required) {
      const key = dateOnly(date);
      let freeTeacherCount: number | null = null;
      if (countFreeTeachers) {
        let counter = freeByDate.get(key);
        if (!counter) {
          counter = await this.freeTeacherCounter(
            tx,
            tenantId,
            absentStaffId,
            date,
          );
          freeByDate.set(key, counter);
        }
        freeTeacherCount = counter(slot.startsAt, slot.endsAt);
      }
      const cover = openByKey.get(leaveCoverKey(slot.id, date));
      const names = slotById.get(slot.id);
      result.push({
        date: key,
        slotId: slot.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        className: names?.class.name ?? null,
        sectionName: names?.section?.name ?? null,
        subjectName: names?.subject.name ?? null,
        coverage: !cover
          ? 'UNCOVERED'
          : cover.status === TimetableSubstitutionStatus.ASSIGNED
            ? 'ASSIGNED'
            : 'DRAFT',
        substitutionId: cover?.id ?? null,
        substituteName: cover?.substituteTeacher
          ? `${cover.substituteTeacher.firstName} ${cover.substituteTeacher.lastName}`.trim()
          : null,
        freeTeacherCount,
      });
    }
    return result;
  }

  /**
   * For one school day: teachers on the live timetable, minus those teaching
   * or substituting at the given time, minus staff on approved leave that day.
   */
  private async freeTeacherCounter(
    tx: Client,
    tenantId: string,
    absentStaffId: string,
    date: Date,
  ) {
    const dayOfWeek = toTimetableDayOfWeek(date);
    const [liveSlots, onLeave, assigned] = await Promise.all([
      tx.timetableSlot.findMany({
        where: { tenantId, ...liveTimetableSlotWhere(date) },
        select: {
          staffId: true,
          dayOfWeek: true,
          startsAt: true,
          endsAt: true,
        },
      }),
      tx.staffLeaveRequest.findMany({
        where: {
          tenantId,
          status: LeaveRequestStatus.APPROVED,
          startsOn: { lte: date },
          endsOn: { gte: date },
        },
        select: { staffId: true },
      }),
      tx.timetableSubstitution.findMany({
        where: {
          tenantId,
          date,
          status: TimetableSubstitutionStatus.ASSIGNED,
          substituteTeacherId: { not: null },
        },
        select: {
          substituteTeacherId: true,
          timetableSlot: { select: { startsAt: true, endsAt: true } },
        },
      }),
    ]);
    const timetabled = new Set(liveSlots.map((slot) => slot.staffId));
    const absent = new Set(onLeave.map((row) => row.staffId));
    absent.add(absentStaffId);
    return (startsAt: string, endsAt: string) => {
      const start = minutes(startsAt);
      const end = minutes(endsAt);
      const overlaps = (a: string, b: string) =>
        minutes(a) < end && minutes(b) > start;
      const busy = new Set<string>();
      for (const slot of liveSlots) {
        if (
          slot.dayOfWeek === dayOfWeek &&
          overlaps(slot.startsAt, slot.endsAt)
        )
          busy.add(slot.staffId);
      }
      for (const row of assigned) {
        if (
          row.substituteTeacherId &&
          overlaps(row.timetableSlot.startsAt, row.timetableSlot.endsAt)
        )
          busy.add(row.substituteTeacherId);
      }
      let free = 0;
      for (const staffId of timetabled) {
        if (!busy.has(staffId) && !absent.has(staffId)) free += 1;
      }
      return free;
    };
  }

  private async assertEmployedThroughout(
    client: Client | PrismaService,
    tenantId: string,
    staffId: string,
    startsOn: Date,
    endsOn: Date,
  ) {
    const period = { startsOn, endsOn };
    const windows = await client.staffEmployment.findMany({
      where: authoritativeEmploymentWhere(tenantId, period, [staffId]),
      select: { effectiveFrom: true, effectiveTo: true },
    });
    if (
      employedDaysInPeriod(windows, period) !== calendarDaysInPeriod(period)
    ) {
      throw leaveConflict(
        'LEAVE_OUTSIDE_EMPLOYMENT',
        'Leave must fall entirely within the staff member’s verified employment',
      );
    }
  }

  private async assertPayrollUnaffected(
    tx: Client,
    leave: Pick<
      StaffLeaveRequest,
      'tenantId' | 'isPaid' | 'startsOn' | 'endsOn'
    >,
    action: 'approve' | 'cancel',
  ) {
    const months: Array<{ periodMonth: number; periodYear: number }> = [];
    const cursor = new Date(
      Date.UTC(
        leave.startsOn.getUTCFullYear(),
        leave.startsOn.getUTCMonth(),
        1,
      ),
    );
    while (cursor <= leave.endsOn) {
      months.push({
        periodMonth: cursor.getUTCMonth() + 1,
        periodYear: cursor.getUTCFullYear(),
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    const run = await tx.payrollRun.findFirst({
      where: {
        tenantId: leave.tenantId,
        status: { in: FIXED_PAYROLL_STATUSES },
        OR: months,
      },
      select: { periodMonth: true, periodYear: true, status: true },
    });
    if (run) {
      throw leaveConflict(
        'LEAVE_PAYROLL_FINALIZED',
        `Cannot ${action} leave inside payroll period ${run.periodMonth}/${run.periodYear}, which is ${run.status}. Record a payroll adjustment instead.`,
      );
    }
  }

  private async findBalanceRow(
    client: Client | PrismaService,
    tenantId: string,
    staffId: string,
    leaveType: string,
    year: number,
  ) {
    return client.staffLeaveBalance.findFirst({
      where: {
        tenantId,
        staffId,
        year,
        leaveType: { in: leaveTypeAliases(leaveType) },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
  }

  private async availableBalance(
    client: Client | PrismaService,
    tenantId: string,
    staffId: string,
    leaveType: string,
    year: number,
  ) {
    const row = await this.findBalanceRow(
      client,
      tenantId,
      staffId,
      leaveType,
      year,
    );
    return row ? availableLeaveDays(row) : new Prisma.Decimal(0);
  }

  /**
   * Debits by an atomic UPDATE (which takes the row lock) and re-checks the
   * result: a concurrent approval waits, then sees the committed debit.
   */
  private async debitBalance(tx: Client, leave: StaffLeaveRequest) {
    const row = await this.findBalanceRow(
      tx,
      leave.tenantId,
      leave.staffId,
      leave.leaveType,
      leave.startsOn.getUTCFullYear(),
    );
    if (!row) {
      throw leaveConflict(
        'LEAVE_BALANCE_INSUFFICIENT',
        'Approving this leave request would result in a negative leave balance',
      );
    }
    const debited = await tx.staffLeaveBalance.update({
      where: { id: row.id },
      data: { used: { increment: leave.days } },
    });
    if (availableLeaveDays(debited).isNegative()) {
      throw leaveConflict(
        'LEAVE_BALANCE_INSUFFICIENT',
        'Approving this leave request would result in a negative leave balance',
      );
    }
  }

  private async creditBalance(tx: Client, leave: StaffLeaveRequest) {
    const row = await this.findBalanceRow(
      tx,
      leave.tenantId,
      leave.staffId,
      leave.leaveType,
      leave.startsOn.getUTCFullYear(),
    );
    if (!row) return;
    await tx.staffLeaveBalance.update({
      where: { id: row.id },
      data: { used: { decrement: leave.days } },
    });
  }

  private async markLeaveAttendance(
    tx: Client,
    leave: StaffLeaveRequest,
    actorUserId: string,
  ) {
    const anomalies: Array<{ date: string; existingStatus: AttendanceStatus }> =
      [];
    for (const attendanceDate of eachLeaveDate(leave.startsOn, leave.endsOn)) {
      const key = {
        tenantId_staffId_attendanceDate: {
          tenantId: leave.tenantId,
          staffId: leave.staffId,
          attendanceDate,
        },
      };
      const existing = await tx.staffAttendance.findUnique({ where: key });
      if (!existing) {
        await tx.staffAttendance.create({
          data: {
            tenantId: leave.tenantId,
            staffId: leave.staffId,
            attendanceDate,
            status: AttendanceStatus.LEAVE,
            leaveType: leave.leaveType,
            note: `Approved leave request ${leave.id}`,
            approvedById: actorUserId,
          },
        });
      } else if (existing.status === AttendanceStatus.LEAVE) {
        await tx.staffAttendance.update({
          where: key,
          data: {
            leaveType: leave.leaveType,
            note: `Approved leave request ${leave.id}`,
          },
        });
      } else {
        anomalies.push({
          date: dateOnly(attendanceDate),
          existingStatus: existing.status,
        });
      }
    }
    return anomalies;
  }

  private async removeLeaveAttendance(tx: Client, leave: StaffLeaveRequest) {
    await tx.staffAttendance.deleteMany({
      where: {
        tenantId: leave.tenantId,
        staffId: leave.staffId,
        attendanceDate: { gte: leave.startsOn, lte: leave.endsOn },
        status: AttendanceStatus.LEAVE,
        note: { contains: leave.id },
      },
    });
  }
}
