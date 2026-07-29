import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PlansService } from '../plans/plans.service';
import { skipSuspendedTenantJob } from '../plans/processor-tenant.guard';
import { DataExportCenterService } from './data-export-center.service';

interface AdvancedOperationsJob {
  tenantId: string;
  jobId: string;
}

@Processor('advanced-operations')
export class AdvancedOperationsProcessor extends WorkerHost {
  private readonly logger = new Logger(AdvancedOperationsProcessor.name);

  constructor(
    private readonly exportsService: DataExportCenterService,
    private readonly plansService: PlansService,
  ) {
    super();
  }

  async process(job: Job<AdvancedOperationsJob, void>): Promise<void> {
    if (job.name !== 'runDataExport') {
      this.logger.warn(`Unknown advanced operations job: ${job.name}`);
      return;
    }

    if (
      await skipSuspendedTenantJob(
        this.plansService,
        job.data.tenantId,
        this.logger,
        `advanced operations export ${job.data.jobId}`,
      )
    ) {
      return;
    }

    await this.exportsService.completeJob(job.data);
  }
}
