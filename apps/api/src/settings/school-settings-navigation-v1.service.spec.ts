import type { AuthContext } from '../auth/auth.types';
import { SchoolSettingsNavigationV1Service } from './school-settings-navigation-v1.service';

function buildService(modules: string[] = []) {
  const entitlementsService = {
    getEntitlements: jest.fn().mockResolvedValue({
      tier: 'STANDARD',
      modules,
      features: [],
      addOns: [],
    }),
  };
  return {
    service: new SchoolSettingsNavigationV1Service(
      entitlementsService as never,
    ),
    entitlementsService,
  };
}

const context = (
  permissions: string[],
  overrides: Partial<AuthContext> = {},
): AuthContext => ({
  userId: 'user-1',
  tenantId: 'tenant-1',
  tenantSlug: 'green-valley',
  email: 'admin@school.test',
  authMethod: 'PASSWORD',
  roles: ['admin'],
  permissions,
  ...overrides,
});

async function itemsOf(
  service: SchoolSettingsNavigationV1Service,
  permissions: string[],
) {
  const navigation = await service.getNavigation(context(permissions));
  return navigation.groups.flatMap((group) => group.items);
}

describe('SchoolSettingsNavigationV1Service', () => {
  it('shows read-only policy navigation for settings readers', async () => {
    const { service } = buildService();
    const items = await itemsOf(service, ['settings:read']);

    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.access === 'view')).toBe(true);
    expect(items.some((item) => item.id === 'overview')).toBe(true);
    expect(items.some((item) => item.id === 'audit-export')).toBe(false);
    expect(items.some((item) => item.id === 'users-access')).toBe(false);
  });

  it('grants manage access across domains for full settings managers', async () => {
    const { service } = buildService();
    const items = await itemsOf(service, [
      'settings:read',
      'settings:manage',
      'attendance:read',
      'attendance:manage_all',
    ]);

    for (const id of [
      'school-profile',
      'branding-documents',
      'academic-calendar',
      'attendance',
      'fees',
      'accounting',
      'hr-payroll',
      'communication',
      'security',
    ]) {
      expect(items.find((item) => item.id === id)?.access).toBe('manage');
    }
    expect(items.find((item) => item.id === 'audit-export')?.access).toBe(
      'view',
    );
  });

  it('elevates Configuration Owner navigation to delegate access', async () => {
    const { service } = buildService();
    const items = await itemsOf(service, [
      'settings:read',
      'settings:manage',
      'settings:delegate',
      'settings:audit:read',
      'roles:read',
      'roles:assign',
      'roles:manage_permissions',
      'users:read',
      'users:create',
      'users:update_status',
    ]);

    expect(items.find((item) => item.id === 'overview')?.access).toBe(
      'delegate',
    );
    expect(items.find((item) => item.id === 'fees')?.access).toBe('delegate');
    expect(items.find((item) => item.id === 'roles-permissions')?.access).toBe(
      'delegate',
    );
    expect(items.find((item) => item.id === 'users-access')?.access).toBe(
      'manage',
    );
  });

  it('projects domain-scoped edit access for an accountant persona', async () => {
    const { service } = buildService();
    const items = await itemsOf(service, [
      'settings:read',
      'settings:finance:manage',
      'settings:accounting:manage',
      'users:read',
      'roles:read',
    ]);

    expect(items.find((item) => item.id === 'fees')?.access).toBe('edit');
    expect(items.find((item) => item.id === 'accounting')?.access).toBe('edit');
    expect(items.find((item) => item.id === 'attendance')).toBeUndefined();
    expect(items.find((item) => item.id === 'hr-payroll')?.access).toBe('view');
    expect(items.find((item) => item.id === 'users-access')?.access).toBe(
      'view',
    );
  });

  it('projects academic structure from the APIs that back the workspace', async () => {
    const { service } = buildService();
    const readOnlyItems = await itemsOf(service, [
      'classes:read',
      'sections:read',
    ]);
    expect(
      readOnlyItems.find((item) => item.id === 'academic-structure')?.access,
    ).toBe('view');

    const editorItems = await itemsOf(service, [
      'classes:read',
      'classes:create',
      'sections:read',
    ]);
    expect(
      editorItems.find((item) => item.id === 'academic-structure')?.access,
    ).toBe('edit');

    const incompleteReadItems = await itemsOf(service, ['classes:read']);
    expect(
      incompleteReadItems.find((item) => item.id === 'academic-structure'),
    ).toBeUndefined();
  });

  it('elevates user access for any supported account action', async () => {
    const { service } = buildService();
    const items = await itemsOf(service, [
      'users:read',
      'users:reset_password',
    ]);
    expect(items.find((item) => item.id === 'users-access')?.access).toBe(
      'edit',
    );
  });

  it('returns no settings navigation for public-only personas', async () => {
    const { service } = buildService(['library']);
    const navigation = await service.getNavigation(
      context(['settings:read_public']),
    );

    expect(navigation.groups).toEqual([]);
  });

  it('shows module settings only when the module is enabled and permitted', async () => {
    const { service: withLibrary } = buildService(['library']);
    const withLibraryItems = await itemsOf(withLibrary, [
      'settings:read',
      'library:read',
      'library:manage',
    ]);
    expect(
      withLibraryItems.find((item) => item.id === 'library-settings'),
    ).toMatchObject({ module: 'library', access: 'edit' });

    const { service: withoutLibrary } = buildService([]);
    const withoutLibraryItems = await itemsOf(withoutLibrary, [
      'settings:read',
      'library:read',
      'library:manage',
    ]);
    expect(
      withoutLibraryItems.some((item) => item.id === 'library-settings'),
    ).toBe(false);

    const { service: noPermission } = buildService(['library']);
    const noPermissionItems = await itemsOf(noPermission, ['settings:read']);
    expect(
      noPermissionItems.some((item) => item.id === 'library-settings'),
    ).toBe(false);
  });

  it('never emits platform-plane routes or controls', async () => {
    const { service } = buildService(['library', 'transport', 'canteen']);
    const items = await itemsOf(service, [
      'settings:read',
      'settings:manage',
      'settings:delegate',
      'settings:audit:read',
      'users:read',
      'users:create',
      'users:update_status',
      'roles:read',
      'roles:assign',
      'roles:manage_permissions',
      'admission_policy:read',
      'admission_policy:manage',
      'library:read',
      'library:manage',
      'transport:read',
      'transport:manage',
      'canteen:controls:read',
      'canteen:controls:update',
    ]);

    for (const item of items) {
      expect(item.href.startsWith('/platform')).toBe(false);
      expect(item.href.includes('/platform/')).toBe(false);
    }
    const labels = items.map((item) => item.label.toLowerCase()).join(' ');
    expect(labels).not.toContain('billing');
    expect(labels).not.toContain('queue');
    expect(labels).not.toContain('credential');
  });
});
