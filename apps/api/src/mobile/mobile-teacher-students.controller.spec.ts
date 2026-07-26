import { AuthMethod } from '@prisma/client';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { AuthContext } from '../auth/auth.types';
import { AttendanceService } from '../attendance/attendance.service';
import { MobileTeacherStudentsController } from './mobile-teacher-students.controller';
import { LearningImprovementService } from '../learning-improvement/learning-improvement.service';

describe('MobileTeacherStudentsController', () => {
  let attendanceService: jest.Mocked<
    Pick<AttendanceService, 'getTeacherMobileStudentSummary'>
  >;
  let learningImprovementService: jest.Mocked<
    Pick<
      LearningImprovementService,
      | 'getTeacherStudentLearningHub'
      | 'createFormativeAssessment'
      | 'createIntervention'
    >
  >;
  let controller: MobileTeacherStudentsController;
  let actor: AuthContext;

  beforeEach(() => {
    attendanceService = {
      getTeacherMobileStudentSummary: jest.fn(),
    };
    learningImprovementService = {
      getTeacherStudentLearningHub: jest.fn(),
      createFormativeAssessment: jest.fn(),
      createIntervention: jest.fn(),
    };
    controller = new MobileTeacherStudentsController(
      attendanceService as unknown as AttendanceService,
      learningImprovementService as unknown as LearningImprovementService,
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

  it('delegates assignment-scoped learning support reads and writes', async () => {
    learningImprovementService.getTeacherStudentLearningHub.mockResolvedValue({
      student: { id: 'student-1' },
    } as never);
    learningImprovementService.createFormativeAssessment.mockResolvedValue({
      id: 'assessment-1',
    } as never);
    learningImprovementService.createIntervention.mockResolvedValue({
      id: 'case-1',
    } as never);

    const query = {
      academicYearId: '11111111-1111-4111-8111-111111111111',
      classId: '22222222-2222-4222-8222-222222222222',
      sectionId: '33333333-3333-4333-8333-333333333333',
    };
    const assessment = {
      ...query,
      outcomeId: '44444444-4444-4444-8444-444444444444',
      subjectId: '55555555-5555-4555-8555-555555555555',
      kind: 'OBSERVATION',
      masteryStatus: 'DEVELOPING',
      assessedOn: '2026-07-26T00:00:00.000Z',
      clientSubmissionId: '66666666-6666-4666-8666-666666666666',
    };
    const intervention = {
      academicYearId: query.academicYearId,
      priority: 'ROUTINE',
      title: 'Reading follow-up',
      concernSummary: 'Two classroom checks need planned follow-up.',
      clientRequestId: '77777777-7777-4777-8777-777777777777',
    };

    await controller.getStudentLearningSupport('student-1', query, actor);
    await controller.createFormativeAssessment(
      'student-1',
      assessment as never,
      actor,
    );
    await controller.createIntervention(
      'student-1',
      intervention as never,
      actor,
    );

    expect(
      learningImprovementService.getTeacherStudentLearningHub,
    ).toHaveBeenCalledWith(actor, 'student-1', query);
    expect(
      learningImprovementService.createFormativeAssessment,
    ).toHaveBeenCalledWith(actor, {
      ...assessment,
      studentId: 'student-1',
    });
    expect(learningImprovementService.createIntervention).toHaveBeenCalledWith(
      actor,
      {
        ...intervention,
        studentId: 'student-1',
      },
    );
  });
});
