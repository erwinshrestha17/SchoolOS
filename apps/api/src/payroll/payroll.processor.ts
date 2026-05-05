import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PayrollService } from './payroll.service';

@Processor('payroll')
export class PayrollProcessor extends WorkerHost {
  private readonly logger = new Logger(PayrollProcessor.name);

  constructor(private readonly payrollService: PayrollService) {
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
    this.logger.log(
      `Generating payslip PDFs for tenant ${input.tenantId} for month ${input.month}...`,
    );
    // Placeholder logic for batch PDF generation
    // In reality, this would loop over all generated payroll records and create PDFs via PayrollService
    await new Promise((resolve) => setTimeout(resolve, 2000));
    this.logger.log(
      `Completed payslip generation for tenant ${input.tenantId}.`,
    );
  }
}
