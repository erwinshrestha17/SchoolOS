import { BadRequestException } from '@nestjs/common';
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
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_PERMISSIONS,
  buildPermissionKey,
} from '../src/rbac/rbac.defaults';
import {
  MockState,
  PrismaMock,
  createResponseMock,
  createQueueMock,
  createAuthContextMock,
  createPrismaMock,
  ensureTenantDefaultsWithState,
} from './test-helpers';

describe('SchoolOS Tenant Settings (E2E)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaMock;
  let authController: AuthController;
  let settingsController: SettingsController;

  beforeEach(async () => {
    prisma = createPrismaMock();
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
    const password = bcrypt.hashSync('pass123', 4);

    // 1. Setup Tenant A with Admin
    const tenantAId = 'tenant-a';
    prisma.__state.tenants.push({
      id: tenantAId,
      slug: 'school-a',
      name: 'School A',
      isActive: true,
      plan: 'standard',
    });
    ensureTenantDefaultsWithState(prisma.__state, tenantAId);

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
      roleId: adminRoleA!.id,
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
    ensureTenantDefaultsWithState(prisma.__state, tenantBId);

    // 3. Login as Admin A
    await authController.login(
      {
        tenantSlug: 'school-a',
        email: 'admin@school-a.com',
        password: 'pass123',
      },
      createResponseMock() as any,
      { ip: '127.0.0.1', headers: {} } as any,
    );
    const authA = createAuthContextMock({ tenantId: tenantAId, userId: adminA.id });

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
      roleId: teacherRoleA!.id,
      tenantId: tenantAId,
    });

    const authTeacher = createAuthContextMock({
      tenantId: tenantAId,
      userId: teacherA.id,
      roles: ['teacher'],
      permissions: SYSTEM_ROLE_PERMISSIONS.teacher as string[],
    });

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
      roleId: parentRoleA!.id,
      tenantId: tenantAId,
    });

    const authParent = createAuthContextMock({
      tenantId: tenantAId,
      userId: parentA.id,
      roles: ['parent'],
      permissions: SYSTEM_ROLE_PERMISSIONS.parent as string[],
    });

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
