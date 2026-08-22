import { ForbiddenException } from '@nestjs/common';
import {
  PRINCIPAL_PERMISSION_KEYS,
  isPrincipalRestrictedFromInstitutionalSettings,
} from '@schoolos/core';
import type { AuthContext } from '../auth/auth.types';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { SchoolSettingsWorkspaceController } from './school-settings-workspace.controller';

const principalAuth = (overrides: Partial<AuthContext> = {}): AuthContext => ({
  userId: 'principal-1',
  tenantId: 'tenant-1',
  tenantSlug: 'green-valley',
  email: 'principal@school.test',
  authMethod: 'PASSWORD',
  roles: ['principal'],
  permissions: [...PRINCIPAL_PERMISSION_KEYS],
  ...overrides,
});

const ownerAuth = (): AuthContext =>
  principalAuth({
    roles: ['principal', 'school_config_owner'],
    permissions: [
      ...PRINCIPAL_PERMISSION_KEYS,
      'settings:manage',
      'settings:delegate',
      'settings:identity:manage',
    ],
  });

describe('Principal institutional settings boundary', () => {
  it('restricts Principal-only but not Principal + School Configuration Owner', () => {
    expect(
      isPrincipalRestrictedFromInstitutionalSettings(principalAuth().roles),
    ).toBe(true);
    expect(
      isPrincipalRestrictedFromInstitutionalSettings(ownerAuth().roles),
    ).toBe(false);
  });

  it('blocks GET /settings and onboarding for Principal-only before service reads', async () => {
    const settingsService = {
      getSettings: jest.fn().mockResolvedValue([]),
    };
    const platformService = {
      getOnboardingChecklist: jest.fn().mockResolvedValue({}),
    };
    const controller = new SettingsController(
      settingsService as never,
      platformService as never,
    );
    const request = { auth: principalAuth() } as never;

    await expect(controller.getSettings(request)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(controller.getOnboarding(request)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(settingsService.getSettings).not.toHaveBeenCalled();
    expect(platformService.getOnboardingChecklist).not.toHaveBeenCalled();
  });

  it('allows Principal + School Configuration Owner to use institutional reads', async () => {
    const settingsService = {
      getSettings: jest.fn().mockResolvedValue([]),
    };
    const platformService = {
      getOnboardingChecklist: jest.fn().mockResolvedValue({ total: 0 }),
    };
    const controller = new SettingsController(
      settingsService as never,
      platformService as never,
    );
    const request = { auth: ownerAuth() } as never;

    await expect(controller.getSettings(request)).resolves.toEqual([]);
    await expect(controller.getOnboarding(request)).resolves.toEqual({
      total: 0,
    });
    expect(settingsService.getSettings).toHaveBeenCalledWith('tenant-1');
  });

  it('returns no institutional Settings navigation for Principal-only', async () => {
    const navigationService = {
      getNavigation: jest.fn().mockResolvedValue({
        generatedAt: '2026-08-22T00:00:00.000Z',
        groups: [{ id: 'school-setup', label: 'School Setup', items: [] }],
      }),
    };
    const controller = new SchoolSettingsWorkspaceController(
      {} as never,
      navigationService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const navigation = await controller.getNavigation(principalAuth());
    expect(navigation.groups).toEqual([]);
    expect(navigationService.getNavigation).not.toHaveBeenCalled();

    await controller.getNavigation(ownerAuth());
    expect(navigationService.getNavigation).toHaveBeenCalledWith(ownerAuth());
  });

  it('blocks direct school-profile reads for Principal-only while preserving support override', async () => {
    const profileService = {
      getProfile: jest.fn().mockResolvedValue({ schoolName: 'Green Valley' }),
    };
    const controller = new SchoolSettingsWorkspaceController(
      {} as never,
      {} as never,
      profileService as never,
      {} as never,
      {} as never,
      {} as never,
    );

    expect(() => controller.getSchoolProfile(principalAuth())).toThrow(
      ForbiddenException,
    );

    const supportAuth = principalAuth({
      roles: [],
      permissions: ['settings:read_public'],
      isSupportOverride: true,
    });
    await expect(controller.getSchoolProfile(supportAuth)).resolves.toEqual({
      schoolName: 'Green Valley',
    });
  });

  it('denies a Principal-only tenant-setting mutation in the real SettingsService', async () => {
    const prisma = {
      tenantSetting: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };
    const auditService = { record: jest.fn() };
    const service = new SettingsService(
      prisma as never,
      auditService as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.updateSetting(principalAuth(), 'school_name', 'Changed School'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.tenantSetting.upsert).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });
});
