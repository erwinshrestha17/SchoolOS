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
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { HomeworkQueryDto } from './dto/homework-query.dto';
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
import { UpdateHomeworkDto } from './dto/update-homework.dto';
import { HomeworkService } from './homework.service';

@Controller('homework')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class HomeworkController {
  constructor(private readonly homeworkService: HomeworkService) {}

  @Get()
  @Permissions('homework:read')
  listHomework(
    @CurrentAuth() auth: AuthContext,
    @Query() query: HomeworkQueryDto,
  ) {
    return this.homeworkService.listAssignments(auth, query);
  }

  @Get('submissions')
  @Permissions('homework:read')
  listLegacySubmissions(@CurrentAuth() auth: AuthContext) {
    return this.homeworkService.listSubmissions(auth);
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
  listSubmissions(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.homeworkService.listSubmissions(auth, id);
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

  @Patch('submissions/:submissionId/status')
  @Permissions('homework:update')
  updateSubmissionStatus(
    @Param('submissionId') submissionId: string,
    @Body() dto: UpdateHomeworkSubmissionStatusDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.updateSubmissionStatus(submissionId, dto, auth);
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

  @Patch('submissions/:submissionId/request-correction')
  @Permissions('homework:review')
  requestCorrection(
    @Param('submissionId') submissionId: string,
    @Body() dto: RequestCorrectionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.requestCorrection(submissionId, dto, auth);
  }
}
