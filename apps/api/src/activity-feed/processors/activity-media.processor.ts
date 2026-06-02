import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';

export interface ActivityMediaCompressionJob {
  tenantId: string;
  attachmentId: string;
  fileAssetId: string;
  requestedById: string;
}

const ACTIVITY_PREVIEW_MAX_EDGE_PX = 1280;
const ACTIVITY_PREVIEW_JPEG_QUALITY = 72;
const ACTIVITY_PREVIEW_WEBP_QUALITY = 72;

@Processor('activity-media')
export class ActivityMediaProcessor extends WorkerHost {
  private readonly logger = new Logger(ActivityMediaProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {
    super();
  }

  async process(job: Job<ActivityMediaCompressionJob>) {
    const { tenantId, attachmentId, fileAssetId } = job.data;

    const attachment = await this.prisma.activityAttachment.findFirst({
      where: { id: attachmentId, tenantId },
      include: { fileAsset: true },
    });

    if (!attachment?.fileAsset) {
      this.logger.warn(`Attachment ${attachmentId} not found, skipping.`);
      return;
    }

    await this.prisma.activityAttachment.update({
      where: { id: attachmentId },
      data: {
        processingStatus: 'PROCESSING',
      },
    });

    try {
      const originalBuffer = await this.storageService.getObjectBuffer(
        attachment.fileAsset.objectKey,
      );

      const optimizedBuffer = await this.buildOptimizedPreview(
        originalBuffer,
        attachment.contentType,
        attachmentId,
      );

      const optimizedResult = await this.storageService.saveBufferObject({
        tenantId,
        prefix: `activity-feed/optimized`,
        fileName: `optimized_${attachment.fileName}`,
        contentType: attachment.contentType,
        content: optimizedBuffer,
      });

      await this.prisma.activityAttachment.update({
        where: { id: attachmentId },
        data: {
          processingStatus: 'READY',
          optimizedObjectKey: optimizedResult.objectKey,
          optimizedSizeBytes: optimizedResult.sizeBytes,
        },
      });

      return {
        attachmentId,
        fileAssetId,
        status: 'READY',
        optimizedKey: optimizedResult.objectKey,
      };
    } catch (error) {
      await this.prisma.activityAttachment.update({
        where: { id: attachmentId },
        data: {
          processingStatus: 'FAILED',
        },
      });

      this.logger.error(
        `Activity media compression failed for attachment ${attachmentId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private async buildOptimizedPreview(
    originalBuffer: Buffer,
    contentType: string,
    attachmentId: string,
  ) {
    const normalizedType = contentType.toLowerCase();

    if (normalizedType === 'image/heic' || normalizedType === 'image/heif') {
      this.logger.warn(
        `Activity media ${attachmentId} is ${normalizedType}; keeping original bytes for preview until HEIC transcoding is enabled.`,
      );
      return originalBuffer;
    }

    try {
      const pipeline = sharp(originalBuffer, { failOn: 'none' })
        .rotate()
        .resize({
          width: ACTIVITY_PREVIEW_MAX_EDGE_PX,
          height: ACTIVITY_PREVIEW_MAX_EDGE_PX,
          fit: 'inside',
          withoutEnlargement: true,
        });

      const optimizedBuffer = await this.applyOutputFormat(
        pipeline,
        normalizedType,
      );

      if (optimizedBuffer.byteLength <= 0) {
        return originalBuffer;
      }

      return optimizedBuffer.byteLength < originalBuffer.byteLength
        ? optimizedBuffer
        : originalBuffer;
    } catch (error) {
      this.logger.warn(
        `Activity media ${attachmentId} could not be optimized; keeping original bytes for preview. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return originalBuffer;
    }
  }

  private applyOutputFormat(
    pipeline: sharp.Sharp,
    normalizedType: string,
  ): Promise<Buffer> {
    if (normalizedType === 'image/jpeg' || normalizedType === 'image/jpg') {
      return pipeline
        .jpeg({
          quality: ACTIVITY_PREVIEW_JPEG_QUALITY,
          mozjpeg: true,
        })
        .toBuffer();
    }

    if (normalizedType === 'image/png') {
      return pipeline
        .png({
          compressionLevel: 9,
          adaptiveFiltering: true,
          effort: 7,
        })
        .toBuffer();
    }

    if (normalizedType === 'image/webp') {
      return pipeline
        .webp({
          quality: ACTIVITY_PREVIEW_WEBP_QUALITY,
          effort: 4,
        })
        .toBuffer();
    }

    return Promise.resolve(Buffer.alloc(0));
  }
}
