import { AttendanceStatus, AuthMethod } from '@prisma/client';
import { AttendanceService } from '../attendance/attendance.service';
import type { AuthContext } from '../auth/auth.types';
import { MobileTeacherAttendanceController } from './mobile-teacher-attendance.controller';

describe('MobileTeacherAttendanceController', () => {
  let attendanceService: jest.Mocked<
    Pick<
      AttendanceService,
      'listTeacherMobileClassSections' | 'getRoster' | 'submitAttendance'
    >
  >;
  let controller: MobileTeacherAttendanceController;
  let actor: AuthContext;

  beforeEach(() => {
    attendanceService = {
      listTeacherMobileClassSections: jest.fn(),
      getRoster: jest.fn(),
      submitAttendance: jest.fn(),
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
      controller.getRoster(
        actor,
        'year-1',
        'class-1',
        'section-1',
        '2026-06-02',
      ),
    ).resolves.toEqual({
      academicYearId: 'year-1',
      academicYearName: '2082',
      classId: 'class-1',
      className: 'Grade 3',
      sectionId: 'section-1',
      sectionName: 'A',
      attendanceDate: new Date('2026-06-02T00:00:00.000Z'),
      existingSession: null,
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

  it('submits attendance through the existing scoped attendance service', async () => {
    const dto = {
      academicYearId: 'year-1',
      classId: 'class-1',
      sectionId: 'section-1',
      attendanceDate: '2026-06-02',
      exceptions: [{ studentId: 'student-1', status: AttendanceStatus.ABSENT }],
    };
    attendanceService.submitAttendance.mockResolvedValue({
      sessionId: 's-1',
    } as Awaited<ReturnType<AttendanceService['submitAttendance']>>);

    await expect(controller.submit(dto, actor)).resolves.toEqual({
      sessionId: 's-1',
    });
    expect(attendanceService.submitAttendance).toHaveBeenCalledWith(dto, actor);
  });
});
