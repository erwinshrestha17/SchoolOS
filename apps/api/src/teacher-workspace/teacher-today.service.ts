import { Injectable, Logger } from '@nestjs/common';
import { getNepalSchoolDay, toNepalLocalDateTime } from '@schoolos/core';
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
type Settled<T> = { ok: true; value: T } | { ok: false };

/** Nepal school date ("YYYY-MM-DD") of a requested date, defaulting to now. */
function requestedSchoolDate(dateInput: string | undefined, now: Date) {
  if (dateInput && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) return dateInput;
  const parsed = dateInput ? new Date(dateInput) : now;
  return getNepalSchoolDay(Number.isNaN(parsed.getTime()) ? now : parsed)
    .gregorianDate;
}

@Injectable()
export class TeacherTodayService {
  private readonly logger = new Logger(TeacherTodayService.name);

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

    // Phase 4: each panel settles independently. A failing source is named in
    // `unavailablePanels` and its field is null — never an empty/zero value
    // that would read as "nothing to do".
    const [attendance, homework, timetable, marks] = await Promise.all([
      this.settle('attendance', () =>
        this.attendanceService.getTeacherMobileToday(actor, dateInput),
      ),
      homeworkEnabled
        ? this.settle('homework', () =>
            this.homeworkService.getHomeworkSummaryToday(actor, {
              date: dateInput,
            }),
          )
        : Promise.resolve<Settled<null>>({ ok: true, value: null }),
      timetableEnabled
        ? this.settle('timetable', () =>
            this.timetableService.getTeacherMobileTimetable(actor, {
              date: dateInput,
              days: 1,
            }),
          )
        : Promise.resolve<Settled<null>>({ ok: true, value: null }),
      examsEnabled
        ? this.settle('marksDeadlines', () =>
            this.getUpcomingMarksDeadlines(actor, now),
          )
        : Promise.resolve<Settled<null>>({ ok: true, value: null }),
    ]);
    const unavailablePanels = [
      ...(attendance.ok ? [] : ['attendance']),
      ...(homework.ok ? [] : ['homework']),
      ...(timetable.ok ? [] : ['timetable']),
      ...(marks.ok ? [] : ['marksDeadlines']),
    ];
    const attendanceToday = attendance.ok ? attendance.value : null;
    const homeworkSummary = homework.ok ? homework.value : null;
    const timetableToday = timetable.ok ? timetable.value : null;

    // Attendance reports its business day as UTC midnight of the Nepal date.
    const schoolDate =
      attendanceToday?.date.slice(0, 10) ?? requestedSchoolDate(dateInput, now);
    // Current/next period only describe the real present moment: for any
    // other requested date they are null (the schedule is still returned).
    const isToday = schoolDate === getNepalSchoolDay(now).gregorianDate;
    const nowTimeOfDay = nepalTimeOfDay(now);
    const periods = (attendanceToday?.periods ?? []) as TodayPeriod[];
    // A period COVERED by a substitute is not taught by this teacher today.
    const teaching = periods
      .filter((period) => period.coverageStatus !== 'COVERED')
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const currentPeriod = isToday
      ? (teaching.find(
          (period) =>
            period.startsAt <= nowTimeOfDay && nowTimeOfDay < period.endsAt,
        ) ?? null)
      : null;
    const nextPeriod = isToday
      ? (teaching.find((period) => period.startsAt > nowTimeOfDay) ?? null)
      : null;

    return {
      generatedAt: now.toISOString(),
      date: attendanceToday?.date ?? `${schoolDate}T00:00:00.000Z`,
      isToday,
      currentPeriod,
      nextPeriod,
      todaysPeriods: attendanceToday ? periods : null,
      assignedClasses: attendanceToday?.classes ?? null,
      pendingAttendanceCount: attendanceToday?.pendingAttendanceCount ?? null,
      homework: homeworkSummary
        ? {
            givenToday: homeworkSummary.givenToday,
            dueToday: homeworkSummary.dueToday,
            awaitingReviewCount: homeworkSummary.notChecked,
          }
        : null,
      substitutions: timetableToday?.substitutions ?? null,
      marksDeadlines: marks.ok ? marks.value : null,
      unavailableModules,
      unavailablePanels,
    };
  }

  private async settle<T>(
    panel: string,
    load: () => Promise<T>,
  ): Promise<Settled<T>> {
    try {
      return { ok: true, value: await load() };
    } catch (error) {
      this.logger.warn(
        `teacher today panel ${panel} unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { ok: false };
    }
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

    // Exam-term end dates are business dates: compare on Nepal day bounds so
    // a term ending today is still listed for the whole Nepal school day.
    const today = getNepalSchoolDay(now);
    const withinSevenDays = new Date(
      today.endExclusiveUtc.getTime() + 7 * 24 * 60 * 60 * 1000,
    );

    const terms = await this.prisma.examTerm.findMany({
      where: {
        tenantId: actor.tenantId,
        academicYearId: currentYear.id,
        isLocked: false,
        endsOn: { gte: today.startUtc, lt: withinSevenDays },
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
