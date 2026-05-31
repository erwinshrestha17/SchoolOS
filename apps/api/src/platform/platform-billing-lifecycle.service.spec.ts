import { Prisma } from '@prisma/client';
import { PlatformBillingLifecycleService } from './platform-billing-lifecycle.service';

describe('PlatformBillingLifecycleService', () => {
  function createService() {
    const prisma = {
      saaSInvoice: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      tenantSubscription: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      tenant: {
        update: jest.fn(),
      },
    };
    const auditService = { record: jest.fn() };
    const platformService = { createSaaSInvoice: jest.fn() };

    return {
      service: new PlatformBillingLifecycleService(
        prisma as never,
        auditService as never,
        platformService as never,
      ),
      prisma,
      auditService,
      platformService,
    };
  }

  it('generates due SaaS renewal invoices and advances the renewal date', async () => {
    const { service, prisma, auditService, platformService } = createService();
    const renewalDate = new Date('2026-05-01T00:00:00.000Z');
    prisma.saaSInvoice.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prisma.tenantSubscription.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'sub-1',
          tenantId: 'tenant-1',
          planId: 'plan-1',
          renewsAt: renewalDate,
          plan: {
            id: 'plan-1',
            name: 'Premium',
            status: 'ACTIVE',
            billingCycle: 'MONTHLY',
            priceNpr: new Prisma.Decimal('12000.00'),
          },
        },
      ]);
    platformService.createSaaSInvoice.mockResolvedValue({ id: 'invoice-1' });

    const result = await service.runBillingLifecycle('billing-actor');

    expect(result.renewalInvoices).toBe(1);
    expect(platformService.createSaaSInvoice).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        planId: 'plan-1',
        subscriptionId: 'sub-1',
        issueDate: renewalDate.toISOString(),
        dueDate: '2026-05-16T00:00:00.000Z',
        status: 'ISSUED',
        lines: [
          {
            lineType: 'SUBSCRIPTION',
            description: 'Premium MONTHLY subscription renewal',
            quantity: 1,
            unitAmount: '12000.00',
          },
        ],
      }),
      'billing-actor',
    );
    expect(prisma.tenantSubscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { renewsAt: new Date('2026-06-01T00:00:00.000Z') },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'subscription_renewal_invoice_generated',
        resource: 'subscriptions',
        resourceId: 'sub-1',
        tenantId: 'platform',
        userId: 'billing-actor',
      }),
    );
  });

  it('advances free active subscriptions without creating tenant fee or accounting records', async () => {
    const { service, prisma, auditService, platformService } = createService();
    prisma.saaSInvoice.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prisma.tenantSubscription.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'sub-free',
          tenantId: 'tenant-1',
          planId: 'plan-free',
          renewsAt: new Date('2026-05-01T00:00:00.000Z'),
          plan: {
            id: 'plan-free',
            name: 'Pilot',
            status: 'ACTIVE',
            billingCycle: 'ANNUAL',
            priceNpr: new Prisma.Decimal('0'),
          },
        },
      ]);

    const result = await service.runBillingLifecycle('billing-actor');

    expect(result.renewalInvoices).toBe(0);
    expect(platformService.createSaaSInvoice).not.toHaveBeenCalled();
    expect(prisma.tenantSubscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-free' },
      data: { renewsAt: new Date('2027-05-01T00:00:00.000Z') },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'subscription_renewal_advanced',
        resource: 'subscriptions',
        tenantId: 'platform',
      }),
    );
  });
});
