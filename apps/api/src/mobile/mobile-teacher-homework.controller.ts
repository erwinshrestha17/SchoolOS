import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { CreateHomeworkDto } from '../homework/dto/create-homework.dto';
import { ReviewHomeworkSubmissionDto } from '../homework/dto/submission.dto';
import { UpdateHomeworkDto } from '../homework/dto/update-homework.dto';
import { HomeworkService } from '../homework/homework.service';
import {
  MobileTeacherHomeworkQueryDto,
  MobileTeacherHomeworkSubmissionQueryDto,
} from './dto/mobile-teacher-homework.dto';

@Controller('mobile/teacher/homework')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.homework')
@Roles('teacher', 'subject_teacher')
export class MobileTeacherHomeworkController {
  constructor(private readonly homeworkService: HomeworkService) {}

  @Get('scopes')
  @Permissions('homework:read')
  listScopes(@CurrentAuth() auth: AuthContext) {
    return this.homeworkService.listTeacherMobileHomeworkScopes(auth);
  }

  @Get()
  @Permissions('homework:read')
  listHomework(
    @CurrentAuth() auth: AuthContext,
    @Query() query: MobileTeacherHomeworkQueryDto,
  ) {
    return this.homeworkService.listTeacherMobileHomework(auth, query);
  }

  @Post()
  @Permissions('homework:create')
  createHomework(
    @Body() dto: CreateHomeworkDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.createTeacherMobileHomework(dto, auth);
  }

  @Get(':id')
  @Permissions('homework:read')
  getHomework(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.homeworkService.getTeacherMobileHomework(auth, id);
  }

  @Patch(':id')
  @Permissions('homework:update')
  updateHomework(
    @Param('id') id: string,
    @Body() dto: UpdateHomeworkDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.updateTeacherMobileHomework(id, dto, auth);
  }

  @Post(':id/publish')
  @Permissions('homework:update')
  publishHomework(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.homeworkService.publishTeacherMobileHomework(id, auth);
  }

  @Get(':id/submissions')
  @Permissions('homework:read')
  listSubmissions(
    @Param('id') id: string,
    @Query() query: MobileTeacherHomeworkSubmissionQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.listTeacherMobileHomeworkSubmissions(
      auth,
      id,
      query,
    );
  }

  @Patch('submissions/:submissionId/review')
  @Permissions('homework:review')
  reviewSubmission(
    @Param('submissionId') submissionId: string,
    @Body() dto: ReviewHomeworkSubmissionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.homeworkService.reviewTeacherMobileHomeworkSubmission(
      auth,
      submissionId,
      dto,
    );
  }
}
