import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PlatformService } from '../src/platform/platform.service';
import { PlatformController } from '../src/platform/platform.controller';
import { PlansService } from '../src/plans/plans.service';
import { getQueueToken } from '@nestjs/bullmq';
import { PrismaMock, createPrismaMock, createQueueMock } from './test-helpers';

describe('M0 SaaS Billing & Entitlements & Observability (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaMock;
  let platformService: PlatformService;
  let platformController: PlatformController;
  let plansService: PlansService;

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

    platformService = app.get<PlatformService>(PlatformService);
    platformController = app.get<PlatformController>(PlatformController);
    plansService = app.get<PlansService>(PlansService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('SaaS Billing Lifecycle Automation', () => {
    const tenantId = 'billing-school-id';

    beforeEach(async () => {
      // Clear database state
      prisma.__state.tenants = [];
      prisma.__state.saaSInvoices = [];
      prisma.__state.saaSPayments = [];
      prisma.__state.tenantSubscriptions = [];
      prisma.__state.auditLogs = [];
      prisma.__state.invoices = [];
      prisma.__state.payments = [];
      prisma.__state.journalEntries = [];

      // Create a test tenant
      await prisma.tenant.create({
        data: {
          id: tenantId,
          name: 'Billing School',
          slug: 'billing-school',
          plan: 'standard',
        },
      });
    });

    it('invoice draft -> issued -> paid lifecycle works', async () => {
      // 1. Create a draft invoice
      const invoice = await platformService.createSaaSInvoice(
        tenantId,
        {
          issueDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          status: 'DRAFT',
          lines: [
            {
              lineType: 'SUBSCRIPTION',
              description: 'Standard Plan Subscription',
              quantity: 1,
              unitAmount: '10000.00',
            },
          ],
        },
        'admin-user',
      );

      expect(invoice.status).toBe('DRAFT');
      expect(invoice.amount).toBe('10000.00');

      // 2. Issue the invoice
      const issued = await platformService.issueSaaSInvoice(invoice.id, 'admin-user');
      expect(issued.status).toBe('ISSUED');

      // Verify audit logged for saas_invoice_issued
      const issueAudit = prisma.__state.auditLogs.find(
        (log) => log.action === 'saas_invoice_issued' && log.resourceId === invoice.id,
      );
      expect(issueAudit).toBeDefined();

      // 3. Record a payment
      const paid = await platformService.recordSaaSPayment(
        tenantId,
        invoice.id,
        {
          amount: '10000.00',
          paymentDate: new Date().toISOString(),
          method: 'BANK_TRANSFER',
          reference: 'TXN-123',
        },
        'admin-user',
      );

      expect(paid.status).toBe('PAID');
      expect(paid.paidAmount).toBe('10000.00');
      expect(paid.balanceAmount).toBe('0.00');

      // Verify audit logged for saas_payment_recorded
      const paymentAudit = prisma.__state.auditLogs.find(
        (log) => log.action === 'saas_payment_recorded' && log.resourceId === invoice.id,
      );
      expect(paymentAudit).toBeDefined();
    });

    it('invoice issued -> overdue -> subscription past_due (GRACE) works', async () => {
      // 1. Create active subscription
      const sub = await prisma.tenantSubscription.create({
        data: {
          tenantId,
          planId: 'standard-plan',
          status: 'ACTIVE',
          startsAt: new Date(),
        },
      });

      // 2. Create issued invoice
      const invoice = await platformService.createSaaSInvoice(
        tenantId,
        {
          subscriptionId: sub.id,
          issueDate: new Date().toISOString(),
          dueDate: new Date(Date.now() - 86400000).toISOString(), // overdue
          status: 'ISSUED',
          lines: [
            {
              lineType: 'SUBSCRIPTION',
              description: 'Standard Plan Subscription',
              quantity: 1,
              unitAmount: '10000.00',
            },
          ],
        },
        'admin-user',
      );

      // 3. Mark overdue
      const overdue = await platformService.markInvoiceOverdue(invoice.id, 'admin-user');
      expect(overdue.status).toBe('OVERDUE');

      // Verify subscription status updated to GRACE
      const updatedSub = await prisma.tenantSubscription.findUnique({
        where: { id: sub.id },
      });
      expect(updatedSub.status).toBe('GRACE');

      // Verify audit log for grace status
      const graceAudit = prisma.__state.auditLogs.find(
        (log) => log.action === 'subscription_grace_period_started',
      );
      expect(graceAudit).toBeDefined();
    });

    it('overdue -> suspend tenant works', async () => {
      // 1. Create active subscription
      const sub = await prisma.tenantSubscription.create({
        data: {
          tenantId,
          planId: 'standard-plan',
          status: 'GRACE',
          startsAt: new Date(),
        },
      });

      // 2. Suspend tenant
      await platformService.suspendTenantForBilling(tenantId, 'Unpaid balance for overdue invoice', 'admin-user');

      // Verify tenant is inactive
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      expect(tenant.isActive).toBe(false);

      // Verify subscription is suspended
      const updatedSub = await prisma.tenantSubscription.findUnique({
        where: { id: sub.id },
      });
      expect(updatedSub.status).toBe('SUSPENDED');

      // Verify audit logs
      const suspendAudit = prisma.__state.auditLogs.find(
        (log) => log.action === 'tenant_suspended_billing',
      );
      expect(suspendAudit).toBeDefined();
      if (suspendAudit) {
        expect((suspendAudit.after as any)?.reason).toBe('Unpaid balance for overdue invoice');
      }
    });

    it('payment -> reactivate tenant works', async () => {
      // 1. Create suspended subscription and inactive tenant
      const sub = await prisma.tenantSubscription.create({
        data: {
          tenantId,
          planId: 'standard-plan',
          status: 'SUSPENDED',
          startsAt: new Date(),
        },
      });
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { isActive: false },
      });

      // 2. Reactivate tenant
      await platformService.reactivateTenantAfterPayment(tenantId, 'Payment received for past due invoice', 'admin-user');

      // Verify tenant is active
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      expect(tenant.isActive).toBe(true);

      // Verify subscription is active
      const updatedSub = await prisma.tenantSubscription.findUnique({
        where: { id: sub.id },
      });
      expect(updatedSub.status).toBe('ACTIVE');

      // Verify audit logs
      const reactivateAudit = prisma.__state.auditLogs.find(
        (log) => log.action === 'tenant_reactivated_billing',
      );
      expect(reactivateAudit).toBeDefined();
      if (reactivateAudit) {
        expect((reactivateAudit.after as any)?.reason).toBe('Payment received for past due invoice');
      }
    });

    it('cancel invoice rejects cancellation of paid invoices and prevents payments on cancelled invoice', async () => {
      // 1. Create paid invoice
      const invoice = await platformService.createSaaSInvoice(
        tenantId,
        {
          issueDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          status: 'ISSUED',
          lines: [
            {
              lineType: 'SUBSCRIPTION',
              description: 'Standard Plan Subscription',
              quantity: 1,
              unitAmount: '10000.00',
            },
          ],
        },
        'admin-user',
      );

      await platformService.recordSaaSPayment(
        tenantId,
        invoice.id,
        {
          amount: '10000.00',
          paymentDate: new Date().toISOString(),
          method: 'BANK_TRANSFER',
        },
        'admin-user',
      );

      // 2. Try to cancel paid invoice
      await expect(
        platformService.cancelSaaSInvoice(
          tenantId,
          invoice.id,
          { reason: 'Customer requested cancellation' },
          'admin-user',
        ),
      ).rejects.toThrow(BadRequestException);

      // 3. Create a new draft invoice and cancel it
      const draft = await platformService.createSaaSInvoice(
        tenantId,
        {
          issueDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          status: 'DRAFT',
          lines: [
            {
              lineType: 'SUBSCRIPTION',
              description: 'Standard Plan Subscription',
              quantity: 1,
              unitAmount: '10000.00',
            },
          ],
        },
        'admin-user',
      );

      const cancelled = await platformService.cancelSaaSInvoice(
        tenantId,
        draft.id,
        { reason: 'Customer requested cancellation' },
        'admin-user',
      );
      expect(cancelled.status).toBe('CANCELLED');

      // 4. Try to pay cancelled invoice
      await expect(
        platformService.recordSaaSPayment(
          tenantId,
          draft.id,
          {
            amount: '5000.00',
            paymentDate: new Date().toISOString(),
            method: 'BANK_TRANSFER',
          },
          'admin-user',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('prevent duplicate payment with same reference', async () => {
      const invoice = await platformService.createSaaSInvoice(
        tenantId,
        {
          issueDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          status: 'ISSUED',
          lines: [
            {
              lineType: 'SUBSCRIPTION',
              description: 'Standard Plan Subscription',
              quantity: 1,
              unitAmount: '10000.00',
            },
          ],
        },
        'admin-user',
      );

      // Record first payment
      await platformService.recordSaaSPayment(
        tenantId,
        invoice.id,
        {
          amount: '5000.00',
          paymentDate: new Date().toISOString(),
          method: 'BANK_TRANSFER',
          reference: 'TXN-DOUBLE',
        },
        'admin-user',
      );

      // Record duplicate payment reference
      await expect(
        platformService.recordSaaSPayment(
          tenantId,
          invoice.id,
          {
            amount: '5000.00',
            paymentDate: new Date().toISOString(),
            method: 'BANK_TRANSFER',
            reference: 'TXN-DOUBLE',
          },
          'admin-user',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('ensures no M3 or M9 ledger posting occurs during platform billing mutations', async () => {
      const invoice = await platformService.createSaaSInvoice(
        tenantId,
        {
          issueDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          status: 'ISSUED',
          lines: [
            {
              lineType: 'SUBSCRIPTION',
              description: 'Standard Plan Subscription',
              quantity: 1,
              unitAmount: '10000.00',
            },
          ],
        },
        'admin-user',
      );

      await platformService.recordSaaSPayment(
        tenantId,
        invoice.id,
        {
          amount: '10000.00',
          paymentDate: new Date().toISOString(),
          method: 'BANK_TRANSFER',
        },
        'admin-user',
      );

      // Verify that M3/M9 tables remain completely empty
      expect(prisma.__state.invoices).toHaveLength(0);
      expect(prisma.__state.payments).toHaveLength(0);
      expect(prisma.__state.journalEntries).toHaveLength(0);
    });
  });

  describe('Entitlement Enforcement Against Real School APIs', () => {
    const tenantId = 'entitlement-school-id';

    beforeEach(async () => {
      prisma.__state.tenants = [];
      prisma.__state.tenantSubscriptions = [];
      prisma.__state.tenantFeatureOverrides = [];
      prisma.__state.usageLimits = [];
      prisma.__state.usageCounters = [];
      prisma.__state.platformPlans = [];

      await prisma.tenant.create({
        data: {
          id: tenantId,
          name: 'Entitlement School',
          slug: 'entitlement-school',
          plan: 'basic',
        },
      });

      await prisma.platformPlan.create({
        data: {
          id: 'basic-plan',
          key: 'basic',
          name: 'Basic Plan',
        },
      });
    });

    it('returns false and inactive reason for suspended tenant', async () => {
      // Deactivate tenant
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { isActive: false },
      });

      const res = await plansService.checkFeatureEnabled(tenantId, 'module.students');
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('tenant_inactive');
      expect(res.message).toContain('school account is currently suspended');
    });

    it('feature override takes precedence', async () => {
      // 1. Feature disabled by default for basic plan
      await prisma.tenantSubscription.create({
        data: {
          tenantId,
          planId: 'basic-plan',
          status: 'ACTIVE',
          startsAt: new Date(),
        },
      });

      // 2. Add override to enable
      await prisma.tenantFeatureOverride.create({
        data: {
          tenantId,
          featureKey: 'module.library',
          enabled: true,
        },
      });

      const res = await plansService.checkFeatureEnabled(tenantId, 'module.library');
      expect(res.allowed).toBe(true);
    });

    it('validateLimit blocks suspended tenant', async () => {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { isActive: false },
      });

      await expect(
        plansService.validateLimit(tenantId, 'students.count', 5),
      ).rejects.toThrow(ForbiddenException);
    });

    it('validateLimit blocks exceeding limit', async () => {
      await prisma.tenantSubscription.create({
        data: {
          tenantId,
          planId: 'basic-plan',
          status: 'ACTIVE',
          startsAt: new Date(),
        },
      });

      // Let's create a usage limit
      await prisma.usageLimit.create({
        data: {
          planId: 'basic-plan',
          usageKey: 'students.count',
          limit: 10,
        },
      });

      await expect(
        plansService.validateLimit(tenantId, 'students.count', 10),
      ).rejects.toThrow(ForbiddenException);
    });

    it('validateLimit allows within limit', async () => {
      await prisma.tenantSubscription.create({
        data: {
          tenantId,
          planId: 'basic-plan',
          status: 'ACTIVE',
          startsAt: new Date(),
        },
      });

      // Let's create a usage limit
      await prisma.usageLimit.create({
        data: {
          planId: 'basic-plan',
          usageKey: 'students.count',
          limit: 10,
        },
      });

      await expect(
        plansService.validateLimit(tenantId, 'students.count', 9),
      ).resolves.toBeUndefined();
    });
  });

  describe('Usage, Audit, and Platform Dashboard Observability Polish', () => {
    beforeEach(async () => {
      prisma.__state.auditLogs = [];
    });

    it('lists audit logs with page, limit, and filters', async () => {
      // 1. Create audit logs
      await prisma.auditLog.create({
        data: {
          tenantId: 'school-a',
          action: 'tenant_suspended',
          resource: 'tenants',
          resourceId: 'school-a',
          userId: 'admin-user',
        },
      });
      await prisma.auditLog.create({
        data: {
          tenantId: 'school-b',
          action: 'tenant_activated',
          resource: 'tenants',
          resourceId: 'school-b',
          userId: 'admin-user',
        },
      });

      const logs = await platformService.listAuditLogs({
        tenantId: 'school-a',
        page: 1,
        limit: 10,
      });

      expect(logs.items).toHaveLength(1);
      expect(logs.items[0].tenantId).toBe('school-a');
      expect(logs.items[0].action).toBe('tenant_suspended');
    });

    it('exports audit logs as CSV, ensuring secrets are not leaked and is audited', async () => {
      await prisma.auditLog.create({
        data: {
          tenantId: 'school-a',
          action: 'tenant_suspended',
          resource: 'tenants',
          resourceId: 'school-a',
          userId: 'admin-user',
          before: { secretKey: 'dont-leak-me' },
        },
      });

      const csv = await platformService.exportAuditLogsCsv({}, 'admin-user');
      expect(csv).toContain('ID,Timestamp,Action,Resource,Resource ID,Tenant ID');
      expect(csv).toContain('tenant_suspended');
      expect(csv).not.toContain('dont-leak-me');

      // Verify audit logged for platform_audit_logs_exported
      const exportAudit = prisma.__state.auditLogs.find(
        (log) => log.action === 'platform_audit_logs_exported',
      );
      expect(exportAudit).toBeDefined();
    });
  });
});
