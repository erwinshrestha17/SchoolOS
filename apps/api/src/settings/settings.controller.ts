import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
  UnauthorizedException,
  Post,
  Delete,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PlatformService } from '../platform/platform.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth-request.interface';
import type {
  TenantSettingSummary,
  UpdateTenantSettingPayload,
} from '@schoolos/core';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import type { AuthContext } from '../auth/auth.types';
import { UploadTenantLogoDto } from './dto/upload-tenant-logo.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly platformService: PlatformService,
  ) {}

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

  @Get('onboarding')
  @Permissions('settings:read')
  async getOnboarding(@Req() req: AuthenticatedRequest) {
    if (!req.auth) {
      throw new UnauthorizedException('Authentication context required');
    }
    return this.platformService.getOnboardingChecklist(req.auth.tenantId);
  }

  @Post('branding/logo')
  @Permissions('settings:manage')
  uploadSchoolLogo(
    @Body() dto: UploadTenantLogoDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.settingsService.uploadSchoolLogo(dto, auth);
  }

  @Get('branding/logo/preview')
  @Permissions('settings:read')
  previewSchoolLogo(@CurrentAuth() auth: AuthContext) {
    return this.settingsService.getSchoolLogoAccess(auth, 'preview');
  }

  @Get('branding/logo/download')
  @Permissions('settings:read')
  downloadSchoolLogo(@CurrentAuth() auth: AuthContext) {
    return this.settingsService.getSchoolLogoAccess(auth, 'download');
  }

  @Delete('branding/logo')
  @Permissions('settings:manage')
  removeSchoolLogo(@CurrentAuth() auth: AuthContext) {
    return this.settingsService.removeSchoolLogo(auth);
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
