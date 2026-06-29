import { AuthMethod } from '@prisma/client';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { AuthContext } from '../auth/auth.types';
import { AttendanceService } from '../attendance/attendance.service';
import { MobileTeacherStudentsController } from './mobile-teacher-students.controller';

describe('MobileTeacherStudentsController', () => {
  let attendanceService: jest.Mocked<
    Pick<AttendanceService, 'getTeacherMobileStudentSummary'>
  >;
  let controller: MobileTeacherStudentsController;
  let actor: AuthContext;

  beforeEach(() => {
    attendanceService = {
      getTeacherMobileStudentSummary: jest.fn(),
    };
    controller = new MobileTeacherStudentsController(
      attendanceService as unknown as AttendanceService,
    );
    actor = {
      userId: 'teacher-user-1',
      tenantId: 'tenant-1',
      tenantSlug: 'school',
      email: 'teacher@school.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['subject_teacher'],
      permissions: ['students:read'],
    };
  });

  it('delegates teacher-scoped student summary reads to the attendance scope service', async () => {
    attendanceService.getTeacherMobileStudentSummary.mockResolvedValue({
      student: { id: 'student-1', name: 'Asha Rai' },
      attendance: { recentWindow: 1 },
    } as never);

    await expect(
      controller.getStudentSummary(
        'student-1',
        'year-1',
        'class-1',
        'section-1',
        actor,
      ),
    ).resolves.toEqual({
      student: { id: 'student-1', name: 'Asha Rai' },
      attendance: { recentWindow: 1 },
    });
    expect(
      attendanceService.getTeacherMobileStudentSummary,
    ).toHaveBeenCalledWith(actor, {
      studentId: 'student-1',
      academicYearId: 'year-1',
      classId: 'class-1',
      sectionId: 'section-1',
    });
  });

  it('allows class teachers and subject teachers through the mobile route contract', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, MobileTeacherStudentsController),
    ).toEqual(['teacher', 'subject_teacher']);
  });
});
