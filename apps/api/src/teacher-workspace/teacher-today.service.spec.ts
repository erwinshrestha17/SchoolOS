import { AuthMethod } from '@prisma/client';
import { TeacherTodayService } from './teacher-today.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { HomeworkService } from '../homework/homework.service';
import { TimetableService } from '../timetable/timetable.service';
import type { AuthContext } from '../auth/auth.types';

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
  function makeService(overrides: {
    periods?: ReturnType<typeof makePeriod>[];
    subjectAssignments?: Array<{ subjectId: string }>;
    examTerms?: Array<{ id: string; name: string; endsOn: Date }>;
  } = {}) {
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
      staff: { findFirst: jest.fn().mockResolvedValue({ id: 'staff-1' }) },
      academicYear: {
        findFirst: jest.fn().mockResolvedValue({ id: 'year-1' }),
      },
      subjectTeacherAssignment: {
        findMany: jest
          .fn()
          .mockResolvedValue(overrides.subjectAssignments ?? [{ subjectId: 'subject-1' }]),
      },
      examTerm: {
        findMany: jest.fn().mockResolvedValue(overrides.examTerms ?? []),
      },
    };

    const service = new TeacherTodayService(
      prisma as unknown as PrismaService,
      attendanceService as unknown as AttendanceService,
      homeworkService as unknown as HomeworkService,
      timetableService as unknown as TimetableService,
    );
    return { service, prisma, homeworkService, timetableService };
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

  it('only surfaces exam terms within the next 7 days for the teacher\'s own assigned subjects', async () => {
    const withinWindow = new Date(NOW_NPT_09_15.getTime() + 3 * 24 * 60 * 60 * 1000);
    const { service, prisma } = makeService({
      examTerms: [
        { id: 'term-1', name: 'Unit Test 2', endsOn: withinWindow },
      ],
    });

    const result = await service.getToday(actor, undefined, NOW_NPT_09_15);

    expect(result.marksDeadlines).toEqual([
      { examTermId: 'term-1', examTermName: 'Unit Test 2', endsOn: withinWindow },
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
});
