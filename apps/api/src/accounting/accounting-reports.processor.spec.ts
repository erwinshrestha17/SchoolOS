import { SUSPENDED_TENANT_MESSAGE } from '../plans/tenant-access.constants';
import { createProcessorClsMock } from '../plans/processor-cls.mock';
import { AccountingReportsProcessor } from './accounting-reports.processor';

describe('AccountingReportsProcessor', () => {
  const jobData = {
    exportId: 'export-1',
    reportKey: 'accounting.general-ledger' as const,
    format: 'csv' as const,
    filters: { fiscalYearId: 'fy-1', accountCode: '1001' },
    actor: {
      tenantId: 'tenant-1',
      tenantSlug: 'test',
      userId: 'user-1',
      permissions: ['accounting:exports:create'],
    },
  };

  let prisma: { reportExport: { update: jest.Mock } };
  let exportsService: { completeQueuedReportExport: jest.Mock };
  let plansService: { shouldProcessTenantJob: jest.Mock };
  let processor: AccountingReportsProcessor;

  beforeEach(() => {
    prisma = { reportExport: { update: jest.fn() } };
    exportsService = { completeQueuedReportExport: jest.fn() };
    plansService = {
      shouldProcessTenantJob: jest.fn().mockResolvedValue(true),
    };
    processor = new AccountingReportsProcessor(
      prisma as unknown as ConstructorParameters<
        typeof AccountingReportsProcessor
      >[0],
      exportsService as unknown as ConstructorParameters<
        typeof AccountingReportsProcessor
      >[1],
      plansService as unknown as ConstructorParameters<
        typeof AccountingReportsProcessor
      >[2],
      createProcessorClsMock() as unknown as ConstructorParameters<
        typeof AccountingReportsProcessor
      >[3],
    );
  });

  it('marks queued accounting exports running before completing them', async () => {
    await processor.process({
      name: 'generateAccountingReport',
      data: jobData,
    } as unknown as Parameters<typeof processor.process>[0]);

    expect(prisma.reportExport.update).toHaveBeenCalledWith({
      where: { id: 'export-1' },
      data: { status: 'RUNNING' },
    });
    expect(exportsService.completeQueuedReportExport).toHaveBeenCalledWith(
      jobData,
    );
  });

  it('fails queued accounting exports for suspended tenants without generating files', async () => {
    plansService.shouldProcessTenantJob.mockResolvedValue(false);

    await processor.process({
      name: 'generateAccountingReport',
      data: jobData,
    } as unknown as Parameters<typeof processor.process>[0]);

    expect(exportsService.completeQueuedReportExport).not.toHaveBeenCalled();
    expect(prisma.reportExport.update).toHaveBeenCalledWith({
      where: { id: 'export-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorSummary: SUSPENDED_TENANT_MESSAGE,
        completedAt: expect.any(Date),
      }),
    });
  });

  it('marks queued accounting exports failed with bounded diagnostics on errors', async () => {
    exportsService.completeQueuedReportExport.mockRejectedValue(
      new Error('background export limit exceeded'),
    );

    await processor.process({
      name: 'generateAccountingReport',
      data: jobData,
    } as unknown as Parameters<typeof processor.process>[0]);

    expect(prisma.reportExport.update).toHaveBeenLastCalledWith({
      where: { id: 'export-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorSummary: 'background export limit exceeded',
        completedAt: expect.any(Date),
      }),
    });
  });
});
