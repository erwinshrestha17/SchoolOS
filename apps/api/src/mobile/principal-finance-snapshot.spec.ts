import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { AuthMethod } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { systemRolePermissions } from '@schoolos/core';
import type { AuthContext } from '../auth/auth.types';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { REQUIRED_MODULE_KEY } from '../auth/decorators/required-module.decorator';
import { MobilePrincipalController } from './mobile-principal.controller';
import { MobilePrincipalService } from './mobile-principal.service';

/**
 * Owner decision 1 (Phase 3/4 close): Principals read a leadership-safe,
 * aggregate-only finance snapshot through `finance:principal:read`, and that
 * permission grants no operational finance authority anywhere.
 */
describe('Principal finance snapshot (finance:principal:read)', () => {
  const principal: AuthContext = {
    userId: 'principal-user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'school',
    email: 'principal@school.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['principal'],
    permissions: [
      'students:read',
      'attendance:read',
      'notices:read',
      'finance:principal:read',
    ],
  };

  function makePrisma() {
    const aggregate = (amount: number | null, count = 0) =>
      jest.fn().mockResolvedValue({
        _sum: { amount, totalAmount: amount },
        _count: { _all: count },
      });
    return {
      tenant: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'tenant-1',
          name: 'School',
          isActive: true,
        }),
      },
      payment: {
        aggregate: aggregate(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      invoice: {
        aggregate: aggregate(0),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      paymentAllocation: { aggregate: aggregate(0) },
      financeApprovalRequest: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      cashierClose: { findMany: jest.fn().mockResolvedValue([]) },
      bankReconciliationSession: { count: jest.fn().mockResolvedValue(0) },
      bankStatementImportJob: { count: jest.fn().mockResolvedValue(0) },
      class: { findMany: jest.fn().mockResolvedValue([]) },
      section: { findMany: jest.fn().mockResolvedValue([]) },
      attendanceSession: { findMany: jest.fn().mockResolvedValue([]) },
      attendanceRecord: { findMany: jest.fn().mockResolvedValue([]) },
      attendanceCorrectionRequest: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      approvalRequest: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      notice: { findMany: jest.fn().mockResolvedValue([]) },
      reportCard: { count: jest.fn().mockResolvedValue(0) },
      student: { count: jest.fn().mockResolvedValue(0) },
      staffAttendance: { findMany: jest.fn().mockResolvedValue([]) },
      staffLeaveRequest: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      timetableSubstitution: { findMany: jest.fn().mockResolvedValue([]) },
      reportCardCorrectionRequest: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ count: 0n }]),
    };
  }

  function makeService(
    prisma: ReturnType<typeof makePrisma>,
    modules: string[],
  ) {
    return new MobilePrincipalService(
      prisma as never,
      {
        getEntitlements: jest.fn().mockResolvedValue({ modules, features: [] }),
      } as never,
      { registerFinalAction: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      { listManagerRequests: jest.fn() } as never,
    );
  }

  const feesCard = async (
    service: MobilePrincipalService,
    actor: AuthContext,
  ) => (await service.getDashboard(actor)).cards.find((c) => c.key === 'fees');

  it('route requires only finance:principal:read and the fees module', () => {
    const reflector = new Reflector();
    const handler = MobilePrincipalController.prototype.feesSummary;
    expect(reflector.get(PERMISSIONS_KEY, handler)).toEqual([
      'finance:principal:read',
    ]);
    expect(reflector.get(REQUIRED_MODULE_KEY, handler)).toBe('fees');
  });

  it('authorized: returns aggregates with no operational capability and no student names', async () => {
    const prisma = makePrisma();
    prisma.financeApprovalRequest.findMany.mockResolvedValue([
      {
        id: 'fa-1',
        type: 'REFUND',
        amount: 5000,
        payment: { amount: 5000 },
      },
    ]);
    prisma.financeApprovalRequest.count.mockResolvedValue(1);
    prisma.invoice.count.mockResolvedValue(2);
    prisma.bankStatementImportJob.count.mockResolvedValue(1);
    const service = makeService(prisma, ['fees']);

    const summary = await service.getFeesSummary(principal);

    expect(summary.readOnly).toBe(true);
    expect(summary.authorization.allowedActions).toEqual([]);
    expect(Object.values(summary.authorization.capabilities)).not.toContain(
      true,
    );
    expect(summary.authorization.authorizedSections).toEqual(['summary']);
    expect(summary.metrics.reconciliation.failedStatementImports).toBe(1);
    expect(summary.metrics.aging.overdue90PlusCount).toBe(2);
    expect(summary.metrics.cashBankPosition).toEqual(
      expect.objectContaining({ available: false }),
    );
    // Student identity never leaves the Finance workspace.
    const approvalInclude = prisma.financeApprovalRequest.findMany.mock
      .calls[0][0].include as { payment: { select: object } };
    expect(approvalInclude.payment.select).not.toHaveProperty('student');
    expect(JSON.stringify(summary.watchlist)).not.toMatch(/firstName|lastName/);
  });

  it('zero is reported as a known zero, distinct from unavailable', async () => {
    const service = makeService(makePrisma(), ['fees']);
    const card = await feesCard(service, principal);
    expect(card).toMatchObject({ available: true, value: 'NPR 0' });
  });

  it('no permission: the fees card is withheld, never zero, and nothing is queried', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, ['fees']);
    const card = await feesCard(service, {
      ...principal,
      permissions: principal.permissions.filter(
        (p) => p !== 'finance:principal:read',
      ),
    });
    expect(card).toMatchObject({
      value: null,
      available: false,
      unavailableReason: 'NOT_PERMITTED',
    });
    expect(prisma.cashierClose.findMany).not.toHaveBeenCalled();
  });

  it('module disabled: the fees card is locked and withheld', async () => {
    const prisma = makePrisma();
    const card = await feesCard(makeService(prisma, []), principal);
    expect(card).toMatchObject({ value: null, available: false, locked: true });
    expect(prisma.cashierClose.findMany).not.toHaveBeenCalled();
  });

  it('partial backend failure: the fees card is unavailable, never zero', async () => {
    const prisma = makePrisma();
    prisma.bankReconciliationSession.count.mockRejectedValue(
      new Error('timeout'),
    );
    const card = await feesCard(makeService(prisma, ['fees']), principal);
    expect(card).toMatchObject({
      value: null,
      available: false,
      unavailableReason: 'UNAVAILABLE',
    });
  });

  describe('negative authorization: no operational finance authority', () => {
    const OPERATIONAL = [
      'fees:manage',
      'payments:collect',
      'payments:close',
      'payments:reverse',
      'accounting:journals:create',
      'accounting:journals:post',
      'accounting:journals:reverse',
      'accounting:bank-reconciliation:manage',
      'accounting:fiscal-years:manage',
      'ledger:read',
    ];

    it('the Principal preset holds none of the operational finance keys', () => {
      const principalKeys = new Set(systemRolePermissions.principal);
      expect(OPERATIONAL.filter((key) => principalKeys.has(key))).toEqual([]);
    });

    it('no route anywhere accepts finance:principal:read except the snapshot', () => {
      const SRC = join(__dirname, '..');
      const files = (function walk(dir: string): string[] {
        return readdirSync(dir).flatMap((entry) => {
          const path = join(dir, entry);
          return statSync(path).isDirectory() ? walk(path) : [path];
        });
      })(SRC).filter((file) => file.endsWith('.controller.ts'));
      const users = files.filter((file) =>
        readFileSync(file, 'utf8').includes("'finance:principal:read'"),
      );
      expect(users.map((file) => file.slice(SRC.length + 1))).toEqual([
        'mobile/mobile-principal.controller.ts',
      ]);
      const source = readFileSync(
        join(SRC, 'mobile/mobile-principal.controller.ts'),
        'utf8',
      );
      expect(source.match(/'finance:principal:read'/g)).toHaveLength(1);
      expect(source).toMatch(
        /@Get\('fees-summary'\)\s*@Permissions\('finance:principal:read'\)/,
      );
    });
  });
});
