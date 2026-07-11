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
    invoice: {
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { totalAmount: { toString: () => '500.00' } } }),
    },
    paymentRefund: {
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { amount: { toString: () => '0.00' } } }),
    },
    feeBillingRun: { count: jest.fn().mockResolvedValue(0) },
    cashierClose: { count: jest.fn().mockResolvedValue(0) },
    activityPost: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    activityAttachment: { count: jest.fn().mockResolvedValue(0) },
    notificationDelivery: { count: jest.fn().mockResolvedValue(0) },
    staff: {
      findFirst: jest.fn().mockResolvedValue({ id: 'staff-1' }),
    },
    subjectTeacherAssignment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
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
    service = new OperationalSummaryService(
      prisma,
      entitlements as unknown as EntitlementsService,
    );
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
    entitlements.getEntitlements.mockResolvedValue({
      modules: ['fees'],
    } as never);

    const summary = await service.getModuleSummary('m3_fees', actor);

    expect(summary.status).toBe('ready');
    expect(summary.summary.collectedTodayAmount).toBe('125.50');
    // overdueFeesAmount = max(0, invoiceTotal - paidTotal + refundTotal)
    // = max(0, 500.00 - 125.50 + 0.00) = 374.50, mirroring FinanceService's
    // outstanding-balance formula for the fees workspace.
    expect(summary.summary.overdueFeesAmount).toBe('374.50');
    expect(summary.schoolDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(summary.generatedAt).toMatch(/Z$/);

    const allCountCalls = [
      countResult,
      (prisma as unknown as { invoice: { count: jest.Mock } }).invoice.count,
      (prisma as unknown as { paymentRefund: { count: jest.Mock } })
        .paymentRefund.count,
      (prisma as unknown as { feeBillingRun: { count: jest.Mock } })
        .feeBillingRun.count,
      (prisma as unknown as { cashierClose: { count: jest.Mock } }).cashierClose
        .count,
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

  it('omits the module next-action when nothing needs attention', async () => {
    entitlements.getEntitlements.mockResolvedValue({
      modules: ['fees'],
    } as never);

    const summary = await service.getModuleSummary('m3_fees', actor);

    // Every enabled module previously always contributed a static
    // "Open <module>" action regardless of whether there was anything to
    // review, which made the dashboard's next-actions list just re-list
    // every enabled module instead of genuine follow-up work.
    expect(summary.attentionItems).toHaveLength(0);
    expect(summary.nextActions).toEqual([]);
  });

  it('surfaces the module next-action only when an attention item exists', async () => {
    entitlements.getEntitlements.mockResolvedValue({
      modules: ['fees'],
    } as never);
    (
      prisma as unknown as { invoice: { count: jest.Mock } }
    ).invoice.count.mockResolvedValue(3);

    const summary = await service.getModuleSummary('m3_fees', actor);

    expect(summary.attentionItems.length).toBeGreaterThan(0);
    expect(summary.nextActions).toEqual([
      {
        key: 'open_m3_fees',
        label: 'Open Fees',
        route: '/dashboard/fees',
      },
    ]);
  });

  // Regression guard: m5_activity previously gated canView on
  // 'activity:read'/'activity:manage', permission strings no real role is
  // ever granted (roles carry 'activity_feed:read'/'activity_feed:moderate'
  // instead), so the summary silently reported locked/unavailable for
  // every actor. See apps/web/app/dashboard/activity/page.tsx history.
  it('grants canView for an admin actor holding activity_feed:moderate', async () => {
    entitlements.getEntitlements.mockResolvedValue({
      modules: ['activity'],
    } as never);
    const adminActor: AuthContext = {
      ...actor,
      roles: ['admin'],
      permissions: ['activity_feed:moderate'],
    };

    const summary = await service.getModuleSummary('m5_activity', adminActor);

    expect(summary.permissions).toEqual({ canView: true });
    expect(summary.status).not.toBe('permissionDenied');
    expect(summary.status).not.toBe('locked');
  });

  it('grants canView for a teacher actor holding only activity_feed:read', async () => {
    entitlements.getEntitlements.mockResolvedValue({
      modules: ['activity'],
    } as never);
    const teacherActor: AuthContext = {
      ...actor,
      roles: ['teacher'],
      permissions: ['activity_feed:read'],
    };

    const summary = await service.getModuleSummary('m5_activity', teacherActor);

    expect(summary.permissions).toEqual({ canView: true });
    expect(summary.status).not.toBe('permissionDenied');
    expect(summary.status).not.toBe('locked');
  });
});
