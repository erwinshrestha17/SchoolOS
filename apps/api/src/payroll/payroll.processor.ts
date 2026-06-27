import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PlansService } from '../plans/plans.service';
import { skipSuspendedTenantJob } from '../plans/processor-tenant.guard';
import {
  PayrollService,
  type PayslipGenerationJobData,
  type PayslipGenerationJobResult,
} from './payroll.service';

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
    job: Job<PayslipGenerationJobData, PayslipGenerationJobResult>,
  ): Promise<PayslipGenerationJobResult> {
    switch (job.name) {
      case 'generatePayslips':
      case 'regeneratePayslip':
        return this.handleGeneratePayslips(job.data);
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
        throw new Error('Unsupported payroll job');
    }
  }

  private async handleGeneratePayslips(input: PayslipGenerationJobData) {
    if (
      await skipSuspendedTenantJob(
        this.plansService,
        input.tenantId,
        this.logger,
        'payslip generation',
      )
    ) {
      throw new Error('Payroll generation skipped for unavailable tenant');
    }

    this.logger.log(
      `Generating payslip PDFs for tenant ${input.tenantId}, run ${input.payrollRunId}...`,
    );
    const result = await this.payrollService.generatePayslipPdfBatch(input);
    this.logger.log(
      `Completed payslip generation for tenant ${input.tenantId}: generated=${result.generated}, skipped=${result.skipped}, payrollRunId=${result.payrollRunId}.`,
    );
    return result;
  }
}
