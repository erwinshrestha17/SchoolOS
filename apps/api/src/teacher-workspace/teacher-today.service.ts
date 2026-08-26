import { Injectable } from '@nestjs/common';
import { toNepalLocalDateTime } from '@schoolos/core';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { HomeworkService } from '../homework/homework.service';
import { TimetableService } from '../timetable/timetable.service';
import { TeacherScopeService } from '../teacher-scope/teacher-scope.service';
import { TeacherWorkspaceModuleResolver } from './teacher-workspace-modules';

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
  coverageStatus: 'SCHEDULED' | 'SUBSTITUTING' | 'COVERED';
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
    private readonly teacherScopeService: TeacherScopeService,
    private readonly moduleResolver: TeacherWorkspaceModuleResolver,
  ) {}

  async getToday(
    actor: AuthContext,
    dateInput?: string,
    now: Date = new Date(),
  ) {
    const enabledModules = await this.moduleResolver.getEnabledModules(
      actor.tenantId,
    );
    const homeworkEnabled = enabledModules.has('homework');
    const timetableEnabled = enabledModules.has('timetable');
    const examsEnabled = enabledModules.has('exams');

    const unavailableModules = this.moduleResolver.unavailableModules(
      enabledModules,
      ['homework', 'timetable', 'exams'],
    );

    const [attendanceToday, homeworkSummary, timetableToday, marksDeadlines] =
      await Promise.all([
        this.attendanceService.getTeacherMobileToday(actor, dateInput),
        homeworkEnabled
          ? this.homeworkService.getHomeworkSummaryToday(actor, {
              date: dateInput,
            })
          : Promise.resolve(null),
        timetableEnabled
          ? this.timetableService.getTeacherMobileTimetable(actor, {
              date: dateInput,
              days: 1,
            })
          : Promise.resolve(null),
        examsEnabled
          ? this.getUpcomingMarksDeadlines(actor, now)
          : Promise.resolve(null),
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
      homework: homeworkSummary
        ? {
            givenToday: homeworkSummary.givenToday,
            dueToday: homeworkSummary.dueToday,
            awaitingReviewCount: homeworkSummary.notChecked,
          }
        : null,
      substitutions: timetableToday?.substitutions ?? null,
      marksDeadlines,
      unavailableModules,
    };
  }

  private async getUpcomingMarksDeadlines(actor: AuthContext, now: Date) {
    const currentYear = await this.prisma.academicYear.findFirst({
      where: { tenantId: actor.tenantId, isCurrent: true },
      select: { id: true },
    });
    if (!currentYear) return [];

    const subjectAssignments =
      await this.teacherScopeService.listActiveAssignments(actor, {
        academicYearId: currentYear.id,
      });
    const subjectIds = [
      ...new Set(
        subjectAssignments
          .map((assignment) => assignment.subjectId)
          .filter((subjectId): subjectId is string => Boolean(subjectId)),
      ),
    ];
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
