import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  FileStatus,
  PayrollLineStatus,
  PayrollRunStatus,
  PayslipStatus,
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

  it('effective-dates a current contract when a future replacement is created', async () => {
    const currentContract = buildStaffContract({
      id: 'contract-current',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: null,
      status: 'ACTIVE',
    });
    const replacement = buildStaffContract({
      id: 'contract-replacement',
      contractNumber: 'CNT-002',
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: null,
      status: 'ACTIVE',
    });
    const { service, tx, auditService } = buildService({
      staffContracts: [currentContract],
      createdStaffContract: replacement,
    });

    await expect(
      service.createContract(
        {
          staffId: 'staff-1',
          contractNumber: ' CNT-002 ',
          position: ' Senior Teacher ',
          startDate: '2026-08-01',
          baseSalary: 50000,
        },
        actor as never,
      ),
    ).resolves.toEqual(replacement);

    expect(tx.staffContract.update).toHaveBeenCalledWith({
      where: { id: 'contract-current', tenantId: actor.tenantId },
      data: { endDate: new Date('2026-07-31T00:00:00.000Z') },
    });
    expect(tx.staffContract.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'INACTIVE' }),
      }),
    );
    expect(tx.staffContract.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contractNumber: 'CNT-002',
          position: 'Senior Teacher',
          startDate: new Date('2026-08-01T00:00:00.000Z'),
          status: 'ACTIVE',
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'supersede',
        resourceId: 'contract-current',
        after: expect.objectContaining({
          supersededByContractId: 'contract-replacement',
        }),
      }),
    );
  });

  it('rejects a contract that overlaps an active contract with the same or later start date', async () => {
    const scheduledContract = buildStaffContract({
      id: 'contract-scheduled',
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: null,
      status: 'ACTIVE',
    });
    const { service, tx } = buildService({
      staffContracts: [scheduledContract],
    });

    await expect(
      service.createContract(
        {
          staffId: 'staff-1',
          contractNumber: 'CNT-002',
          position: 'Teacher',
          startDate: '2026-07-01',
          endDate: '2026-12-31',
          baseSalary: 50000,
        },
        actor as never,
      ),
    ).rejects.toThrow('overlaps another active or scheduled contract');

    expect(tx.staffContract.update).not.toHaveBeenCalled();
    expect(tx.staffContract.create).not.toHaveBeenCalled();
  });

  it('rejects a staff contract with an end date before its start date', async () => {
    const { service, prisma } = buildService({});

    await expect(
      service.createContract(
        {
          staffId: 'staff-1',
          contractNumber: 'CNT-002',
          position: 'Teacher',
          startDate: '2026-08-01',
          endDate: '2026-07-31',
          baseSalary: 50000,
        },
        actor as never,
      ),
    ).rejects.toThrow('Contract end date cannot be before the start date');

    expect(prisma.$transaction).not.toHaveBeenCalled();
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

  it('requires submission and completed review before approval', async () => {
    const generatedRun = buildPayrollRun({
      status: PayrollRunStatus.GENERATED,
    });
    const { service, prisma } = buildService({ payrollRun: generatedRun });

    await expect(
      service.approvePayrollRun('run-1', actor as never),
    ).rejects.toThrow('Payroll run in GENERATED status cannot be approved');

    expect(prisma.payrollLine.updateMany).not.toHaveBeenCalled();
    expect(prisma.payslip.createMany).not.toHaveBeenCalled();
  });

  it('separates review submission from review completion', async () => {
    const generatedRun = buildPayrollRun({
      status: PayrollRunStatus.GENERATED,
    });
    const underReviewRun = buildPayrollRun({
      status: PayrollRunStatus.UNDER_REVIEW,
    });
    const { service, prisma, auditService } = buildService({
      payrollRunFindFirstQueue: [generatedRun, underReviewRun],
      updatedPayrollRunQueue: [
        underReviewRun,
        buildPayrollRun({ status: PayrollRunStatus.REVIEWED }),
      ],
    });

    await expect(
      service.submitPayrollRunForReview('run-1', actor as never),
    ).resolves.toMatchObject({ status: PayrollRunStatus.UNDER_REVIEW });
    await expect(
      service.reviewPayrollRun('run-1', actor as never),
    ).resolves.toMatchObject({ status: PayrollRunStatus.REVIEWED });

    expect(prisma.payrollRun.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'run-1' },
        data: { status: PayrollRunStatus.UNDER_REVIEW },
      }),
    );
    expect(prisma.payrollRun.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'run-1' },
        data: { status: PayrollRunStatus.REVIEWED },
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'submit_review' }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'complete_review' }),
    );
  });

  it('rejects paid payroll runs instead of mutating them through correction return', async () => {
    const run = buildPayrollRun({ status: PayrollRunStatus.PAID });
    const { service, prisma } = buildService({ payrollRun: run });

    await expect(
      service.rejectPayrollRun(
        'run-1',
        { reason: 'Should not mutate paid payroll' },
        actor as never,
      ),
    ).rejects.toThrow(
      'Payroll run in PAID status cannot be returned for correction',
    );

    expect(prisma.payrollRun.update).not.toHaveBeenCalled();
  });

  it('requires an audited reason before returning a reviewed run for correction', async () => {
    const reviewedRun = buildPayrollRun({
      status: PayrollRunStatus.REVIEWED,
    });
    const { service, prisma } = buildService({ payrollRun: reviewedRun });

    await expect(
      service.rejectPayrollRun('run-1', { reason: '   ' }, actor as never),
    ).rejects.toThrow('Correction reason is required');

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
      employeeContribution: '1000.00',
      employerContribution: '1000.00',
      totalContribution: '2000.00',
    });
    expect(tds).toMatchObject({ payrollRunId: 'run-1', totalTds: '500.00' });
    expect(components).toMatchObject({
      payrollRunId: 'run-1',
      staffCount: 1,
      grossSalary: '50000.00',
      netPayable: '49000.00',
    });
  });

  it('returns bounded backend-owned dashboard summary totals as serialized Decimal values', async () => {
    const selectedRun = buildPayrollRun({
      status: PayrollRunStatus.APPROVED,
      grossAmount: new Prisma.Decimal('100000.25'),
      deductionAmount: new Prisma.Decimal('12000.10'),
      netAmount: new Prisma.Decimal('88000.15'),
      pfEmployeeAmount: new Prisma.Decimal('5000.05'),
      pfEmployerAmount: new Prisma.Decimal('5000.05'),
      tdsAmount: new Prisma.Decimal('2000.00'),
      _count: { lines: 2, payslips: 1 },
    });
    const { service, prisma } = buildService({
      staffCountQueue: [12, 2],
      staffContractCount: 3,
      staffLeaveRequestCountQueue: [5, 1],
      payrollRunFindFirstQueue: [
        buildPayrollRun({ id: 'latest-run', status: PayrollRunStatus.POSTED }),
        selectedRun,
      ],
      payrollRunStatusGroups: [
        { status: PayrollRunStatus.APPROVED, _count: { _all: 1 } },
        { status: PayrollRunStatus.GENERATED, _count: { _all: 2 } },
      ],
      payslipStatusGroups: [
        { status: PayslipStatus.ISSUED, _count: { _all: 1 } },
      ],
    });

    const summary = await service.getPayrollDashboardSummary(
      {
        payrollRunId: 'run-1',
        month: 5,
        year: 2026,
        contractWindowDays: 45,
      },
      actor as never,
    );

    expect(summary).toMatchObject({
      filters: {
        periodMonth: 5,
        periodYear: 2026,
        payrollRunId: 'run-1',
        contractWindowDays: 45,
        timezone: 'Asia/Kathmandu',
      },
      activeStaffCount: 12,
      activeStaffWithoutActiveSalaryStructureCount: 2,
      contractsExpiringWithinWindow: 3,
      pendingLeaveRequests: 5,
      onLeaveTodayCount: 1,
      payrollRunsByStatus: expect.objectContaining({
        APPROVED: 1,
        GENERATED: 2,
      }),
      selectedPayrollRun: expect.objectContaining({
        employeeCount: 2,
        totalGross: '100000.25',
        totalDeductions: '12000.10',
        totalNet: '88000.15',
        pfEmployeeAmount: '5000.05',
        postingReadiness: expect.objectContaining({
          canPost: true,
          createsAccountingAccrualOnly: true,
          salaryDisbursementProviderSupported: false,
        }),
        payslipGeneration: expect.objectContaining({
          status: 'PARTIAL',
          total: 1,
          expected: 2,
          byStatus: expect.objectContaining({ ISSUED: 1 }),
        }),
        validationExceptionCount: 0,
        validationExceptionSource: 'payroll_exception_workflow',
        validationExceptionsBySeverity: {
          BLOCKING: 0,
          WARNING: 0,
          INFO: 0,
        },
      }),
    });
    expect(prisma.staff.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: actor.tenantId }),
      }),
    );
    expect(prisma.payrollRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: actor.tenantId, id: 'run-1' },
      }),
    );
  });

  it('paginates payroll runs with tenant and lifecycle status filters', async () => {
    const { service, prisma } = buildService({
      payrollRuns: [
        buildPayrollRun({
          status: PayrollRunStatus.APPROVED,
          _count: { lines: 3, payslips: 2 },
        }),
      ],
      payrollRunCount: 21,
    });

    const result = await service.listPayrollRuns(
      { page: 2, limit: 10, status: PayrollRunStatus.APPROVED },
      actor as never,
    );

    expect(prisma.payrollRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: actor.tenantId,
          status: PayrollRunStatus.APPROVED,
        },
        skip: 10,
        take: 10,
      }),
    );
    expect(result).toMatchObject({
      total: 21,
      page: 2,
      limit: 10,
      hasNextPage: true,
      items: [
        expect.objectContaining({
          grossAmount: '50000.00',
          netAmount: '49000.00',
          lineCount: 3,
          payslipCount: 2,
        }),
      ],
    });
  });

  it('keeps staff self-service payslip lists scoped to the authenticated staff member', async () => {
    const { service, prisma } = buildService({
      staff: buildStaff({ id: 'own-staff', userId: actor.userId }),
      payslips: [buildPayslip({ staffId: 'own-staff' })],
      payslipCount: 1,
    });

    const result = await service.listMyPayslips(
      { page: 1, limit: 5, staffId: 'other-staff' },
      actor as never,
    );

    expect(prisma.staff.findFirst).toHaveBeenCalledWith({
      where: { tenantId: actor.tenantId, userId: actor.userId },
    });
    expect(prisma.payslip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: actor.tenantId,
          staffId: 'own-staff',
        }),
        skip: 0,
        take: 5,
      }),
    );
    expect(result).toMatchObject({
      total: 1,
      items: [expect.objectContaining({ staffId: 'own-staff' })],
    });
  });

  it('downloads payslips only through File Registry protected file access', async () => {
    const content = Buffer.from('%PDF-1.4 protected');
    const fileRegistryService = {
      getFileMetadata: jest.fn().mockResolvedValue({
        id: 'file-1',
        tenantId: actor.tenantId,
        module: 'payroll',
        entityId: 'payslip-1',
        status: FileStatus.UPLOADED,
      }),
      assertFileAccessForAuth: jest.fn().mockResolvedValue(undefined),
      getProtectedDownload: jest.fn().mockResolvedValue({
        asset: { id: 'file-1' },
        content,
      }),
    };
    const { service, prisma } = buildService({
      payslip: buildPayslip({ id: 'payslip-1', payslipNumber: 'PS-001' }),
      reportExports: [
        {
          fileAssetId: 'file-1',
          filters: { payslipId: 'payslip-1', payslipNumber: 'PS-001' },
        },
      ],
      fileRegistryService,
    });

    await expect(service.getPayslipPdf('PS-001', actor as never)).resolves.toBe(
      content,
    );
    expect(prisma.reportExport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: actor.tenantId,
          reportKey: 'payroll.payslip',
          format: 'pdf',
          status: 'COMPLETED',
          fileAssetId: { not: null },
        }),
      }),
    );
    expect(fileRegistryService.getFileMetadata).toHaveBeenCalledWith(
      actor.tenantId,
      'file-1',
    );
    expect(fileRegistryService.assertFileAccessForAuth).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'file-1' }),
      actor,
    );
    expect(fileRegistryService.getProtectedDownload).toHaveBeenCalledWith(
      actor.tenantId,
      'file-1',
      actor.userId,
    );
  });

  it('returns a safe unavailable state when a payslip has no registered protected file', async () => {
    const { service } = buildService({
      payslip: buildPayslip({ id: 'payslip-1', payslipNumber: 'PS-001' }),
      reportExports: [],
      fileRegistryService: {
        getFileMetadata: jest.fn(),
        assertFileAccessForAuth: jest.fn(),
        getProtectedDownload: jest.fn(),
      },
    });

    const result = service.getPayslipPdf('PS-001', actor as never);

    await expect(result).rejects.toBeInstanceOf(ConflictException);
    await expect(result).rejects.toThrow(
      'Protected payslip file is unavailable. Regenerate payslips before downloading.',
    );
  });

  it('returns the same safe conflict when a completed export points to a missing File Registry asset', async () => {
    const { service } = buildService({
      payslip: buildPayslip({ id: 'payslip-1', payslipNumber: 'PS-001' }),
      reportExports: [
        {
          fileAssetId: 'missing-file',
          filters: { payslipId: 'payslip-1', payslipNumber: 'PS-001' },
        },
      ],
      fileRegistryService: {
        getFileMetadata: jest
          .fn()
          .mockRejectedValue(new NotFoundException('File not found')),
        assertFileAccessForAuth: jest.fn(),
        getProtectedDownload: jest.fn(),
      },
    });

    const result = service.getPayslipPdf('PS-001', actor as never);

    await expect(result).rejects.toBeInstanceOf(ConflictException);
    await expect(result).rejects.toThrow(
      'Protected payslip file is unavailable. Regenerate payslips before downloading.',
    );
  });

  it('returns the same safe conflict when the generated File Registry asset has no stored object', async () => {
    const missingObjectError = Object.assign(
      new Error('Local storage object is missing'),
      { code: 'ENOENT' },
    );
    const { service } = buildService({
      payslip: buildPayslip({ id: 'payslip-1', payslipNumber: 'PS-001' }),
      reportExports: [
        {
          fileAssetId: 'file-1',
          filters: { payslipId: 'payslip-1', payslipNumber: 'PS-001' },
        },
      ],
      fileRegistryService: {
        getFileMetadata: jest.fn().mockResolvedValue({
          id: 'file-1',
          tenantId: actor.tenantId,
          module: 'payroll',
          entityId: 'payslip-1',
          status: FileStatus.UPLOADED,
        }),
        assertFileAccessForAuth: jest.fn().mockResolvedValue(undefined),
        getProtectedDownload: jest.fn().mockRejectedValue(missingObjectError),
      },
    });

    const result = service.getPayslipPdf('PS-001', actor as never);

    await expect(result).rejects.toBeInstanceOf(ConflictException);
    await expect(result).rejects.toThrow(
      'Protected payslip file is unavailable. Regenerate payslips before downloading.',
    );
  });

  it('queues a tenant-scoped payslip regeneration job with a stable deduplication id', async () => {
    const job = {
      id: 'payroll-payslip-tenant-1-run-1-payslip-1',
      name: 'regeneratePayslip',
      data: {
        tenantId: actor.tenantId,
        payrollRunId: 'run-1',
        payslipId: 'payslip-1',
        requestedByUserId: actor.userId,
      },
      timestamp: Date.parse('2026-06-27T06:00:00.000Z'),
      processedOn: null,
      finishedOn: null,
      returnvalue: null,
      getState: jest.fn().mockResolvedValue('waiting'),
      remove: jest.fn(),
    };
    const payrollQueue = {
      getJob: jest.fn().mockResolvedValue(null),
      add: jest.fn().mockResolvedValue(job),
    };
    const { service, auditService } = buildService({
      payslip: buildPayslip({
        id: 'payslip-1',
        payrollRunId: 'run-1',
        payrollRun: {
          id: 'run-1',
          periodMonth: 5,
          periodYear: 2026,
          status: PayrollRunStatus.POSTED,
        },
      }),
      payrollQueue,
    });

    await expect(
      service.queuePayslipRegenerationJob('run-1', 'payslip-1', actor as never),
    ).resolves.toMatchObject({
      jobId: job.id,
      payrollRunId: 'run-1',
      payslipId: 'payslip-1',
      payslipNumber: 'PS-001',
      status: 'QUEUED',
    });
    expect(payrollQueue.add).toHaveBeenCalledWith(
      'regeneratePayslip',
      {
        tenantId: actor.tenantId,
        payrollRunId: 'run-1',
        payslipId: 'payslip-1',
        requestedByUserId: actor.userId,
      },
      expect.objectContaining({ jobId: job.id, attempts: 3 }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'queue_payslip_regeneration',
        resource: 'payslip',
        resourceId: 'payslip-1',
        tenantId: actor.tenantId,
        userId: actor.userId,
      }),
    );
  });

  it('reuses an active payslip regeneration job instead of queueing a duplicate', async () => {
    const activeJob = {
      id: 'payroll-payslip-tenant-1-run-1-payslip-1',
      name: 'regeneratePayslip',
      data: {
        tenantId: actor.tenantId,
        payrollRunId: 'run-1',
        payslipId: 'payslip-1',
        requestedByUserId: actor.userId,
      },
      timestamp: Date.parse('2026-06-27T06:00:00.000Z'),
      processedOn: Date.parse('2026-06-27T06:00:01.000Z'),
      finishedOn: null,
      returnvalue: null,
      getState: jest.fn().mockResolvedValue('active'),
      remove: jest.fn(),
    };
    const payrollQueue = {
      getJob: jest.fn().mockResolvedValue(activeJob),
      add: jest.fn(),
    };
    const { service } = buildService({ payrollQueue });

    await expect(
      service.queuePayslipRegenerationJob('run-1', 'payslip-1', actor as never),
    ).resolves.toMatchObject({
      jobId: activeJob.id,
      status: 'PROCESSING',
    });
    expect(payrollQueue.add).not.toHaveBeenCalled();
    expect(activeJob.remove).not.toHaveBeenCalled();
  });

  it('does not expose a payslip regeneration job from another tenant', async () => {
    const payrollQueue = {
      getJob: jest.fn().mockResolvedValue({
        id: 'job-other-tenant',
        name: 'regeneratePayslip',
        data: {
          tenantId: 'tenant-other',
          payrollRunId: 'run-1',
          payslipId: 'payslip-1',
          requestedByUserId: 'user-other',
        },
        getState: jest.fn().mockResolvedValue('waiting'),
      }),
      add: jest.fn(),
    };
    const { service } = buildService({ payrollQueue });

    await expect(
      service.getPayslipRegenerationJob(
        'run-1',
        'payslip-1',
        'job-other-tenant',
        actor as never,
      ),
    ).rejects.toThrow('Payslip regeneration job not found');
  });

  it('returns bounded completed regeneration status without queue internals', async () => {
    const payrollQueue = {
      getJob: jest.fn().mockResolvedValue({
        id: 'job-1',
        name: 'regeneratePayslip',
        data: {
          tenantId: actor.tenantId,
          payrollRunId: 'run-1',
          payslipId: 'payslip-1',
          requestedByUserId: actor.userId,
        },
        timestamp: Date.parse('2026-06-27T06:00:00.000Z'),
        processedOn: Date.parse('2026-06-27T06:00:01.000Z'),
        finishedOn: Date.parse('2026-06-27T06:00:02.000Z'),
        returnvalue: {
          payrollRunId: 'run-1',
          periodMonth: 5,
          periodYear: 2026,
          payslipCount: 1,
          generated: 1,
          skipped: 0,
        },
        getState: jest.fn().mockResolvedValue('completed'),
      }),
      add: jest.fn(),
    };
    const { service } = buildService({ payrollQueue });

    const result = await service.getPayslipRegenerationJob(
      'run-1',
      'payslip-1',
      'job-1',
      actor as never,
    );

    expect(result).toEqual({
      jobId: 'job-1',
      payrollRunId: 'run-1',
      payslipId: 'payslip-1',
      payslipNumber: 'PS-001',
      status: 'SUCCEEDED',
      requestedAt: '2026-06-27T06:00:00.000Z',
      startedAt: '2026-06-27T06:00:01.000Z',
      completedAt: '2026-06-27T06:00:02.000Z',
      generated: 1,
      skipped: 0,
      payslipCount: 1,
    });
    expect(result).not.toHaveProperty('data');
    expect(result).not.toHaveProperty('failedReason');
  });

  it('regenerates the requested payslip even when a stale completed export exists', async () => {
    const generatedAsset = { id: 'file-regenerated' };
    const fileRegistryService = {
      registerGeneratedFile: jest.fn().mockResolvedValue(generatedAsset),
    };
    const payslip = buildPayslip({
      id: 'payslip-1',
      payrollRunId: 'run-1',
      staff: buildStaff(),
      payrollLine: buildPayrollLine(),
    });
    const { service, prisma, auditService } = buildService({
      payrollRun: buildPayrollRun({
        id: 'run-1',
        status: PayrollRunStatus.POSTED,
        tenant: { name: 'SchoolOS Academy' },
        payslips: [payslip],
      }),
      reportExports: [
        {
          id: 'stale-export',
          filters: { payrollRunId: 'run-1', payslipId: 'payslip-1' },
        },
      ],
      fileRegistryService,
    });

    await expect(
      service.generatePayslipPdfBatch({
        tenantId: actor.tenantId,
        payrollRunId: 'run-1',
        payslipId: 'payslip-1',
        requestedByUserId: actor.userId,
      }),
    ).resolves.toEqual({
      payrollRunId: 'run-1',
      periodMonth: 5,
      periodYear: 2026,
      payslipCount: 1,
      generated: 1,
      skipped: 0,
    });
    expect(prisma.reportExport.findMany).not.toHaveBeenCalled();
    expect(fileRegistryService.registerGeneratedFile).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: actor.tenantId,
        generatedByUserId: actor.userId,
        module: 'payroll',
        entityId: 'payslip-1',
      }),
    );
    expect(prisma.reportExport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        reportKey: 'payroll.payslip',
        status: 'COMPLETED',
        fileAssetId: 'file-regenerated',
        requestedBy: actor.userId,
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'generate_payslip_pdf_batch',
        resourceId: 'run-1',
        tenantId: actor.tenantId,
        userId: actor.userId,
      }),
    );
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
        amount: '2500.00',
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
  staffContracts?: unknown[];
  createdStaffContract?: unknown;
  salaryStructureFindFirstQueue?: unknown[];
  salaryStructures?: unknown[];
  payrollLineCount?: number;
  payrollRun?: unknown;
  payrollRunFindFirstQueue?: unknown[];
  updatedPayrollRunQueue?: unknown[];
  payrollRuns?: unknown[];
  payrollRunCount?: number;
  payrollRunStatusGroups?: unknown[];
  postedPayrollRun?: unknown;
  staffCountQueue?: number[];
  staffContractCount?: number;
  staffLeaveRequestCountQueue?: number[];
  payslips?: unknown[];
  payslip?: unknown;
  payslipCount?: number;
  payslipStatusGroups?: unknown[];
  reportExports?: unknown[];
  fileRegistryService?: unknown;
  payrollQueue?: unknown;
}) {
  const salaryStructureFindFirstQueue = [
    ...(options.salaryStructureFindFirstQueue ?? []),
  ];
  const payrollRunFindFirstQueue = [
    ...(options.payrollRunFindFirstQueue ?? []),
  ];
  const updatedPayrollRunQueue = [...(options.updatedPayrollRunQueue ?? [])];
  const staffCountQueue = [...(options.staffCountQueue ?? [])];
  const staffLeaveRequestCountQueue = [
    ...(options.staffLeaveRequestCountQueue ?? []),
  ];

  const tx = {
    staffContract: {
      findMany: jest.fn().mockResolvedValue(options.staffContracts ?? []),
      update: jest
        .fn()
        .mockImplementation(
          async ({ data }: { data: Record<string, unknown> }) => ({
            ...buildStaffContract(),
            ...(options.staffContracts?.[0] as
              | Record<string, unknown>
              | undefined),
            ...data,
          }),
        ),
      create: jest
        .fn()
        .mockResolvedValue(
          options.createdStaffContract ?? buildStaffContract(),
        ),
    },
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
      count: jest
        .fn()
        .mockImplementation(async () =>
          staffCountQueue.length > 0 ? staffCountQueue.shift() : 1,
        ),
    },
    staffContract: {
      create: jest.fn().mockResolvedValue(buildStaffContract()),
      findFirst: jest.fn().mockResolvedValue(buildStaffContract()),
      findMany: jest.fn().mockResolvedValue([buildStaffContract()]),
      count: jest.fn().mockResolvedValue(options.staffContractCount ?? 0),
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
        .mockImplementation(async () =>
          payrollRunFindFirstQueue.length > 0
            ? payrollRunFindFirstQueue.shift()
            : (options.payrollRun ?? buildPayrollRun()),
        ),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest
        .fn()
        .mockResolvedValue(options.payrollRuns ?? [buildPayrollRun()]),
      count: jest.fn().mockResolvedValue(options.payrollRunCount ?? 1),
      groupBy: jest
        .fn()
        .mockResolvedValue(options.payrollRunStatusGroups ?? []),
      create: jest.fn().mockResolvedValue(buildPayrollRun()),
      update: jest
        .fn()
        .mockImplementation(async () =>
          updatedPayrollRunQueue.length > 0
            ? updatedPayrollRunQueue.shift()
            : buildPayrollRun(),
        ),
    },
    payrollLine: {
      count: jest.fn().mockResolvedValue(options.payrollLineCount ?? 0),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    payslip: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue(options.payslips ?? []),
      findFirst: jest.fn().mockResolvedValue(options.payslip ?? buildPayslip()),
      count: jest.fn().mockResolvedValue(options.payslipCount ?? 0),
      groupBy: jest.fn().mockResolvedValue(options.payslipStatusGroups ?? []),
    },
    reportExport: {
      findMany: jest.fn().mockResolvedValue(options.reportExports ?? []),
      create: jest.fn(),
    },
    staffAttendance: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    staffLeaveRequest: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest
        .fn()
        .mockImplementation(async () =>
          staffLeaveRequestCountQueue.length > 0
            ? staffLeaveRequestCountQueue.shift()
            : 0,
        ),
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
      options.fileRegistryService as never,
      options.payrollQueue as never,
    ),
    prisma,
    tx,
    auditService,
    accountingPostingService,
    payrollQueue: options.payrollQueue,
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
    allowances: new Prisma.Decimal(5000),
    deductions: new Prisma.Decimal(1000),
    pfEmployee: new Prisma.Decimal(0),
    pfEmployer: new Prisma.Decimal(0),
    tds: new Prisma.Decimal(0),
    leaveDeductions: new Prisma.Decimal(0),
    netSalary: new Prisma.Decimal(49000),
    attendanceDays: 26,
    workingDays: 30,
    paidDays: new Prisma.Decimal(26),
    unpaidDays: new Prisma.Decimal(4),
    ...overrides,
  };
}

function buildPayslip(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payslip-1',
    tenantId: actor.tenantId,
    payrollRunId: 'run-1',
    payrollLineId: 'line-1',
    staffId: 'staff-1',
    payslipNumber: 'PS-001',
    status: PayslipStatus.ISSUED,
    grossSalary: new Prisma.Decimal(50000),
    deductionAmount: new Prisma.Decimal(1000),
    pfEmployee: new Prisma.Decimal(0),
    pfEmployer: new Prisma.Decimal(0),
    tds: new Prisma.Decimal(0),
    netSalary: new Prisma.Decimal(49000),
    paymentStatus: 'UNPAID',
    issuedAt: new Date('2026-05-31T00:00:00.000Z'),
    staff: buildStaff({ userId: actor.userId }),
    payrollRun: {
      id: 'run-1',
      periodMonth: 5,
      periodYear: 2026,
      status: PayrollRunStatus.POSTED,
    },
    ...overrides,
  };
}
