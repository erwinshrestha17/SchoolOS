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
  it('blocks a legacy contract with no verified employment (Phase 7.1)', async () => {
    const { service, prisma } = buildService({
      lines: [],
      employments: [],
    });

    const readiness = await service.getReadiness(period, actor);

    expect(readiness.readinessStatus).toBe('BLOCKED');
    expect(readiness.exceptionsByCategory.MISSING_VERIFIED_EMPLOYMENT).toBe(1);
    expect(
      persistedCandidates(prisma).find(
        (item) => item.code === 'MISSING_VERIFIED_EMPLOYMENT',
      ),
    ).toMatchObject({
      severity: 'BLOCKING',
      staffId: 'staff-1',
      blockedActions: ['CREATE_DRAFT', 'SUBMIT_REVIEW', 'APPROVE', 'POST'],
    });
    // Only authoritative (verified or ended) employment may count.
    expect(prisma.staffEmployment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          verifiedAt: { not: null },
          status: { in: ['VERIFIED', 'ENDED'] },
        }),
      }),
    );
  });

  it('does not raise the employment exception when a verified employment covers the period', async () => {
    const { service, prisma } = buildService();

    const readiness = await service.getReadiness(period, actor);

    expect(
      readiness.exceptionsByCategory.MISSING_VERIFIED_EMPLOYMENT,
    ).toBeUndefined();
    expect(
      persistedCandidates(prisma).some(
        (item) => item.code === 'MISSING_VERIFIED_EMPLOYMENT',
      ),
    ).toBe(false);
  });

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

// FIXTURE numbers only: these are not Nepal statutory rates.
const taxOnlyPolicy = {
  schemes: [{ code: 'REMUNERATION_TAX', base: 'GROSS', employeeRate: '0.02' }],
};
const pfPolicy = {
  schemes: [
    { code: 'REMUNERATION_TAX', base: 'GROSS', employeeRate: '0.02' },
    {
      code: 'PF',
      base: 'BASIC',
      employeeRate: '0.07',
      employerRate: '0.13',
      requiresIdentifier: true,
    },
  ],
};

function policyVersion(payload: unknown, policyKey = 'fixture-policy') {
  return {
    id: `version-${policyKey}`,
    policyKey,
    version: 1,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    sourceTitle: 'Fixture',
    sourceChecksumSha256: 'a'.repeat(64),
    payload,
  };
}

function structure(overrides: Record<string, unknown> = {}) {
  return {
    id: 'structure-1',
    staffId: 'staff-1',
    paymentMethod: 'BANK',
    pfEnabled: false,
    tdsEnabled: true,
    ...overrides,
  };
}

function statutoryIssues(prisma: ReturnType<typeof buildPrismaMock>) {
  return persistedCandidates(prisma).filter(
    (item) => item.code === 'MISSING_STATUTORY_CONFIGURATION',
  );
}

describe('PayrollReadinessService statutory configuration (Phase 7.8)', () => {
  const blockedActions = ['CREATE_DRAFT', 'SUBMIT_REVIEW', 'APPROVE', 'POST'];

  it('is satisfied when the approved policy covers what the staff owe', async () => {
    const { service, prisma } = buildService();
    await service.getReadiness(period, actor);
    expect(statutoryIssues(prisma)).toEqual([]);
  });

  it('blocks the period when no approved policy covers it', async () => {
    const { service, prisma } = buildService({ policies: [] });
    await service.getReadiness(period, actor);
    expect(statutoryIssues(prisma)).toEqual([
      expect.objectContaining({
        severity: 'BLOCKING',
        staffId: null,
        title: 'No approved statutory policy',
        blockedActions,
      }),
    ]);
  });

  it('needs no policy when nobody owes a statutory amount', async () => {
    const { service, prisma } = buildService({
      policies: [],
      structures: [structure({ tdsEnabled: false, pfEnabled: false })],
    });
    await service.getReadiness(period, actor);
    expect(statutoryIssues(prisma)).toEqual([]);
    expect(prisma.nepalHrPolicyVersion.findMany).not.toHaveBeenCalled();
  });

  it('blocks when the policy does not define a scheme that is owed', async () => {
    const { service, prisma } = buildService({
      policies: [
        policyVersion({
          schemes: [{ code: 'PF', base: 'BASIC', employeeRate: '0.1' }],
        }),
      ],
    });
    await service.getReadiness(period, actor);
    expect(statutoryIssues(prisma)).toEqual([
      expect.objectContaining({
        title: 'Scheme not defined by the approved policy',
        safeMessage: expect.stringContaining('REMUNERATION_TAX'),
      }),
    ]);
  });

  it('blocks a member whose provident contribution has no scheme membership', async () => {
    const { service, prisma } = buildService({
      policies: [policyVersion(pfPolicy)],
      structures: [structure({ pfEnabled: true })],
    });
    await service.getReadiness(period, actor);
    expect(statutoryIssues(prisma)).toEqual([
      expect.objectContaining({
        staffId: 'staff-1',
        title: 'Statutory scheme membership missing',
        blockedActions,
      }),
    ]);
  });

  it('blocks a required identifier that is missing and accepts one that is present', async () => {
    const missing = buildService({
      policies: [policyVersion(pfPolicy)],
      structures: [structure({ pfEnabled: true })],
      memberships: [
        { staffId: 'staff-1', scheme: 'PF', memberIdentifier: null },
      ],
    });
    await missing.service.getReadiness(period, actor);
    expect(statutoryIssues(missing.prisma)).toEqual([
      expect.objectContaining({
        staffId: 'staff-1',
        title: 'PF member identifier missing',
      }),
    ]);

    const present = buildService({
      policies: [policyVersion(pfPolicy)],
      structures: [structure({ pfEnabled: true })],
      memberships: [
        { staffId: 'staff-1', scheme: 'PF', memberIdentifier: 'PF-1001' },
      ],
    });
    await present.service.getReadiness(period, actor);
    expect(statutoryIssues(present.prisma)).toEqual([]);
  });

  it('refuses an unusable or ambiguous policy instead of guessing', async () => {
    const unusable = buildService({
      policies: [policyVersion({ schemes: [{ code: 'CIT' }] })],
    });
    await unusable.service.getReadiness(period, actor);
    expect(statutoryIssues(unusable.prisma)).toEqual([
      expect.objectContaining({ title: 'Statutory policy unusable' }),
    ]);

    const ambiguous = buildService({
      policies: [
        policyVersion(taxOnlyPolicy, 'policy-a'),
        policyVersion(taxOnlyPolicy, 'policy-b'),
      ],
    });
    await ambiguous.service.getReadiness(period, actor);
    expect(statutoryIssues(ambiguous.prisma)).toEqual([
      expect.objectContaining({ title: 'Statutory policy unusable' }),
    ]);
  });

  it('evaluates a run against the policy version it was calculated with', async () => {
    const { service, prisma } = buildService({
      policies: [],
      runOverrides: { statutoryPolicyVersionId: 'version-pinned' },
      pinnedPolicy: { payload: taxOnlyPolicy },
    });
    await service.getReadiness(period, actor);
    expect(prisma.nepalHrPolicyVersion.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'version-pinned' } }),
    );
    expect(prisma.nepalHrPolicyVersion.findMany).not.toHaveBeenCalled();
    expect(statutoryIssues(prisma)).toEqual([]);
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
    lines?: Record<string, unknown>[];
    existingExceptions?: Record<string, unknown>[];
    employments?: Record<string, unknown>[];
    structures?: Record<string, unknown>[];
    policies?: Record<string, unknown>[];
    pinnedPolicy?: Record<string, unknown> | null;
    memberships?: Record<string, unknown>[];
    runOverrides?: Record<string, unknown>;
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
        statutoryPolicyVersionId: null,
        ...options.runOverrides,
      }),
    },
    runWithoutTenantScope: jest.fn(
      async (_reason: string, fn: () => Promise<unknown>) => fn(),
    ),
    nepalHrPolicyVersion: {
      findMany: jest
        .fn()
        .mockResolvedValue(options.policies ?? [policyVersion(taxOnlyPolicy)]),
      findUnique: jest.fn().mockResolvedValue(options.pinnedPolicy ?? null),
    },
    staffStatutoryMembership: {
      findMany: jest.fn().mockResolvedValue(options.memberships ?? []),
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
      findMany: jest.fn().mockResolvedValue(options.structures ?? []),
    },
    staffEmployment: {
      findMany: jest.fn().mockResolvedValue(
        options.employments ?? [
          {
            id: 'employment-1',
            staffId: 'staff-1',
            effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
            effectiveTo: null,
          },
        ],
      ),
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
        const creates = (tx.payrollException.create as jest.Mock).mock
          .calls as [
          { data: { severity: string; status?: string; code: string } },
        ][];
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
