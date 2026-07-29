import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { PlansService } from '../plans/plans.service';
import { runTenantScopedJob } from '../plans/processor-tenant.context';
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
    private readonly cls: ClsService,
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
    const result = await runTenantScopedJob(
      this.cls,
      this.plansService,
      input.tenantId,
      this.logger,
      'payslip generation',
      async () => {
        this.logger.log(
          `Generating payslip PDFs for tenant ${input.tenantId}, run ${input.payrollRunId}...`,
        );
        const batchResult =
          await this.payrollService.generatePayslipPdfBatch(input);
        this.logger.log(
          `Completed payslip generation for tenant ${input.tenantId}: generated=${batchResult.generated}, skipped=${batchResult.skipped}, payrollRunId=${batchResult.payrollRunId}.`,
        );
        return batchResult;
      },
    );

    if (!result) {
      throw new Error('Payroll generation skipped for unavailable tenant');
    }

    return result;
  }
}
