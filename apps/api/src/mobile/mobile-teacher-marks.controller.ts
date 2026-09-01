import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { MarksService } from '../academics/marks.service';
import { BulkUpsertMarksDto } from '../academics/dto/bulk-upsert-marks.dto';
import { ListMarksDto } from '../academics/dto/list-marks.dto';
import { ListAssessmentComponentsDto } from '../academics/dto/list-assessment-components.dto';

/**
 * Purpose-limited Teacher App marks surfaces. Reuses academics MarksService
 * assignment-scope enforcement; does not expose exam-term administration.
 */
@Controller('mobile/teacher/marks')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.exams')
@Roles('teacher', 'subject_teacher')
export class MobileTeacherMarksController {
  constructor(private readonly marksService: MarksService) {}

  @Get('components')
  @Permissions(
    'assessment-components:read',
    'academics:read',
    'academics:enter_marks',
  )
  listComponents(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListAssessmentComponentsDto,
  ) {
    return this.marksService.listAssignedComponents(auth, query);
  }

  @Get()
  @Permissions('marks:read', 'academics:read', 'academics:enter_marks')
  listMarks(@CurrentAuth() auth: AuthContext, @Query() query: ListMarksDto) {
    return this.marksService.listMarks(auth, query);
  }

  @Post('bulk-upsert')
  @Permissions('academics:enter_marks')
  bulkUpsert(
    @Body() dto: BulkUpsertMarksDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.marksService.bulkUpsert(dto, auth);
  }
}
