import { AuthMethod } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../plans/entitlements.service';
import { OperationalSummaryService } from './operational-summary.service';

describe('OperationalSummaryService', () => {
  const actor: AuthContext = {
    userId: 'finance-user-1',
    tenantId: 'tenant-a',
    tenantSlug: 'tenant-a-school',
    email: 'finance@school.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['accountant'],
    permissions: ['fees:read'],
  };

  const countResult = jest.fn().mockResolvedValue(0);
  const recentRows = jest.fn().mockResolvedValue([]);
  const sumResult = jest.fn().mockResolvedValue({
    _sum: { amount: { toString: () => '125.50' } },
  });

  const prisma = {
    payment: {
      count: countResult,
      findMany: recentRows,
      aggregate: sumResult,
    },
    invoice: { count: jest.fn().mockResolvedValue(0) },
    paymentRefund: { count: jest.fn().mockResolvedValue(0) },
    feeBillingRun: { count: jest.fn().mockResolvedValue(0) },
    cashierClose: { count: jest.fn().mockResolvedValue(0) },
  } as unknown as PrismaService;

  const entitlements = {
    getEntitlements: jest.fn(),
  } as unknown as jest.Mocked<Pick<EntitlementsService, 'getEntitlements'>>;

  let service: OperationalSummaryService;

  beforeEach(() => {
    jest.clearAllMocks();
    countResult.mockResolvedValue(0);
    recentRows.mockResolvedValue([]);
    sumResult.mockResolvedValue({
      _sum: { amount: { toString: () => '125.50' } },
    });
    service = new OperationalSummaryService(prisma, entitlements as EntitlementsService);
  });

  it('returns locked without reading module records when the module is not entitled', async () => {
    entitlements.getEntitlements.mockResolvedValue({ modules: [] } as never);

    const summary = await service.getModuleSummary('m3_fees', actor);

    expect(summary.status).toBe('locked');
    expect(summary.permissions).toEqual({ canView: true });
    expect(countResult).not.toHaveBeenCalled();
    expect(sumResult).not.toHaveBeenCalled();
  });

  it('uses tenant-scoped counts and Decimal-safe database aggregate values for fees', async () => {
    entitlements.getEntitlements.mockResolvedValue({ modules: ['fees'] } as never);

    const summary = await service.getModuleSummary('m3_fees', actor);

    expect(summary.status).toBe('ready');
    expect(summary.summary.collectedTodayAmount).toBe('125.50');
    expect(summary.schoolDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(summary.generatedAt).toMatch(/Z$/);

    const allCountCalls = [
      countResult,
      (prisma as unknown as { invoice: { count: jest.Mock } }).invoice.count,
      (prisma as unknown as { paymentRefund: { count: jest.Mock } }).paymentRefund.count,
      (prisma as unknown as { feeBillingRun: { count: jest.Mock } }).feeBillingRun.count,
      (prisma as unknown as { cashierClose: { count: jest.Mock } }).cashierClose.count,
    ].flatMap((mock) => mock.mock.calls);

    expect(allCountCalls.length).toBeGreaterThan(0);
    for (const [input] of allCountCalls) {
      expect(input.where.tenantId).toBe('tenant-a');
    }

    expect(sumResult).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-a' }),
        _sum: { amount: true },
      }),
    );
    expect(recentRows).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-a' },
        take: 5,
      }),
    );
  });
});
