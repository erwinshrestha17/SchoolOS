import { PayrollProcessor } from './payroll.processor';

describe('PayrollProcessor payslip generation jobs', () => {
  const jobData = {
    tenantId: 'tenant-1',
    payrollRunId: 'run-1',
    payslipId: 'payslip-1',
    requestedByUserId: 'user-1',
  };

  let payrollService: { generatePayslipPdfBatch: jest.Mock };
  let plansService: { shouldProcessTenantJob: jest.Mock };
  let processor: PayrollProcessor;

  beforeEach(() => {
    payrollService = {
      generatePayslipPdfBatch: jest.fn().mockResolvedValue({
        payrollRunId: 'run-1',
        periodMonth: 5,
        periodYear: 2026,
        payslipCount: 1,
        generated: 1,
        skipped: 0,
      }),
    };
    plansService = {
      shouldProcessTenantJob: jest.fn().mockResolvedValue(true),
    };
    processor = new PayrollProcessor(
      payrollService as never,
      plansService as never,
    );
  });

  it('returns bounded generation results for a queued payslip regeneration', async () => {
    await expect(
      processor.process({
        name: 'regeneratePayslip',
        data: jobData,
      } as never),
    ).resolves.toEqual({
      payrollRunId: 'run-1',
      periodMonth: 5,
      periodYear: 2026,
      payslipCount: 1,
      generated: 1,
      skipped: 0,
    });
    expect(payrollService.generatePayslipPdfBatch).toHaveBeenCalledWith(
      jobData,
    );
  });

  it('fails closed for an inactive tenant before generating a file', async () => {
    plansService.shouldProcessTenantJob.mockResolvedValue(false);

    await expect(
      processor.process({
        name: 'regeneratePayslip',
        data: jobData,
      } as never),
    ).rejects.toThrow('Payroll generation skipped for unavailable tenant');
    expect(payrollService.generatePayslipPdfBatch).not.toHaveBeenCalled();
  });
});
