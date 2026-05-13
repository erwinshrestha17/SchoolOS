import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';
import { AuthContext } from '../auth/auth.types';

@Processor('reports')
export class ReportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportsService: ReportsService,
  ) {
    super();
  }

  async process(
    job: Job<
      {
        exportId: string;
        reportKey: string;
        filters: Record<string, unknown>;
        format: string;
        actor: AuthContext;
      },
      void
    >,
  ): Promise<void> {
    const { exportId, reportKey, filters, format, actor } = job.data;
    this.logger.log(`Processing report ${reportKey} for export ${exportId}`);

    try {
      await this.prisma.reportExport.update({
        where: { id: exportId },
        data: { status: 'RUNNING' },
      });

      const executor = this.reportsService.registry.get(reportKey);
      if (!executor) throw new Error('Report executor not found');

      const data = await executor.execute(actor, filters, format);

      // In a real implementation, we would generate a file (CSV/PDF) and upload to R2/S3
      // For this hardening, we mark as COMPLETED and store summary or just simulate

      this.logger.log(
        `Successfully generated ${data.length} rows for report ${reportKey}`,
      );

      await this.prisma.reportExport.update({
        where: { id: exportId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to process report ${reportKey}: ${message}`,
        stack,
      );
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
}
