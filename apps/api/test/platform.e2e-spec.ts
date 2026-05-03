import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AuthController } from '../src/auth/auth.controller';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PlatformController } from '../src/platform/platform.controller';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { getQueueToken } from '@nestjs/bullmq';
import * as bcrypt from 'bcrypt';
import { PERMISSION_CATALOG, SYSTEM_ROLE_DEFINITIONS, SYSTEM_ROLE_PERMISSIONS, buildPermissionKey } from '../src/rbac/rbac.defaults';

describe('SchoolOS Platform Control Plane (E2E)', () => {
  let moduleRef: TestingModule;
  let prisma: any;
  let authController: AuthController;
  let platformController: PlatformController;
  let jwtAuthGuard: JwtAuthGuard;

  beforeEach(async () => {
    prisma = await createPrismaMock();
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({ ping: jest.fn(async () => 'PONG'), onModuleDestroy: jest.fn() })
      .overrideProvider(getQueueToken('finance')).useValue(createQueueMock())
      .overrideProvider(getQueueToken('notifications')).useValue(createQueueMock())
      .overrideProvider(getQueueToken('payroll')).useValue(createQueueMock())
      .overrideProvider(NotificationsService).useValue({ sendAuthCodeEmail: jest.fn(), sendEmail: jest.fn() })
      .compile();

    authController = moduleRef.get(AuthController);
    platformController = moduleRef.get(PlatformController);
    jwtAuthGuard = moduleRef.get(JwtAuthGuard);
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('restricts /platform routes to platform_super_admin only', async () => {
    // 1. Setup a regular school admin
    const schoolAdminPassword = await bcrypt.hash('school123', 4);
    const tenantId = 'tenant-1';
    prisma.__state.tenants.push({ id: tenantId, slug: 'school-1', name: 'School 1', isActive: true, plan: 'standard', createdAt: new Date() });
    ensureTenantDefaults(prisma.__state, tenantId);
    
    const adminRole = prisma.__state.roles.find(r => r.tenantId === tenantId && r.name === 'admin');
    const schoolAdmin = { id: 'user-admin', email: 'admin@school1.com', passwordHash: schoolAdminPassword, tenantId, status: 'ACTIVE', authMethod: 'PASSWORD', lastLoginAt: new Date(), failedLoginCount: 0 };
    prisma.__state.users.push(schoolAdmin);
    prisma.__state.userRoles.push({ id: 'ur-1', userId: schoolAdmin.id, roleId: adminRole.id, tenantId });

    // 2. Login as school admin
    const loginRes = await authController.login({ tenantSlug: 'school-1', email: 'admin@school1.com', password: 'school123' }, createResponseMock() as any);
    const accessToken = (loginRes as any).accessToken;

    // 3. Try to access platform API - should fail
    const platformGuard = moduleRef.get(require('../src/auth/guards/platform.guard').PlatformGuard);
    const mockReq = { headers: { authorization: `Bearer ${accessToken}` } } as any;
    const mockContext = { switchToHttp: () => ({ getRequest: () => mockReq }), getHandler: () => {}, getClass: () => {} } as any;
    
    await jwtAuthGuard.canActivate(mockContext);
    await expect(platformGuard.canActivate(mockContext)).rejects.toBeInstanceOf(ForbiddenException);

    // 4. Setup a platform super admin
    const platformId = 'platform';
    prisma.__state.tenants.push({ id: platformId, slug: 'platform', name: 'Platform', isActive: true, plan: 'platform', createdAt: new Date() });
    ensureTenantDefaults(prisma.__state, platformId);
    
    const platformRole = prisma.__state.roles.find(r => r.tenantId === platformId && r.name === 'platform_super_admin');
    const platformAdmin = { id: 'user-platform', email: 'super@schoolos.com', passwordHash: schoolAdminPassword, tenantId: platformId, status: 'ACTIVE', authMethod: 'PASSWORD', lastLoginAt: new Date(), failedLoginCount: 0 };
    prisma.__state.users.push(platformAdmin);
    prisma.__state.userRoles.push({ id: 'ur-p', userId: platformAdmin.id, roleId: platformRole.id, tenantId: platformId });

    // 5. Login as platform admin
    const pLoginRes = await authController.login({ tenantSlug: 'platform', email: 'super@schoolos.com', password: 'school123' }, createResponseMock() as any);
    const pAccessToken = (pLoginRes as any).accessToken;
    mockReq.headers.authorization = `Bearer ${pAccessToken}`;

    // 6. Access platform API - should succeed
    await jwtAuthGuard.canActivate(mockContext);
    expect(platformGuard.canActivate(mockContext)).toBe(true);

    const tenants = await platformController.listTenants();
    expect(tenants).toHaveLength(2); // school-1 and platform
    expect(tenants.find(t => t.slug === 'school-1')).toBeDefined();

    // 7. Suspend school-1
    await platformController.updateTenantStatus(tenantId, false, { auth: { userId: platformAdmin.id } } as any);
    const detail = await platformController.getTenantDetail(tenantId);
    expect(detail.isActive).toBe(false);

    // 8. Verify audit log
    const audit = prisma.__state.auditLogs.find(a => a.action === 'tenant_suspended' && a.resourceId === tenantId);
    expect(audit).toBeDefined();
    expect(audit.tenantId).toBe('platform');
  });
});

async function createPrismaMock() {
  const state = {
    tenants: [],
    permissions: PERMISSION_CATALOG.map((p, i) => ({ id: `perm-${i+1}`, ...p })),
    roles: [],
    rolePermissions: [],
    users: [],
    userRoles: [],
    students: [],
    staff: [],
    auditLogs: [],
    refreshTokens: [],
    otpCodes: [],
  };
  return {
    __state: state,
    tenant: {
      findMany: jest.fn(async () => state.tenants),
      findUnique: jest.fn(async (q) => state.tenants.find(t => t.id === q.where.id || t.slug === q.where.slug)),
      update: jest.fn(async (q) => {
        const t = state.tenants.find(t => t.id === q.where.id);
        Object.assign(t, q.data);
        return t;
      }),
    },
    user: {
      findUnique: jest.fn(async (q) => {
        if (q.where.tenantId_email) {
          const u = state.users.find(u => u.tenantId === q.where.tenantId_email.tenantId && u.email === q.where.tenantId_email.email);
          if (!u) return null;
          return userWithRelations(state, u);
        }
        return userWithRelations(state, state.users.find(u => u.id === q.where.id));
      }),
      update: jest.fn(async (q) => {
        const u = state.users.find(u => u.id === q.where.id);
        Object.assign(u, q.data);
        return u;
      }),
    },
    role: { findMany: jest.fn(async () => state.roles) },
    userRole: { findMany: jest.fn(async () => state.userRoles) },
    student: { count: jest.fn(async () => 0) },
    staff: { count: jest.fn(async () => 0) },
    auditLog: {
      create: jest.fn(async (q) => {
        const log = { id: `log-${state.auditLogs.length+1}`, ...q.data, createdAt: new Date() };
        state.auditLogs.push(log);
        return log;
      }),
      findFirst: jest.fn(async () => null),
    },
    refreshToken: { create: jest.fn() },
  };
}

function userWithRelations(state: any, user: any) {
  if (!user) return null;
  return {
    ...user,
    userRoles: state.userRoles.filter(ur => ur.userId === user.id).map(ur => ({
      ...ur,
      role: {
        ...state.roles.find(r => r.id === ur.roleId),
        rolePermissions: state.rolePermissions.filter(rp => rp.roleId === ur.roleId).map(rp => ({
          ...rp,
          permission: state.permissions.find(p => p.id === rp.permissionId),
        })),
      },
    })),
  };
}

function ensureTenantDefaults(state: any, tenantId: string) {
  for (const def of SYSTEM_ROLE_DEFINITIONS) {
    const role = { id: `role-${tenantId}-${def.name}`, tenantId, name: def.name, description: def.description };
    state.roles.push(role);
    const perms = SYSTEM_ROLE_PERMISSIONS[def.name] || [];
    for (const pk of perms) {
      const p = state.permissions.find(p => buildPermissionKey(p.resource, p.action) === pk);
      if (p) state.rolePermissions.push({ roleId: role.id, permissionId: p.id });
    }
  }
}

function createResponseMock() {
  return { cookie: jest.fn(), clearCookie: jest.fn() };
}

function createQueueMock() {
  return { add: jest.fn(), close: jest.fn(), disconnect: jest.fn(), on: jest.fn() };
}
