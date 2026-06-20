import type { AuthContext } from '../auth/auth.types';
import { SchoolSettingsNavigationV1Service } from './school-settings-navigation-v1.service';

const service = new SchoolSettingsNavigationV1Service();
const context = (permissions: string[]): AuthContext => ({
  userId: 'user-1',
  tenantId: 'tenant-1',
  tenantSlug: 'green-valley',
  email: 'admin@school.test',
  authMethod: 'PASSWORD',
  roles: ['admin'],
  permissions,
});

describe('SchoolSettingsNavigationV1Service', () => {
  it('shows overview as view-only for settings readers', () => {
    const item = service.getNavigation(context(['settings:read'])).groups[0]?.items[0];
    expect(item).toMatchObject({ id: 'overview', access: 'view' });
  });

  it('shows profile management for settings managers', () => {
    const items = service.getNavigation(context(['settings:manage'])).groups[0]?.items ?? [];
    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'school-profile', access: 'manage' }),
    ]));
  });
});
