import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PlansService } from '../plans/plans.service';
import { skipSuspendedTenantJob } from '../plans/processor-tenant.guard';
import { FinanceService } from './finance.service';

@Processor('finance')
export class FinanceProcessor extends WorkerHost {
  private readonly logger = new Logger(FinanceProcessor.name);

  constructor(
    private readonly financeService: FinanceService,
    private readonly plansService: PlansService,
  ) {
    super();
  }

  async process(job: Job<{ tenantId: string }, void>): Promise<void> {
    switch (job.name) {
      case 'calculateLateFees':
        return this.handleCalculateLateFees(job.data);
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleCalculateLateFees(input: { tenantId: string }) {
    if (
      await skipSuspendedTenantJob(
        this.plansService,
        input.tenantId,
        this.logger,
        'calculateLateFees',
      )
    ) {
      return;
    }

    this.logger.log(`Calculating late fees for tenant ${input.tenantId}...`);
    const result = await this.financeService.calculateLateFeesForTenant(
      input.tenantId,
    );
    this.logger.log(
      `Completed late fee calculations for tenant ${input.tenantId}: applied=${result.applied}, skipped=${result.skipped}, disabled=${result.disabled}.`,
    );
  }
}
