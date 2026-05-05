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
import { AcademicsFoundationService } from './academics-foundation.service';
import { AcademicsService, PromotionReadinessRow } from './academics.service';
import { AssessmentComponentsService } from './assessment-components.service';
import { CasRecordsService } from './cas-records.service';
import { MarkLockWorkflowService } from './mark-lock-workflow.service';
import { ReportCardPdfService } from './report-card-pdf.service';
import { ReportCardsService } from './report-cards.service';
import { CreateAssessmentComponentDto } from './dto/create-assessment-component.dto';
import { CreateCasRecordDto } from './dto/create-cas-record.dto';
import { CreateExamTermDto } from './dto/create-exam-term.dto';
import { CreateExamTimetableSlotDto } from './dto/create-exam-timetable-slot.dto';
import { EnterMarkDto } from './dto/enter-mark.dto';
import { GenerateReportCardDto } from './dto/generate-report-card.dto';
import { PromoteStudentDto } from './dto/promote-student.dto';
import { BatchPromoteDto } from './dto/batch-promote.dto';
import { BatchEnterMarksDto } from './dto/batch-enter-marks.dto';
import { BatchGenerateReportCardsDto } from './dto/batch-generate-report-cards.dto';
import { BatchCasRecordsDto } from './dto/batch-cas-records.dto';
import { RequestMarkLockDto } from './dto/request-mark-lock.dto';
import { ReviewMarkLockDto } from './dto/review-mark-lock.dto';
import { UnlockExamTermDto } from './dto/unlock-exam-term.dto';
import { UpdateExamTermDto } from './dto/update-exam-term.dto';
import { UpdateAssessmentComponentDto } from './dto/update-assessment-component.dto';
import { UpdateCasRecordDto } from './dto/update-cas-record.dto';

@Controller('academics')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class AcademicsController {
  constructor(
    private readonly academicsService: AcademicsService,
    private readonly academicsFoundationService: AcademicsFoundationService,
    private readonly assessmentComponentsService: AssessmentComponentsService,
    private readonly casRecordsService: CasRecordsService,
    private readonly markLockWorkflowService: MarkLockWorkflowService,
    private readonly reportCardPdfService: ReportCardPdfService,
    private readonly reportCardsService: ReportCardsService,
  ) {}

  @Get('exams')
  @Permissions('academics:read')
  listExamTerms(
    @CurrentAuth() auth: AuthContext,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.academicsFoundationService.listExamTerms(auth, {
      academicYearId,
    });
  }

  @Post('exams')
  @Permissions('academics:create')
  createExamTerm(
    @Body() dto: CreateExamTermDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsFoundationService.createExamTerm(dto, auth);
  }

  @Patch('exams/:id')
  @Permissions('academics:update')
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

  @Delete('exams/:id')
  @Permissions('academics:delete')
  deleteExamTerm(
    @Param('id') examTermId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsFoundationService.deleteExamTerm(examTermId, auth);
  }

  @Patch('exams/:id/unlock')
  @Permissions('academics:manage')
  unlockExamTerm(
    @Param('id') examTermId: string,
    @Body() dto: UnlockExamTermDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.markLockWorkflowService.unlockExamTerm(examTermId, dto, auth);
  }

  @Post('exams/components')
  @Permissions('academics:create')
  createComponent(
    @Body() dto: CreateAssessmentComponentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.assessmentComponentsService.create(dto, auth);
  }

  @Get('exams/:id/components')
  @Permissions('academics:read')
  listComponentsByExamTerm(
    @Param('id') examTermId: string,
    @Query('subjectId') subjectId: string | undefined,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.assessmentComponentsService.listByExamTerm(
      auth,
      examTermId,
      subjectId,
    );
  }

  @Patch('exams/components/:id')
  @Permissions('academics:update')
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

  @Delete('exams/components/:id')
  @Permissions('academics:delete')
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
  @Permissions('academics:read')
  listMarks(
    @CurrentAuth() auth: AuthContext,
    @Query('examTermId') examTermId?: string,
    @Query('assessmentComponentId') assessmentComponentId?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    if (examTermId || assessmentComponentId || classId || subjectId) {
      return this.academicsService.listMarksByFilters(auth, {
        examTermId,
        assessmentComponentId,
        classId,
        sectionId,
        subjectId,
      });
    }

    return this.academicsService.listMarks(auth);
  }

  @Post('marks')
  @Permissions('academics:enter_marks')
  enterMark(@Body() dto: EnterMarkDto, @CurrentAuth() auth: AuthContext) {
    return this.academicsService.enterMark(dto, auth);
  }

  @Post('marks/batch')
  @Permissions('academics:enter_marks')
  batchEnterMarks(
    @Body() dto: BatchEnterMarksDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.batchEnterMarks(dto, auth);
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

  @Get('cas')
  @Permissions('academics:read')
  listCas(
    @CurrentAuth() auth: AuthContext,
    @Query('academicYearId') academicYearId?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.casRecordsService.list(auth, {
      academicYearId,
      classId,
      sectionId,
      subjectId,
      studentId,
    });
  }

  @Post('cas')
  @Permissions('academics:enter_marks')
  createCas(@Body() dto: CreateCasRecordDto, @CurrentAuth() auth: AuthContext) {
    return this.casRecordsService.create(dto, auth);
  }

  @Post('cas/batch')
  @Permissions('academics:enter_marks')
  batchCreateCas(
    @Body() dto: BatchCasRecordsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.casRecordsService.batchCreate(dto, auth);
  }

  @Patch('cas/:id')
  @Permissions('academics:update')
  updateCas(
    @Param('id') casRecordId: string,
    @Body() dto: UpdateCasRecordDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.casRecordsService.update(casRecordId, dto, auth);
  }

  @Delete('cas/:id')
  @Permissions('academics:delete')
  deleteCas(
    @Param('id') casRecordId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.casRecordsService.delete(casRecordId, auth);
  }

  @Get('report-cards')
  @Permissions('academics:read')
  listReportCards(@CurrentAuth() auth: AuthContext) {
    return this.academicsService.listReportCards(auth);
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
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('status') status?: string,
  ): Promise<PromotionReadinessRow[]> {
    return this.academicsService.listPromotionReadiness(auth, {
      academicYearId,
      classId,
      sectionId,
      status,
    });
  }

  @Post('promotions')
  @Permissions('academics:update')
  promoteStudent(
    @Body() dto: PromoteStudentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.promoteStudent(dto, auth);
  }

  @Post('promotions/batch')
  @Permissions('academics:update')
  batchPromote(@Body() dto: BatchPromoteDto, @CurrentAuth() auth: AuthContext) {
    return this.academicsService.batchPromote(dto, auth);
  }
}
