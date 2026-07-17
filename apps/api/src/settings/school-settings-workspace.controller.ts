import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { SchoolSettingsOverview } from '@schoolos/core';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantActiveGuard } from '../auth/guards/tenant-active.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { SettingsService } from './settings.service';
import { SchoolSettingsNavigationV1Service } from './school-settings-navigation-v1.service';
import { SchoolSettingsProfileService } from './school-settings-profile.service';
import { BrandingDocumentsService } from './branding-documents.service';
import { AcademicCalendarSettingsService } from './academic-calendar-settings.service';
import { SchoolSettingsIntegrationsService } from './school-settings-integrations.service';
import { UpdateSchoolProfileDto } from './dto/update-school-profile.dto';
import { UpdateBrandingDocumentsDto } from './dto/update-branding-documents.dto';
import { CreateAcademicCalendarYearDto } from './dto/create-academic-calendar-year.dto';
import { UpsertSchoolCalendarDaySettingsDto } from './dto/upsert-school-calendar-day.dto';

@Controller('settings/workspaces')
@UseGuards(JwtAuthGuard, TenantActiveGuard, RolesPermissionsGuard)
export class SchoolSettingsWorkspaceController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly navigationService: SchoolSettingsNavigationV1Service,
    private readonly profileService: SchoolSettingsProfileService,
    private readonly brandingService: BrandingDocumentsService,
    private readonly academicCalendarService: AcademicCalendarSettingsService,
    private readonly integrationsService: SchoolSettingsIntegrationsService,
  ) {}

  @Get('navigation')
  getNavigation(@CurrentAuth() auth: AuthContext) {
    return this.navigationService.getNavigation(auth);
  }

  @Get('overview')
  @Permissions('settings:read')
  async getOverview(
    @CurrentAuth() auth: AuthContext,
  ): Promise<SchoolSettingsOverview> {
    const [settings, navigation, academicCalendar, schoolName, recentChanges] =
      await Promise.all([
        this.settingsService.getSettings(auth.tenantId),
        this.navigationService.getNavigation(auth),
        this.academicCalendarService.getCalendar(auth.tenantId),
        this.settingsService.getTenantName(auth.tenantId),
        this.settingsService.listRecentSettingChanges(auth.tenantId, 5),
      ]);
    const configured = new Set(
      settings.filter((item) => hasValue(item.value)).map((item) => item.key),
    );
    const profileKeys = [
      'school_name',
      'school_address',
      'school_phone',
      'school_email',
      'principal_name',
    ];
    const profileReady = profileKeys.every((key) =>
      configured.has(key as never),
    );
    const brandingReady =
      configured.has('school_logo') && configured.has('branding_primary_color');
    const calendarReady = academicCalendar.academicYears.some(
      (year) => year.isCurrent,
    );

    const readiness: SchoolSettingsOverview['readiness'] = [
      {
        id: 'school-profile',
        label: 'School Profile',
        description: profileReady
          ? 'Official school profile is configured.'
          : 'Add the required official school profile details.',
        href: '/dashboard/settings/school-profile',
        status: profileReady ? 'ready' : 'needs_attention',
      },
      {
        id: 'branding-documents',
        label: 'Branding & Documents',
        description: brandingReady
          ? 'Official logo and document defaults are configured.'
          : 'Add an official logo and document defaults.',
        href: '/dashboard/settings/branding-documents',
        status: brandingReady ? 'ready' : 'needs_attention',
      },
      {
        id: 'academic-calendar',
        label: 'Calendar, Academic Year & Holidays',
        description: calendarReady
          ? 'A current Bikram Sambat academic year is configured.'
          : 'Create and set the current Bikram Sambat academic year.',
        href: '/dashboard/settings/academic-calendar',
        status: calendarReady ? 'ready' : 'needs_attention',
      },
    ];

    const attention = readiness
      .filter((item) => item.status === 'needs_attention')
      .slice(0, 5);

    return {
      generatedAt: new Date().toISOString(),
      schoolName,
      navigation,
      readiness,
      attention,
      recentChanges,
      primaryAction: attention.length
        ? { label: 'Complete setup', href: attention[0].href }
        : {
            label: 'Review recent changes',
            href: '/dashboard/settings/audit-export',
          },
    };
  }

  @Get('integrations')
  @Permissions('settings:read')
  getIntegrations(@CurrentAuth() auth: AuthContext) {
    return this.integrationsService.getIntegrationsStatus(auth.tenantId);
  }

  @Get('school-profile')
  @Permissions('settings:identity:manage')
  getSchoolProfile(@CurrentAuth() auth: AuthContext) {
    return this.profileService.getProfile(auth.tenantId);
  }

  @Patch('school-profile')
  @Permissions('settings:identity:manage')
  updateSchoolProfile(
    @Body() dto: UpdateSchoolProfileDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.profileService.updateProfile(auth.tenantId, dto, auth.userId);
  }

  @Get('branding-documents')
  @Permissions('settings:identity:manage')
  getBrandingDocuments(@CurrentAuth() auth: AuthContext) {
    return this.brandingService.getBranding(auth.tenantId);
  }

  @Patch('branding-documents')
  @Permissions('settings:identity:manage')
  updateBrandingDocuments(
    @Body() dto: UpdateBrandingDocumentsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.brandingService.updateBranding(auth.tenantId, dto, auth.userId);
  }

  @Get('academic-calendar')
  @Permissions('settings:academic:manage')
  getAcademicCalendar(
    @CurrentAuth() auth: AuthContext,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.academicCalendarService.getCalendar(
      auth.tenantId,
      academicYearId,
    );
  }

  @Post('academic-calendar/academic-years')
  @Permissions('settings:academic:manage')
  createAcademicCalendarYear(
    @Body() dto: CreateAcademicCalendarYearDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicCalendarService.createAcademicYear(
      auth.tenantId,
      dto,
      auth.userId,
    );
  }

  @Post('academic-calendar/academic-years/:academicYearId/set-current')
  @Permissions('settings:academic:manage')
  setCurrentAcademicCalendarYear(
    @Param('academicYearId') academicYearId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicCalendarService.setCurrentAcademicYear(
      auth.tenantId,
      academicYearId,
      auth.userId,
    );
  }

  @Post('academic-calendar/days')
  @Permissions('settings:academic:manage')
  upsertAcademicCalendarDay(
    @Body() dto: UpsertSchoolCalendarDaySettingsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicCalendarService.upsertCalendarDay(
      auth.tenantId,
      dto,
      auth.userId,
    );
  }
}

function hasValue(value: unknown) {
  return typeof value === 'string'
    ? value.trim().length > 0
    : value !== null && value !== undefined;
}
