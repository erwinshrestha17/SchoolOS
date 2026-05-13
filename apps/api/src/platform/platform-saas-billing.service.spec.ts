import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PlatformService } from './platform.service';

describe('PlatformService SaaS billing lifecycle hardening', () => {
  let service: PlatformService;
  let prisma: any;
  let auditService: { record: jest.Mock };

  const makeQueue = () => ({
    getJobCounts: jest.fn(),
    isPaused: jest.fn(),
    getWorkers: jest.fn(),
    getFailed: jest.fn(),
    getJob: jest.fn(),
  });

  beforeEach(() => {
    prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tenant-1',
          isActive: true,
        }),
      },
      saaSInvoice: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      saaSPayment: {
        create: jest.fn(),
      },
      tenantSubscription: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    auditService = { record: jest.fn().mockResolvedValue({}) };

    service = new PlatformService(
      prisma,
      auditService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      makeQueue() as any,
      makeQueue() as any,
      makeQueue() as any,
      makeQueue() as any,
      makeQueue() as any,
    );
  });

  it('creates SaaS invoices as platform billing records and audits the action', async () => {
    const invoice = {
      id: 'saas-invoice-1',
      tenantId: 'tenant-1',
      invoiceNumber: 'SaaS-000001',
      amount: new Prisma.Decimal('2500'),
      currency: 'NPR',
      status: 'ISSUED',
      issueDate: new Date('2026-05-01'),
      dueDate: new Date('2026-05-15'),
      lines: [],
      payments: [],
    };

    prisma.saaSInvoice.create.mockResolvedValue(invoice);
    jest
      .spyOn(service as any, 'nextInvoiceNumber')
      .mockResolvedValue('SaaS-000001');
    jest.spyOn(service as any, 'toInvoiceSummary').mockReturnValue({
      id: invoice.id,
      tenantId: invoice.tenantId,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      amount: '2500',
    });

    const result = await service.createSaaSInvoice(
      'tenant-1',
      {
        issueDate: '2026-05-01',
        dueDate: '2026-05-15',
        lines: [
          {
            lineType: 'SUBSCRIPTION',
            description: 'SchoolOS monthly subscription',
            quantity: 1,
            unitAmount: '2500',
          },
        ],
      },
      'platform-user-1',
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 'saas-invoice-1',
        invoiceNumber: 'SaaS-000001',
        status: 'ISSUED',
      }),
    );
    expect(prisma.saaSInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          amount: expect.any(Prisma.Decimal),
          currency: 'NPR',
          status: 'ISSUED',
          createdBy: 'platform-user-1',
          lines: {
            create: [
              expect.objectContaining({
                lineType: 'SUBSCRIPTION',
                quantity: 1,
                unitAmount: expect.any(Prisma.Decimal),
                totalAmount: expect.any(Prisma.Decimal),
              }),
            ],
          },
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'saas_invoice_created',
        resource: 'saas_billing',
        tenantId: 'tenant-1',
        userId: 'platform-user-1',
      }),
    );
  });

  it('records partial and full SaaS payments without touching school fee/accounting delegates', async () => {
    const invoice = {
      id: 'saas-invoice-1',
      tenantId: 'tenant-1',
      status: 'ISSUED',
      amount: new Prisma.Decimal('2500'),
      payments: [{ amount: new Prisma.Decimal('1000') }],
      lines: [],
    };
    const updatedInvoice = {
      ...invoice,
      status: 'PARTIAL',
      payments: [
        { amount: new Prisma.Decimal('1000') },
        { amount: new Prisma.Decimal('500') },
      ],
    };

    prisma.saaSInvoice.findFirst.mockResolvedValue(invoice);
    prisma.saaSPayment.create.mockResolvedValue({ id: 'saas-payment-1' });
    prisma.saaSInvoice.update.mockResolvedValue(updatedInvoice);
    jest.spyOn(service as any, 'toInvoiceSummary').mockReturnValue({
      id: 'saas-invoice-1',
      status: 'PARTIAL',
      paidAmount: '1500',
    });

    await service.recordSaaSPayment(
      'tenant-1',
      'saas-invoice-1',
      {
        amount: '500',
        paymentDate: '2026-05-05',
        method: 'BANK_TRANSFER',
        reference: 'BANK-REF-1',
      },
      'platform-user-1',
    );

    expect(prisma.saaSPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        invoiceId: 'saas-invoice-1',
        amount: expect.any(Prisma.Decimal),
        method: 'BANK_TRANSFER',
        reference: 'BANK-REF-1',
        createdBy: 'platform-user-1',
      }),
    });
    expect(prisma.saaSInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'saas-invoice-1' },
        data: { status: 'PARTIAL' },
      }),
    );
    expect((prisma as any).payment).toBeUndefined();
    expect((prisma as any).invoice).toBeUndefined();
    expect((prisma as any).journalEntry).toBeUndefined();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'saas_payment_recorded',
        resource: 'saas_billing',
        tenantId: 'tenant-1',
      }),
    );
  });

  it('rejects payment against cancelled, missing, paid, and overpaid SaaS invoices', async () => {
    prisma.saaSInvoice.findFirst.mockResolvedValue(null);

    await expect(
      service.recordSaaSPayment(
        'tenant-1',
        'missing',
        { amount: '100', paymentDate: '2026-05-05', method: 'CASH' },
        'platform-user-1',
      ),
    ).rejects.toThrow(NotFoundException);

    prisma.saaSInvoice.findFirst.mockResolvedValue({
      id: 'cancelled',
      tenantId: 'tenant-1',
      status: 'CANCELLED',
      amount: new Prisma.Decimal('100'),
      payments: [],
    });

    await expect(
      service.recordSaaSPayment(
        'tenant-1',
        'cancelled',
        { amount: '100', paymentDate: '2026-05-05', method: 'CASH' },
        'platform-user-1',
      ),
    ).rejects.toThrow(/cancelled invoice/);

    prisma.saaSInvoice.findFirst.mockResolvedValue({
      id: 'paid',
      tenantId: 'tenant-1',
      status: 'PAID',
      amount: new Prisma.Decimal('100'),
      payments: [],
    });

    await expect(
      service.recordSaaSPayment(
        'tenant-1',
        'paid',
        { amount: '100', paymentDate: '2026-05-05', method: 'CASH' },
        'platform-user-1',
      ),
    ).rejects.toThrow(/already fully paid/);

    prisma.saaSInvoice.findFirst.mockResolvedValue({
      id: 'issued',
      tenantId: 'tenant-1',
      status: 'ISSUED',
      amount: new Prisma.Decimal('100'),
      payments: [{ amount: new Prisma.Decimal('75') }],
    });

    await expect(
      service.recordSaaSPayment(
        'tenant-1',
        'issued',
        { amount: '50', paymentDate: '2026-05-05', method: 'CASH' },
        'platform-user-1',
      ),
    ).rejects.toThrow(/exceeds invoice balance/);
  });

  it('cancels unpaid SaaS invoices with a reason and rejects cancelling paid invoices', async () => {
    const invoice = {
      id: 'saas-invoice-1',
      tenantId: 'tenant-1',
      status: 'ISSUED',
      payments: [],
    };
    const cancelled = {
      ...invoice,
      status: 'CANCELLED',
      cancelledBy: 'platform-user-1',
      cancellationReason: 'Duplicate invoice',
      lines: [],
      payments: [],
    };

    prisma.saaSInvoice.findFirst.mockResolvedValue(invoice);
    prisma.saaSInvoice.update.mockResolvedValue(cancelled);
    jest.spyOn(service as any, 'toInvoiceSummary').mockReturnValue({
      id: 'saas-invoice-1',
      status: 'CANCELLED',
    });

    await expect(
      service.cancelSaaSInvoice(
        'tenant-1',
        'saas-invoice-1',
        { reason: 'Duplicate invoice' },
        'platform-user-1',
      ),
    ).resolves.toEqual({ id: 'saas-invoice-1', status: 'CANCELLED' });

    expect(prisma.saaSInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'saas-invoice-1' },
        data: expect.objectContaining({
          status: 'CANCELLED',
          cancelledBy: 'platform-user-1',
          cancellationReason: 'Duplicate invoice',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'saas_invoice_cancelled',
        resource: 'saas_billing',
        tenantId: 'tenant-1',
      }),
    );

    prisma.saaSInvoice.findFirst.mockResolvedValue({
      ...invoice,
      payments: [{ id: 'payment-1', amount: new Prisma.Decimal('100') }],
    });

    await expect(
      service.cancelSaaSInvoice(
        'tenant-1',
        'saas-invoice-1',
        { reason: 'Duplicate invoice' },
        'platform-user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('audits tenant subscription status transitions including trial active suspended expired and cancelled states', async () => {
    for (const status of [
      'TRIAL',
      'ACTIVE',
      'GRACE',
      'SUSPENDED',
      'EXPIRED',
      'CANCELLED',
    ]) {
      prisma.tenantSubscription.findFirst.mockResolvedValueOnce({
        id: `before-${status}`,
        tenantId: 'tenant-1',
        status: 'ACTIVE',
      });
      prisma.tenantSubscription.update.mockResolvedValueOnce({
        id: `sub-${status}`,
        tenantId: 'tenant-1',
        status,
        startsAt: new Date('2026-05-01'),
        endsAt: null,
        renewsAt: null,
        trialEndsAt: null,
        plan: { key: 'standard', name: 'Standard' },
      });
      jest.spyOn(service as any, 'toSubscriptionSummary').mockReturnValueOnce({
        id: `sub-${status}`,
        tenantId: 'tenant-1',
        status,
      });

      await expect(
        service.updateSubscriptionStatus(
          'tenant-1',
          `sub-${status}`,
          { status, notes: `Move to ${status}` },
          'platform-user-1',
        ),
      ).resolves.toEqual(
        expect.objectContaining({
          id: `sub-${status}`,
          status,
        }),
      );
    }

    expect(auditService.record).toHaveBeenCalledTimes(6);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tenant_subscription_status_updated',
        resource: 'subscriptions',
        tenantId: 'tenant-1',
        userId: 'platform-user-1',
      }),
    );
  });
});
