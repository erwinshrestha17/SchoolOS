import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
  UnauthorizedException,
  Query,
} from '@nestjs/common';
import { PlatformService } from './platform.service';
import { PlatformGuard } from '../auth/guards/platform.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth-request.interface';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type {
  PaginatedResponse,
  PlatformTenantSummary,
  PlatformTenantDetail,
  PlatformTenantUsage,
} from '@schoolos/core';
import { ListPlatformTenantsDto } from './dto/list-platform-tenants.dto';
import { UpdatePlatformTenantStatusDto } from './dto/update-platform-tenant-status.dto';

@Controller('platform')
@UseGuards(JwtAuthGuard, PlatformGuard)
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('tenants')
  @Permissions('platform:read')
  async listTenants(): Promise<PlatformTenantSummary[]> {
    return this.platformService.listTenants();
  }

  @Get('tenants/page')
  @Permissions('platform:read')
  async listTenantsPage(
    @Query() query: ListPlatformTenantsDto,
  ): Promise<PaginatedResponse<PlatformTenantSummary>> {
    return this.platformService.listTenantsPage(query);
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
    @Body() body: UpdatePlatformTenantStatusDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true }> {
    if (!req.auth) {
      throw new UnauthorizedException('Authentication context required');
    }

    await this.platformService.updateTenantStatus(
      tenantId,
      body.isActive,
      req.auth.userId,
      body.reason,
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
