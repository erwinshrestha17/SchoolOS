import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { EntitlementGuard } from '../src/auth/guards/entitlement.guard';
import { LearningActivitiesController } from '../src/learning/activities/learning-activities.controller';
import { LEARNING_MODULE_ENTITLEMENT } from '../src/learning/learning.constants';
import { SUSPENDED_TENANT_MESSAGE } from '../src/plans/tenant-access.constants';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { AuthContext } from '../src/auth/auth.types';
import {
  PrismaMock,
  createPrismaMock,
  createQueueMock,
} from './test-helpers';
import { AuthenticatedRequest } from '../src/auth/auth-request.interface';

describe('Learning entitlement denial (E2E)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaMock;
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

    entitlementGuard = moduleRef.get(EntitlementGuard);
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  function buildContext(tenantId: string, actor: AuthContext) {
    const request = {
      headers: { authorization: 'Bearer mock-token' },
      auth: actor,
    } as unknown as AuthenticatedRequest;

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => LearningActivitiesController.prototype.listActivities,
      getClass: () => LearningActivitiesController,
    } as unknown as ExecutionContext;
  }

  it('denies learning routes when module.learning is not entitled', async () => {
    const tenantId = 'tenant-no-learning';
    prisma.__state.tenants.push({
      id: tenantId,
      slug: 'no-learning',
      name: 'No Learning School',
      isActive: true,
      plan: 'basic',
    });

    const planId = 'plan-basic-no-learning';
    prisma.__state.platformPlans.push({
      id: planId,
      key: 'basic',
      name: 'Basic Plan',
    });

    prisma.__state.platformPlanFeatures.push({
      id: 'feature-students-only',
      planId,
      featureKey: 'module.students',
      enabled: true,
    });

    prisma.__state.tenantSubscriptions.push({
      id: 'sub-no-learning',
      tenantId,
      planId,
      status: 'ACTIVE',
      createdAt: new Date(),
    });

    const actor: AuthContext = {
      userId: 'admin-user',
      tenantId,
      tenantSlug: 'no-learning',
      email: 'admin@school.com',
      roles: ['admin'],
      permissions: ['learning:read'],
      authMethod: 'PASSWORD' as any,
    };

    await expect(
      entitlementGuard.canActivate(buildContext(tenantId, actor)),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      entitlementGuard.canActivate(buildContext(tenantId, actor)),
    ).rejects.toThrow(new RegExp(LEARNING_MODULE_ENTITLEMENT.replace('.', '\\.')));
  });

  it('denies learning routes for suspended tenants', async () => {
    const tenantId = 'tenant-suspended-learning';
    prisma.__state.tenants.push({
      id: tenantId,
      slug: 'suspended-learning',
      name: 'Suspended School',
      isActive: false,
      plan: 'premium',
    });

    const planId = 'plan-premium-learning';
    prisma.__state.platformPlans.push({
      id: planId,
      key: 'premium',
      name: 'Premium Plan',
    });

    prisma.__state.platformPlanFeatures.push({
      id: 'feature-learning-premium',
      planId,
      featureKey: LEARNING_MODULE_ENTITLEMENT,
      enabled: true,
    });

    prisma.__state.tenantSubscriptions.push({
      id: 'sub-suspended-learning',
      tenantId,
      planId,
      status: 'ACTIVE',
      createdAt: new Date(),
    });

    const actor: AuthContext = {
      userId: 'admin-user',
      tenantId,
      tenantSlug: 'suspended-learning',
      email: 'admin@school.com',
      roles: ['admin'],
      permissions: ['learning:read'],
      authMethod: 'PASSWORD' as any,
    };

    await expect(
      entitlementGuard.canActivate(buildContext(tenantId, actor)),
    ).rejects.toThrow(SUSPENDED_TENANT_MESSAGE);
  });
});
