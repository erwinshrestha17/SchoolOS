import { AuthMethod } from '@prisma/client';
import { TeacherTodayService } from './teacher-today.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { HomeworkService } from '../homework/homework.service';
import { TimetableService } from '../timetable/timetable.service';
import type { AuthContext } from '../auth/auth.types';
import { TeacherScopeService } from '../teacher-scope/teacher-scope.service';

const actor: AuthContext = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-1',
  userId: 'user-1',
  email: 'teacher@school.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['teacher'],
  permissions: ['attendance:read'],
};

// 2026-07-19 is a Sunday; Nepal is UTC+5:45. 09:15 NPT == 03:30 UTC same day.
const NOW_NPT_09_15 = new Date('2026-07-19T03:30:00.000Z');

function makePeriod(id: string, startsAt: string, endsAt: string) {
  return {
    id,
    academicYearId: 'year-1',
    classId: 'class-1',
    sectionId: 'section-1',
    className: 'Class 5 - A',
    subjectName: 'Mathematics',
    startsAt,
    endsAt,
  };
}

describe('TeacherTodayService', () => {
  function makeService(
    overrides: {
      periods?: ReturnType<typeof makePeriod>[];
      subjectAssignments?: { subjectId: string }[];
      examTerms?: { id: string; name: string; endsOn: Date }[];
      enabledModules?: string[];
      components?: Array<{
        id: string;
        name: string;
        examTerm: { name: string };
      }>;
      rosterSize?: number;
      entered?: number;
    } = {},
  ) {
    const enabledModules = overrides.enabledModules ?? [
      'attendance',
      'homework',
      'timetable',
      'exams',
    ];
    const attendanceToday = {
      date: NOW_NPT_09_15.toISOString(),
      periods: overrides.periods ?? [],
      classes: [{ id: 'roster-1', classId: 'class-1', sectionId: 'section-1' }],
      pendingAttendanceCount: 1,
    };
    const attendanceService = {
      getTeacherMobileToday: jest.fn().mockResolvedValue(attendanceToday),
    };
    const homeworkService = {
      getHomeworkSummaryToday: jest.fn().mockResolvedValue({
        givenToday: 2,
        dueToday: 1,
        notChecked: 5,
      }),
    };
    const timetableService = {
      getTeacherMobileTimetable: jest.fn().mockResolvedValue({
        substitutions: [{ id: 'sub-1', role: 'SUBSTITUTE' }],
      }),
    };
    const prisma = {
      academicYear: {
        findFirst: jest.fn().mockResolvedValue({ id: 'year-1' }),
      },
      examTerm: {
        findMany: jest.fn().mockResolvedValue(overrides.examTerms ?? []),
      },
      assessmentComponent: {
        findMany: jest.fn().mockResolvedValue(overrides.components ?? []),
      },
      student: {
        count: jest.fn().mockResolvedValue(overrides.rosterSize ?? 0),
      },
      markEntry: { count: jest.fn().mockResolvedValue(overrides.entered ?? 0) },
      attendanceCorrectionRequest: {
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const teacherScopeService = {
      listActiveAssignmentsForCapability: jest.fn().mockResolvedValue([
        {
          assignmentId: 'assignment-1',
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: 'subject-1',
        },
      ]),
      listActiveAssignments: jest.fn().mockResolvedValue(
        (overrides.subjectAssignments ?? [{ subjectId: 'subject-1' }]).map(
          (assignment, index) => ({
            assignmentId: `assignment-${String(index + 1)}`,
            academicYearId: 'year-1',
            classId: 'class-1',
            sectionId: 'section-1',
            ...assignment,
          }),
        ),
      ),
    };
    const moduleResolver = {
      getEnabledModules: jest.fn().mockResolvedValue(new Set(enabledModules)),
      unavailableModules: jest.fn((enabled: Set<string>, required: string[]) =>
        required.filter((module) => !enabled.has(module)),
      ),
    };

    const service = new TeacherTodayService(
      prisma as unknown as PrismaService,
      attendanceService as unknown as AttendanceService,
      homeworkService as unknown as HomeworkService,
      timetableService as unknown as TimetableService,
      teacherScopeService as unknown as TeacherScopeService,
      moduleResolver as never,
    );
    return {
      service,
      prisma,
      attendanceService,
      homeworkService,
      timetableService,
      teacherScopeService,
      moduleResolver,
    };
  }

  it('identifies the period covering the current Nepal-local time as currentPeriod', async () => {
    const { service } = makeService({
      periods: [
        makePeriod('period-1', '08:30', '09:10'),
        makePeriod('period-2', '09:10', '09:50'),
        makePeriod('period-3', '09:50', '10:30'),
      ],
    });

    const result = await service.getToday(actor, undefined, NOW_NPT_09_15);

    expect(result.currentPeriod?.id).toBe('period-2');
    expect(result.nextPeriod?.id).toBe('period-3');
  });

  it('returns null currentPeriod and the earliest upcoming period as nextPeriod between classes', async () => {
    const { service } = makeService({
      periods: [
        makePeriod('period-1', '08:00', '08:40'),
        makePeriod('period-2', '09:20', '10:00'),
      ],
    });

    const result = await service.getToday(actor, undefined, NOW_NPT_09_15);

    expect(result.currentPeriod).toBeNull();
    expect(result.nextPeriod?.id).toBe('period-2');
  });

  it('never treats a period covered by a substitute as the current or next class', async () => {
    const { service } = makeService({
      periods: [
        {
          ...makePeriod('period-1', '09:10', '09:50'),
          coverageStatus: 'COVERED',
        },
        makePeriod('period-2', '09:50', '10:30'),
        {
          ...makePeriod('period-3', '10:30', '11:10'),
          coverageStatus: 'COVERED',
        },
      ] as never,
    });

    const result = await service.getToday(actor, undefined, NOW_NPT_09_15);

    expect(result.currentPeriod).toBeNull();
    expect(result.nextPeriod?.id).toBe('period-2');
  });

  it('does not report current/next periods for a date other than today', async () => {
    const { service } = makeService({
      periods: [makePeriod('period-1', '09:10', '09:50')],
    });

    const result = await service.getToday(actor, '2026-07-20', NOW_NPT_09_15);

    // The schedule is the requested date's; "now" does not apply to it.
    expect(result.isToday).toBe(true); // fixture attendance date is today
    const other = await makeService({
      periods: [makePeriod('period-1', '09:10', '09:50')],
    }).service.getToday(actor, '2026-07-20', new Date('2026-07-21T03:30:00Z'));
    expect(other.isToday).toBe(false);
    expect(other.currentPeriod).toBeNull();
    expect(other.nextPeriod).toBeNull();
    expect(result.currentPeriod?.id).toBe('period-1');
  });

  it('reports a failing panel as unavailable instead of zero or empty', async () => {
    const { service, homeworkService } = makeService();
    homeworkService.getHomeworkSummaryToday.mockRejectedValue(
      new Error('timeout'),
    );

    const result = await service.getToday(actor, undefined, NOW_NPT_09_15);

    expect(result.homework).toBeNull();
    expect(result.unavailablePanels).toEqual(['homework']);
    expect(result.pendingAttendanceCount).toBe(1);
  });

  it('returns null schedule fields when attendance itself cannot load', async () => {
    const { service, attendanceService } = makeService();
    attendanceService.getTeacherMobileToday.mockRejectedValue(new Error('db'));

    const result = await service.getToday(actor, undefined, NOW_NPT_09_15);

    expect(result.unavailablePanels).toContain('attendance');
    expect(result.todaysPeriods).toBeNull();
    expect(result.pendingAttendanceCount).toBeNull();
    expect(result.date).toBe('2026-07-19T00:00:00.000Z');
  });

  it('returns null for both when the school day is over', async () => {
    const { service } = makeService({
      periods: [makePeriod('period-1', '08:00', '08:40')],
    });

    const result = await service.getToday(actor, undefined, NOW_NPT_09_15);

    expect(result.currentPeriod).toBeNull();
    expect(result.nextPeriod).toBeNull();
  });

  it('composes homework, attendance, and substitution data from their already-scoped services', async () => {
    const { service } = makeService();
    const result = await service.getToday(actor, undefined, NOW_NPT_09_15);

    expect(result.pendingAttendanceCount).toBe(1);
    expect(result.homework).toEqual({
      givenToday: 2,
      dueToday: 1,
      awaitingReviewCount: 5,
    });
    expect(result.substitutions).toEqual([{ id: 'sub-1', role: 'SUBSTITUTE' }]);
  });

  it("only surfaces exam terms within the next 7 days for the teacher's own assigned subjects", async () => {
    const withinWindow = new Date(
      NOW_NPT_09_15.getTime() + 3 * 24 * 60 * 60 * 1000,
    );
    const { service, prisma } = makeService({
      examTerms: [{ id: 'term-1', name: 'Unit Test 2', endsOn: withinWindow }],
    });

    const result = await service.getToday(actor, undefined, NOW_NPT_09_15);

    expect(result.marksDeadlines).toEqual([
      {
        examTermId: 'term-1',
        examTermName: 'Unit Test 2',
        endsOn: withinWindow,
      },
    ]);
    expect(prisma.examTerm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          academicYearId: 'year-1',
          isLocked: false,
        }),
      }),
    );
  });

  it('returns no marks deadlines when the teacher has no subject assignments', async () => {
    const { service, prisma } = makeService({ subjectAssignments: [] });
    const result = await service.getToday(actor, undefined, NOW_NPT_09_15);

    expect(result.marksDeadlines).toEqual([]);
    expect(prisma.examTerm.findMany).not.toHaveBeenCalled();
  });

  describe('DEF-06 module degradation', () => {
    it('returns null homework and skips HomeworkService when homework is disabled', async () => {
      const { service, homeworkService } = makeService({
        enabledModules: ['attendance', 'timetable', 'exams'],
      });

      const result = await service.getToday(actor, undefined, NOW_NPT_09_15);

      expect(result.homework).toBeNull();
      expect(result.unavailableModules).toContain('homework');
      expect(homeworkService.getHomeworkSummaryToday).not.toHaveBeenCalled();
    });

    it('returns null substitutions when timetable is disabled', async () => {
      const { service, timetableService } = makeService({
        enabledModules: ['attendance', 'homework', 'exams'],
      });

      const result = await service.getToday(actor, undefined, NOW_NPT_09_15);

      expect(result.substitutions).toBeNull();
      expect(result.unavailableModules).toContain('timetable');
      expect(timetableService.getTeacherMobileTimetable).not.toHaveBeenCalled();
    });

    it('returns null marksDeadlines when exams is disabled', async () => {
      const { service, prisma } = makeService({
        enabledModules: ['attendance', 'homework', 'timetable'],
      });

      const result = await service.getToday(actor, undefined, NOW_NPT_09_15);

      expect(result.marksDeadlines).toBeNull();
      expect(result.unavailableModules).toContain('exams');
      expect(prisma.examTerm.findMany).not.toHaveBeenCalled();
    });
  });

  describe('marks to complete and own corrections (Phase 4C)', () => {
    it("lists only the teacher's open components that still miss marks", async () => {
      const { service, prisma } = makeService({
        components: [
          {
            id: 'comp-1',
            name: 'Unit test 1',
            examTerm: { name: 'First term' },
          },
        ],
        rosterSize: 30,
        entered: 26,
      });

      const result = await service.getToday(actor, undefined, NOW_NPT_09_15);

      expect(result.marksToComplete).toEqual([
        expect.objectContaining({
          assessmentComponentId: 'comp-1',
          missingCount: 4,
          expectedCount: 30,
          sectionId: 'section-1',
        }),
      ]);
      // The expected roster is the assignment's own section.
      expect(prisma.student.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          classId: 'class-1',
          sectionId: 'section-1',
          lifecycleStatus: 'ACTIVE',
        }),
      });
      expect(prisma.assessmentComponent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            examTerm: { academicYearId: 'year-1', isLocked: false },
          }),
        }),
      );
    });

    it('omits components whose marks are complete', async () => {
      const { service } = makeService({
        components: [
          {
            id: 'comp-1',
            name: 'Unit test 1',
            examTerm: { name: 'First term' },
          },
        ],
        rosterSize: 30,
        entered: 30,
      });
      const result = await service.getToday(actor, undefined, NOW_NPT_09_15);
      expect(result.marksToComplete).toEqual([]);
    });

    it("counts only the teacher's own corrections", async () => {
      const { service, prisma } = makeService();
      prisma.attendanceCorrectionRequest.count
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);

      const result = await service.getToday(actor, undefined, NOW_NPT_09_15);

      expect(result.corrections).toEqual({ pending: 2, rejectedRecently: 1 });
      for (const [args] of prisma.attendanceCorrectionRequest.count.mock
        .calls as Array<[{ where: Record<string, unknown> }]>) {
        expect(args.where).toMatchObject({
          tenantId: 'tenant-1',
          requestedById: 'user-1',
        });
      }
    });
  });
});
