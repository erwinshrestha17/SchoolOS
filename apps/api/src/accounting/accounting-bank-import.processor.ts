import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { PlansService } from '../plans/plans.service';
import { runTenantScopedJob } from '../plans/processor-tenant.context';
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
    private readonly cls: ClsService,
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
    const completed = await runTenantScopedJob(
      this.cls,
      this.plansService,
      input.actor.tenantId,
      this.logger,
      `bank statement import ${input.jobRecordId}`,
      async () => {
        try {
          await this.prisma.bankStatementImportJob.update({
            where: { id: input.jobRecordId },
            data: { status: 'RUNNING' },
          });
          await this.bankImportJobsService.completeQueuedBankStatementImport(
            input,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          const stack = error instanceof Error ? error.stack : undefined;
          this.logger.error(
            `Failed to process bank statement import job ${input.jobRecordId}: ${message}`,
            stack,
          );
          await this.markFailed(input.jobRecordId, message);
        }

        return true;
      },
    );

    if (!completed) {
      await this.markFailed(input.jobRecordId, SUSPENDED_TENANT_MESSAGE);
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
