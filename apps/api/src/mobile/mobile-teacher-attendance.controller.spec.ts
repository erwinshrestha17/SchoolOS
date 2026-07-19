import { AuthMethod } from '@prisma/client';
import { AttendanceService } from '../attendance/attendance.service';
import type { AuthContext } from '../auth/auth.types';
import { MobileTeacherAttendanceController } from './mobile-teacher-attendance.controller';

describe('MobileTeacherAttendanceController', () => {
  let attendanceService: jest.Mocked<
    Pick<
      AttendanceService,
      | 'listTeacherMobileClassSections'
      | 'getTeacherMobileToday'
      | 'getRoster'
      | 'syncAttendance'
    >
  >;
  let controller: MobileTeacherAttendanceController;
  let actor: AuthContext;

  beforeEach(() => {
    attendanceService = {
      listTeacherMobileClassSections: jest.fn(),
      getTeacherMobileToday: jest.fn(),
      getRoster: jest.fn(),
      syncAttendance: jest.fn(),
    };
    controller = new MobileTeacherAttendanceController(
      attendanceService as unknown as AttendanceService,
    );
    actor = {
      userId: 'teacher-1',
      tenantId: 'tenant-1',
      tenantSlug: 'green-valley',
      email: 'teacher@school.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['teacher'],
      permissions: ['attendance:read', 'attendance:mark'],
    };
  });

  it('returns the purpose-limited teacher today board', async () => {
    attendanceService.getTeacherMobileToday.mockResolvedValue({
      date: '2026-06-02T00:00:00.000Z',
      periods: [],
      classes: [],
      pendingAttendanceCount: 0,
    });

    await expect(
      controller.getToday(actor, { date: '2026-06-02' }),
    ).resolves.toEqual({
      date: '2026-06-02T00:00:00.000Z',
      periods: [],
      classes: [],
      pendingAttendanceCount: 0,
    });
    expect(attendanceService.getTeacherMobileToday).toHaveBeenCalledWith(
      actor,
      '2026-06-02',
    );
  });

  it('lists assigned teacher mobile attendance classes', async () => {
    attendanceService.listTeacherMobileClassSections.mockResolvedValue({
      items: [{ id: 'year-1:class-1:section-1' }],
    } as Awaited<
      ReturnType<AttendanceService['listTeacherMobileClassSections']>
    >);

    await expect(controller.listClasses(actor)).resolves.toEqual({
      items: [{ id: 'year-1:class-1:section-1' }],
    });
    expect(
      attendanceService.listTeacherMobileClassSections,
    ).toHaveBeenCalledWith(actor);
  });

  it('returns a purpose-limited roster payload for one assigned class', async () => {
    attendanceService.getRoster.mockResolvedValue({
      academicYear: { id: 'year-1', name: '2082' },
      class: { id: 'class-1', name: 'Grade 3' },
      section: { id: 'section-1', name: 'A' },
      attendanceDate: new Date('2026-06-02T00:00:00.000Z'),
      attendanceState: {
        submittedAt: null,
        lockAt: new Date('2026-06-03T00:00:00.000Z'),
        isSubmitted: false,
        isLocked: false,
        conflictStatus: 'NONE',
      },
      existingSession: null,
      calendarDay: { isWorkingDay: true },
      students: [
        {
          id: 'student-1',
          fullNameEn: 'Asha Sharma',
          rollNumber: 7,
          status: 'PRESENT',
          remark: null,
          primaryGuardian: { fullName: 'Parent Hidden' },
        },
      ],
    } as unknown as Awaited<ReturnType<AttendanceService['getRoster']>>);

    await expect(
      controller.getRoster(actor, {
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        attendanceDate: '2026-06-02',
      }),
    ).resolves.toEqual({
      academicYearId: 'year-1',
      academicYearName: '2082',
      classId: 'class-1',
      className: 'Grade 3',
      sectionId: 'section-1',
      sectionName: 'A',
      attendanceDate: new Date('2026-06-02T00:00:00.000Z'),
      attendanceState: {
        submittedAt: null,
        lockAt: new Date('2026-06-03T00:00:00.000Z'),
        isSubmitted: false,
        isLocked: false,
        conflictStatus: 'NONE',
      },
      calendarDay: { isWorkingDay: true },
      students: [
        {
          studentId: 'student-1',
          studentName: 'Asha Sharma',
          rollNumber: 7,
          status: 'PRESENT',
          remark: null,
        },
      ],
    });
    expect(attendanceService.getRoster).toHaveBeenCalledWith(
      actor,
      'year-1',
      'class-1',
      'section-1',
      '2026-06-02',
    );
  });

  it('syncs a replay-safe mobile attendance submission', async () => {
    const dto = {
      academicYearId: 'year-1',
      classId: 'class-1',
      sectionId: 'section-1',
      attendanceDate: '2026-06-02',
      exceptions: [],
      clientSubmissionId: 'mobile-draft-1',
      deviceTimestamp: '2026-06-02T08:00:00.000Z',
    };
    attendanceService.syncAttendance.mockResolvedValue({
      clientSubmissionId: 'mobile-draft-1',
      attendanceSessionId: 'session-1',
      conflictId: null,
      syncStatus: 'ACCEPTED',
      replayed: false,
      serverReceivedAt: '2026-06-02T08:00:01.000Z',
      deviceId: 'private-device-id',
    } as Awaited<ReturnType<AttendanceService['syncAttendance']>>);

    await expect(controller.sync(dto, actor)).resolves.toEqual({
      clientSubmissionId: 'mobile-draft-1',
      attendanceSessionId: 'session-1',
      conflictId: null,
      syncStatus: 'ACCEPTED',
      replayed: false,
      serverReceivedAt: '2026-06-02T08:00:01.000Z',
    });
    expect(attendanceService.syncAttendance).toHaveBeenCalledWith(dto, actor);
  });
});
