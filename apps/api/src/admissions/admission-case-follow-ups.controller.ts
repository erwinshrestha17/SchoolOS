import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { AdmissionCaseFollowUpsService } from './admission-case-follow-ups.service';

@Controller('admissions/students')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.students')
export class AdmissionCaseFollowUpsController {
  constructor(
    private readonly followUpsService: AdmissionCaseFollowUpsService,
  ) {}

  @Get(':studentId/follow-ups')
  @Permissions('students:manage_lifecycle')
  getForStudent(
    @Param('studentId') studentId: string,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.followUpsService.getForStudent(studentId, actor);
  }
}
