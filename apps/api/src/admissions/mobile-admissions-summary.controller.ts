import { Controller, Get, UseGuards } from '@nestjs/common';
import { FEATURE_KEYS } from '@schoolos/core';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { MobileAdmissionsSummaryService } from './mobile-admissions-summary.service';

@Controller('mobile/principal')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement(FEATURE_KEYS.MOBILE_FULL_ROLE)
@Roles('principal', 'admin', 'platform_super_admin')
export class MobileAdmissionsSummaryController {
  constructor(private readonly mobileAdmissionsSummaryService: MobileAdmissionsSummaryService) {}

  @Get('admissions-summary')
  @Permissions('students:read', 'enrollments:read')
  getAdmissionsSummary(@CurrentAuth() actor: AuthContext) {
    return this.mobileAdmissionsSummaryService.getPrincipalSummary(actor);
  }
}
