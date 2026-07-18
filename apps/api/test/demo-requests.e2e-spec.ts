import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { DemoRequestsController } from '../src/demo-requests/demo-requests.controller';
import { DemoRequestsPlatformController } from '../src/demo-requests/demo-requests-platform.controller';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { AuthController } from '../src/auth/auth.controller';
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

describe('Demo Requests (E2E)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaMock;
  let publicController: DemoRequestsController;
  let platformController: DemoRequestsPlatformController;
  let authController: AuthController;
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

    publicController = moduleRef.get(DemoRequestsController);
    platformController = moduleRef.get(DemoRequestsPlatformController);
    authController = moduleRef.get(AuthController);
    jwtAuthGuard = moduleRef.get(JwtAuthGuard);
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('persists a public demo request without authentication', async () => {
    const result = await publicController.create({
      schoolName: 'Everest Academy',
      schoolType: 'Secondary School',
      location: 'Kathmandu',
      studentsCount: '500-1000',
      contactName: 'Principal',
      role: 'Principal',
      phone: '9800000000',
      email: 'principal@school.edu.np',
      expectedTimeline: 'Within 1 month',
      interestedModules: ['Fees & Receipts'],
      message: 'Need pilot planning',
    });

    expect(result.status).toBe('NEW');
    expect(prisma.__state.demoRequests).toHaveLength(1);
    expect(prisma.__state.demoRequests[0]?.email).toBe(
      'principal@school.edu.np',
    );
  });

  it('allows platform operators to list and update demo requests', async () => {
    const platformId = 'platform-tenant';
    const platformPassword = await bcrypt.hash('platform123', 4);

    prisma.__state.tenants.push({
      id: platformId,
      slug: 'platform',
      name: 'SchoolOS Platform',
      isActive: true,
      plan: 'platform',
      createdAt: new Date(),
    } as Record<string, unknown>);
    ensureTenantDefaultsWithState(prisma.__state, platformId);

    const superAdminRole = prisma.__state.roles.find(
      (role) =>
        role.tenantId === platformId && role.name === 'platform_super_admin',
    );
    const platformUser = {
      id: 'platform-super-admin-user',
      email: 'admin@schoolos.com',
      passwordHash: platformPassword,
      tenantId: platformId,
      status: 'ACTIVE',
      authMethod: 'PASSWORD',
      lastLoginAt: new Date(),
      failedLoginCount: 0,
    };
    prisma.__state.users.push(platformUser as Record<string, unknown>);
    prisma.__state.userRoles.push({
      id: 'ur-platform-super-admin',
      userId: platformUser.id,
      roleId: superAdminRole?.id ?? '',
      tenantId: platformId,
    } as Record<string, unknown>);

    const loginRes = (await authController.login(
      {
        tenantSlug: 'platform',
        email: 'admin@schoolos.com',
        password: 'platform123',
      },
      createResponseMock() as unknown as Response,
      { ip: '127.0.0.1', headers: {} } as AuthenticatedRequest,
    )) as { accessToken: string };

    const request = {
      headers: { authorization: `Bearer ${loginRes.accessToken}` },
      auth: undefined,
    } as AuthenticatedRequest;

    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => platformController.listPage,
      getClass: () => DemoRequestsPlatformController,
    } as unknown as ExecutionContext;

    await jwtAuthGuard.canActivate(context);

    const created = await publicController.create({
      schoolName: 'Himalaya School',
      schoolType: 'Secondary School',
      location: 'Pokhara',
      studentsCount: '100-250',
      contactName: 'Coordinator',
      role: 'Academic Coordinator',
      phone: '9811111111',
      email: 'coord@himalaya.edu.np',
      expectedTimeline: 'Within 3 months',
      interestedModules: ['Attendance'],
    });

    const listed = await platformController.listPage({
      page: 1,
      limit: 25,
      search: 'Himalaya',
    });
    expect(listed.total).toBeGreaterThanOrEqual(1);
    expect(listed.items.some((item) => item.id === created.id)).toBe(true);

    const updated = await platformController.updateStatus(
      created.id,
      { status: 'CONTACTED', internalNotes: 'Initial outreach complete' },
      request,
    );

    expect(updated.status).toBe('CONTACTED');
    expect(updated.internalNotes).toBe('Initial outreach complete');
    expect(
      prisma.__state.auditLogs.some(
        (log) =>
          log.action === 'demo_request_status_updated' &&
          log.resourceId === created.id,
      ),
    ).toBe(true);
  });

  it('denies school users from platform demo request routes', async () => {
    const tenantId = 'tenant-school';
    const schoolPassword = await bcrypt.hash('school123', 4);

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
      (role) => role.tenantId === tenantId && role.name === 'admin',
    );
    const schoolAdmin = {
      id: 'school-admin',
      email: 'admin@school1.com',
      passwordHash: schoolPassword,
      tenantId,
      status: 'ACTIVE',
      authMethod: 'PASSWORD',
      lastLoginAt: new Date(),
      failedLoginCount: 0,
    };
    prisma.__state.users.push(schoolAdmin as Record<string, unknown>);
    prisma.__state.userRoles.push({
      id: 'ur-school-admin',
      userId: schoolAdmin.id,
      roleId: adminRole?.id ?? '',
      tenantId,
    } as Record<string, unknown>);

    const loginRes = (await authController.login(
      {
        tenantSlug: 'school-1',
        email: 'admin@school1.com',
        password: 'school123',
      },
      createResponseMock() as unknown as Response,
      { ip: '127.0.0.1', headers: {} } as AuthenticatedRequest,
    )) as { accessToken: string };

    const request = {
      headers: { authorization: `Bearer ${loginRes.accessToken}` },
      auth: undefined,
    } as AuthenticatedRequest;

    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => platformController.listPage,
      getClass: () => DemoRequestsPlatformController,
    } as unknown as ExecutionContext;

    await jwtAuthGuard.canActivate(context);

    const platformGuard = moduleRef.get(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../src/auth/guards/platform.guard').PlatformGuard,
    );

    await expect(() => platformGuard.canActivate(context)).toThrow(
      ForbiddenException,
    );
  });
});
