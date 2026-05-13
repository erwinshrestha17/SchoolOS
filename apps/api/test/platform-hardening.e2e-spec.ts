import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ForbiddenException, ExecutionContext } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '../src/config/config.service';
import { EntitlementGuard } from '../src/auth/guards/entitlement.guard';
import { PlatformService } from '../src/platform/platform.service';
import { PlatformController } from '../src/platform/platform.controller';
import { Reflector } from '@nestjs/core';
import { getQueueToken } from '@nestjs/bullmq';
import {
  PrismaMock,
  createPrismaMock,
  createQueueMock,
} from './test-helpers';

describe('M0 Platform Backend Hardening (E2E - Internal)', () => {
  let app: INestApplication;
  let prisma: PrismaMock;
  let jwtService: JwtService;
  let configService: ConfigService;
  let entitlementGuard: EntitlementGuard;
  let platformService: PlatformService;
  let platformController: PlatformController;
  let reflector: Reflector;

  let freeTenantId: string;
  let premiumTenantId: string;

  beforeAll(async () => {
    prisma = createPrismaMock();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(getQueueToken('notifications'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('finance'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('payroll'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('activity-media'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('homework'))
      .useValue(createQueueMock())
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    jwtService = app.get<JwtService>(JwtService);
    configService = app.get<ConfigService>(ConfigService);
    entitlementGuard = app.get<EntitlementGuard>(EntitlementGuard);
    platformService = app.get<PlatformService>(PlatformService);
    platformController = app.get<PlatformController>(PlatformController);
    reflector = app.get<Reflector>(Reflector);

    // Setup Test Data
    const platformId = 'platform';
    prisma.__state.tenants.push({
      id: platformId,
      slug: 'platform',
      name: 'Platform',
      isActive: true,
      plan: 'platform',
    });

    freeTenantId = 'free-school-id';
    await prisma.tenant.create({
      data: { id: freeTenantId, name: 'Free School', slug: 'free-school', plan: 'free' },
    });

    premiumTenantId = 'premium-school-id';
    await prisma.tenant.create({
      data: { id: premiumTenantId, name: 'Premium School', slug: 'premium-school', plan: 'premium' },
    });

    // Premium Plan
    const premiumPlanId = 'plan-premium';
    await prisma.platformPlan.create({
      data: { id: premiumPlanId, key: 'premium-plan', name: 'Premium Plan' }
    });
    prisma.__state.platformPlanFeatures.push(
      { planId: premiumPlanId, featureKey: 'module.payroll', enabled: true },
      { planId: premiumPlanId, featureKey: 'module.fees', enabled: true }
    );
    await prisma.tenantSubscription.create({
      data: { tenantId: premiumTenantId, planId: premiumPlanId, status: 'ACTIVE' }
    });

    // Free Plan
    const freePlanId = 'plan-free';
    await prisma.platformPlan.create({
      data: { id: freePlanId, key: 'free-plan', name: 'Free Plan' }
    });
    prisma.__state.platformPlanFeatures.push(
      { planId: freePlanId, featureKey: 'module.fees', enabled: true },
      { planId: freePlanId, featureKey: 'module.payroll', enabled: false }
    );
    await prisma.tenantSubscription.create({
      data: { tenantId: freeTenantId, planId: freePlanId, status: 'ACTIVE' }
    });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  function createMockContext(tenantId: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          auth: { tenantId, roles: [], permissions: [] },
          user: { tenantId, roles: [], permissions: [] },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  }

  describe('Entitlement Enforcement', () => {
    it('allows access to enabled modules', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('module.fees');
      
      const context = createMockContext(freeTenantId);
      const canActivate = await entitlementGuard.canActivate(context);
      expect(canActivate).toBe(true);
    });

    it('denies access to disabled modules', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('module.payroll');
      
      const context = createMockContext(freeTenantId);
      await expect(entitlementGuard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('honors manual feature overrides', async () => {
      await prisma.tenantFeatureOverride.create({
        data: { tenantId: freeTenantId, featureKey: 'module.payroll', enabled: true, reason: 'Test' }
      });

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('module.payroll');
      const context = createMockContext(freeTenantId);
      const canActivate = await entitlementGuard.canActivate(context);
      expect(canActivate).toBe(true);
    });
  });

  describe('SaaS Billing Lifecycle', () => {
    it('manages invoice lifecycle from ISSUED to PAID', async () => {
      const actor = { tenantId: 'platform', userId: 'admin' } as any;
      
      // 1. Create
      const invoice = await platformService.createSaaSInvoice(freeTenantId, {
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 86400000), // 1 day in future
        lines: [{ lineType: 'SUBSCRIPTION', description: 'Sub', quantity: 1, unitAmount: 5000 }]
      }, actor);
      
      expect(invoice).toBeDefined();
      expect(invoice.id).toBeDefined();
      expect(invoice.status).toBe('ISSUED');

      // 2. Partial Payment
      const partial = await platformService.recordSaaSPayment(freeTenantId, invoice.id, {
        amount: 2000,
        paymentDate: new Date(),
        method: 'BANK_TRANSFER'
      }, actor);
      
      expect(partial.status).toBe('PARTIAL');

      // 3. Full Payment
      const full = await platformService.recordSaaSPayment(freeTenantId, invoice.id, {
        amount: 3000,
        paymentDate: new Date(),
        method: 'BANK_TRANSFER'
      }, actor);
      
      expect(full.status).toBe('PAID');
    });
  });

  describe('Queue Health', () => {
    it('returns queue health data structure', async () => {
      const health = await platformService.getQueueHealth();
      expect(Array.isArray(health)).toBe(true);
    });
  });

  describe('Provider Masking', () => {
    it('masks secret keys in config', async () => {
      await prisma.providerConfig.create({
        data: {
          type: 'SMS',
          name: 'MaskTest',
          environment: 'PRODUCTION',
          configEncrypted: { key: 'secret', sender: 'test' },
          secretKeys: ['key'],
          enabled: true,
          updatedBy: 'test'
        }
      });

      const providers = await platformController.listProviders();
      const testProvider = providers.find((p: any) => p.name === 'MaskTest');
      expect(testProvider.config.key).toBe('********');
    });
  });
});
