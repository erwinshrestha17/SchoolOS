import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { DataExportCenterService } from './data-export-center.service';

interface AdvancedOperationsJob {
  tenantId: string;
  jobId: string;
}

@Processor('advanced-operations')
export class AdvancedOperationsProcessor extends WorkerHost {
  private readonly logger = new Logger(AdvancedOperationsProcessor.name);

  constructor(private readonly exportsService: DataExportCenterService) {
    super();
  }

  async process(job: Job<AdvancedOperationsJob, void>): Promise<void> {
    if (job.name !== 'runDataExport') {
      this.logger.warn(`Unknown advanced operations job: ${job.name}`);
      return;
    }
    await this.exportsService.completeJob(job.data);
  }
}
