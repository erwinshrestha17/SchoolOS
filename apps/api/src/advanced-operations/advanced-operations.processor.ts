import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { PlansService } from '../plans/plans.service';
import { runTenantScopedJob } from '../plans/processor-tenant.context';
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
    private readonly cls: ClsService,
  ) {
    super();
  }

  async process(job: Job<AdvancedOperationsJob, void>): Promise<void> {
    if (job.name !== 'runDataExport') {
      this.logger.warn(`Unknown advanced operations job: ${job.name}`);
      return;
    }

    await runTenantScopedJob(
      this.cls,
      this.plansService,
      job.data.tenantId,
      this.logger,
      `advanced operations export ${job.data.jobId}`,
      async () => {
        await this.exportsService.completeJob(job.data);
      },
    );
  }
}
