import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PlansService } from '../plans/plans.service';
import { skipSuspendedTenantJob } from '../plans/processor-tenant.guard';
import { PayrollService } from './payroll.service';

@Processor('payroll')
export class PayrollProcessor extends WorkerHost {
  private readonly logger = new Logger(PayrollProcessor.name);

  constructor(
    private readonly payrollService: PayrollService,
    private readonly plansService: PlansService,
  ) {
    super();
  }

  async process(
    job: Job<{ tenantId: string; month: string }, void>,
  ): Promise<void> {
    switch (job.name) {
      case 'generatePayslips':
        return this.handleGeneratePayslips(job.data);
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleGeneratePayslips(input: {
    tenantId: string;
    month: string;
  }) {
    if (
      await skipSuspendedTenantJob(
        this.plansService,
        input.tenantId,
        this.logger,
        'generatePayslips',
      )
    ) {
      return;
    }

    this.logger.log(
      `Generating payslip PDFs for tenant ${input.tenantId} for month ${input.month}...`,
    );
    const result = await this.payrollService.generatePayslipPdfBatch(input);
    this.logger.log(
      `Completed payslip generation for tenant ${input.tenantId}: generated=${result.generated}, skipped=${result.skipped}, payrollRunId=${result.payrollRunId}.`,
    );
  }
}
