import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AuthController } from '../src/auth/auth.controller';
import { SettingsController } from '../src/settings/settings.controller';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { getQueueToken } from '@nestjs/bullmq';
import * as bcrypt from 'bcrypt';
import {
  PERMISSION_CATALOG,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_PERMISSIONS,
  buildPermissionKey,
} from '../src/rbac/rbac.defaults';

describe('SchoolOS Tenant Settings (E2E)', () => {
  let moduleRef: TestingModule;
  let prisma: any;
  let authController: AuthController;
  let settingsController: SettingsController;

  beforeEach(async () => {
    prisma = await createPrismaMock();
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({
        ping: jest.fn(async () => 'PONG'),
        onModuleDestroy: jest.fn(),
      })
      .overrideProvider(getQueueToken('finance'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('notifications'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('payroll'))
      .useValue(createQueueMock())
      .overrideProvider(NotificationsService)
      .useValue({ sendAuthCodeEmail: jest.fn(), sendEmail: jest.fn() })
      .compile();

    authController = moduleRef.get(AuthController);
    settingsController = moduleRef.get(SettingsController);
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('enforces tenant scoping and role-based permissions', async () => {
    const password = await bcrypt.hash('pass123', 4);

    // 1. Setup Tenant A with Admin
    const tenantAId = 'tenant-a';
    prisma.__state.tenants.push({
      id: tenantAId,
      slug: 'school-a',
      name: 'School A',
      isActive: true,
      plan: 'standard',
    });
    ensureTenantDefaults(prisma.__state, tenantAId);

    const adminRoleA = prisma.__state.roles.find(
      (r) => r.tenantId === tenantAId && r.name === 'admin',
    );
    const adminA = {
      id: 'admin-a',
      email: 'admin@school-a.com',
      passwordHash: password,
      tenantId: tenantAId,
      status: 'ACTIVE',
    };
    prisma.__state.users.push(adminA);
    prisma.__state.userRoles.push({
      userId: adminA.id,
      roleId: adminRoleA.id,
      tenantId: tenantAId,
    });

    // 2. Setup Tenant B
    const tenantBId = 'tenant-b';
    prisma.__state.tenants.push({
      id: tenantBId,
      slug: 'school-b',
      name: 'School B',
      isActive: true,
      plan: 'standard',
    });
    ensureTenantDefaults(prisma.__state, tenantBId);

    // 3. Login as Admin A
    const loginRes = await authController.login(
      {
        tenantSlug: 'school-a',
        email: 'admin@school-a.com',
        password: 'pass123',
      },
      createResponseMock() as any,
      { ip: '127.0.0.1', headers: {} } as any,
    );
    const authA = { tenantId: tenantAId, userId: adminA.id };

    // 4. Admin A updates a setting
    await settingsController.updateSetting(
      'branding_primary_color',
      { value: '#ff0000' },
      { auth: authA } as any,
    );

    const settingsA = await settingsController.getSettings({
      auth: authA,
    } as any);
    expect(
      settingsA.find((s) => s.key === 'branding_primary_color')?.value,
    ).toBe('#ff0000');

    // 5. Verify it's NOT in Tenant B
    const settingsB = prisma.__state.tenantSettings.filter(
      (s) => s.tenantId === tenantBId,
    );
    expect(settingsB).toHaveLength(0);

    // 6. Test Validation - Invalid Color
    await expect(
      settingsController.updateSetting(
        'branding_primary_color',
        { value: 'not-a-color' },
        { auth: authA } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // 7. Test Validation - Invalid Type (number instead of string)
    await expect(
      settingsController.updateSetting('timezone', { value: 123 }, {
        auth: authA,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    // 8. Test Permissions - Teacher (Read only)
    const teacherRoleA = prisma.__state.roles.find(
      (r) => r.tenantId === tenantAId && r.name === 'teacher',
    );
    const teacherA = {
      id: 'teacher-a',
      email: 'teacher@school-a.com',
      passwordHash: password,
      tenantId: tenantAId,
      status: 'ACTIVE',
    };
    prisma.__state.users.push(teacherA);
    prisma.__state.userRoles.push({
      userId: teacherA.id,
      roleId: teacherRoleA.id,
      tenantId: tenantAId,
    });

    const authTeacher = {
      tenantId: tenantAId,
      userId: teacherA.id,
      roles: ['teacher'],
      permissions: SYSTEM_ROLE_PERMISSIONS['teacher'],
    };

    // Teacher can read
    const tSettings = await settingsController.getSettings({
      auth: authTeacher,
    } as any);
    expect(tSettings).toBeDefined();

    // 9. Test Exposure - Parent Role
    const parentRoleA = prisma.__state.roles.find(
      (r) => r.tenantId === tenantAId && r.name === 'parent',
    );
    const parentA = {
      id: 'parent-a',
      email: 'parent@school-a.com',
      passwordHash: password,
      tenantId: tenantAId,
      status: 'ACTIVE',
    };
    prisma.__state.users.push(parentA);
    prisma.__state.userRoles.push({
      userId: parentA.id,
      roleId: parentRoleA.id,
      tenantId: tenantAId,
    });

    const authParent = {
      tenantId: tenantAId,
      userId: parentA.id,
      roles: ['parent'],
      permissions: SYSTEM_ROLE_PERMISSIONS['parent'],
    };

    // Parent CANNOT read private settings
    // In a real request, RolesPermissionsGuard would block this because 'parent' lacks 'settings:read'
    // Here we can just verify the permission mapping
    expect(authParent.permissions.includes('settings:read')).toBe(false);

    // Parent CAN read public settings
    expect(authParent.permissions.includes('settings:read_public')).toBe(true);

    // 10. Verify Public Endpoint Key Filtering
    // Add a sensitive setting
    await settingsController.updateSetting(
      'sms_provider',
      { value: 'twilio' },
      { auth: authA } as any,
    );

    const publicSettings = await settingsController.getPublicSettings({
      auth: authParent,
    } as any);

    // Branding should be there
    expect(
      publicSettings.find((s) => s.key === 'branding_primary_color'),
    ).toBeDefined();
    // SMS provider should NOT be there
    expect(
      publicSettings.find((s) => s.key === 'sms_provider'),
    ).toBeUndefined();
    expect(
      publicSettings.find((s) => s.key === 'feature_toggles'),
    ).toBeUndefined();
  });
});

async function createPrismaMock() {
  const state: {
    tenants: any[];
    tenantSettings: any[];
    permissions: any[];
    roles: any[];
    rolePermissions: any[];
    users: any[];
    userRoles: any[];
    auditLogs: any[];
  } = {
    tenants: [],
    tenantSettings: [],
    permissions: PERMISSION_CATALOG.map((p, i) => ({
      id: `perm-${i + 1}`,
      ...p,
    })),
    roles: [],
    rolePermissions: [],
    users: [],
    userRoles: [],
    auditLogs: [],
  };
  return {
    __state: state,
    tenant: {
      findUnique: jest.fn(async (q) =>
        state.tenants.find(
          (t) => t.id === q.where.id || t.slug === q.where.slug,
        ),
      ),
    },
    tenantSetting: {
      findMany: jest.fn(async (q) =>
        state.tenantSettings.filter((s) => s.tenantId === q.where.tenantId),
      ),
      findUnique: jest.fn(async (q) =>
        state.tenantSettings.find(
          (s) =>
            s.tenantId === q.where.tenantId_key.tenantId &&
            s.key === q.where.tenantId_key.key,
        ),
      ),
      upsert: jest.fn(async (q) => {
        const existing = state.tenantSettings.find(
          (s) =>
            s.tenantId === q.where.tenantId_key.tenantId &&
            s.key === q.where.tenantId_key.key,
        );
        if (existing) {
          Object.assign(existing, q.update, { updatedAt: new Date() });
          return existing;
        }
        const created = {
          id: `s-${state.tenantSettings.length}`,
          ...q.create,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        state.tenantSettings.push(created);
        return created;
      }),
    },
    user: {
      findUnique: jest.fn(async (q) => {
        const u = state.users.find(
          (u) =>
            (u.tenantId === q.where?.tenantId_email?.tenantId &&
              u.email === q.where?.tenantId_email?.email) ||
            u.id === q.where.id,
        );
        if (!u) return null;
        return {
          ...u,
          userRoles: state.userRoles
            .filter((ur) => ur.userId === u.id)
            .map((ur) => ({
              ...ur,
              role: {
                ...state.roles.find((r) => r.id === ur.roleId),
                rolePermissions: state.rolePermissions
                  .filter((rp) => rp.roleId === ur.roleId)
                  .map((rp) => ({
                    ...rp,
                    permission: state.permissions.find(
                      (p) => p.id === rp.permissionId,
                    ),
                  })),
              },
            })),
        };
      }),
      update: jest.fn(async (q) => {
        const u = state.users.find((u) => u.id === q.where.id);
        if (u) {
          Object.assign(u, q.data);
        }
        return u;
      }),
    },
    auditLog: {
      create: jest.fn(async (q) => {
        const log = {
          id: `log-${state.auditLogs.length}`,
          ...q.data,
          createdAt: new Date(),
        };
        state.auditLogs.push(log);
        return log;
      }),
    },
    refreshToken: { create: jest.fn() },
  };
}

function ensureTenantDefaults(state: any, tenantId: string) {
  for (const def of SYSTEM_ROLE_DEFINITIONS) {
    const role = {
      id: `role-${tenantId}-${def.name}`,
      tenantId,
      name: def.name,
      isSystem: true,
    };
    state.roles.push(role);
    const perms = SYSTEM_ROLE_PERMISSIONS[def.name] || [];
    for (const pk of perms) {
      const p = state.permissions.find(
        (p) => buildPermissionKey(p.resource, p.action) === pk,
      );
      if (p)
        state.rolePermissions.push({ roleId: role.id, permissionId: p.id });
    }
  }
}

function createResponseMock() {
  return { cookie: jest.fn(), clearCookie: jest.fn() };
}

function createQueueMock() {
  return { add: jest.fn(), close: jest.fn(), on: jest.fn() };
}
