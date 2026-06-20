import { AuthMethod, HomeworkSubmissionStatus } from '@prisma/client';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { AuthContext } from '../auth/auth.types';
import { HomeworkService } from '../homework/homework.service';
import { MobileTeacherHomeworkController } from './mobile-teacher-homework.controller';

describe('MobileTeacherHomeworkController', () => {
  let homeworkService: jest.Mocked<
    Pick<
      HomeworkService,
      | 'listTeacherMobileHomeworkScopes'
      | 'listTeacherMobileHomework'
      | 'createTeacherMobileHomework'
      | 'getTeacherMobileHomework'
      | 'updateTeacherMobileHomework'
      | 'publishTeacherMobileHomework'
      | 'listTeacherMobileHomeworkSubmissions'
      | 'reviewTeacherMobileHomeworkSubmission'
    >
  >;
  let controller: MobileTeacherHomeworkController;
  let actor: AuthContext;

  beforeEach(() => {
    homeworkService = {
      listTeacherMobileHomeworkScopes: jest.fn(),
      listTeacherMobileHomework: jest.fn(),
      createTeacherMobileHomework: jest.fn(),
      getTeacherMobileHomework: jest.fn(),
      updateTeacherMobileHomework: jest.fn(),
      publishTeacherMobileHomework: jest.fn(),
      listTeacherMobileHomeworkSubmissions: jest.fn(),
      reviewTeacherMobileHomeworkSubmission: jest.fn(),
    };
    controller = new MobileTeacherHomeworkController(
      homeworkService as unknown as HomeworkService,
    );
    actor = {
      userId: 'teacher-user-1',
      tenantId: 'tenant-1',
      tenantSlug: 'school',
      email: 'teacher@school.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['teacher'],
      permissions: ['homework:read', 'homework:create', 'homework:review'],
    };
  });

  it('delegates assigned homework scopes to the teacher-scoped service', async () => {
    homeworkService.listTeacherMobileHomeworkScopes.mockResolvedValue({
      items: [{ id: 'year-1:class-1:section-1:subject-1' }],
    } as never);

    await expect(controller.listScopes(actor)).resolves.toEqual({
      items: [{ id: 'year-1:class-1:section-1:subject-1' }],
    });
    expect(
      homeworkService.listTeacherMobileHomeworkScopes,
    ).toHaveBeenCalledWith(actor);
  });

  it('allows subject teachers through the existing mobile homework route contract', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, MobileTeacherHomeworkController),
    ).toEqual(['teacher', 'subject_teacher']);
  });

  it('delegates list to teacher-scoped mobile homework service', async () => {
    const query = { classId: 'class-1', limit: 20 };
    homeworkService.listTeacherMobileHomework.mockResolvedValue({
      items: [{ id: 'homework-1' }],
      total: 1,
      page: 1,
      limit: 20,
    } as never);

    await expect(controller.listHomework(actor, query)).resolves.toEqual({
      items: [{ id: 'homework-1' }],
      total: 1,
      page: 1,
      limit: 20,
    });
    expect(homeworkService.listTeacherMobileHomework).toHaveBeenCalledWith(
      actor,
      query,
    );
  });

  it('delegates create, update, and publish through mobile-scoped methods', async () => {
    const createDto = {
      academicYearId: 'year-1',
      classId: 'class-1',
      subjectId: 'subject-1',
      title: 'Fractions',
      instructions: 'Solve page 10',
      dueDate: '2026-06-22T00:00:00.000Z',
    };
    homeworkService.createTeacherMobileHomework.mockResolvedValue({
      id: 'homework-1',
    } as never);
    homeworkService.updateTeacherMobileHomework.mockResolvedValue({
      id: 'homework-1',
      title: 'Updated',
    } as never);
    homeworkService.publishTeacherMobileHomework.mockResolvedValue({
      id: 'homework-1',
      status: 'ASSIGNED',
    } as never);

    await expect(
      controller.createHomework(createDto as never, actor),
    ).resolves.toEqual({ id: 'homework-1' });
    await expect(
      controller.updateHomework('homework-1', { title: 'Updated' }, actor),
    ).resolves.toEqual({ id: 'homework-1', title: 'Updated' });
    await expect(
      controller.publishHomework('homework-1', actor),
    ).resolves.toEqual({ id: 'homework-1', status: 'ASSIGNED' });

    expect(homeworkService.createTeacherMobileHomework).toHaveBeenCalledWith(
      createDto,
      actor,
    );
    expect(homeworkService.updateTeacherMobileHomework).toHaveBeenCalledWith(
      'homework-1',
      { title: 'Updated' },
      actor,
    );
    expect(homeworkService.publishTeacherMobileHomework).toHaveBeenCalledWith(
      'homework-1',
      actor,
    );
  });

  it('delegates submission list and review through mobile-scoped methods', async () => {
    const query = { status: HomeworkSubmissionStatus.SUBMITTED };
    const dto = {
      status: HomeworkSubmissionStatus.REVIEWED,
      teacherRemarks: 'Good work',
    };
    homeworkService.listTeacherMobileHomeworkSubmissions.mockResolvedValue({
      items: [{ id: 'submission-1' }],
      total: 1,
      page: 1,
      limit: 20,
    } as never);
    homeworkService.reviewTeacherMobileHomeworkSubmission.mockResolvedValue({
      id: 'submission-1',
      status: 'REVIEWED',
    } as never);

    await expect(
      controller.listSubmissions('homework-1', query, actor),
    ).resolves.toEqual({
      items: [{ id: 'submission-1' }],
      total: 1,
      page: 1,
      limit: 20,
    });
    await expect(
      controller.reviewSubmission('submission-1', dto, actor),
    ).resolves.toEqual({ id: 'submission-1', status: 'REVIEWED' });

    expect(
      homeworkService.listTeacherMobileHomeworkSubmissions,
    ).toHaveBeenCalledWith(actor, 'homework-1', query);
    expect(
      homeworkService.reviewTeacherMobileHomeworkSubmission,
    ).toHaveBeenCalledWith(actor, 'submission-1', dto);
  });
});
