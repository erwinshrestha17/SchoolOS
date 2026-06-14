import { ConflictException } from '@nestjs/common';
import {
  PayrollLineStatus,
  PayrollRunStatus,
  Prisma,
  SalaryComponentType,
  SalaryStructureStatus,
} from '@prisma/client';
import { PayrollService } from './payroll.service';

const actor = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
  email: 'admin@schoolos.test',
  roles: ['admin'],
  permissions: ['payroll:run:read', 'payroll:run:approve', 'payroll:run:post'],
};

describe('PayrollService hardening boundaries', () => {
  it('rejects cross-tenant staff contract creation before writing a contract', async () => {
    const { service, prisma } = buildService({ staff: null });

    await expect(
      service.createContract(
        {
          staffId: 'staff-other-tenant',
          contractNumber: 'CNT-001',
          position: 'Teacher',
          startDate: '2026-05-01',
          baseSalary: 45000,
        },
        actor as never,
      ),
    ).rejects.toThrow('Staff member not found in this tenant');

    expect(prisma.staff.findFirst).toHaveBeenCalledWith({
      where: { id: 'staff-other-tenant', tenantId: actor.tenantId },
    });
    expect(prisma.staffContract.create).not.toHaveBeenCalled();
  });

  it('rejects overlapping ACTIVE salary structures for the same staff period', async () => {
    const structure = buildSalaryStructure({
      id: 'salary-1',
      staffId: 'staff-1',
      effectiveFrom: new Date('2026-05-01T00:00:00.000Z'),
      effectiveTo: new Date('2026-12-31T00:00:00.000Z'),
      status: SalaryStructureStatus.DRAFT,
    });
    const overlapping = buildSalaryStructure({
      id: 'salary-2',
      staffId: 'staff-1',
      effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
      effectiveTo: null,
      status: SalaryStructureStatus.ACTIVE,
    });
    const { service, prisma } = buildService({
      salaryStructureFindFirstQueue: [structure, overlapping],
      salaryStructures: [overlapping],
    });

    await expect(
      service.activateSalaryStructure('salary-1', actor as never),
    ).rejects.toThrow(ConflictException);

    expect(prisma.salaryStructure.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: 'salary-1', tenantId: actor.tenantId },
    });
    expect(prisma.salaryStructure.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: actor.tenantId,
          staffId: 'staff-1',
          status: SalaryStructureStatus.ACTIVE,
          id: { not: 'salary-1' },
        }),
      }),
    );
    expect(prisma.salaryStructure.update).not.toHaveBeenCalled();
  });

  it('closes the previous open-ended salary version when activating a later version', async () => {
    const structure = buildSalaryStructure({
      id: 'salary-new',
      staffId: 'staff-1',
      effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
      effectiveTo: null,
      status: SalaryStructureStatus.DRAFT,
    });
    const previous = buildSalaryStructure({
      id: 'salary-old',
      staffId: 'staff-1',
      effectiveFrom: new Date('2026-05-01T00:00:00.000Z'),
      effectiveTo: null,
      status: SalaryStructureStatus.ACTIVE,
    });
    const { service, tx } = buildService({
      salaryStructureFindFirstQueue: [structure],
      salaryStructures: [previous],
    });

    await service.activateSalaryStructure('salary-new', actor as never);

    expect(tx.salaryStructure.update).toHaveBeenCalledWith({
      where: { id: 'salary-old' },
      data: { effectiveTo: new Date('2026-05-31T00:00:00.000Z') },
    });
    expect(tx.salaryStructure.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'salary-new' },
        data: expect.objectContaining({
          status: SalaryStructureStatus.ACTIVE,
          activatedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('prevents mutating salary structures already used by payroll', async () => {
    const existing = buildSalaryStructure({
      id: 'salary-used',
      status: SalaryStructureStatus.ACTIVE,
    });
    const { service, prisma } = buildService({
      salaryStructureFindFirstQueue: [existing],
      payrollLineCount: 1,
    });

    await expect(
      service.updateSalaryStructure(
        'salary-used',
        { basicSalary: 50000 },
        actor as never,
      ),
    ).rejects.toThrow(
      'Salary structure used by payroll cannot be mutated retroactively',
    );

    expect(prisma.payrollLine.count).toHaveBeenCalledWith({
      where: { tenantId: actor.tenantId, salaryStructureId: 'salary-used' },
    });
    expect(prisma.salaryStructure.update).not.toHaveBeenCalled();
  });

  it('rejects re-approval of a posted payroll run', async () => {
    const run = buildPayrollRun({ status: PayrollRunStatus.POSTED });
    const { service, prisma } = buildService({ payrollRun: run });

    await expect(
      service.approvePayrollRun('run-1', actor as never),
    ).rejects.toThrow('Posted payroll cannot be re-approved');

    expect(prisma.payrollRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1', tenantId: actor.tenantId },
      }),
    );
    expect(prisma.payrollLine.updateMany).not.toHaveBeenCalled();
    expect(prisma.payslip.createMany).not.toHaveBeenCalled();
  });

  it('rejects paid payroll runs instead of mutating them through rejection', async () => {
    const run = buildPayrollRun({ status: PayrollRunStatus.PAID });
    const { service, prisma } = buildService({ payrollRun: run });

    await expect(
      service.rejectPayrollRun(
        'run-1',
        { reason: 'Should not mutate paid payroll' },
        actor as never,
      ),
    ).rejects.toThrow('Approved, posted, or paid payroll cannot be rejected');

    expect(prisma.payrollRun.update).not.toHaveBeenCalled();
  });

  it('posts payroll through AccountingPostingService and stores journalEntryId', async () => {
    const run = buildPayrollRun({ status: PayrollRunStatus.APPROVED });
    const { service, prisma, tx, accountingPostingService } = buildService({
      payrollRun: run,
      postedPayrollRun: buildPayrollRun({
        status: PayrollRunStatus.POSTED,
        journalEntryId: 'journal-1',
      }),
    });

    const result = await service.postPayrollRun('run-1', actor as never);

    expect(accountingPostingService.postPayrollAccrual).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: actor.tenantId,
        payrollRunId: 'run-1',
        periodMonth: run.periodMonth,
        periodYear: run.periodYear,
        grossAmount: run.grossAmount,
        deductionAmount: run.deductionAmount,
        netAmount: run.netAmount,
      }),
      actor,
      tx,
    );
    expect(tx.payrollLine.updateMany).toHaveBeenCalledWith({
      where: { tenantId: actor.tenantId, payrollRunId: 'run-1' },
      data: { status: PayrollLineStatus.POSTED },
    });
    expect(tx.payrollRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: expect.objectContaining({
          status: PayrollRunStatus.POSTED,
          postedById: actor.userId,
          journalEntryId: 'journal-1',
        }),
      }),
    );
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ journalEntryId: 'journal-1' }),
    );
  });

  it('rejects double posting instead of returning a silently posted run', async () => {
    const run = buildPayrollRun({
      status: PayrollRunStatus.POSTED,
      journalEntryId: 'journal-1',
    });
    const { service, accountingPostingService } = buildService({
      payrollRun: run,
    });

    await expect(
      service.postPayrollRun('run-1', actor as never),
    ).rejects.toThrow('Payroll run is already posted');

    expect(accountingPostingService.postPayrollAccrual).not.toHaveBeenCalled();
  });

  it('scopes payroll run register reports by tenant and selected payroll run', async () => {
    const { service, prisma } = buildService({
      payrollRuns: [
        buildPayrollRun({
          lines: [
            buildPayrollLine({
              id: 'line-1',
              pfEmployee: new Prisma.Decimal(1000),
              pfEmployer: new Prisma.Decimal(1000),
              tds: new Prisma.Decimal(500),
            }),
          ],
        }),
      ],
    });

    const register = await service.getPayrollRegister(actor as never, {
      payrollRunId: 'run-1',
      department: 'Academics',
      status: PayrollRunStatus.GENERATED,
    });
    const pf = await service.getPayrollPfSummary(actor as never, 'run-1');
    const tds = await service.getPayrollTdsSummary(actor as never, 'run-1');
    const components = await service.getSalaryComponentSummary(
      actor as never,
      'run-1',
    );

    expect(prisma.payrollRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: actor.tenantId,
          id: 'run-1',
          status: PayrollRunStatus.GENERATED,
        },
        take: 100,
      }),
    );
    expect(prisma.payrollRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          lines: expect.objectContaining({
            where: expect.objectContaining({
              staff: { department: 'Academics' },
            }),
          }),
        }),
      }),
    );
    expect(register).toHaveLength(1);
    expect(pf).toMatchObject({
      payrollRunId: 'run-1',
      staffCount: 1,
      employeeContribution: 1000,
      employerContribution: 1000,
      totalContribution: 2000,
    });
    expect(tds).toMatchObject({ payrollRunId: 'run-1', totalTds: 500 });
    expect(components).toMatchObject({
      payrollRunId: 'run-1',
      staffCount: 1,
      grossSalary: 50000,
      netPayable: 49000,
    });
  });

  it('lists statutory deductions from tenant-scoped active salary structures only', async () => {
    const { service, prisma } = buildService({
      salaryStructures: [
        buildSalaryStructure({
          pfEnabled: true,
          tdsEnabled: true,
          components: [
            {
              name: 'CIT contribution',
              amount: new Prisma.Decimal(1500),
              taxable: false,
            },
          ],
        }),
        buildSalaryStructure({
          id: 'salary-2',
          pfEnabled: false,
          tdsEnabled: true,
          components: [
            {
              name: 'CIT contribution',
              amount: new Prisma.Decimal(1000),
              taxable: false,
            },
          ],
        }),
      ],
    });

    await expect(
      service.listStatutoryDeductions(actor as never),
    ).resolves.toEqual([
      expect.objectContaining({
        code: 'PF',
        configuredStructureCount: 1,
        source: 'salary_structure_pf_enabled',
      }),
      expect.objectContaining({
        code: 'TDS',
        configuredStructureCount: 2,
        source: 'salary_structure_tds_enabled',
      }),
      expect.objectContaining({
        code: 'DEDUCTION_CIT_CONTRIBUTION',
        name: 'CIT contribution',
        amount: 2500,
        configuredStructureCount: 2,
        source: 'salary_structure_component',
      }),
    ]);

    expect(prisma.salaryStructure.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        status: SalaryStructureStatus.ACTIVE,
      },
      select: {
        pfEnabled: true,
        tdsEnabled: true,
        components: {
          where: { componentType: SalaryComponentType.DEDUCTION },
          select: { name: true, amount: true, taxable: true },
        },
      },
      orderBy: [{ effectiveFrom: 'desc' }],
      take: 100,
    });
  });

  it('does not return fake statutory deductions when no tenant payroll policy is configured', async () => {
    const { service } = buildService({ salaryStructures: [] });

    await expect(
      service.listStatutoryDeductions(actor as never),
    ).resolves.toEqual([]);
  });
});

function buildService(options: {
  staff?: unknown;
  salaryStructureFindFirstQueue?: unknown[];
  salaryStructures?: unknown[];
  payrollLineCount?: number;
  payrollRun?: unknown;
  payrollRuns?: unknown[];
  postedPayrollRun?: unknown;
}) {
  const salaryStructureFindFirstQueue = [
    ...(options.salaryStructureFindFirstQueue ?? []),
  ];

  const tx = {
    payrollLine: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    salaryStructure: {
      update: jest.fn().mockResolvedValue(buildSalaryStructure()),
    },
    payrollRun: {
      update: jest
        .fn()
        .mockResolvedValue(options.postedPayrollRun ?? buildPayrollRun()),
    },
    payslip: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const prisma = {
    staff: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          options.staff === null ? null : (options.staff ?? buildStaff()),
        ),
      findMany: jest.fn().mockResolvedValue([buildStaff()]),
    },
    staffContract: {
      create: jest.fn().mockResolvedValue(buildStaffContract()),
      findFirst: jest.fn().mockResolvedValue(buildStaffContract()),
      findMany: jest.fn().mockResolvedValue([buildStaffContract()]),
    },
    salaryStructure: {
      findFirst: jest.fn().mockImplementation(async () => {
        if (salaryStructureFindFirstQueue.length === 0) {
          return null;
        }

        return salaryStructureFindFirstQueue.shift();
      }),
      findMany: jest.fn().mockResolvedValue(options.salaryStructures ?? []),
      update: jest.fn().mockResolvedValue(buildSalaryStructure()),
      create: jest.fn().mockResolvedValue(buildSalaryStructure()),
    },
    payrollRun: {
      findFirst: jest
        .fn()
        .mockResolvedValue(options.payrollRun ?? buildPayrollRun()),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest
        .fn()
        .mockResolvedValue(options.payrollRuns ?? [buildPayrollRun()]),
      create: jest.fn().mockResolvedValue(buildPayrollRun()),
      update: jest.fn().mockResolvedValue(buildPayrollRun()),
    },
    payrollLine: {
      count: jest.fn().mockResolvedValue(options.payrollLineCount ?? 0),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    payslip: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    staffAttendance: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    staffLeaveRequest: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    journalEntry: {
      create: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (input: unknown) => {
      if (Array.isArray(input)) {
        return Promise.all(input);
      }

      return (input as any)(tx);
    }),
  };

  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };
  const accountingPostingService = {
    postPayrollAccrual: jest.fn().mockResolvedValue({ id: 'journal-1' }),
    postPayrollDisbursement: jest
      .fn()
      .mockResolvedValue({ id: 'journal-disbursement-1' }),
  };

  return {
    service: new PayrollService(
      prisma as never,
      auditService as never,
      accountingPostingService as never,
    ),
    prisma,
    tx,
    auditService,
    accountingPostingService,
  };
}

function buildStaff(overrides: Record<string, unknown> = {}) {
  return {
    id: 'staff-1',
    tenantId: actor.tenantId,
    firstName: 'Asha',
    lastName: 'Teacher',
    employeeId: 'EMP-001',
    bankAccount: '1234567890',
    bankName: 'Nepal Bank',
    ...overrides,
  };
}

function buildStaffContract(overrides: Record<string, unknown> = {}) {
  return {
    id: 'contract-1',
    tenantId: actor.tenantId,
    staffId: 'staff-1',
    contractNumber: 'CNT-001',
    position: 'Teacher',
    startDate: new Date('2026-05-01T00:00:00.000Z'),
    endDate: null,
    status: 'ACTIVE',
    baseSalary: new Prisma.Decimal(45000),
    allowances: new Prisma.Decimal(5000),
    deductions: new Prisma.Decimal(1000),
    staff: buildStaff(),
    ...overrides,
  };
}

function buildSalaryStructure(overrides: Record<string, unknown> = {}) {
  return {
    id: 'salary-1',
    tenantId: actor.tenantId,
    staffId: 'staff-1',
    effectiveFrom: new Date('2026-05-01T00:00:00.000Z'),
    effectiveTo: null,
    status: SalaryStructureStatus.ACTIVE,
    basicSalary: new Prisma.Decimal(45000),
    allowances: new Prisma.Decimal(5000),
    deductions: new Prisma.Decimal(1000),
    pfEnabled: false,
    tdsEnabled: true,
    paymentMethod: 'BANK',
    components: [],
    staff: buildStaff(),
    ...overrides,
  };
}

function buildPayrollRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    tenantId: actor.tenantId,
    periodMonth: 5,
    periodYear: 2026,
    periodStart: new Date('2026-05-01T00:00:00.000Z'),
    periodEnd: new Date('2026-05-31T00:00:00.000Z'),
    status: PayrollRunStatus.GENERATED,
    grossAmount: new Prisma.Decimal(50000),
    deductionAmount: new Prisma.Decimal(1000),
    netAmount: new Prisma.Decimal(49000),
    pfEmployeeAmount: new Prisma.Decimal(0),
    pfEmployerAmount: new Prisma.Decimal(0),
    tdsAmount: new Prisma.Decimal(0),
    journalEntryId: null,
    disbursementJournalEntryId: null,
    notes: null,
    lines: [],
    payslips: [],
    ...overrides,
  };
}

function buildPayrollLine(overrides: Record<string, unknown> = {}) {
  return {
    id: 'line-1',
    tenantId: actor.tenantId,
    payrollRunId: 'run-1',
    staffId: 'staff-1',
    staff: buildStaff(),
    grossSalary: new Prisma.Decimal(50000),
    deductions: new Prisma.Decimal(1000),
    pfEmployee: new Prisma.Decimal(0),
    pfEmployer: new Prisma.Decimal(0),
    tds: new Prisma.Decimal(0),
    leaveDeductions: new Prisma.Decimal(0),
    netSalary: new Prisma.Decimal(49000),
    paidDays: new Prisma.Decimal(26),
    unpaidDays: new Prisma.Decimal(4),
    ...overrides,
  };
}
