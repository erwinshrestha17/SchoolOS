import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PlatformService } from './platform.service';
import { PlatformGuard } from '../auth/guards/platform.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/auth-request.interface';
import { Permissions } from '../auth/decorators/permissions.decorator';
import {
  PlatformTenantSummary,
  PlatformTenantDetail,
  PlatformTenantUsage,
} from '@schoolos/core';

@Controller('platform')
@UseGuards(JwtAuthGuard, PlatformGuard)
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('tenants')
  @Permissions('platform:read')
  async listTenants(): Promise<PlatformTenantSummary[]> {
    return this.platformService.listTenants();
  }

  @Get('tenants/:tenantId')
  @Permissions('platform:read')
  async getTenantDetail(
    @Param('tenantId') tenantId: string,
  ): Promise<PlatformTenantDetail> {
    return this.platformService.getTenantDetail(tenantId);
  }

  @Patch('tenants/:tenantId/status')
  @Permissions('platform:manage')
  async updateTenantStatus(
    @Param('tenantId') tenantId: string,
    @Body('isActive') isActive: boolean,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true }> {
    await this.platformService.updateTenantStatus(
      tenantId,
      isActive,
      req.auth.userId,
    );
    return { success: true };
  }

  @Get('tenants/:tenantId/usage')
  @Permissions('platform:read')
  async getTenantUsage(
    @Param('tenantId') tenantId: string,
  ): Promise<PlatformTenantUsage> {
    return this.platformService.getTenantUsage(tenantId);
  }
}
