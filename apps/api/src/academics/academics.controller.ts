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
import { AcademicsService } from './academics.service';
import { CreateAssessmentComponentDto } from './dto/create-assessment-component.dto';
import { CreateCasRecordDto } from './dto/create-cas-record.dto';
import { CreateExamTermDto } from './dto/create-exam-term.dto';
import { CreateExamTimetableSlotDto } from './dto/create-exam-timetable-slot.dto';
import { EnterMarkDto } from './dto/enter-mark.dto';
import { GenerateReportCardDto } from './dto/generate-report-card.dto';
import { PromoteStudentDto } from './dto/promote-student.dto';
import { BatchPromoteDto } from './dto/batch-promote.dto';
import { RequestMarkLockDto } from './dto/request-mark-lock.dto';
import { ReviewMarkLockDto } from './dto/review-mark-lock.dto';
import { UpdateExamTermDto } from './dto/update-exam-term.dto';

@Controller('academics')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class AcademicsController {
  constructor(
    private readonly academicsService: AcademicsService,
    private readonly academicsFoundationService: AcademicsFoundationService,
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
    return this.academicsFoundationService.updateExamTerm(examTermId, dto, auth);
  }

  @Delete('exams/:id')
  @Permissions('academics:delete')
  deleteExamTerm(
    @Param('id') examTermId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsFoundationService.deleteExamTerm(examTermId, auth);
  }

  @Post('exams/components')
  @Permissions('academics:create')
  createComponent(
    @Body() dto: CreateAssessmentComponentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.createAssessmentComponent(dto, auth);
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
  listMarks(@CurrentAuth() auth: AuthContext) {
    return this.academicsService.listMarks(auth);
  }

  @Post('marks')
  @Permissions('academics:enter_marks')
  enterMark(@Body() dto: EnterMarkDto, @CurrentAuth() auth: AuthContext) {
    return this.academicsService.enterMark(dto, auth);
  }

  @Get('marks/lock-requests')
  @Permissions('academics:read')
  listMarkLockRequests(@CurrentAuth() auth: AuthContext) {
    return this.academicsService.listMarkLockRequests(auth);
  }

  @Post('marks/lock-requests')
  @Permissions('academics:enter_marks')
  requestMarkLock(
    @Body() dto: RequestMarkLockDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.requestMarkLock(dto, auth);
  }

  @Patch('marks/lock-requests/:id/review')
  @Permissions('academics:update')
  reviewMarkLockRequest(
    @Param('id') requestId: string,
    @Body() dto: ReviewMarkLockDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.reviewMarkLockRequest(requestId, dto, auth);
  }

  @Get('cas')
  @Permissions('academics:read')
  listCas(@CurrentAuth() auth: AuthContext) {
    return this.academicsService.listCasRecords(auth);
  }

  @Post('cas')
  @Permissions('academics:enter_marks')
  createCas(@Body() dto: CreateCasRecordDto, @CurrentAuth() auth: AuthContext) {
    return this.academicsService.createCasRecord(dto, auth);
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
    return this.academicsService.generateReportCard(dto, auth);
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
    return this.academicsService.getReportCardPdf(reportCardId, auth);
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
    @Query('academicYearId') academicYearId?: string,
    @Query('classId') classId?: string,
  ) {
    return this.academicsService.listPromotionReadiness(
      auth,
      academicYearId,
      classId,
    );
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
