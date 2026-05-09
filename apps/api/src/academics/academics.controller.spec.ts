import type { AuthContext } from '../auth/auth.types';
import { AcademicsController } from './academics.controller';

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
  const academicsService = {
    listExamTimetable: jest.fn(),
    createExamTimetableSlot: jest.fn(),
    publishExamTimetable: jest.fn(),
    listMarksByFilters: jest.fn(),
    listMarks: jest.fn(),
    enterMark: jest.fn(),
    batchEnterMarks: jest.fn(),
    listReportCards: jest.fn(),
    listSyllabusTopics: jest.fn(),
    createSyllabusTopic: jest.fn(),
    markTopicComplete: jest.fn(),
    getSyllabusProgress: jest.fn(),
    listRemedialStudents: jest.fn(),
    listPromotionReadiness: jest.fn(),
    promoteStudent: jest.fn(),
    batchPromote: jest.fn(),
  };
  const academicsFoundationService = {
    listExamTerms: jest.fn(),
    createExamTerm: jest.fn(),
    updateExamTerm: jest.fn(),
    deleteExamTerm: jest.fn(),
  };
  const assessmentComponentsService = {
    create: jest.fn(),
    listByExamTerm: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const casRecordsService = {
    list: jest.fn(),
    create: jest.fn(),
    batchCreate: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const markLockWorkflowService = {
    unlockExamTerm: jest.fn(),
    list: jest.fn(),
    request: jest.fn(),
    review: jest.fn(),
  };
  const reportCardPdfService = {
    getReportCardPdf: jest.fn(),
  };
  const reportCardsService = {
    generateReportCard: jest.fn(),
    batchGenerateReportCards: jest.fn(),
  };
  const resultPublishingService = {
    listPublishingReadiness: jest.fn(),
    publishResults: jest.fn(),
    unpublishResults: jest.fn(),
    notifyResults: jest.fn(),
  };

  const marksEntryService = {
    enterMark: jest.fn(),
    batchEnterMarks: jest.fn(),
    listLockRequests: jest.fn(),
    reviewLockRequest: jest.fn(),
  };
  return {
    controller: new AcademicsController(
      academicsService as never,
      academicsFoundationService as never,
      assessmentComponentsService as never,
      casRecordsService as never,
      markLockWorkflowService as never,
      reportCardPdfService as never,
      reportCardsService as never,
      marksEntryService as never,
      resultPublishingService as never,
    ),
    academicsService,
    academicsFoundationService,
    assessmentComponentsService,
    casRecordsService,
    markLockWorkflowService,
    reportCardPdfService,
    reportCardsService,
    marksEntryService,
    resultPublishingService,
  };
}

describe('AcademicsController M4 contracts', () => {
  it('delegates filtered mark listing with tenant actor context', () => {
    const { controller, academicsService } = createController();
    academicsService.listMarksByFilters.mockReturnValue([{ id: 'mark-1' }]);

    const result = controller.listMarks(
      actor,
      'term-1',
      'component-1',
      'class-1',
      'section-1',
      'subject-1',
    );

    expect(academicsService.listMarksByFilters).toHaveBeenCalledWith(actor, {
      examTermId: 'term-1',
      assessmentComponentId: 'component-1',
      classId: 'class-1',
      sectionId: 'section-1',
      subjectId: 'subject-1',
    });
    expect(result).toEqual([{ id: 'mark-1' }]);
  });

  it('delegates single mark entry with current actor', () => {
    const { controller, academicsService } = createController();
    const dto = {
      examTermId: 'term-1',
      assessmentComponentId: 'component-1',
      studentId: 'student-1',
      marksObtained: 89,
      remarks: 'Good',
    };
    academicsService.enterMark.mockReturnValue({ id: 'mark-1' });

    const result = controller.enterMark(dto as never, actor);

    expect(academicsService.enterMark).toHaveBeenCalledWith(dto, actor);
    expect(result).toEqual({ id: 'mark-1' });
  });

  it('delegates transactional batch marks entry with current actor', () => {
    const { controller, academicsService } = createController();
    const dto = {
      examTermId: 'term-1',
      assessmentComponentId: 'component-1',
      entries: [{ studentId: 'student-1', marksObtained: 90 }],
    };
    academicsService.batchEnterMarks.mockReturnValue({ updated: 1 });

    const result = controller.batchEnterMarks(dto as never, actor);

    expect(academicsService.batchEnterMarks).toHaveBeenCalledWith(dto, actor);
    expect(result).toEqual({ updated: 1 });
  });

  it('delegates CAS list filters with tenant actor context', () => {
    const { controller, casRecordsService } = createController();
    casRecordsService.list.mockReturnValue([{ id: 'cas-1' }]);

    const result = controller.listCas(
      actor,
      'year-1',
      'class-1',
      'section-1',
      'subject-1',
      'student-1',
    );

    expect(casRecordsService.list).toHaveBeenCalledWith(actor, {
      academicYearId: 'year-1',
      classId: 'class-1',
      sectionId: 'section-1',
      subjectId: 'subject-1',
      studentId: 'student-1',
    });
    expect(result).toEqual([{ id: 'cas-1' }]);
  });

  it('delegates CAS batch create with current actor', () => {
    const { controller, casRecordsService } = createController();
    const dto = {
      records: [
        {
          academicYearId: 'year-1',
          subjectId: 'subject-1',
          studentId: 'student-1',
          classId: 'class-1',
          category: 'Participation',
          score: 4,
          maxScore: 5,
          observedOn: '2026-05-09',
        },
      ],
    };
    casRecordsService.batchCreate.mockReturnValue({ created: 1 });

    const result = controller.batchCreateCas(dto as never, actor);

    expect(casRecordsService.batchCreate).toHaveBeenCalledWith(dto, actor);
    expect(result).toEqual({ created: 1 });
  });

  it('delegates mark lock request/review/unlock workflows with audit-ready DTOs', () => {
    const { controller, markLockWorkflowService } = createController();
    const requestDto = { examTermId: 'term-1', reason: 'All marks verified' };
    const reviewDto = { status: 'APPROVED', reviewNote: 'Checked' };
    const unlockDto = { reason: 'Principal approved correction window' };
    markLockWorkflowService.request.mockReturnValue({ id: 'lock-1' });
    markLockWorkflowService.review.mockReturnValue({ status: 'APPROVED' });
    markLockWorkflowService.unlockExamTerm.mockReturnValue({ unlocked: true });

    expect(controller.requestMarkLock(requestDto as never, actor)).toEqual({
      id: 'lock-1',
    });
    expect(controller.reviewMarkLockRequest('lock-1', reviewDto as never, actor)).toEqual({
      status: 'APPROVED',
    });
    expect(controller.unlockExamTerm('term-1', unlockDto as never, actor)).toEqual({
      unlocked: true,
    });
    expect(markLockWorkflowService.request).toHaveBeenCalledWith(
      requestDto,
      actor,
    );
    expect(markLockWorkflowService.review).toHaveBeenCalledWith(
      'lock-1',
      reviewDto,
      actor,
    );
    expect(markLockWorkflowService.unlockExamTerm).toHaveBeenCalledWith(
      'term-1',
      unlockDto,
      actor,
    );
  });

  it('delegates report card generation and batch generation to report card service', () => {
    const { controller, reportCardsService } = createController();
    const singleDto = {
      studentId: 'student-1',
      academicYearId: 'year-1',
      examTermId: 'term-1',
    };
    const batchDto = {
      academicYearId: 'year-1',
      examTermId: 'term-1',
      classId: 'class-1',
    };
    reportCardsService.generateReportCard.mockReturnValue({ id: 'rc-1' });
    reportCardsService.batchGenerateReportCards.mockReturnValue({ queued: true });

    expect(controller.generateReportCard(singleDto as never, actor)).toEqual({
      id: 'rc-1',
    });
    expect(controller.batchGenerateReportCards(batchDto as never, actor)).toEqual({
      queued: true,
    });
    expect(reportCardsService.generateReportCard).toHaveBeenCalledWith(
      singleDto,
      actor,
    );
    expect(reportCardsService.batchGenerateReportCards).toHaveBeenCalledWith(
      batchDto,
      actor,
    );
  });

  it('delegates report card PDF access through PDF service', () => {
    const { controller, reportCardPdfService } = createController();
    const pdf = Buffer.from('%PDF-1.4');
    reportCardPdfService.getReportCardPdf.mockReturnValue(pdf);

    const result = controller.getReportCardPdf('report-card-1', actor);

    expect(reportCardPdfService.getReportCardPdf).toHaveBeenCalledWith(
      'report-card-1',
      actor,
    );
    expect(result).toBe(pdf);
  });

  it('delegates result publishing, unpublishing, and notifications with current actor', () => {
    const { controller, resultPublishingService } = createController();
    const publishDto = { reportCardIds: ['rc-1'], notifyParents: true };
    const unpublishDto = { reportCardIds: ['rc-1'], reason: 'Correction' };
    const notifyDto = { reportCardIds: ['rc-1'], message: 'Results published' };
    resultPublishingService.publishResults.mockReturnValue({ published: 1 });
    resultPublishingService.unpublishResults.mockReturnValue({ unpublished: 1 });
    resultPublishingService.notifyResults.mockReturnValue({ notified: 1 });

    expect(controller.publishResults(publishDto as never, actor)).toEqual({
      published: 1,
    });
    expect(controller.unpublishResults(unpublishDto as never, actor)).toEqual({
      unpublished: 1,
    });
    expect(controller.notifyResults(notifyDto as never, actor)).toEqual({
      notified: 1,
    });
    expect(resultPublishingService.publishResults).toHaveBeenCalledWith(
      publishDto,
      actor,
    );
    expect(resultPublishingService.unpublishResults).toHaveBeenCalledWith(
      unpublishDto,
      actor,
    );
    expect(resultPublishingService.notifyResults).toHaveBeenCalledWith(
      notifyDto,
      actor,
    );
  });

  it('delegates promotion readiness and promotion actions with current actor', () => {
    const { controller, academicsService } = createController();
    academicsService.listPromotionReadiness.mockReturnValue([{ studentId: 's1' }]);
    academicsService.promoteStudent.mockReturnValue({ id: 'promotion-1' });
    academicsService.batchPromote.mockReturnValue({ promoted: 1 });

    expect(
      controller.listPromotions(actor, 'year-1', 'class-1', 'section-1', 'READY'),
    ).toEqual([{ studentId: 's1' }]);
    expect(
      controller.promoteStudent(
        {
          studentId: 'student-1',
          fromAcademicYearId: 'year-1',
          toAcademicYearId: 'year-2',
          fromClassId: 'class-1',
          toClassId: 'class-2',
        } as never,
        actor,
      ),
    ).toEqual({ id: 'promotion-1' });
    expect(
      controller.batchPromote(
        { promotions: [{ studentId: 'student-1' }] } as never,
        actor,
      ),
    ).toEqual({ promoted: 1 });
    expect(academicsService.listPromotionReadiness).toHaveBeenCalledWith(actor, {
      academicYearId: 'year-1',
      classId: 'class-1',
      sectionId: 'section-1',
      status: 'READY',
    });
  });
});
