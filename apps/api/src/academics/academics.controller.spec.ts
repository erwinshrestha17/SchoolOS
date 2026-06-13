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
  };
  const academicsFoundationService = {
    listExamTerms: jest.fn(),
    listAssessmentTemplates: jest.fn(),
    applyAssessmentTemplate: jest.fn(),
    createExamTerm: jest.fn(),
    updateExamTerm: jest.fn(),
    deleteExamTerm: jest.fn(),
  };
  const assessmentComponentsService = {
    $transaction: jest.fn((promises: unknown[]) => Promise.all(promises)),
    create: jest.fn(),
    listByExamTerm: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const casRecordsService = {
    list: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    bulkUpsert: jest.fn(),
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

  const marksService = {
    listMarks: jest.fn(),
    getStudentHistory: jest.fn(),
    bulkUpsert: jest.fn(),
    updateMark: jest.fn(),
  };
  const resultsService = {
    previewStudentResult: jest.fn(),
    previewClassResults: jest.fn(),
  };
  const gradeCalculatorService = {
    getGradingScale: jest.fn(),
  };
  const promotionReadinessService = {
    listPromotionReadiness: jest.fn(),
    promoteStudent: jest.fn(),
    batchPromote: jest.fn(),
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
      marksService as never,
      resultPublishingService as never,
      gradeCalculatorService as never,
      resultsService as never,
      promotionReadinessService as never,
    ),
    academicsService,
    academicsFoundationService,
    assessmentComponentsService,
    casRecordsService,
    markLockWorkflowService,
    reportCardPdfService,
    reportCardsService,
    marksService,
    resultPublishingService,
    gradeCalculatorService,
    resultsService,
    promotionReadinessService,
  };
}

describe('AcademicsController M4 contracts', () => {
  it('delegates filtered mark listing with tenant actor context', () => {
    const { controller, marksService } = createController();
    const dto = {
      examTermId: 'term-1',
      assessmentComponentId: 'component-1',
      classId: 'class-1',
      sectionId: 'section-1',
      subjectId: 'subject-1',
    };
    marksService.listMarks.mockReturnValue([{ id: 'mark-1' }]);

    const result = controller.listMarks(actor, dto as never);

    expect(marksService.listMarks).toHaveBeenCalledWith(actor, dto);
    expect(result).toEqual([{ id: 'mark-1' }]);
  });

  it('delegates single mark update with current actor', () => {
    const { controller, marksService } = createController();
    const dto = {
      marksObtained: 89,
      remarks: 'Good',
    };
    marksService.updateMark.mockReturnValue({ id: 'mark-1' });

    const result = controller.updateMark('mark-1', dto as never, actor);

    expect(marksService.updateMark).toHaveBeenCalledWith('mark-1', dto, actor);
    expect(result).toEqual({ id: 'mark-1' });
  });

  it('delegates transactional bulk marks upsert with current actor', () => {
    const { controller, marksService } = createController();
    const dto = {
      examTermId: 'term-1',
      assessmentComponentId: 'component-1',
      classId: 'class-1',
      subjectId: 'subject-1',
      entries: [{ studentId: 'student-1', marksObtained: 90 }],
    };
    marksService.bulkUpsert.mockReturnValue({ updated: 1 });

    const result = controller.bulkUpsertMarks(dto as never, actor);

    expect(marksService.bulkUpsert).toHaveBeenCalledWith(dto, actor);
    expect(result).toEqual({ updated: 1 });
  });

  it('delegates CAS list with tenant actor context', () => {
    const { controller, casRecordsService } = createController();
    const dto = {
      academicYearId: 'year-1',
      classId: 'class-1',
    };
    casRecordsService.list.mockReturnValue({ items: [{ id: 'cas-1' }] });

    const result = controller.listCas(actor, dto as never);

    expect(casRecordsService.list).toHaveBeenCalledWith(actor, dto);
    expect(result).toEqual({ items: [{ id: 'cas-1' }] });
  });

  it('delegates CAS bulk upsert with current actor', () => {
    const { controller, casRecordsService } = createController();
    const dto = {
      academicYearId: 'year-1',
      classId: 'class-1',
      category: 'Participation',
      maxScore: 5,
      observedOn: '2026-05-09',
      entries: [{ studentId: 'student-1', score: 4 }],
    };
    casRecordsService.bulkUpsert.mockReturnValue({ created: 1 });

    const result = controller.bulkUpsertCas(dto as never, actor);

    expect(casRecordsService.bulkUpsert).toHaveBeenCalledWith(dto, actor);
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
    expect(
      controller.reviewMarkLockRequest('lock-1', reviewDto as never, actor),
    ).toEqual({
      status: 'APPROVED',
    });
    expect(
      controller.unlockExamTerm('term-1', unlockDto as never, actor),
    ).toEqual({
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

  it('delegates assessment template listing and application with current actor', () => {
    const { controller, academicsFoundationService } = createController();
    const dto = {
      academicYearId: 'year-1',
      classId: 'class-1',
      templateKey: 'basic-terminal',
      startsOn: '2026-06-01',
      endsOn: '2026-06-15',
    };
    academicsFoundationService.listAssessmentTemplates.mockReturnValue([
      { key: 'basic-terminal' },
    ]);
    academicsFoundationService.applyAssessmentTemplate.mockReturnValue({
      examTerm: { id: 'term-1' },
    });

    expect(controller.listAssessmentTemplates()).toEqual([
      { key: 'basic-terminal' },
    ]);
    expect(controller.applyAssessmentTemplate(dto as never, actor)).toEqual({
      examTerm: { id: 'term-1' },
    });
    expect(
      academicsFoundationService.applyAssessmentTemplate,
    ).toHaveBeenCalledWith(dto, actor);
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
    reportCardsService.batchGenerateReportCards.mockReturnValue({
      queued: true,
    });

    expect(controller.generateReportCard(singleDto as never, actor)).toEqual({
      id: 'rc-1',
    });
    expect(
      controller.batchGenerateReportCards(batchDto as never, actor),
    ).toEqual({
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
    resultPublishingService.unpublishResults.mockReturnValue({
      unpublished: 1,
    });
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
    const { controller, promotionReadinessService } = createController();
    promotionReadinessService.listPromotionReadiness.mockReturnValue([
      { studentId: 's1' },
    ]);
    promotionReadinessService.promoteStudent.mockReturnValue({
      id: 'promotion-1',
    });
    promotionReadinessService.batchPromote.mockReturnValue({ promoted: 1 });

    expect(
      controller.listPromotions(
        actor,
        'year-1',
        'term-1',
        'class-1',
        'section-1',
        'READY',
      ),
    ).toEqual([{ studentId: 's1' }]);
    expect(
      controller.promoteStudent(
        {
          studentId: 'student-1',
          academicYearId: 'year-1',
          targetAcademicYearId: 'year-2',
          toClassId: 'class-2',
        } as never,
        actor,
      ),
    ).toEqual({ id: 'promotion-1' });
    expect(
      controller.batchPromote(
        { classMappings: [{ studentIds: ['student-1'] }] } as never,
        actor,
      ),
    ).toEqual({ promoted: 1 });
    expect(
      promotionReadinessService.listPromotionReadiness,
    ).toHaveBeenCalledWith(actor, {
      academicYearId: 'year-1',
      examTermId: 'term-1',
      classId: 'class-1',
      sectionId: 'section-1',
      status: 'READY',
      page: undefined,
      limit: undefined,
    });
  });

  it('delegates results preview to ResultsService', async () => {
    const { controller, resultsService } = createController();
    const studentId = 's1';
    const dto = { examTermId: 'term-1', includeCas: true };
    jest.spyOn(resultsService, 'previewStudentResult').mockResolvedValue({
      student: { name: 'John Doe' },
      summary: { percentage: 85 },
    } as never);

    const result = await controller.previewStudentResult(
      studentId,
      dto as never,
      actor,
    );

    expect(result).toEqual({
      student: { name: 'John Doe' },
      summary: { percentage: 85 },
    });
    expect(resultsService.previewStudentResult).toHaveBeenCalledWith(
      studentId,
      actor,
      {
        examTermId: 'term-1',
        includeCas: true,
        classId: undefined,
        sectionId: undefined,
      },
    );
  });

  it('delegates class results preview to ResultsService', () => {
    const { controller, resultsService } = createController();
    const dto = { examTermId: 'term-1', classId: 'c1', includeCas: true };
    resultsService.previewClassResults.mockReturnValue({ items: [] });

    expect(controller.previewClassResults(dto as never, actor)).toEqual({
      items: [],
    });
    expect(resultsService.previewClassResults).toHaveBeenCalledWith(actor, {
      examTermId: 'term-1',
      classId: 'c1',
      includeCas: true,
      sectionId: undefined,
      page: undefined,
      limit: undefined,
    });
  });

  it('delegates grading scale to GradeCalculatorService', () => {
    const { controller, gradeCalculatorService } = createController();
    gradeCalculatorService.getGradingScale.mockReturnValue([{ grade: 'A+' }]);

    expect(controller.getGradingScale(actor)).toEqual([{ grade: 'A+' }]);
    expect(gradeCalculatorService.getGradingScale).toHaveBeenCalledWith(
      actor.tenantId,
    );
  });
});
