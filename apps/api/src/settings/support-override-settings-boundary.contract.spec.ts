import {
  SUPPORT_OVERRIDE_SCOPE_DEFINITIONS,
  SUPPORT_OVERRIDE_SCOPES,
  resolveSupportOverridePermissions,
} from '@schoolos/core';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { MeController } from '../plans/me.controller';
import { SchoolSettingsWorkspaceController } from './school-settings-workspace.controller';

describe('support override settings boundary contract', () => {
  it('keeps the school-profile scope public-read-only without generic settings or role access', () => {
    const schoolProfile = SUPPORT_OVERRIDE_SCOPE_DEFINITIONS.find(
      ({ key }) => key === 'SCHOOL_PROFILE',
    );

    expect(schoolProfile).toBeDefined();
    expect(schoolProfile?.permissions).toContain('settings:read_public');
    expect(schoolProfile?.permissions).not.toContain('settings:read');
    expect(schoolProfile?.permissions).not.toContain('roles:read');
  });

  it('does not inject role browsing or generic settings access into resolved support permissions', () => {
    const permissions = resolveSupportOverridePermissions(
      SUPPORT_OVERRIDE_SCOPES,
    );

    expect(permissions).not.toContain('roles:read');
    expect(permissions).not.toContain('settings:read');
    expect(permissions).toContain('settings:read_public');
  });

  it('gates settings navigation and school profile on the exact public-read permission', () => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        SchoolSettingsWorkspaceController.prototype.getNavigation,
      ),
    ).toEqual(['settings:read_public']);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        SchoolSettingsWorkspaceController.prototype.getSchoolProfile,
      ),
    ).toEqual(['settings:read_public']);
  });

  it('keeps tenant entitlements reachable through the public-read bootstrap permission', () => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        MeController.prototype.getMyEntitlements,
      ),
    ).toEqual(['settings:read_public']);
  });
});
