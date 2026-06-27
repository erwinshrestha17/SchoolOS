import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { AuthMethod, FinanceRequestStatus, Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { FinanceService } from './finance.service';

const actor: AuthContext = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
  email: 'finance@school.test',
  roles: ['accountant'],
  permissions: ['fees:manage'],
  authMethod: AuthMethod.PASSWORD,
};

function buildService() {
  const prisma = {
    tenantSetting: {
      findUnique: jest.fn().mockResolvedValue({
        value: 'Asia/Kathmandu',
      }),
    },
    payment: {
      aggregate: jest
        .fn()
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(1250) } })
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(400) } })
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(300) } }),
      count: jest.fn().mockResolvedValue(2),
    },
    paymentRefund: {
      aggregate: jest
        .fn()
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(50) } })
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(25) } })
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(20) } }),
    },
    invoice: {
      aggregate: jest
        .fn()
        .mockResolvedValueOnce({
          _sum: { totalAmount: new Prisma.Decimal(1000) },
        })
        .mockResolvedValueOnce({
          _sum: { totalAmount: new Prisma.Decimal(700) },
        }),
    },
    financeApprovalRequest: {
      count: jest.fn().mockResolvedValue(3),
    },
    receipt: {
      count: jest.fn().mockResolvedValue(4),
    },
    cashierClose: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ studentCount: 5n }]),
  };
  const service = new FinanceService(
    prisma as never,
    { record: jest.fn() } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, prisma };
}

describe('FinanceService dashboard summary', () => {
  it('returns tenant-scoped Decimal-safe totals for a bounded Nepal school day', async () => {
    const { service, prisma } = buildService();

    const result = await service.getDashboardSummary(
      {
        date: '2026-06-27',
        timeZone: 'Asia/Kathmandu',
      },
      actor,
    );

    expect(result.period).toEqual({
      fromDate: '2026-06-27',
      toDate: '2026-06-27',
      timeZone: 'Asia/Kathmandu',
      startUtc: '2026-06-26T18:15:00.000Z',
      endExclusiveUtc: '2026-06-27T18:15:00.000Z',
    });
    expect(result.collectedToday).toEqual({
      grossAmount: '1250.00',
      refundedAmount: '50.00',
      netAmount: '1200.00',
    });
    expect(result.outstanding.amount).toBe('625.00');
    expect(result.overdue).toEqual({
      studentCount: 5,
      amount: '420.00',
    });
    expect(result.pendingApprovalCount).toBe(3);
    expect(result.receiptsIssued).toBe(4);
    expect(result.cashierClose.state).toBe('OPEN');

    expect(prisma.invoice.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: actor.tenantId }),
      }),
    );
    expect(prisma.financeApprovalRequest.count).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        status: FinanceRequestStatus.PENDING,
      },
    });
  });

  it('preserves a negative net collection when bounded refunds exceed receipts', async () => {
    const { service, prisma } = buildService();
    prisma.payment.aggregate
      .mockReset()
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(100) } })
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(400) } })
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(300) } });
    prisma.paymentRefund.aggregate
      .mockReset()
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(150) } })
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(25) } })
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(20) } });

    const result = await service.getDashboardSummary(
      {
        date: '2026-06-27',
        timeZone: 'Asia/Kathmandu',
      },
      actor,
    );

    expect(result.collectedToday).toEqual({
      grossAmount: '100.00',
      refundedAmount: '150.00',
      netAmount: '-50.00',
    });
  });

  it('fails closed without a finance permission', async () => {
    const { service, prisma } = buildService();

    await expect(
      service.getDashboardSummary(
        { date: '2026-06-27' },
        { ...actor, permissions: [] },
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.tenantSetting.findUnique).not.toHaveBeenCalled();
  });

  it('rejects unbounded or mismatched date inputs', async () => {
    const { service } = buildService();

    await expect(service.getDashboardSummary({}, actor)).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.getDashboardSummary(
        {
          fromDate: '2024-01-01',
          toDate: '2026-06-27',
        },
        actor,
      ),
    ).rejects.toThrow('limited to 366 days');
    await expect(
      service.getDashboardSummary(
        {
          date: '2026-06-27',
          timeZone: 'UTC',
        },
        actor,
      ),
    ).rejects.toThrow('does not match');
  });
});
