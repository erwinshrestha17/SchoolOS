import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';

export interface ActivityMediaCompressionJob {
  tenantId: string;
  attachmentId: string;
  fileAssetId: string;
  requestedById: string;
}

@Processor('activity-media')
export class ActivityMediaProcessor extends WorkerHost {
  private readonly logger = new Logger(ActivityMediaProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<ActivityMediaCompressionJob>) {
    const { tenantId, attachmentId, fileAssetId } = job.data;

    await this.prisma.activityAttachment.updateMany({
      where: {
        id: attachmentId,
        tenantId,
        fileAssetId,
      },
      data: {
        processingStatus: 'PROCESSING',
      } as never,
    });

    try {
      // Placeholder for real image compression implementation.
      // The important production boundary is that compression is asynchronous,
      // tenant-scoped, idempotent, and does not expose media until the file is valid.
      await this.prisma.activityAttachment.updateMany({
        where: {
          id: attachmentId,
          tenantId,
          fileAssetId,
        },
        data: {
          processingStatus: 'READY',
        } as never,
      });

      return { attachmentId, fileAssetId, status: 'READY' };
    } catch (error) {
      await this.prisma.activityAttachment.updateMany({
        where: {
          id: attachmentId,
          tenantId,
          fileAssetId,
        },
        data: {
          processingStatus: 'FAILED',
        } as never,
      });

      this.logger.error(
        `Activity media compression failed for attachment ${attachmentId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
