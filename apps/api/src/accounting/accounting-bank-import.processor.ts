import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PlansService } from '../plans/plans.service';
import { skipSuspendedTenantJob } from '../plans/processor-tenant.guard';
import { SUSPENDED_TENANT_MESSAGE } from '../plans/tenant-access.constants';
import { PrismaService } from '../prisma/prisma.service';
import {
  AccountingBankImportJob,
  AccountingBankImportJobsService,
} from './accounting-bank-import-jobs.service';

@Processor('accounting-bank-import')
export class AccountingBankImportProcessor extends WorkerHost {
  private readonly logger = new Logger(AccountingBankImportProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bankImportJobsService: AccountingBankImportJobsService,
    private readonly plansService: PlansService,
  ) {
    super();
  }

  async process(job: Job<AccountingBankImportJob, void>): Promise<void> {
    switch (job.name) {
      case 'importBankStatementChunked':
        return this.handleImportBankStatementChunked(job.data);
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleImportBankStatementChunked(
    input: AccountingBankImportJob,
  ) {
    if (
      await skipSuspendedTenantJob(
        this.plansService,
        input.actor.tenantId,
        this.logger,
        `bank statement import ${input.jobRecordId}`,
      )
    ) {
      await this.markFailed(input.jobRecordId, SUSPENDED_TENANT_MESSAGE);
      return;
    }

    try {
      await this.prisma.bankStatementImportJob.update({
        where: { id: input.jobRecordId },
        data: { status: 'RUNNING' },
      });
      await this.bankImportJobsService.completeQueuedBankStatementImport(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to process bank statement import job ${input.jobRecordId}: ${message}`,
        stack,
      );
      await this.markFailed(input.jobRecordId, message);
    }
  }

  private async markFailed(jobRecordId: string, message: string) {
    await this.prisma.bankStatementImportJob.update({
      where: { id: jobRecordId },
      data: {
        status: 'FAILED',
        errorSummary: message,
        completedAt: new Date(),
      },
    });
  }
}
