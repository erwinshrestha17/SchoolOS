import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { ReviewHomeworkSubmissionDto } from './dto/review-homework-submission.dto';
import { SubmitHomeworkDto } from './dto/submit-homework.dto';
import { TimetableService } from './timetable.service';

@Controller('homework')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class HomeworkController {
  constructor(private readonly timetableService: TimetableService) {}

  @Get()
  @Permissions('homework:read')
  listHomework(
    @CurrentAuth() auth: AuthContext,
    @Query('studentId') studentId?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.timetableService.listHomework(auth, {
      studentId,
      classId,
      sectionId,
    });
  }

  @Post('reminders/process')
  @Permissions('homework:create')
  processHomeworkReminders(@CurrentAuth() auth: AuthContext) {
    return this.timetableService.processHomeworkReminders(auth);
  }

  @Post()
  @Permissions('homework:create')
  createHomework(
    @Body() dto: CreateHomeworkDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.createHomework(dto, auth);
  }

  @Get('submissions')
  @Permissions('homework:read')
  listSubmissions(@CurrentAuth() auth: AuthContext) {
    return this.timetableService.listHomeworkSubmissions(auth);
  }

  @Post('submissions')
  @Permissions('homework:review')
  reviewSubmission(
    @Body() dto: ReviewHomeworkSubmissionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.reviewHomeworkSubmission(dto, auth);
  }

  @Post('submit')
  @Permissions('homework:submit')
  submitHomework(
    @Body() dto: SubmitHomeworkDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.submitHomework(dto, auth);
  }
}
