import { ForbiddenException } from '@nestjs/common';
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
import { Response } from 'express';
import { AuthenticatedRequest } from '../src/auth/auth-request.interface';
import {
  PrismaMock,
  createPrismaMock,
  createQueueMock,
  createResponseMock,
  ensureTenantDefaultsWithState,
} from './test-helpers';
import { ExecutionContext } from '@nestjs/common';

describe('SchoolOS Platform Control Plane (E2E)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaMock;
  let authController: AuthController;
  let platformController: PlatformController;
  let jwtAuthGuard: JwtAuthGuard;

  beforeEach(async () => {
    prisma = createPrismaMock();
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({
        ping: jest.fn(() => Promise.resolve('PONG')),
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
    prisma.__state.tenants.push({
      id: tenantId,
      slug: 'school-1',
      name: 'School 1',
      isActive: true,
      plan: 'standard',
      createdAt: new Date(),
    } as Record<string, unknown>);
    ensureTenantDefaultsWithState(prisma.__state, tenantId);

    const adminRole = prisma.__state.roles.find(
      (r) => r.tenantId === tenantId && r.name === 'admin',
    );
    const schoolAdmin = {
      id: 'user-admin',
      email: 'admin@school1.com',
      passwordHash: schoolAdminPassword,
      tenantId,
      status: 'ACTIVE',
      authMethod: 'PASSWORD',
      lastLoginAt: new Date(),
      failedLoginCount: 0,
    };
    prisma.__state.users.push(schoolAdmin as Record<string, unknown>);
    prisma.__state.userRoles.push({
      id: 'ur-1',
      userId: schoolAdmin.id,
      roleId: adminRole?.id ?? '',
      tenantId,
    } as Record<string, unknown>);

    // 2. Login as school admin
    const loginRes = (await authController.login(
      {
        tenantSlug: 'school-1',
        email: 'admin@school1.com',
        password: 'school123',
      },
      createResponseMock() as unknown as Response,
      { ip: '127.0.0.1', headers: {} } as unknown as AuthenticatedRequest,
    )) as { accessToken: string };
    const accessToken = loginRes.accessToken;

    // 3. Try to access platform API - should fail
    const platformGuard = moduleRef.get(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../src/auth/guards/platform.guard').PlatformGuard,
    );
    const mockReq = {
      headers: { authorization: `Bearer ${accessToken}` },
    } as unknown as AuthenticatedRequest;
    const mockContext = {
      switchToHttp: () => ({ getRequest: () => mockReq }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    await jwtAuthGuard.canActivate(mockContext);
    expect(() => platformGuard.canActivate(mockContext)).toThrow(
      ForbiddenException,
    );

    // 4. Setup a platform super admin
    const platformId = 'platform';
    prisma.__state.tenants.push({
      id: platformId,
      slug: 'platform',
      name: 'Platform',
      isActive: true,
      plan: 'platform',
      createdAt: new Date(),
    } as Record<string, unknown>);
    ensureTenantDefaultsWithState(prisma.__state, platformId);

    const platformRole = prisma.__state.roles.find(
      (r) => r.tenantId === platformId && r.name === 'platform_super_admin',
    );
    const platformAdmin = {
      id: 'user-platform',
      email: 'super@schoolos.com',
      passwordHash: schoolAdminPassword,
      tenantId: platformId,
      status: 'ACTIVE',
      authMethod: 'PASSWORD',
      lastLoginAt: new Date(),
      failedLoginCount: 0,
    };
    prisma.__state.users.push(platformAdmin as Record<string, unknown>);
    prisma.__state.userRoles.push({
      id: 'ur-p',
      userId: platformAdmin.id,
      roleId: platformRole?.id ?? '',
      tenantId: platformId,
    } as Record<string, unknown>);

    // 5. Login as platform admin
    const pLoginRes = (await authController.login(
      {
        tenantSlug: 'platform',
        email: 'super@schoolos.com',
        password: 'school123',
      },
      createResponseMock() as unknown as Response,
      { ip: '127.0.0.1', headers: {} } as unknown as AuthenticatedRequest,
    )) as { accessToken: string };
    const pAccessToken = pLoginRes.accessToken;
    mockReq.headers.authorization = `Bearer ${pAccessToken}`;

    // 6. Access platform API - should succeed
    await jwtAuthGuard.canActivate(mockContext);
    expect(platformGuard.canActivate(mockContext)).toBe(true);

    const tenants = await platformController.listTenants();
    expect(tenants).toHaveLength(3); // school-1, platform, and default-school
    expect(tenants.find((t) => t.slug === 'school-1')).toBeDefined();

    // 7. Suspend school-1
    await platformController.updateTenantStatus(tenantId, false, {
      auth: { userId: platformAdmin.id },
    } as unknown as AuthenticatedRequest);
    const detail = await platformController.getTenantDetail(tenantId);
    expect(detail.isActive).toBe(false);

    // 8. Verify audit log
    const audit = prisma.__state.auditLogs.find(
      (a) => a.action === 'tenant_suspended' && a.resourceId === tenantId,
    );
    expect(audit).toBeDefined();
    if (!audit) throw new Error('Audit log not found');
    expect(audit.tenantId).toBe('platform');

    // 9. Setup platform support admin (Read-only)
    const supportRole = prisma.__state.roles.find(
      (r) => r.tenantId === platformId && r.name === 'platform_support',
    );
    const platformSupport = {
      id: 'user-support',
      email: 'support@schoolos.com',
      passwordHash: schoolAdminPassword,
      tenantId: platformId,
      status: 'ACTIVE',
      authMethod: 'PASSWORD',
      lastLoginAt: new Date(),
      failedLoginCount: 0,
    };
    prisma.__state.users.push(platformSupport as Record<string, unknown>);
    prisma.__state.userRoles.push({
      id: 'ur-s',
      userId: platformSupport.id,
      roleId: supportRole?.id ?? '',
      tenantId: platformId,
    } as Record<string, unknown>);

    const sLoginRes = (await authController.login(
      {
        tenantSlug: 'platform',
        email: 'support@schoolos.com',
        password: 'school123',
      },
      createResponseMock() as unknown as Response,
      { ip: '127.0.0.1', headers: {} } as unknown as AuthenticatedRequest,
    )) as { accessToken: string };
    const sAccessToken = sLoginRes.accessToken;
    const sMockReq = {
      headers: { authorization: `Bearer ${sAccessToken}` },
    } as unknown as AuthenticatedRequest;
    const sMockContext = {
      switchToHttp: () => ({ getRequest: () => sMockReq }),
      getHandler: () => platformController.listTenants,
      getClass: () => PlatformController,
    } as unknown as ExecutionContext;

    // 10. Support can read tenants
    await jwtAuthGuard.canActivate(sMockContext);
    expect(platformGuard.canActivate(sMockContext)).toBe(true);
    const tenantsList = await platformController.listTenants();
    expect(tenantsList).toBeDefined();

    // 11. Support CANNOT update tenant status
    const sUpdateContext = {
      switchToHttp: () => ({ getRequest: () => sMockReq }),
      getHandler: () => platformController.updateTenantStatus,
      getClass: () => PlatformController,
    } as unknown as ExecutionContext;
    await jwtAuthGuard.canActivate(sUpdateContext);
    expect(() => platformGuard.canActivate(sUpdateContext)).toThrow(
      ForbiddenException,
    );

    // 12. Setup platform billing admin (Read-only)
    const billingRole = prisma.__state.roles.find(
      (r) => r.tenantId === platformId && r.name === 'platform_billing_admin',
    );
    const platformBilling = {
      id: 'user-billing',
      email: 'billing@schoolos.com',
      passwordHash: schoolAdminPassword,
      tenantId: platformId,
      status: 'ACTIVE',
      authMethod: 'PASSWORD',
      lastLoginAt: new Date(),
      failedLoginCount: 0,
    };
    prisma.__state.users.push(platformBilling as Record<string, unknown>);
    prisma.__state.userRoles.push({
      id: 'ur-b',
      userId: platformBilling.id,
      roleId: billingRole?.id ?? '',
      tenantId: platformId,
    } as Record<string, unknown>);

    const bLoginRes = (await authController.login(
      {
        tenantSlug: 'platform',
        email: 'billing@schoolos.com',
        password: 'school123',
      },
      createResponseMock() as unknown as Response,
      { ip: '127.0.0.1', headers: {} } as unknown as AuthenticatedRequest,
    )) as { accessToken: string };
    const bAccessToken = bLoginRes.accessToken;
    const bMockReq = {
      headers: { authorization: `Bearer ${bAccessToken}` },
    } as unknown as AuthenticatedRequest;
    const bMockContext = {
      switchToHttp: () => ({ getRequest: () => bMockReq }),
      getHandler: () => platformController.getTenantUsage,
      getClass: () => PlatformController,
    } as unknown as ExecutionContext;

    // 13. Billing can read usage
    await jwtAuthGuard.canActivate(bMockContext);
    expect(platformGuard.canActivate(bMockContext)).toBe(true);
    const usage = await platformController.getTenantUsage(tenantId);
    expect(usage).toBeDefined();

    // 14. Billing CANNOT update tenant status
    const bUpdateContext = {
      switchToHttp: () => ({ getRequest: () => bMockReq }),
      getHandler: () => platformController.updateTenantStatus,
      getClass: () => PlatformController,
    } as unknown as ExecutionContext;
    await jwtAuthGuard.canActivate(bUpdateContext);
    expect(() => platformGuard.canActivate(bUpdateContext)).toThrow(
      ForbiddenException,
    );
  });
});
