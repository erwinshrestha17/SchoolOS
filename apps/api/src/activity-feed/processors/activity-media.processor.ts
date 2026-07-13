import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import sharp from 'sharp';
import { FileRegistryService } from '../../file-registry/file-registry.service';
import { PlansService } from '../../plans/plans.service';
import { skipSuspendedTenantJob } from '../../plans/processor-tenant.guard';
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
const ACTIVITY_THUMBNAIL_EDGE_PX = 256;
const ACTIVITY_THUMBNAIL_WEBP_QUALITY = 68;
const ACTIVITY_THUMBNAIL_VARIANT = 'thumbnail-256';

@Processor('activity-media')
export class ActivityMediaProcessor extends WorkerHost {
  private readonly logger = new Logger(ActivityMediaProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly plansService: PlansService,
    private readonly fileRegistryService: FileRegistryService,
  ) {
    super();
  }

  async process(job: Job<ActivityMediaCompressionJob>) {
    const { tenantId, attachmentId, fileAssetId } = job.data;

    if (
      await skipSuspendedTenantJob(
        this.plansService,
        tenantId,
        this.logger,
        'activity media compression',
      )
    ) {
      return;
    }

    const attachment = await this.prisma.activityAttachment.findFirst({
      where: { id: attachmentId, tenantId },
      include: { fileAsset: true, thumbnailFileAsset: true },
    });

    if (
      !attachment?.fileAsset ||
      attachment.fileAsset.tenantId !== tenantId ||
      attachment.fileAsset.id !== fileAssetId
    ) {
      this.logger.warn(`Attachment ${attachmentId} not found, skipping.`);
      return;
    }

    if (
      this.isValidThumbnailVariant(
        attachment.thumbnailFileAsset,
        tenantId,
        attachmentId,
        fileAssetId,
      )
    ) {
      await this.prisma.activityAttachment.update({
        where: { id: attachmentId },
        data: { processingStatus: 'READY' },
      });
      return {
        attachmentId,
        fileAssetId,
        thumbnailFileAssetId: attachment.thumbnailFileAsset.id,
        status: 'READY',
      };
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

      const thumbnailBuffer = await this.buildThumbnail(originalBuffer);
      const thumbnailFileAsset = await this.findOrCreateThumbnailVariant({
        tenantId,
        attachmentId,
        fileAssetId,
        requestedById: job.data.requestedById,
        originalFileName: attachment.fileName,
        content: thumbnailBuffer,
      });

      await this.prisma.activityAttachment.update({
        where: { id: attachmentId },
        data: {
          processingStatus: 'READY',
          optimizedObjectKey: optimizedResult.objectKey,
          optimizedSizeBytes: optimizedResult.sizeBytes,
          thumbnailFileAssetId: thumbnailFileAsset.id,
        },
      });

      return {
        attachmentId,
        fileAssetId,
        status: 'READY',
        optimizedKey: optimizedResult.objectKey,
        thumbnailFileAssetId: thumbnailFileAsset.id,
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

  private buildThumbnail(originalBuffer: Buffer) {
    return sharp(originalBuffer, { failOn: 'none' })
      .rotate()
      .resize({
        width: ACTIVITY_THUMBNAIL_EDGE_PX,
        height: ACTIVITY_THUMBNAIL_EDGE_PX,
        fit: 'cover',
        position: 'attention',
        withoutEnlargement: true,
      })
      .webp({ quality: ACTIVITY_THUMBNAIL_WEBP_QUALITY, effort: 4 })
      .toBuffer();
  }

  private async findOrCreateThumbnailVariant(input: {
    tenantId: string;
    attachmentId: string;
    fileAssetId: string;
    requestedById: string;
    originalFileName: string;
    content: Buffer;
  }) {
    const existing = (
      await this.fileRegistryService.listFilesByEntity(
        input.tenantId,
        'activity',
        input.attachmentId,
      )
    ).find((asset) =>
      this.isValidThumbnailVariant(
        asset,
        input.tenantId,
        input.attachmentId,
        input.fileAssetId,
      ),
    );

    if (existing) {
      return existing;
    }

    const stem = input.originalFileName.replace(/\.[^.]+$/, '') || 'activity';
    return this.fileRegistryService.registerGeneratedFile({
      tenantId: input.tenantId,
      generatedByUserId: input.requestedById,
      originalFilename: `${stem}-${ACTIVITY_THUMBNAIL_VARIANT}.webp`,
      content: input.content,
      mimeType: 'image/webp',
      module: 'activity',
      entityId: input.attachmentId,
      metadata: {
        variant: ACTIVITY_THUMBNAIL_VARIANT,
        sourceFileAssetId: input.fileAssetId,
        activityAttachmentId: input.attachmentId,
      },
    });
  }

  private isValidThumbnailVariant(
    asset: {
      id: string;
      tenantId: string;
      module: string | null;
      entityId: string | null;
      status: string;
      metadata: unknown;
    } | null,
    tenantId: string,
    attachmentId: string,
    sourceFileAssetId: string,
  ): asset is NonNullable<typeof asset> {
    if (
      !asset ||
      asset.tenantId !== tenantId ||
      asset.module !== 'activity' ||
      asset.entityId !== attachmentId ||
      asset.status !== 'UPLOADED' ||
      !asset.metadata ||
      typeof asset.metadata !== 'object' ||
      Array.isArray(asset.metadata)
    ) {
      return false;
    }

    const metadata = asset.metadata as Record<string, unknown>;
    return (
      metadata.variant === ACTIVITY_THUMBNAIL_VARIANT &&
      metadata.sourceFileAssetId === sourceFileAssetId &&
      metadata.activityAttachmentId === attachmentId
    );
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
