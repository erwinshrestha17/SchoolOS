import {
  Body,
  Controller,
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

@Controller('academics')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class AcademicsController {
  constructor(private readonly academicsService: AcademicsService) {}

  @Get('exams')
  @Permissions('academics:read')
  listExamTerms(@CurrentAuth() auth: AuthContext) {
    return this.academicsService.listExamTerms(auth);
  }

  @Post('exams')
  @Permissions('academics:manage')
  createExamTerm(
    @Body() dto: CreateExamTermDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.createExamTerm(dto, auth);
  }

  @Post('exams/components')
  @Permissions('academics:manage')
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
  @Permissions('academics:manage')
  createExamTimetableSlot(
    @Body() dto: CreateExamTimetableSlotDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.createExamTimetableSlot(dto, auth);
  }

  @Post('exams/:id/timetable/publish')
  @Permissions('academics:manage')
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
  @Permissions('academics:manage')
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
  listSyllabusTopics(@Param('id') subjectId: string, @CurrentAuth() auth: AuthContext) {
    return this.academicsService.listSyllabusTopics(subjectId, auth);
  }

  @Post('subjects/:id/syllabus')
  @Permissions('academics:manage')
  createSyllabusTopic(
    @Param('id') subjectId: string,
    @Body() dto: { title: string; description?: string; orderIndex?: number },
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.createSyllabusTopic(subjectId, dto, auth);
  }

  @Patch('syllabus/:id/complete')
  @Permissions('academics:manage')
  markTopicComplete(@Param('id') topicId: string, @CurrentAuth() auth: AuthContext) {
    return this.academicsService.markTopicComplete(topicId, auth);
  }

  @Get('subjects/:id/syllabus/progress')
  @Permissions('academics:read')
  getSyllabusProgress(@Param('id') subjectId: string, @CurrentAuth() auth: AuthContext) {
    return this.academicsService.getSyllabusProgress(subjectId, auth);
  }

  @Post('homework')
  @Permissions('academics:manage')
  createHomework(
    @Body() dto: {
      academicYearId: string;
      classId: string;
      sectionId?: string;
      subjectId: string;
      title: string;
      instructions: string;
      dueAt: string;
      maxScore?: number;
    },
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.createHomework(dto, auth);
  }

  @Get('homework')
  @Permissions('academics:read')
  listHomeworks(
    @Query('classId') classId: string,
    @Query('subjectId') subjectId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.listHomeworks(auth, classId, subjectId);
  }

  @Get('homework/:id/submissions')
  @Permissions('academics:read')
  listHomeworkSubmissions(@Param('id') homeworkId: string, @CurrentAuth() auth: AuthContext) {
    return this.academicsService.listHomeworkSubmissions(homeworkId, auth);
  }

  @Patch('homework/submissions/:id/review')
  @Permissions('academics:manage')
  reviewHomeworkSubmission(
    @Param('id') submissionId: string,
    @Body() dto: { status: 'ASSIGNED' | 'SUBMITTED' | 'REVIEWED' | 'LATE'; score?: number; feedback?: string },
    @CurrentAuth() auth: AuthContext,
  ) {
    // Need to cast the string to HomeworkStatus inside the service or here.
    // The service expects HomeworkStatus, so we can cast it if we import it, or just pass it since TS matches strings to string enums.
    return this.academicsService.reviewHomeworkSubmission(submissionId, dto as any, auth);
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
  @Permissions('academics:manage')
  promoteStudent(
    @Body() dto: PromoteStudentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.promoteStudent(dto, auth);
  }

  @Post('promotions/batch')
  @Permissions('academics:manage')
  batchPromote(
    @Body() dto: BatchPromoteDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicsService.batchPromote(dto, auth);
  }
}
