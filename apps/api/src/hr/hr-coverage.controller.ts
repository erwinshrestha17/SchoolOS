import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { HrCoverageService } from './hr-coverage.service';

@Controller('hr')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.hr')
export class HrCoverageController {
  constructor(private readonly coverageService: HrCoverageService) {}

  @Get('coverage-summary')
  @Permissions('hr:read')
  getStaffCoverageSummary(@CurrentAuth() auth: AuthContext) {
    return this.coverageService.getStaffCoverageSummary(auth);
  }
}
