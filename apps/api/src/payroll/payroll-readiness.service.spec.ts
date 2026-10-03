import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import type { PayrollExceptionQueryDto } from './dto/payroll-exception-query.dto';
import { PayrollReadinessService } from './payroll-readiness.service';
import { calculatePeriodPayroll } from './payroll-period-calculation';

jest.mock('./payroll-period-calculation', () => ({
  calculatePeriodPayroll: jest.fn(),
}));
const mockedCalculation = calculatePeriodPayroll as unknown as jest.Mock;

function emptyCalculation(overrides: Record<string, unknown> = {}) {
  return {
    lines: [],
    prorationErrors: [],
    unresolvedCorrections: [],
    configurationErrors: [],
    ...overrides,
  };
}

// Phase 7.9: payroll periods are Bikram Sambat months. Ashwin 2083 runs from
// 2026-09-17 to 2026-10-17.
const period: PayrollExceptionQueryDto = {
  year: 2083,
  month: 6,
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

beforeEach(() => {
  mockedCalculation.mockReset();
  mockedCalculation.mockResolvedValue(emptyCalculation());
});

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
          identityKey: '2083-6:run-1:staff-1:ZERO_GROSS_PAY',
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
              '2083-6:run-1:staff-1:ZERO_GROSS_PAY',
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

describe('PayrollReadinessService period, proration, adjustments and holds (Phase 7.9)', () => {
  const find = (prisma: ReturnType<typeof buildPrismaMock>, code: string) =>
    persistedCandidates(prisma).filter((item) => item.code === code);

  it('blocks creation and approval when proration inputs are unresolved', async () => {
    mockedCalculation.mockResolvedValue(
      emptyCalculation({
        prorationErrors: [
          {
            staffId: 'staff-1',
            code: 'PRORATION_EMPLOYED_DAYS_WITHOUT_COMPENSATION',
            message: 'Employed days are not covered by a salary structure',
          },
        ],
      }),
    );
    const { service, prisma } = buildService();
    await service.getReadiness(period, actor);
    expect(find(prisma, 'PRORATION_INPUT_UNRESOLVED')).toEqual([
      expect.objectContaining({
        severity: 'BLOCKING',
        staffId: 'staff-1',
        blockedActions: ['CREATE_DRAFT', 'SUBMIT_REVIEW', 'APPROVE', 'POST'],
      }),
    ]);
  });

  it('warns, without blocking approval, about a correction that cannot be priced', async () => {
    mockedCalculation.mockResolvedValue(
      emptyCalculation({
        unresolvedCorrections: [
          {
            correctionId: 'correction-1',
            staffId: 'staff-1',
            attendanceDate: '2026-09-20',
            code: 'SOURCE_LINE_MISSING',
            message: 'No source line',
          },
        ],
      }),
    );
    const { service, prisma } = buildService();
    await service.getReadiness(period, actor);
    expect(find(prisma, 'PAYROLL_ADJUSTMENT_UNRESOLVED')).toEqual([
      expect.objectContaining({
        severity: 'WARNING',
        blockedActions: ['SUBMIT_REVIEW'],
      }),
    ]);
  });

  it('does not re-evaluate proration for a run that is already approved', async () => {
    const { service } = buildService({ runOverrides: { status: 'APPROVED' } });
    await service.getReadiness(period, actor);
    expect(mockedCalculation).not.toHaveBeenCalled();
  });

  it('uses the stored divisor of the run and its own id when evaluating', async () => {
    const { service } = buildService();
    await service.getReadiness(period, actor);
    expect(mockedCalculation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        divisorDays: 31,
        divisorBasis: 'CALENDAR_DAYS_OF_PERIOD',
        ownRunId: 'run-1',
        tenantId: 'tenant-1',
      }),
    );
  });

  it('blocks a BS-labelled run whose stored bounds are not its Nepali month', async () => {
    const { service, prisma } = buildService({
      runOverrides: {
        periodStart: new Date('2026-09-01T00:00:00.000Z'),
        periodEnd: new Date('2026-09-30T23:59:59.999Z'),
      },
    });
    await service.getReadiness(period, actor);
    expect(find(prisma, 'INVALID_PAYROLL_PERIOD')).toEqual([
      expect.objectContaining({ severity: 'BLOCKING', staffId: null }),
    ]);
  });

  it('does not question a legacy Gregorian-labelled run', async () => {
    const { service, prisma } = buildService({
      runOverrides: {
        periodYear: 2026,
        periodMonth: 5,
        periodStart: new Date('2026-05-01T00:00:00.000Z'),
        periodEnd: new Date('2026-05-31T23:59:59.999Z'),
        divisorDays: null,
        divisorBasis: null,
      },
    });
    await service.getReadiness(
      { year: 2026, month: 5, page: 1, limit: 25 },
      actor,
    );
    expect(find(prisma, 'INVALID_PAYROLL_PERIOD')).toEqual([]);
  });

  it('blocks a line whose adjustments differ from the applied adjustment rows', async () => {
    const { service, prisma } = buildService({
      lines: [buildLine({ grossSalary: 45000 })],
      appliedAdjustments: [
        {
          staffId: 'staff-1',
          kind: 'ARREARS',
          amount: new Prisma.Decimal('1000.00'),
        },
      ],
    });
    await service.getReadiness(period, actor);
    expect(find(prisma, 'PAYROLL_ADJUSTMENT_UNRESOLVED')).toEqual([
      expect.objectContaining({
        severity: 'BLOCKING',
        blockedActions: ['SUBMIT_REVIEW', 'APPROVE', 'POST', 'MARK_PAID'],
      }),
    ]);
  });

  it('accepts a line whose adjustments equal the applied adjustment rows', async () => {
    const { service, prisma } = buildService({
      lines: [
        buildLine({
          grossSalary: 45000,
          adjustmentEarnings: new Prisma.Decimal('1000.00'),
          adjustmentDeductions: new Prisma.Decimal('250.50'),
        }),
      ],
      appliedAdjustments: [
        {
          staffId: 'staff-1',
          kind: 'ARREARS',
          amount: new Prisma.Decimal('400.00'),
        },
        {
          staffId: 'staff-1',
          kind: 'ARREARS',
          amount: new Prisma.Decimal('600.00'),
        },
        {
          staffId: 'staff-1',
          kind: 'RECOVERY',
          amount: new Prisma.Decimal('250.50'),
        },
      ],
    });
    await service.getReadiness(period, actor);
    expect(find(prisma, 'PAYROLL_ADJUSTMENT_UNRESOLVED')).toEqual([]);
  });

  it('blocks only mark-paid for an active hold and never exposes its reason', async () => {
    const { service, prisma } = buildService({
      lines: [buildLine({ grossSalary: 45000 })],
      activeHolds: [{ staffId: 'staff-1' }],
    });
    await service.getReadiness(period, actor);
    const [hold] = find(prisma, 'PAYROLL_HOLD_ACTIVE');
    expect(hold).toMatchObject({
      severity: 'BLOCKING',
      staffId: 'staff-1',
      blockedActions: ['MARK_PAID'],
    });
    expect(prisma.payrollHold.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          status: 'ACTIVE',
        }),
        select: { staffId: true },
      }),
    );
  });

  it('blocks every advancing action for a negative net, including validation', async () => {
    const { service, prisma } = buildService({
      lines: [
        buildLine({ grossSalary: 45000, netSalary: new Prisma.Decimal(-10) }),
      ],
    });
    await service.getReadiness(period, actor);
    expect(find(prisma, 'NEGATIVE_NET_PAY')).toEqual([
      expect.objectContaining({
        severity: 'BLOCKING',
        blockedActions: [
          'CREATE_DRAFT',
          'SUBMIT_REVIEW',
          'APPROVE',
          'POST',
          'MARK_PAID',
        ],
      }),
    ]);
  });

  it('blocks payment when a bank-paid line has invalid bank details', async () => {
    const { service, prisma } = buildService({
      lines: [
        buildLine({
          grossSalary: 45000,
          salaryStructure: { paymentMethod: 'BANK' },
          staff: {
            status: 'ACTIVE',
            panNumber: null,
            bankAccount: '12 ; DROP',
            bankName: 'Fixture Bank',
          },
        }),
      ],
    });
    await service.getReadiness(period, actor);
    expect(find(prisma, 'INVALID_BANK_DETAILS')).toEqual([
      expect.objectContaining({
        severity: 'BLOCKING',
        blockedActions: ['MARK_PAID'],
      }),
    ]);
  });

  it('reads a named period that has no run as a BS month and rejects a non-BS one', async () => {
    const { service } = buildService();
    (
      service as unknown as { prisma: ReturnType<typeof buildPrismaMock> }
    ).prisma.payrollRun.findFirst.mockResolvedValue(null);
    await expect(
      service.getReadiness({ year: 2026, month: 5, page: 1, limit: 25 }, actor),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'PAYROLL_PERIOD_YEAR_OUT_OF_RANGE',
      }),
    });
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
    adjustmentEarnings: new Prisma.Decimal(0),
    adjustmentDeductions: new Prisma.Decimal(0),
    staff: {
      status: 'ACTIVE',
      panNumber: null,
      bankAccount: null,
      bankName: null,
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
    appliedAdjustments?: Record<string, unknown>[];
    activeHolds?: Record<string, unknown>[];
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
        periodYear: 2083,
        periodMonth: 6,
        periodStart: new Date('2026-09-17T00:00:00.000Z'),
        periodEnd: new Date('2026-10-17T23:59:59.999Z'),
        status: 'GENERATED',
        statutoryPolicyVersionId: null,
        divisorDays: 31,
        divisorBasis: 'CALENDAR_DAYS_OF_PERIOD',
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
    payrollAdjustment: {
      findMany: jest.fn().mockResolvedValue(options.appliedAdjustments ?? []),
    },
    payrollHold: {
      findMany: jest.fn().mockResolvedValue(options.activeHolds ?? []),
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
