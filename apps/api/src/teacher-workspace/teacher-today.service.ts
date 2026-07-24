import { Injectable } from '@nestjs/common';
import { toNepalLocalDateTime } from '@schoolos/core';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { HomeworkService } from '../homework/homework.service';
import { TimetableService } from '../timetable/timetable.service';

interface TodayPeriod {
  id: string;
  academicYearId: string;
  classId: string;
  sectionId: string | null;
  className: string;
  subjectName: string;
  // "HH:mm" 24-hour Nepal-local time-of-day (TimetableSlot stores no date,
  // just a recurring weekly time -- see prisma/schema/timetable.prisma).
  startsAt: string;
  endsAt: string;
}

/** "HH:mm" for the given instant in Asia/Kathmandu, matching TimetableSlot's storage format. */
function nepalTimeOfDay(instant: Date): string {
  const local = toNepalLocalDateTime(instant);
  return `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`;
}

/**
 * Teacher Home/Today aggregator (Teacher Persona spec sections 10.1 / 21.1).
 * Deliberately does not re-derive assignment scoping: every field here comes
 * from an already-scoped existing service call (attendance, homework,
 * timetable) -- this only composes their results and computes
 * current/next-period and upcoming marks deadlines on top.
 */
@Injectable()
export class TeacherTodayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
    private readonly homeworkService: HomeworkService,
    private readonly timetableService: TimetableService,
  ) {}

  async getToday(
    actor: AuthContext,
    dateInput?: string,
    now: Date = new Date(),
  ) {
    const [attendanceToday, homeworkSummary, timetableToday, marksDeadlines] =
      await Promise.all([
        this.attendanceService.getTeacherMobileToday(actor, dateInput),
        this.homeworkService.getHomeworkSummaryToday(actor, {
          date: dateInput,
        }),
        this.timetableService.getTeacherMobileTimetable(actor, {
          date: dateInput,
          days: 1,
        }),
        this.getUpcomingMarksDeadlines(actor, now),
      ]);

    const nowTimeOfDay = nepalTimeOfDay(now);
    const periods = attendanceToday.periods as TodayPeriod[];
    const currentPeriod =
      periods.find(
        (period) =>
          period.startsAt <= nowTimeOfDay && nowTimeOfDay <= period.endsAt,
      ) ?? null;
    const nextPeriod =
      periods
        .filter((period) => period.startsAt > nowTimeOfDay)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null;

    return {
      generatedAt: now.toISOString(),
      date: attendanceToday.date,
      currentPeriod,
      nextPeriod,
      todaysPeriods: periods,
      assignedClasses: attendanceToday.classes,
      pendingAttendanceCount: attendanceToday.pendingAttendanceCount,
      homework: {
        givenToday: homeworkSummary.givenToday,
        dueToday: homeworkSummary.dueToday,
        awaitingReviewCount: homeworkSummary.notChecked,
      },
      substitutions: timetableToday.substitutions,
      marksDeadlines,
    };
  }

  private async getUpcomingMarksDeadlines(actor: AuthContext, now: Date) {
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true },
    });
    if (!staff) return [];

    const currentYear = await this.prisma.academicYear.findFirst({
      where: { tenantId: actor.tenantId, isCurrent: true },
      select: { id: true },
    });
    if (!currentYear) return [];

    const subjectAssignments =
      await this.prisma.subjectTeacherAssignment.findMany({
        where: {
          tenantId: actor.tenantId,
          staffId: staff.id,
          academicYearId: currentYear.id,
        },
        select: { subjectId: true },
      });
    const subjectIds = [...new Set(subjectAssignments.map((a) => a.subjectId))];
    if (subjectIds.length === 0) return [];

    const withinSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const terms = await this.prisma.examTerm.findMany({
      where: {
        tenantId: actor.tenantId,
        academicYearId: currentYear.id,
        isLocked: false,
        endsOn: { gte: now, lte: withinSevenDays },
        components: { some: { subjectId: { in: subjectIds } } },
      },
      select: { id: true, name: true, endsOn: true },
      orderBy: { endsOn: 'asc' },
      take: 10,
    });

    return terms.map((term) => ({
      examTermId: term.id,
      examTermName: term.name,
      endsOn: term.endsOn,
    }));
  }
}
