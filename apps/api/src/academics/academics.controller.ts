import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { AcademicsFoundationService } from './academics-foundation.service';
import { AcademicsService } from './academics.service';
import { AssessmentComponentsService } from './assessment-components.service';
import { CasRecordsService } from './cas-records.service';
import { MarkLockWorkflowService } from './mark-lock-workflow.service';
import { MarksService } from './marks.service';
import {
  PromotionReadinessRow,
  PromotionReadinessService,
} from './promotion-readiness.service';
import { ReportCardPdfService } from './report-card-pdf.service';
import { ReportCardsService } from './report-cards.service';
import {
  ResultPublishingService,
  PublishingReadinessRow,
} from './result-publishing.service';
import { CreateAssessmentComponentDto } from './dto/create-assessment-component.dto';
import { CreateCasRecordDto } from './dto/create-cas-record.dto';
import { CreateExamTermDto } from './dto/create-exam-term.dto';
import { CreateExamTimetableSlotDto } from './dto/create-exam-timetable-slot.dto';
import { BulkUpsertMarksDto } from './dto/bulk-upsert-marks.dto';
import { ListMarksDto } from './dto/list-marks.dto';
import { UpdateMarkDto } from './dto/update-mark.dto';
import { GenerateReportCardDto } from './dto/generate-report-card.dto';
import {
  ApplyReportCardCorrectionDto,
  RequestReportCardCorrectionDto,
} from './dto/report-card-correction.dto';
import { PromoteStudentDto } from './dto/promote-student.dto';
import { BatchPromoteDto } from './dto/batch-promote.dto';
import { ListCasRecordsDto } from './dto/list-cas-records.dto';
import { BulkUpsertCasRecordsDto } from './dto/bulk-upsert-cas-records.dto';
import { BatchGenerateReportCardsDto } from './dto/batch-generate-report-cards.dto';
import { RequestMarkLockDto } from './dto/request-mark-lock.dto';
import { ReviewMarkLockDto } from './dto/review-mark-lock.dto';
import { UnlockExamTermDto } from './dto/unlock-exam-term.dto';
import { UpdateExamTermDto } from './dto/update-exam-term.dto';
import { UpdateAssessmentComponentDto } from './dto/update-assessment-component.dto';
import { PublishResultsDto } from './dto/publish-results.dto';
import { UnpublishResultsDto } from './dto/unpublish-results.dto';
import { NotifyResultsDto } from './dto/notify-results.dto';
import { UpdateCasRecordDto } from './dto/update-cas-record.dto';
import { ListExamTermsDto } from './dto/list-exam-terms.dto';
import { ListAssessmentComponentsDto } from './dto/list-assessment-components.dto';
import { PreviewStudentResultDto } from './dto/preview-student-result.dto';
import { PreviewClassResultsDto } from './dto/preview-class-results.dto';
import { GradeCalculatorService } from './grade-calculator.service';
import { ResultsService } from './results.service';

@Controller('academics')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.exams')
export class AcademicsController {
  constructor(
    private readonly academicsService: AcademicsService,
    private readonly academicsFoundationService: AcademicsFoundationService,
    private readonly assessmentComponentsService: AssessmentComponentsService,
    private readonly casRecordsService: CasRecordsService,
    private readonly markLockWorkflowService: MarkLockWorkflowService,
    private readonly reportCardPdfService: ReportCardPdfService,
    private readonly reportCardsService: ReportCardsService,
    private readonly marksService: MarksService,
    private readonly resultPublishingService: ResultPublishingService,
    private readonly gradeCalculatorService: GradeCalculatorService,
    private readonly resultsService: ResultsService,
    private readonly promotionReadinessService: PromotionReadinessService,
  ) {}

  @Get('exam-terms')
  @Permissions('exam-terms:read', 'academics:read')
  listExamTerms(
    @CurrentAuth() auth: AuthContext,
    @Query() dto: ListExamTermsDto,
  ) {
    return this.academicsFoundationService.listExamTerms(auth, dto);
  }

  @Get('exam-terms/:id')
  @Permissions('exam-terms:read', 'academics:read')
  getExamTerm(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.academicsFoundationService.getExamTermById(id, auth);
  }

  @Post('exam-terms')
  @Permissions('exam-terms:manage', 'academics:create')
  createExamTerm(
    @Body() dto: CreateExamTermDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsFoundationService.createExamTerm(dto, auth);
  }

  @Patch('exam-terms/:id')
  @Permissions('exam-terms:manage', 'academics:update')
  updateExamTerm(
    @Param('id') examTermId: string,
    @Body() dto: UpdateExamTermDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsFoundationService.updateExamTerm(
      examTermId,
      dto,
      auth,
    );
  }

  @Patch('exam-terms/:id/status')
  @Permissions('exam-terms:manage', 'academics:update')
  updateExamTermStatus(
    @Param('id') examTermId: string,
    @Body() dto: { status: 'ARCHIVED' },
    @CurrentAuth() auth: AuthContext,
  ) {
    if (dto.status === 'ARCHIVED') {
      return this.academicsFoundationService.archiveExamTerm(examTermId, auth);
    }
  }

  @Delete('exam-terms/:id')
  @Permissions('exam-terms:manage', 'academics:delete')
  deleteExamTerm(
    @Param('id') examTermId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsFoundationService.deleteExamTerm(examTermId, auth);
  }

  @Patch('exam-terms/:id/unlock')
  @Permissions('exam-terms:manage', 'academics:manage')
  unlockExamTerm(
    @Param('id') examTermId: string,
    @Body() dto: UnlockExamTermDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.markLockWorkflowService.unlockExamTerm(examTermId, dto, auth);
  }

  @Get('assessment-components')
  @Permissions('assessment-components:read', 'academics:read')
  listComponents(
    @Query() dto: ListAssessmentComponentsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.assessmentComponentsService.list(auth, dto);
  }

  @Get('assessment-components/:id')
  @Permissions('assessment-components:read', 'academics:read')
  getComponent(
    @Param('id') assessmentComponentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.assessmentComponentsService.getById(
      assessmentComponentId,
      auth,
    );
  }

  @Post('assessment-components')
  @Permissions('assessment-components:manage', 'academics:create')
  createComponent(
    @Body() dto: CreateAssessmentComponentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.assessmentComponentsService.create(dto, auth);
  }

  @Patch('assessment-components/:id')
  @Permissions('assessment-components:manage', 'academics:update')
  updateComponent(
    @Param('id') assessmentComponentId: string,
    @Body() dto: UpdateAssessmentComponentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.assessmentComponentsService.update(
      assessmentComponentId,
      dto,
      auth,
    );
  }

  @Delete('assessment-components/:id')
  @Permissions('assessment-components:manage', 'academics:delete')
  deleteComponent(
    @Param('id') assessmentComponentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.assessmentComponentsService.delete(assessmentComponentId, auth);
  }

  @Get('exams/timetable')
  @Permissions('academics:read')
  listExamTimetable(@CurrentAuth() auth: AuthContext) {
    return this.academicsService.listExamTimetable(auth);
  }

  @Post('exams/timetable')
  @Permissions('academics:create')
  createExamTimetableSlot(
    @Body() dto: CreateExamTimetableSlotDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.createExamTimetableSlot(dto, auth);
  }

  @Post('exams/:id/timetable/publish')
  @Permissions('academics:update')
  publishExamTimetable(
    @Param('id') examTermId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.publishExamTimetable(examTermId, auth);
  }

  @Get('marks')
  @Permissions('marks:read', 'academics:read')
  listMarks(@CurrentAuth() auth: AuthContext, @Query() dto: ListMarksDto) {
    return this.marksService.listMarks(auth, dto);
  }

  @Get('marks/student/:studentId')
  @Permissions('marks:read', 'academics:read')
  getStudentHistory(
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string | undefined,
    @Query('examTermId') examTermId: string | undefined,
    @Query('subjectId') subjectId: string | undefined,
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.marksService.getStudentHistory(studentId, auth, {
      academicYearId,
      examTermId,
      subjectId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('marks/bulk-upsert')
  @Permissions('marks:manage', 'academics:enter_marks')
  bulkUpsertMarks(
    @Body() dto: BulkUpsertMarksDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.marksService.bulkUpsert(dto, auth);
  }

  @Patch('marks/:id')
  @Permissions('marks:manage', 'academics:enter_marks')
  updateMark(
    @Param('id') markId: string,
    @Body() dto: UpdateMarkDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.marksService.updateMark(markId, dto, auth);
  }

  @Get('marks/lock-requests')
  @Permissions('academics:read')
  listMarkLockRequests(
    @CurrentAuth() auth: AuthContext,
    @Query('examTermId') examTermId?: string,
    @Query('status') status?: string,
    @Query('requestedById') requestedById?: string,
  ) {
    return this.markLockWorkflowService.list(auth, {
      examTermId,
      status,
      requestedById,
    });
  }

  @Post('marks/lock-requests')
  @Permissions('academics:enter_marks')
  requestMarkLock(
    @Body() dto: RequestMarkLockDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.markLockWorkflowService.request(dto, auth);
  }

  @Patch('marks/lock-requests/:id/review')
  @Permissions('academics:update')
  reviewMarkLockRequest(
    @Param('id') requestId: string,
    @Body() dto: ReviewMarkLockDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.markLockWorkflowService.review(requestId, dto, auth);
  }

  @Get('cas-records')
  @Permissions('cas-records:read', 'academics:read')
  listCas(@CurrentAuth() auth: AuthContext, @Query() dto: ListCasRecordsDto) {
    return this.casRecordsService.list(auth, dto);
  }

  @Get('cas-records/:id')
  @Permissions('cas-records:read', 'academics:read')
  getCasDetail(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.casRecordsService.findOne(id, auth);
  }

  @Post('cas-records')
  @Permissions('cas-records:manage', 'academics:enter_marks')
  createCas(@Body() dto: CreateCasRecordDto, @CurrentAuth() auth: AuthContext) {
    return this.casRecordsService.create(dto, auth);
  }

  @Post('cas-records/bulk-upsert')
  @Permissions('cas-records:manage', 'academics:enter_marks')
  bulkUpsertCas(
    @Body() dto: BulkUpsertCasRecordsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.casRecordsService.bulkUpsert(dto, auth);
  }

  @Patch('cas-records/:id')
  @Permissions('cas-records:manage', 'academics:update')
  updateCas(
    @Param('id') casRecordId: string,
    @Body() dto: UpdateCasRecordDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.casRecordsService.update(casRecordId, dto, auth);
  }

  @Delete('cas-records/:id')
  @Permissions('cas-records:manage', 'academics:delete')
  deleteCas(
    @Param('id') casRecordId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.casRecordsService.delete(casRecordId, auth);
  }

  @Get('report-cards')
  @Permissions('academics:read')
  listReportCards(
    @CurrentAuth() auth: AuthContext,
    @Query('academicYearId') academicYearId?: string,
    @Query('examTermId') examTermId?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('status') status?: string,
  ) {
    return this.academicsService.listReportCards(auth, {
      academicYearId,
      examTermId,
      classId,
      sectionId,
      status,
    });
  }

  @Post('report-cards')
  @Permissions('academics:manage_report_cards')
  generateReportCard(
    @Body() dto: GenerateReportCardDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.reportCardsService.generateReportCard(dto, auth);
  }

  @Post('report-cards/batch')
  @Permissions('academics:manage_report_cards')
  batchGenerateReportCards(
    @Body() dto: BatchGenerateReportCardsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.reportCardsService.batchGenerateReportCards(dto, auth);
  }

  @Post('report-cards/:id/corrections')
  @Permissions('academics:manage_report_cards')
  requestReportCardCorrection(
    @Param('id') reportCardId: string,
    @Body() dto: RequestReportCardCorrectionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.reportCardsService.requestCorrection(reportCardId, dto, auth);
  }

  @Post('report-cards/:id/regenerate')
  @Permissions('academics:manage_report_cards')
  regenerateCorrectedReportCard(
    @Param('id') reportCardId: string,
    @Body() dto: ApplyReportCardCorrectionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.reportCardsService.applyCorrectionAndRegenerate(
      reportCardId,
      dto,
      auth,
    );
  }

  @Get('report-cards/:id/history')
  @Permissions('academics:read')
  listReportCardHistory(
    @Param('id') reportCardId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.reportCardsService.listHistory(reportCardId, auth);
  }

  @Get('subjects/:id/syllabus')
  @Permissions('academics:read')
  listSyllabusTopics(
    @Param('id') subjectId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.listSyllabusTopics(subjectId, auth);
  }

  @Post('subjects/:id/syllabus')
  @Permissions('academics:create')
  createSyllabusTopic(
    @Param('id') subjectId: string,
    @Body() dto: { title: string; description?: string; orderIndex?: number },
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.createSyllabusTopic(subjectId, dto, auth);
  }

  @Patch('syllabus/:id/complete')
  @Permissions('academics:update')
  markTopicComplete(
    @Param('id') topicId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.markTopicComplete(topicId, auth);
  }

  @Get('subjects/:id/syllabus/progress')
  @Permissions('academics:read')
  getSyllabusProgress(
    @Param('id') subjectId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.getSyllabusProgress(subjectId, auth);
  }

  @Get('report-cards/:id.pdf')
  @Header('Content-Type', 'application/pdf')
  @Permissions('academics:read')
  getReportCardPdf(
    @Param('id') reportCardId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.reportCardPdfService.getReportCardPdf(reportCardId, auth);
  }

  @Get('remedial')
  @Permissions('academics:read')
  listRemedialStudents(
    @CurrentAuth() auth: AuthContext,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.academicsService.listRemedialStudents(auth, academicYearId);
  }

  @Get('promotions')
  @Permissions('academics:read')
  listPromotions(
    @CurrentAuth() auth: AuthContext,
    @Query('academicYearId') academicYearId: string,
    @Query('examTermId') examTermId?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<PromotionReadinessRow[]> {
    return this.promotionReadinessService.listPromotionReadiness(auth, {
      academicYearId,
      examTermId,
      classId,
      sectionId,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('promotions')
  @Permissions('academics:update')
  promoteStudent(
    @Body() dto: PromoteStudentDto,
    @CurrentAuth() auth: AuthContext,
  ): Promise<unknown> {
    return this.promotionReadinessService.promoteStudent(dto, auth);
  }

  @Post('promotions/batch')
  @Permissions('academics:update')
  batchPromote(@Body() dto: BatchPromoteDto, @CurrentAuth() auth: AuthContext) {
    return this.promotionReadinessService.batchPromote(dto, auth);
  }

  @Get('results/publishing')
  @Permissions('academics:read')
  listPublishingReadiness(
    @CurrentAuth() auth: AuthContext,
    @Query('academicYearId') academicYearId?: string,
    @Query('examTermId') examTermId?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('status') status?: string,
  ): Promise<PublishingReadinessRow[]> {
    return this.resultPublishingService.listPublishingReadiness(auth, {
      academicYearId,
      examTermId,
      classId,
      sectionId,
      status,
    });
  }

  @Post('results/publishing/publish')
  @Permissions('academics:manage_report_cards')
  publishResults(
    @Body() dto: PublishResultsDto,
    @CurrentAuth() auth: AuthContext,
  ): Promise<unknown> {
    return this.resultPublishingService.publishResults(dto, auth);
  }

  @Post('results/publishing/unpublish')
  @Permissions('academics:manage_report_cards')
  unpublishResults(
    @Body() dto: UnpublishResultsDto,
    @CurrentAuth() auth: AuthContext,
  ): Promise<unknown> {
    return this.resultPublishingService.unpublishResults(dto, auth);
  }

  @Post('results/publishing/notify')
  @Permissions('academics:manage_report_cards')
  notifyResults(
    @Body() dto: NotifyResultsDto,
    @CurrentAuth() auth: AuthContext,
  ): Promise<unknown> {
    return this.resultPublishingService.notifyResults(dto, auth);
  }

  @Get('grading-scale')
  @Permissions('academics:read')
  getGradingScale() {
    return this.gradeCalculatorService.getGradingScale();
  }

  @Get('results/preview/student/:studentId')
  @Permissions('results:read', 'academics:read')
  previewStudentResult(
    @Param('studentId') studentId: string,
    @Query() dto: PreviewStudentResultDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.resultsService.previewStudentResult(studentId, auth, {
      examTermId: dto.examTermId,
      classId: dto.classId,
      sectionId: dto.sectionId,
      includeCas: dto.includeCas,
    });
  }

  @Get('results/preview')
  @Permissions('results:read', 'academics:read')
  previewClassResults(
    @Query() dto: PreviewClassResultsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.resultsService.previewClassResults(auth, {
      examTermId: dto.examTermId,
      classId: dto.classId,
      sectionId: dto.sectionId,
      includeCas: dto.includeCas,
      page: dto.page,
      limit: dto.limit,
    });
  }
}
