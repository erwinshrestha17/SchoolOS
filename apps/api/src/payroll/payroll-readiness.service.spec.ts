import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import type { PayrollExceptionQueryDto } from './dto/payroll-exception-query.dto';
import { PayrollReadinessService } from './payroll-readiness.service';

const period: PayrollExceptionQueryDto = {
  year: 2026,
  month: 5,
  page: 1,
  limit: 25,
};

const actor: AuthContext = {
  userId: 'hr-user-1',
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  email: 'hr@school.test',
  roles: ['hr_manager'],
  permissions: ['payroll:read', 'payroll:manage'],
  authMethod: 'PASSWORD',
};

describe('PayrollReadinessService', () => {
  it('blocks a payroll line with zero gross pay and reports the tenant as BLOCKED', async () => {
    const { service, prisma } = buildService({
      lines: [buildLine({ grossSalary: 0 })],
    });

    const readiness = await service.getReadiness(period, actor);

    expect(readiness.readinessStatus).toBe('BLOCKED');
    expect(readiness.blockingExceptionCount).toBeGreaterThan(0);
    expect(readiness.exceptionsByCategory.ZERO_GROSS_PAY).toBe(1);

    const persisted = persistedCandidates(prisma);
    const zeroGrossPay = persisted.find(
      (item) => item.code === 'ZERO_GROSS_PAY',
    );
    expect(zeroGrossPay).toMatchObject({
      severity: 'BLOCKING',
      staffId: 'staff-1',
      blockedActions: ['SUBMIT_REVIEW', 'APPROVE', 'POST'],
    });
  });

  it('does not flag a payroll line with non-zero gross pay', async () => {
    const { service, prisma } = buildService({
      lines: [buildLine({ grossSalary: 45000 })],
    });

    const readiness = await service.getReadiness(period, actor);

    expect(readiness.exceptionsByCategory.ZERO_GROSS_PAY).toBeUndefined();
    const persisted = persistedCandidates(prisma);
    expect(persisted.some((item) => item.code === 'ZERO_GROSS_PAY')).toBe(
      false,
    );
  });

  it('resolves a previously-flagged zero-gross-pay exception once the line is corrected', async () => {
    const { service, prisma } = buildService({
      lines: [buildLine({ grossSalary: 45000 })],
      existingExceptions: [
        {
          id: 'exception-1',
          identityKey: '2026-5:run-1:staff-1:ZERO_GROSS_PAY',
          status: 'OPEN',
        },
      ],
    });

    await service.getReadiness(period, actor);

    // The line no longer has zero gross pay, so its ZERO_GROSS_PAY
    // identityKey is absent from the freshly-detected candidates and falls
    // into the "no longer detected" resolution sweep.
    expect(prisma.__tx.payrollException.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          identityKey: {
            notIn: expect.not.arrayContaining([
              '2026-5:run-1:staff-1:ZERO_GROSS_PAY',
            ]),
          },
        }),
        data: expect.objectContaining({ status: 'RESOLVED' }),
      }),
    );
  });
});

function persistedCandidates(prisma: ReturnType<typeof buildPrismaMock>) {
  const creates = (prisma.__tx.payrollException.create as jest.Mock).mock.calls;
  return creates.map((call) => call[0].data);
}

function buildLine(overrides: Record<string, unknown> = {}) {
  return {
    staffId: 'staff-1',
    contractId: 'contract-1',
    workingDays: 30,
    attendanceDays: 30,
    grossSalary: new Prisma.Decimal(45000),
    netSalary: new Prisma.Decimal(40000),
    tds: new Prisma.Decimal(0),
    staff: {
      status: 'ACTIVE',
      panNumber: null,
      bankAccount: null,
    },
    salaryStructure: null,
    ...overrides,
    ...(overrides.grossSalary !== undefined
      ? { grossSalary: new Prisma.Decimal(overrides.grossSalary as number) }
      : {}),
  };
}

function buildPrismaMock(
  options: {
    lines?: Array<Record<string, unknown>>;
    existingExceptions?: Array<Record<string, unknown>>;
  } = {},
) {
  const tx = {
    payrollException: {
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };

  const prisma = {
    __tx: tx,
    payrollRun: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'run-1',
        periodStart: new Date('2026-05-01T00:00:00.000Z'),
        periodEnd: new Date('2026-05-31T00:00:00.000Z'),
        status: 'GENERATED',
      }),
    },
    staff: {
      findMany: jest.fn().mockResolvedValue([{ id: 'staff-1' }]),
    },
    staffContract: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'contract-1', staffId: 'staff-1' }]),
    },
    salaryStructure: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    payrollLine: {
      findMany: jest.fn().mockResolvedValue(options.lines ?? []),
    },
    staffAttendance: {
      groupBy: jest.fn().mockResolvedValue([]),
    },
    accountingSourceMapping: {
      findFirst: jest.fn().mockResolvedValue({ id: 'mapping-1' }),
    },
    fiscalPeriod: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    payrollException: {
      findMany: jest.fn().mockResolvedValue(options.existingExceptions ?? []),
      groupBy: jest.fn().mockImplementation(async () => {
        const creates = (tx.payrollException.create as jest.Mock).mock.calls;
        const counts = new Map<string, number>();
        for (const [{ data }] of creates) {
          const key = `${data.severity}:${data.status ?? 'OPEN'}:${data.code}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return Array.from(counts.entries()).map(([key, count]) => {
          const [severity, status, code] = key.split(':');
          return { severity, status, code, _count: { _all: count } };
        });
      }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
      callback(tx),
    ),
  };

  return prisma;
}

function buildService(options: Parameters<typeof buildPrismaMock>[0] = {}) {
  const prisma = buildPrismaMock(options);
  const auditService = { record: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new PayrollReadinessService(
      prisma as never,
      auditService as never,
    ),
    prisma,
    auditService,
  };
}
