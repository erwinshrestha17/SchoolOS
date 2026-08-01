import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { PlansService } from '../plans/plans.service';
import { runTenantScopedJob } from '../plans/processor-tenant.context';
import { SUSPENDED_TENANT_MESSAGE } from '../plans/tenant-access.constants';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';
import { AuthContext } from '../auth/auth.types';
import type { ReportFormat } from '@schoolos/core';

@Processor('reports')
export class ReportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportsService: ReportsService,
    private readonly plansService: PlansService,
    private readonly cls: ClsService,
  ) {
    super();
  }

  async process(
    job: Job<
      {
        exportId: string;
        reportKey: string;
        filters: Record<string, unknown>;
        format: ReportFormat;
        actor: AuthContext;
      },
      void
    >,
  ): Promise<void> {
    const { exportId, reportKey, filters, format, actor } = job.data;

    const completed = await runTenantScopedJob(
      this.cls,
      this.plansService,
      actor.tenantId,
      this.logger,
      `report export ${reportKey}`,
      async () => {
        this.logger.log(`Processing report ${reportKey} for export ${exportId}`);

        try {
          await this.prisma.reportExport.update({
            where: { id: exportId },
            data: { status: 'RUNNING' },
          });

          await this.reportsService.completeQueuedExport({
            exportId,
            reportKey,
            filters,
            format,
            actor,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          const stack = error instanceof Error ? error.stack : undefined;
          this.logger.error(
            `Failed to process report ${reportKey}: ${message}`,
            stack,
          );
          await this.prisma.reportExport.update({
            where: { id: exportId },
            data: {
              status: 'FAILED',
              errorSummary: 'Report generation failed',
              failureDetail:
                'The report could not be generated. Retry the export or contact an authorized school administrator.',
              completedAt: new Date(),
            },
          });
        }

        return true;
      },
    );

    if (!completed) {
      await this.prisma.reportExport.update({
        where: { id: exportId },
        data: {
          status: 'FAILED',
          errorSummary: SUSPENDED_TENANT_MESSAGE,
          failureDetail: SUSPENDED_TENANT_MESSAGE,
          completedAt: new Date(),
        },
      });
    }
  }
}
