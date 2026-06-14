import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PlansService } from '../plans/plans.service';
import { skipSuspendedTenantJob } from '../plans/processor-tenant.guard';
import { SUSPENDED_TENANT_MESSAGE } from '../plans/tenant-access.constants';
import { PrismaService } from '../prisma/prisma.service';
import {
  AccountingQueuedReportJob,
  AccountingReportExportsService,
} from './accounting-report-exports.service';

@Processor('accounting-reports')
export class AccountingReportsProcessor extends WorkerHost {
  private readonly logger = new Logger(AccountingReportsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly exportsService: AccountingReportExportsService,
    private readonly plansService: PlansService,
  ) {
    super();
  }

  async process(job: Job<AccountingQueuedReportJob, void>): Promise<void> {
    switch (job.name) {
      case 'generateAccountingReport':
        return this.handleGenerateAccountingReport(job.data);
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleGenerateAccountingReport(input: AccountingQueuedReportJob) {
    if (
      await skipSuspendedTenantJob(
        this.plansService,
        input.actor.tenantId,
        this.logger,
        `accounting report export ${input.reportKey}`,
      )
    ) {
      await this.markFailed(input.exportId, SUSPENDED_TENANT_MESSAGE);
      return;
    }

    try {
      await this.prisma.reportExport.update({
        where: { id: input.exportId },
        data: { status: 'RUNNING' },
      });
      await this.exportsService.completeQueuedReportExport(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to process accounting report ${input.reportKey}: ${message}`,
        stack,
      );
      await this.markFailed(input.exportId, message);
    }
  }

  private async markFailed(exportId: string, message: string) {
    await this.prisma.reportExport.update({
      where: { id: exportId },
      data: {
        status: 'FAILED',
        errorSummary: message,
        completedAt: new Date(),
      },
    });
  }
}
