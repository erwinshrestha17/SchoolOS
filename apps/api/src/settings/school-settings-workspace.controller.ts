import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { SettingsService } from './settings.service';
import { SchoolSettingsNavigationV1Service } from './school-settings-navigation-v1.service';
import { SchoolSettingsProfileService } from './school-settings-profile.service';
import { UpdateSchoolProfileDto } from './dto/update-school-profile.dto';

@Controller('settings/workspaces')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class SchoolSettingsWorkspaceController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly navigationService: SchoolSettingsNavigationV1Service,
    private readonly profileService: SchoolSettingsProfileService,
  ) {}

  @Get('navigation')
  getNavigation(@CurrentAuth() auth: AuthContext) {
    return this.navigationService.getNavigation(auth);
  }

  @Get('overview')
  @Permissions('settings:read')
  async getOverview(@CurrentAuth() auth: AuthContext) {
    const [settings, navigation] = await Promise.all([
      this.settingsService.getSettings(auth.tenantId),
      Promise.resolve(this.navigationService.getNavigation(auth)),
    ]);
    const configured = new Set(settings.filter((item) => hasValue(item.value)).map((item) => item.key));
    const profileKeys = ['school_name', 'school_address', 'school_phone', 'school_email', 'principal_name'];
    const profileReady = profileKeys.every((key) => configured.has(key as never));

    return {
      generatedAt: new Date().toISOString(),
      navigation,
      readiness: [{
        id: 'school-profile',
        label: 'School Profile',
        description: profileReady ? 'Official school profile is configured.' : 'Add the required official school profile details.',
        href: '/dashboard/settings/school-profile',
        status: profileReady ? 'ready' : 'needs_attention',
      }],
    };
  }

  @Get('school-profile')
  @Permissions('settings:manage')
  getSchoolProfile(@CurrentAuth() auth: AuthContext) {
    return this.profileService.getProfile(auth.tenantId);
  }

  @Patch('school-profile')
  @Permissions('settings:manage')
  updateSchoolProfile(@Body() dto: UpdateSchoolProfileDto, @CurrentAuth() auth: AuthContext) {
    return this.profileService.updateProfile(auth.tenantId, dto, auth.userId);
  }
}

function hasValue(value: unknown) {
  return typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined;
}
