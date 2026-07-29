import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { TenantActiveGuard } from '../auth/guards/tenant-active.guard';
import { HomeroomSummaryService } from './homeroom-summary.service';

export class HomeroomSummaryQueryDto {
  @IsString()
  classId!: string;

  @IsString()
  sectionId!: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;
}

/**
 * Class Teacher homeroom views. Read-only by design: there is deliberately no
 * write route on this controller, because everything it exposes belongs to
 * other Subject Teachers.
 *
 * The `@Permissions('students:read')` decorator is only the coarse gate. The
 * real check is per-section inside the service, via
 * HOMEROOM_ACADEMIC_SUMMARY_READ -- a teacher holding students:read but no
 * CLASS_TEACHER assignment for the requested section gets a 403, so the
 * classId/sectionId query parameters cannot be used to reach another
 * homeroom.
 */
@Controller('teacher-workspace/homeroom')
@UseGuards(
  JwtAuthGuard,
  TenantActiveGuard,
  RolesPermissionsGuard,
  EntitlementGuard,
)
@Entitlement('module.students')
@Roles('teacher', 'subject_teacher')
export class HomeroomSummaryController {
  constructor(
    private readonly homeroomSummaryService: HomeroomSummaryService,
  ) {}

  @Get()
  @Permissions('students:read')
  listMyHomerooms(@CurrentAuth() auth: AuthContext) {
    return this.homeroomSummaryService.listMyHomerooms(auth);
  }

  @Get('academic-summary')
  @Permissions('students:read')
  getAcademicSummary(
    @CurrentAuth() auth: AuthContext,
    @Query() query: HomeroomSummaryQueryDto,
  ) {
    return this.homeroomSummaryService.getHomeroomAcademicSummary(auth, {
      classId: query.classId,
      sectionId: query.sectionId,
      academicYearId: query.academicYearId,
    });
  }
}
