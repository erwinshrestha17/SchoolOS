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
import { RequiresFeature } from '../platform/feature-entitlement.decorator';
import { FeatureEntitlementGuard } from '../platform/feature-entitlement.guard';
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
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class HomeworkController {
  constructor(
    private readonly homeworkService: HomeworkService,
    private readonly homeworkAttachmentAccessService: HomeworkAttachmentAccessService,
  ) {}

  @Get()
  @UseGuards(FeatureEntitlementGuard)
  @Permissions('homework:read')
  @RequiresFeature('module.homework')
  listHomework(
    @CurrentAuth() auth: AuthContext,
    @Query() query: HomeworkQueryDto,
  ) {
    return this.homeworkService.listAssignments(auth, query);
  }

  @Get('assignments')
  @Permissions('homework:read')
  listAssignments(
    @CurrentAuth() auth: AuthContext,
    @Query() query: HomeworkQueryDto,
  ) {
    return this.homeworkService.listAssignments(auth, query);
  }

  @Post('assignments')
  @UseGuards(FeatureEntitlementGuard)
  @Permissions('homework:create')
  @RequiresFeature('module.homework')
  createAssignment(
    @Body() dto: CreateHomeworkDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.createAssignment(dto, auth);
  }

  @Get('assignments/:id')
  @Permissions('homework:read')
  getAssignment(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.homeworkService.getAssignment(auth, id);
  }

  @Patch('assignments/:id')
  @Permissions('homework:update')
  updateAssignment(
    @Param('id') id: string,
    @Body() dto: UpdateHomeworkDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.updateAssignment(id, dto, auth);
  }

  @Post('assignments/:id/publish')
  @Permissions('homework:update')
  publishAssignment(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.homeworkService.assignHomework(id, auth);
  }

  @Post('assignments/:id/close')
  @Permissions('homework:update')
  closeAssignment(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.homeworkService.closeHomework(id, auth);
  }

  @Post('assignments/:id/archive')
  @Permissions('homework:delete')
  archiveAssignment(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.homeworkService.cancelHomework(id, auth);
  }

  @Post('assignments/:id/reminders')
  @Permissions('homework:update')
  sendReminder(
    @Param('id') id: string,
    @Body() dto: SendHomeworkReminderDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.sendHomeworkReminder(id, dto, auth);
  }

  @Get('assignments/:id/reminders')
  @Permissions('homework:read')
  listAssignmentReminders(
    @Param('id') id: string,
    @Query() query: HomeworkReminderQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.listHomeworkReminderBatches(auth, {
      ...query,
      homeworkId: id,
    });
  }

  @Get('reminder-batches')
  @Permissions('homework:read')
  listReminderBatches(
    @Query() query: HomeworkReminderQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.listHomeworkReminderBatches(auth, query);
  }

  @Post('reminder-batches/:id/retry')
  @Permissions('homework:update')
  retryReminderBatch(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.retryHomeworkReminderBatch(id, auth);
  }

  @Get('assignments/:id/submissions')
  @Permissions('homework:read')
  listAssignmentSubmissions(
    @Param('id') id: string,
    @Query() query: HomeworkSubmissionQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.listSubmissions(auth, id, query);
  }

  @Post('assignments/:id/submissions')
  @Permissions('homework:submit')
  createAssignmentSubmission(
    @Param('id') id: string,
    @Body() dto: CreateHomeworkSubmissionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.createSubmission(id, dto, auth);
  }

  @Get('submissions')
  @Permissions('homework:read')
  listLegacySubmissions(
    @CurrentAuth() auth: AuthContext,
    @Query('assignmentId') assignmentId: string | undefined,
    @Query() query: HomeworkSubmissionQueryDto,
  ) {
    return this.homeworkService.listSubmissions(auth, assignmentId, query);
  }

  @Post('submissions')
  @Permissions('homework:review')
  legacyReviewSubmission(
    @Body() dto: LegacyReviewHomeworkSubmissionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.legacyReview(dto, auth);
  }

  @Post('submit')
  @Permissions('homework:submit')
  legacySubmitHomework(
    @Body() dto: LegacySubmitHomeworkDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.legacySubmit(dto, auth);
  }

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

  @Get(':id')
  @Permissions('homework:read')
  getHomework(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.homeworkService.getAssignment(auth, id);
  }

  @Post()
  @Permissions('homework:create')
  createHomework(
    @Body() dto: CreateHomeworkDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.createAssignment(dto, auth);
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

  @Patch(':id/cancel')
  @Permissions('homework:delete')
  cancelHomework(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.homeworkService.cancelHomework(id, auth);
  }

  @Patch(':id/assign')
  @Permissions('homework:update')
  assignHomework(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.homeworkService.assignHomework(id, auth);
  }

  @Patch(':id/close')
  @Permissions('homework:update')
  closeHomework(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.homeworkService.closeHomework(id, auth);
  }

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

  @Patch('submissions/:submissionId')
  @Permissions('homework:submit')
  updateSubmission(
    @Param('submissionId') submissionId: string,
    @Body() dto: UpdateHomeworkSubmissionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.updateSubmission(submissionId, dto, auth);
  }

  @Post('submissions/:submissionId/review')
  @Patch('submissions/:submissionId/review')
  @Permissions('homework:review')
  reviewSubmission(
    @Param('submissionId') submissionId: string,
    @Body() dto: ReviewHomeworkSubmissionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.reviewSubmission(submissionId, dto, auth);
  }

  @Patch('submissions/:submissionId/status')
  @Permissions('homework:update')
  updateSubmissionStatus(
    @Param('submissionId') submissionId: string,
    @Body() dto: UpdateHomeworkSubmissionStatusDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.updateSubmissionStatus(submissionId, dto, auth);
  }

  @Post('submissions/:submissionId/correction-request')
  @Patch('submissions/:submissionId/request-correction')
  @Permissions('homework:review')
  requestCorrection(
    @Param('submissionId') submissionId: string,
    @Body() dto: RequestCorrectionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.requestCorrection(submissionId, dto, auth);
  }

  @Post('submissions/:submissionId/resubmit')
  @Permissions('homework:submit')
  resubmitCorrection(
    @Param('submissionId') submissionId: string,
    @Body() dto: UpdateHomeworkSubmissionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.updateSubmission(submissionId, dto, auth);
  }
}
