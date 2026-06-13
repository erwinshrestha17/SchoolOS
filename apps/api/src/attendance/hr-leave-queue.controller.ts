import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { StaffLeaveQueueService } from './staff-leave-queue.service';

@Controller('hr/leave-queue')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.hr')
export class HrLeaveQueueController {
  constructor(private readonly leaveQueueService: StaffLeaveQueueService) {}

  @Get('depth')
  @Permissions('hr:leave:approve')
  getApprovalQueueDepth(
    @CurrentAuth() auth: AuthContext,
    @Query('staleDays') staleDays?: string,
  ) {
    return this.leaveQueueService.getApprovalQueueDepth(auth, staleDays);
  }
}
