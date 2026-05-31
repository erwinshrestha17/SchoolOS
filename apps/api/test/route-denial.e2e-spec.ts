import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AuthController } from '../src/auth/auth.controller';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../src/auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../src/auth/guards/entitlement.guard';
import { AccountingReportsController } from '../src/accounting/accounting-reports.controller';
import { AdmissionsController } from '../src/admissions/admissions.controller';
import { MobileController } from '../src/mobile/mobile.controller';
import { PlatformGuard } from '../src/auth/guards/platform.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { AuthContext } from '../src/auth/auth.types';
import { FEATURE_KEYS } from '@schoolos/core';
import {
  PrismaMock,
  createRequestMock,
  createPrismaMock,
  createQueueMock,
} from './test-helpers';
import { AuthenticatedRequest } from '../src/auth/auth-request.interface';

describe('Route Denial (Entitlement Hardening) E2E', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaMock;
  let accountingReportsController: AccountingReportsController;
  let admissionsController: AdmissionsController;
  let jwtAuthGuard: JwtAuthGuard;
  let rolesGuard: RolesPermissionsGuard;
  let entitlementGuard: EntitlementGuard;

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
        onModuleDestroy: jest.fn(() => Promise.resolve(undefined)),
      })
      .overrideProvider(getQueueToken('finance'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('notifications'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('payroll'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('activity-media'))
      .useValue(createQueueMock())
      .compile();

    accountingReportsController = moduleRef.get(AccountingReportsController);
    admissionsController = moduleRef.get(AdmissionsController);
    jwtAuthGuard = moduleRef.get(JwtAuthGuard);
    rolesGuard = moduleRef.get(RolesPermissionsGuard);
    entitlementGuard = moduleRef.get(EntitlementGuard);
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('denies access to accounting reports if module.accounting is not entitled', async () => {
    // 1. Setup a tenant with a plan that LACKS module.accounting
    const tenantId = 'tenant-no-accounting';
    prisma.__state.tenants.push({
      id: tenantId,
      slug: 'no-accounting',
      name: 'No Accounting School',
      isActive: true,
      plan: 'basic',
    });

    const planId = 'plan-basic';
    prisma.__state.platformPlans.push({
      id: planId,
      key: 'basic',
      name: 'Basic Plan',
    });

    // Only grant students module, NOT accounting
    prisma.__state.platformPlanFeatures.push({
      id: 'feature-students',
      planId,
      featureKey: 'module.students',
    });

    prisma.__state.tenantSubscriptions.push({
      id: 'sub-1',
      tenantId,
      planId,
      status: 'ACTIVE',
      createdAt: new Date(),
    });

    // 2. Create an actor (admin) for this tenant
    const actor: AuthContext = {
      userId: 'admin-user',
      tenantId,
      tenantSlug: 'no-accounting',
      email: 'admin@school.com',
      roles: ['admin'],
      permissions: ['accounting.reports.view'], // Has RBAC permission
      authMethod: 'PASSWORD' as any,
    };

    // 3. Mock request and context
    const request = {
      headers: { authorization: 'Bearer mock-token' },
      auth: actor,
    } as unknown as AuthenticatedRequest;

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => AccountingReportsController.prototype.getTrialBalance,
      getClass: () => AccountingReportsController,
    } as unknown as ExecutionContext;

    // 4. EntitlementGuard should throw ForbiddenException
    await expect(entitlementGuard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows access to admissions if module.students is entitled', async () => {
    // 1. Setup a tenant with a plan that HAS module.students
    const tenantId = 'tenant-with-students';
    prisma.__state.tenants.push({
      id: tenantId,
      slug: 'with-students',
      name: 'Standard School',
      isActive: true,
      plan: 'standard',
    });

    const planId = 'plan-standard';
    prisma.__state.platformPlans.push({
      id: planId,
      key: 'standard',
      name: 'Standard Plan',
    });

    prisma.__state.platformPlanFeatures.push({
      id: 'feature-students-std',
      planId,
      featureKey: 'module.students',
      enabled: true,
    });

    prisma.__state.tenantSubscriptions.push({
      id: 'sub-2',
      tenantId,
      planId,
      status: 'ACTIVE',
      createdAt: new Date(),
    });

    // 2. Create an actor
    const actor: AuthContext = {
      userId: 'registrar-user',
      tenantId,
      tenantSlug: 'with-students',
      email: 'registrar@school.com',
      roles: ['admin'],
      permissions: ['students.admission.create'],
      authMethod: 'PASSWORD' as any,
    };

    const request = {
      headers: { authorization: 'Bearer mock-token' },
      auth: actor,
    } as unknown as AuthenticatedRequest;

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => AdmissionsController.prototype.listAdmissions,
      getClass: () => AdmissionsController,
    } as unknown as ExecutionContext;

    // 3. EntitlementGuard should return true
    const result = await entitlementGuard.canActivate(context);
    expect(result).toBe(true);
  });

  it('honors tenant-specific feature overrides', async () => {
    // 1. Setup a tenant with a plan that LACKS module.accounting
    const tenantId = 'tenant-overridden';
    prisma.__state.tenants.push({
      id: tenantId,
      slug: 'overridden',
      isActive: true,
      plan: 'basic',
    });

    const planId = 'plan-basic';
    prisma.__state.platformPlans.push({
      id: planId,
      key: 'basic',
      name: 'Basic Plan',
    });

    prisma.__state.tenantSubscriptions.push({
      id: 'sub-3',
      tenantId,
      planId,
      status: 'ACTIVE',
      createdAt: new Date(),
    });

    // 2. Add an OVERRIDE to ENABLE accounting for this specific basic tenant
    prisma.__state.tenantFeatureOverrides.push({
      id: 'override-1',
      tenantId,
      featureKey: 'module.accounting',
      enabled: true,
    });

    // 3. Create an actor
    const actor: AuthContext = {
      userId: 'admin-user',
      tenantId,
      tenantSlug: 'overridden',
      email: 'admin@school.com',
      roles: ['admin'],
      permissions: ['accounting.reports.view'],
      authMethod: 'PASSWORD' as any,
    };

    const request = {
      headers: { authorization: 'Bearer mock-token' },
      auth: actor,
    } as unknown as AuthenticatedRequest;

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => AccountingReportsController.prototype.getTrialBalance,
      getClass: () => AccountingReportsController,
    } as unknown as ExecutionContext;

    // 4. EntitlementGuard should allow even if plan doesn't have it
    const result = await entitlementGuard.canActivate(context);
    expect(result).toBe(true);
  });

  it('denies mobile parent APIs when the mobile parent feature is not entitled', async () => {
    const tenantId = 'tenant-no-mobile';
    prisma.__state.tenants.push({
      id: tenantId,
      slug: 'no-mobile',
      isActive: true,
      plan: 'custom-no-mobile',
    });

    const planId = 'plan-no-mobile';
    prisma.__state.platformPlans.push({
      id: planId,
      key: 'custom-no-mobile',
      name: 'No Mobile Plan',
    });
    prisma.__state.platformPlanFeatures.push({
      id: 'feature-students-no-mobile',
      planId,
      featureKey: 'module.students',
      enabled: true,
    });
    prisma.__state.tenantSubscriptions.push({
      id: 'sub-no-mobile',
      tenantId,
      planId,
      status: 'ACTIVE',
      createdAt: new Date(),
    });

    const actor: AuthContext = {
      userId: 'parent-user',
      tenantId,
      tenantSlug: 'no-mobile',
      email: 'parent@school.com',
      roles: ['parent'],
      permissions: [],
      authMethod: 'PASSWORD' as any,
    };

    const request = { auth: actor } as unknown as AuthenticatedRequest;
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => MobileController.prototype.getDashboard,
      getClass: () => MobileController,
    } as unknown as ExecutionContext;

    await expect(entitlementGuard.canActivate(context)).rejects.toThrow(
      FEATURE_KEYS.MOBILE_PARENT_BASIC,
    );
  });

  it('denies student creation if students.count limit is reached', async () => {
    // 1. Setup a tenant with a plan that HAS module.students but a limit of 1
    const tenantId = 'tenant-limited';
    prisma.__state.tenants.push({
      id: tenantId,
      slug: 'limited',
      isActive: true,
      plan: 'limited-plan',
    });

    prisma.__state.academicYears.push({
      id: 'ay-2024',
      tenantId,
      name: '2024',
      startsOn: new Date('2024-01-01'),
    });

    prisma.__state.classes.push({
      id: 'class-1',
      tenantId,
      name: 'Class 1',
    });

    const planId = 'plan-limited';
    prisma.__state.platformPlans.push({
      id: planId,
      key: 'limited-plan',
      name: 'Limited Plan',
    });

    prisma.__state.platformPlanFeatures.push({
      id: 'feature-students-lim',
      planId,
      featureKey: 'module.students',
      enabled: true,
    });

    prisma.__state.usageLimits.push({
      id: 'limit-students',
      planId,
      usageKey: 'students.count',
      limit: 1,
    });

    prisma.__state.tenantSubscriptions.push({
      id: 'sub-limited',
      tenantId,
      planId,
      status: 'ACTIVE',
      createdAt: new Date(),
    });

    // 2. Add 1 student already
    prisma.__state.students.push({
      id: 'student-existing',
      tenantId,
      firstNameEn: 'Existing',
      lastNameEn: 'Student',
    });

    // 3. Create an actor
    const actor: AuthContext = {
      userId: 'admin-user',
      tenantId,
      tenantSlug: 'limited',
      email: 'admin@school.com',
      roles: ['admin'],
      permissions: ['students.admission.create'],
      authMethod: 'PASSWORD' as any,
    };

    const studentsController = moduleRef.get(AdmissionsController);

    // 4. Attempt to create another student should throw ForbiddenException
    await expect(
      studentsController.createAdmission(
        {
          firstNameEn: 'New',
          lastNameEn: 'Student',
          gender: 'MALE',
          dateOfBirth: '2010-01-01',
          admissionDate: '2024-01-01',
          academicYearId: 'ay-2024',
          classId: 'class-1',
          guardians: [
            {
              fullName: 'John Guardian',
              relation: 'FATHER',
              primaryPhone: '9841234567',
              isPrimary: true,
            },
          ],
        } as any,
        actor,
      ),
    ).rejects.toThrow(/Plan limit reached for students.count/);
  });

  it('denies school user access to platform routes', async () => {
    const actor: AuthContext = {
      userId: 'school-admin',
      tenantId: 'some-school',
      tenantSlug: 'school',
      email: 'admin@school.com',
      roles: ['admin'], // NOT a platform role
      permissions: ['platform:dashboard:read'], // Even if they have the permission string
      authMethod: 'PASSWORD' as any,
    };

    const request = { auth: actor } as any;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;

    const platformGuard = moduleRef.get(PlatformGuard);
    await expect(() => platformGuard.canActivate(context)).toThrow(
      /Access restricted to platform administrators only/,
    );
  });

  it('throws specific message for inactive tenants', async () => {
    const tenantId = 'inactive-tenant';
    prisma.__state.tenants.push({
      id: tenantId,
      slug: 'inactive',
      isActive: false, // INACTIVE
    });

    const actor: AuthContext = {
      userId: 'user-1',
      tenantId,
      tenantSlug: 'inactive',
      email: 'user@school.com',
      roles: ['admin'],
      permissions: ['students.admission.create'],
      authMethod: 'PASSWORD' as any,
    };

    const request = { auth: actor } as any;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => AdmissionsController.prototype.listAdmissions,
      getClass: () => AdmissionsController,
    } as any;

    await expect(entitlementGuard.canActivate(context)).rejects.toThrow(
      /Your school account is currently suspended/,
    );
  });
});
