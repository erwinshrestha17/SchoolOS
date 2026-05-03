import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth-request.interface';
import type {
  TenantSettingSummary,
  UpdateTenantSettingPayload,
} from '@schoolos/core';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Permissions('settings:read')
  async getSettings(
    @Req() req: AuthenticatedRequest,
  ): Promise<TenantSettingSummary[]> {
    if (!req.auth) {
      throw new UnauthorizedException('Authentication context required');
    }
    return this.settingsService.getSettings(req.auth.tenantId);
  }

  @Get('public')
  @Permissions('settings:read_public')
  async getPublicSettings(
    @Req() req: AuthenticatedRequest,
  ): Promise<TenantSettingSummary[]> {
    if (!req.auth) {
      throw new UnauthorizedException('Authentication context required');
    }
    return this.settingsService.getPublicSettings(req.auth.tenantId);
  }

  @Patch(':key')
  @Permissions('settings:manage')
  async updateSetting(
    @Param('key') key: string,
    @Body() payload: UpdateTenantSettingPayload,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true }> {
    if (!req.auth) {
      throw new UnauthorizedException('Authentication context required');
    }
    await this.settingsService.updateSetting(
      req.auth.tenantId,
      key,
      payload.value,
      req.auth.userId,
    );
    return { success: true };
  }
}
