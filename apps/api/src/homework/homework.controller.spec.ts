import type { AuthContext } from '../auth/auth.types';
import { HomeworkController } from './homework.controller';

const actor: AuthContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  email: 'teacher@school.test',
  roles: ['teacher'],
  permissions: [],
  authMethod: 'PASSWORD',
};

function createController() {
  const homeworkService = {
    listAssignments: jest.fn(),
    listSubmissions: jest.fn(),
    legacyReview: jest.fn(),
    legacySubmit: jest.fn(),
    getAssignment: jest.fn(),
    createAssignment: jest.fn(),
    updateAssignment: jest.fn(),
    deleteOrCancelHomework: jest.fn(),
    cancelHomework: jest.fn(),
    assignHomework: jest.fn(),
    closeHomework: jest.fn(),
    sendHomeworkReminder: jest.fn(),
    listHomeworkReminderBatches: jest.fn(),
    retryHomeworkReminderBatch: jest.fn(),
    createSubmission: jest.fn(),
    updateSubmission: jest.fn(),
    updateSubmissionStatus: jest.fn(),
    reviewSubmission: jest.fn(),
    requestCorrection: jest.fn(),
  };
  const homeworkAttachmentAccessService = {
    getAttachmentAccessUrl: jest.fn(),
  };

  return {
    controller: new HomeworkController(
      homeworkService as never,
      homeworkAttachmentAccessService as never,
    ),
    homeworkService,
    homeworkAttachmentAccessService,
  };
}

describe('HomeworkController M6 contracts', () => {
  it('delegates list filters with current actor', () => {
    const { controller, homeworkService } = createController();
    const query = {
      academicYearId: 'year-1',
      classId: 'class-1',
      sectionId: 'section-1',
      subjectId: 'subject-1',
      page: 1,
      limit: 50,
    };
    homeworkService.listAssignments.mockReturnValue([{ id: 'homework-1' }]);

    const result = controller.listHomework(actor, query as never);

    expect(homeworkService.listAssignments).toHaveBeenCalledWith(actor, query);
    expect(result).toEqual([{ id: 'homework-1' }]);
  });

  it('delegates assignment lifecycle commands with current actor', () => {
    const { controller, homeworkService } = createController();
    homeworkService.assignHomework.mockReturnValue({ status: 'ASSIGNED' });
    homeworkService.closeHomework.mockReturnValue({ status: 'CLOSED' });
    homeworkService.cancelHomework.mockReturnValue({ status: 'CANCELLED' });

    expect(controller.assignHomework('homework-1', actor)).toEqual({
      status: 'ASSIGNED',
    });
    expect(controller.closeHomework('homework-1', actor)).toEqual({
      status: 'CLOSED',
    });
    expect(controller.cancelHomework('homework-1', actor)).toEqual({
      status: 'CANCELLED',
    });
    expect(homeworkService.assignHomework).toHaveBeenCalledWith(
      'homework-1',
      actor,
    );
    expect(homeworkService.closeHomework).toHaveBeenCalledWith(
      'homework-1',
      actor,
    );
    expect(homeworkService.cancelHomework).toHaveBeenCalledWith(
      'homework-1',
      actor,
    );
  });

  it('delegates reminder send/list through service boundary', () => {
    const { controller, homeworkService } = createController();
    const reminderDto = { reminderType: 'HOMEWORK_DUE_SOON' } as any;
    homeworkService.sendHomeworkReminder.mockReturnValue({ id: 'batch-1' });
    homeworkService.listHomeworkReminderBatches.mockReturnValue([{ id: 'batch-1' }]);

    expect(controller.sendReminder('homework-1', reminderDto, actor)).toEqual({
      id: 'batch-1',
    });
    expect(controller.listAssignmentReminders('homework-1', {} as any, actor)).toEqual([{
      id: 'batch-1',
    }]);
    expect(homeworkService.sendHomeworkReminder).toHaveBeenCalledWith(
      'homework-1',
      reminderDto,
      actor,
    );
    expect(homeworkService.listHomeworkReminderBatches).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ homeworkId: 'homework-1' }),
    );
  });

  it('delegates late/correction submission lifecycle routes with current actor', () => {
    const { controller, homeworkService } = createController();
    const submitDto = {
      studentId: 'student-1',
      submissionText: 'Answer',
      submittedAt: '2026-05-09T10:00:00.000Z',
      attachmentIds: ['file-1'],
    };
    const reviewDto = { score: 9, teacherRemarks: 'Good' };
    const correctionDto = { correctionRemarks: 'Please improve diagram' };
    homeworkService.createSubmission.mockReturnValue({ status: 'SUBMITTED' });
    homeworkService.reviewSubmission.mockReturnValue({ status: 'REVIEWED' });
    homeworkService.requestCorrection.mockReturnValue({
      status: 'NEEDS_CORRECTION',
    });

    expect(
      controller.createSubmission('homework-1', submitDto as never, actor),
    ).toEqual({
      status: 'SUBMITTED',
    });
    expect(
      controller.reviewSubmission('submission-1', reviewDto as never, actor),
    ).toEqual({
      status: 'REVIEWED',
    });
    expect(
      controller.requestCorrection(
        'submission-1',
        correctionDto as never,
        actor,
      ),
    ).toEqual({
      status: 'NEEDS_CORRECTION',
    });
    expect(homeworkService.createSubmission).toHaveBeenCalledWith(
      'homework-1',
      submitDto,
      actor,
    );
    expect(homeworkService.reviewSubmission).toHaveBeenCalledWith(
      'submission-1',
      reviewDto,
      actor,
    );
    expect(homeworkService.requestCorrection).toHaveBeenCalledWith(
      'submission-1',
      correctionDto,
      actor,
    );
  });

  it('delegates signed attachment preview/download through access service', () => {
    const { controller, homeworkAttachmentAccessService } = createController();
    homeworkAttachmentAccessService.getAttachmentAccessUrl.mockReturnValue({
      attachmentId: 'attachment-1',
      url: '/api/v1/files/file-1/preview',
    });

    expect(controller.getAttachmentPreviewUrl('attachment-1', actor)).toEqual({
      attachmentId: 'attachment-1',
      url: '/api/v1/files/file-1/preview',
    });
    expect(controller.getAttachmentDownloadUrl('attachment-1', actor)).toEqual({
      attachmentId: 'attachment-1',
      url: '/api/v1/files/file-1/preview',
    });
    expect(
      homeworkAttachmentAccessService.getAttachmentAccessUrl,
    ).toHaveBeenNthCalledWith(1, 'attachment-1', actor, 'preview');
    expect(
      homeworkAttachmentAccessService.getAttachmentAccessUrl,
    ).toHaveBeenNthCalledWith(2, 'attachment-1', actor, 'download');
  });
});
