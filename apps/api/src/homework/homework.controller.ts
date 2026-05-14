import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { HomeworkQueryDto } from './dto/homework-query.dto';
import { HomeworkSubmissionQueryDto } from './dto/homework-submission-query.dto';
import {
  LegacyReviewHomeworkSubmissionDto,
  LegacySubmitHomeworkDto,
} from './dto/legacy-submit-homework.dto';
import {
  CreateHomeworkSubmissionDto,
  RequestCorrectionDto,
  ReviewHomeworkSubmissionDto,
  UpdateHomeworkSubmissionDto,
  UpdateHomeworkSubmissionStatusDto,
} from './dto/submission.dto';
import {
  HomeworkReminderQueryDto,
  SendHomeworkReminderDto,
} from './dto/reminder.dto';
import { UpdateHomeworkDto } from './dto/update-homework.dto';
import { HomeworkAttachmentAccessService } from './homework-attachment-access.service';
import { HomeworkService } from './homework.service';

@Controller('homework')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.homework')
export class HomeworkController {
  constructor(
    private readonly homeworkService: HomeworkService,
    private readonly homeworkAttachmentAccessService: HomeworkAttachmentAccessService,
  ) {}

  // --- Assignments ---

  @Get()
  @Permissions('homework:read')
  listHomework(
    @CurrentAuth() auth: AuthContext,
    @Query() query: HomeworkQueryDto,
  ) {
    return this.homeworkService.listAssignments(auth, query);
  }

  @Post()
  @Permissions('homework:create')
  createHomework(
    @Body() dto: CreateHomeworkDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.createAssignment(dto, auth);
  }

  @Get(':id')
  @Permissions('homework:read')
  getHomework(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.homeworkService.getAssignment(auth, id);
  }

  @Patch(':id')
  @Permissions('homework:update')
  updateHomework(
    @Param('id') id: string,
    @Body() dto: UpdateHomeworkDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.updateAssignment(id, dto, auth);
  }

  @Delete(':id')
  @Permissions('homework:delete')
  deleteHomework(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.homeworkService.deleteOrCancelHomework(id, auth);
  }

  @Patch(':id/publish')
  @Permissions('homework:update')
  publishHomework(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.homeworkService.assignHomework(id, auth);
  }

  @Patch(':id/close')
  @Permissions('homework:update')
  closeHomework(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.homeworkService.closeHomework(id, auth);
  }

  @Patch(':id/cancel')
  @Permissions('homework:delete')
  cancelHomework(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.homeworkService.cancelHomework(id, auth);
  }

  // --- Submissions ---

  @Get(':id/submissions')
  @Permissions('homework:read')
  listSubmissions(
    @Param('id') id: string,
    @Query() query: HomeworkSubmissionQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.listSubmissions(auth, id, query);
  }

  @Post(':id/submissions')
  @Permissions('homework:submit')
  createSubmission(
    @Param('id') id: string,
    @Body() dto: CreateHomeworkSubmissionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.createSubmission(id, dto, auth);
  }

  @Get('submissions/:submissionId')
  @Permissions('homework:read')
  getSubmission(
    @Param('submissionId') submissionId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.getSubmission(auth, submissionId);
  }

  @Patch('submissions/:submissionId')
  @Permissions('homework:submit')
  updateSubmission(
    @Param('submissionId') submissionId: string,
    @Body() dto: UpdateHomeworkSubmissionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.updateSubmission(submissionId, dto, auth);
  }

  @Patch('submissions/:submissionId/review')
  @Permissions('homework:review')
  reviewSubmission(
    @Param('submissionId') submissionId: string,
    @Body() dto: ReviewHomeworkSubmissionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.reviewSubmission(submissionId, dto, auth);
  }

  @Patch('submissions/:submissionId/mark-reviewed')
  @Permissions('homework:review')
  markAsReviewed(
    @Param('submissionId') submissionId: string,
    @Body('feedback') feedback: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.markAsReviewed(auth, submissionId, feedback);
  }

  @Post('submissions/:submissionId/request-correction')
  @Permissions('homework:review')
  requestCorrection(
    @Param('submissionId') submissionId: string,
    @Body() dto: RequestCorrectionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.requestCorrection(submissionId, dto, auth);
  }

  // --- Reminders ---

  @Get(':id/reminders/preview')
  @Permissions('homework:notify')
  previewReminders(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.homeworkService.previewReminders(id, auth);
  }

  @Post(':id/reminders/send')
  @Permissions('homework:notify')
  sendReminders(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.homeworkService.sendReminders(id, auth);
  }

  // --- Reports ---

  @Get('reports/completion')
  @Permissions('homework:read')
  getCompletionReport(
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId: string,
    @Query('sectionId') sectionId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.getHomeworkCompletionReport(
      auth,
      academicYearId,
      classId,
      sectionId,
    );
  }

  @Get('reports/missing-late')
  @Permissions('homework:read')
  getMissingLateReport(
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.getMissingLateSubmissionsReport(
      auth,
      academicYearId,
      classId,
    );
  }

  // --- Attachments ---

  @Get('attachments/:attachmentId/preview-url')
  @Permissions('homework:read')
  getAttachmentPreviewUrl(
    @Param('attachmentId') attachmentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkAttachmentAccessService.getAttachmentAccessUrl(
      attachmentId,
      auth,
      'preview',
    );
  }

  @Get('attachments/:attachmentId/download-url')
  @Permissions('homework:read')
  getAttachmentDownloadUrl(
    @Param('attachmentId') attachmentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkAttachmentAccessService.getAttachmentAccessUrl(
      attachmentId,
      auth,
      'download',
    );
  }

  // --- Legacy Endpoints (Keep for compatibility if needed, but marked) ---

  @Post('submit')
  @Permissions('homework:submit')
  legacySubmitHomework(
    @Body() dto: LegacySubmitHomeworkDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.legacySubmit(dto, auth);
  }
}
