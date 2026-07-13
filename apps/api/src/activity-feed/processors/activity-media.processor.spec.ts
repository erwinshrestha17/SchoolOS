import { StorageProvider } from '@prisma/client';
import { Job } from 'bullmq';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { FileRegistryService } from '../../file-registry/file-registry.service';
import { StorageService } from '../../storage/storage.service';
import {
  ActivityMediaCompressionJob,
  ActivityMediaProcessor,
} from './activity-media.processor';

interface PrismaMock {
  activityAttachment: {
    findFirst: jest.Mock<Promise<ActivityAttachmentRecord | null>, [unknown]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
  };
}

interface StorageMock {
  getObjectBuffer: jest.Mock<Promise<Buffer>, [string]>;
  saveBufferObject: jest.Mock<Promise<StorageSaveResult>, [SaveBufferInput]>;
}

interface SaveBufferInput {
  tenantId: string;
  prefix: string;
  fileName: string;
  contentType: string;
  content: Buffer;
}

interface StorageSaveResult {
  provider: StorageProvider;
  objectKey: string;
  publicUrl: string | null;
  sizeBytes: number;
}

interface ActivityAttachmentRecord {
  id: string;
  tenantId: string;
  fileName: string;
  contentType: string;
  fileAsset: {
    id: string;
    tenantId: string;
    objectKey: string;
  };
  thumbnailFileAsset: null;
}

describe('ActivityMediaProcessor', () => {
  const tenantId = 'tenant-activity';
  const attachmentId = 'attachment-1';
  const fileAssetId = 'file-asset-1';

  let prisma: PrismaMock;
  let storageService: StorageMock;
  let fileRegistryService: {
    listFilesByEntity: jest.Mock;
    registerGeneratedFile: jest.Mock;
  };
  let processor: ActivityMediaProcessor;

  beforeEach(() => {
    prisma = {
      activityAttachment: {
        findFirst: jest.fn<
          Promise<ActivityAttachmentRecord | null>,
          [unknown]
        >(),
        update: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
      },
    };

    storageService = {
      getObjectBuffer: jest.fn<Promise<Buffer>, [string]>(),
      saveBufferObject: jest.fn<
        Promise<StorageSaveResult>,
        [SaveBufferInput]
      >(),
    };
    const generatedAssets: Array<Record<string, unknown>> = [];
    fileRegistryService = {
      listFilesByEntity: jest.fn(async () => generatedAssets),
      registerGeneratedFile: jest.fn(async (input) => {
        const asset = {
          id: 'thumbnail-file-1',
          tenantId,
          module: input.module,
          entityId: input.entityId,
          status: 'UPLOADED',
          metadata: input.metadata,
        };
        generatedAssets.push(asset);
        return asset;
      }),
    };

    processor = new ActivityMediaProcessor(
      prisma as unknown as PrismaService,
      storageService as unknown as StorageService,
      {
        shouldProcessTenantJob: jest.fn().mockResolvedValue(true),
      } as never,
      fileRegistryService as unknown as FileRegistryService,
    );
  });

  it('creates a smaller bounded JPEG preview and marks the attachment ready', async () => {
    const originalBuffer = await createPatternJpeg(1800, 1200);
    prisma.activityAttachment.findFirst.mockResolvedValue(
      buildAttachment({ contentType: 'image/jpeg', fileName: 'classroom.jpg' }),
    );
    storageService.getObjectBuffer.mockResolvedValue(originalBuffer);
    storageService.saveBufferObject.mockImplementation(({ content }) =>
      Promise.resolve({
        provider: StorageProvider.LOCAL,
        objectKey: `${tenantId}/activity-feed/optimized/optimized_classroom.jpg`,
        publicUrl: null,
        sizeBytes: content.byteLength,
      }),
    );

    const result = await processor.process(buildJob());

    const savedInput = storageService.saveBufferObject.mock.calls[0][0];
    const metadata = await sharp(savedInput.content).metadata();
    const thumbnailInput =
      fileRegistryService.registerGeneratedFile.mock.calls[0][0];
    const thumbnailMetadata = await sharp(thumbnailInput.content).metadata();

    expect(savedInput).toEqual(
      expect.objectContaining({
        tenantId,
        prefix: 'activity-feed/optimized',
        fileName: 'optimized_classroom.jpg',
        contentType: 'image/jpeg',
      }),
    );
    expect(savedInput.content.byteLength).toBeLessThan(
      originalBuffer.byteLength,
    );
    expect(
      Math.max(metadata.width ?? 0, metadata.height ?? 0),
    ).toBeLessThanOrEqual(1280);
    expect(thumbnailInput).toEqual(
      expect.objectContaining({
        tenantId,
        generatedByUserId: 'teacher-1',
        originalFilename: 'classroom-thumbnail-256.webp',
        mimeType: 'image/webp',
        module: 'activity',
        entityId: attachmentId,
        metadata: {
          variant: 'thumbnail-256',
          sourceFileAssetId: fileAssetId,
          activityAttachmentId: attachmentId,
        },
      }),
    );
    expect(
      Math.max(thumbnailMetadata.width ?? 0, thumbnailMetadata.height ?? 0),
    ).toBeLessThanOrEqual(256);
    expect(prisma.activityAttachment.update).toHaveBeenCalledWith({
      where: { id: attachmentId },
      data: { processingStatus: 'PROCESSING' },
    });
    expect(prisma.activityAttachment.update).toHaveBeenCalledWith({
      where: { id: attachmentId },
      data: {
        processingStatus: 'READY',
        optimizedObjectKey: `${tenantId}/activity-feed/optimized/optimized_classroom.jpg`,
        optimizedSizeBytes: savedInput.content.byteLength,
        thumbnailFileAssetId: 'thumbnail-file-1',
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        attachmentId,
        fileAssetId,
        status: 'READY',
        optimizedKey: `${tenantId}/activity-feed/optimized/optimized_classroom.jpg`,
        thumbnailFileAssetId: 'thumbnail-file-1',
      }),
    );
  });

  it('keeps HEIC bytes private when transcoding support is unavailable', async () => {
    const heicBuffer = await createPatternJpeg(640, 480);
    prisma.activityAttachment.findFirst.mockResolvedValue(
      buildAttachment({
        contentType: 'image/heic',
        fileName: 'classroom.heic',
      }),
    );
    storageService.getObjectBuffer.mockResolvedValue(heicBuffer);
    storageService.saveBufferObject.mockImplementation(({ content }) =>
      Promise.resolve({
        provider: StorageProvider.LOCAL,
        objectKey: `${tenantId}/activity-feed/optimized/optimized_classroom.heic`,
        publicUrl: null,
        sizeBytes: content.byteLength,
      }),
    );

    await processor.process(buildJob());

    expect(storageService.saveBufferObject).toHaveBeenCalledWith(
      expect.objectContaining({
        content: heicBuffer,
        contentType: 'image/heic',
      }),
    );
    expect(prisma.activityAttachment.update).toHaveBeenLastCalledWith({
      where: { id: attachmentId },
      data: {
        processingStatus: 'READY',
        optimizedObjectKey: `${tenantId}/activity-feed/optimized/optimized_classroom.heic`,
        optimizedSizeBytes: heicBuffer.byteLength,
        thumbnailFileAssetId: 'thumbnail-file-1',
      },
    });
  });

  it('reuses the registered thumbnail variant on job retry', async () => {
    const originalBuffer = await createPatternJpeg(800, 600);
    prisma.activityAttachment.findFirst.mockResolvedValue(
      buildAttachment({ contentType: 'image/jpeg', fileName: 'retry.jpg' }),
    );
    storageService.getObjectBuffer.mockResolvedValue(originalBuffer);
    storageService.saveBufferObject.mockImplementation(({ content }) =>
      Promise.resolve({
        provider: StorageProvider.LOCAL,
        objectKey: `${tenantId}/activity-feed/optimized/retry.jpg`,
        publicUrl: null,
        sizeBytes: content.byteLength,
      }),
    );

    await processor.process(buildJob());
    await processor.process(buildJob());

    expect(fileRegistryService.registerGeneratedFile).toHaveBeenCalledTimes(1);
    expect(prisma.activityAttachment.update).toHaveBeenLastCalledWith({
      where: { id: attachmentId },
      data: expect.objectContaining({
        processingStatus: 'READY',
        thumbnailFileAssetId: 'thumbnail-file-1',
      }),
    });
  });

  it('marks the attachment failed when original media cannot be read', async () => {
    prisma.activityAttachment.findFirst.mockResolvedValue(
      buildAttachment({ contentType: 'image/jpeg', fileName: 'classroom.jpg' }),
    );
    storageService.getObjectBuffer.mockRejectedValue(new Error('storage down'));

    await expect(processor.process(buildJob())).rejects.toThrow('storage down');

    expect(storageService.saveBufferObject).not.toHaveBeenCalled();
    expect(prisma.activityAttachment.update).toHaveBeenCalledWith({
      where: { id: attachmentId },
      data: { processingStatus: 'PROCESSING' },
    });
    expect(prisma.activityAttachment.update).toHaveBeenLastCalledWith({
      where: { id: attachmentId },
      data: { processingStatus: 'FAILED' },
    });
  });

  function buildAttachment({
    contentType,
    fileName,
  }: {
    contentType: string;
    fileName: string;
  }): ActivityAttachmentRecord {
    return {
      id: attachmentId,
      tenantId,
      fileName,
      contentType,
      fileAsset: {
        id: fileAssetId,
        tenantId,
        objectKey: `${tenantId}/activity-feed/original/${fileName}`,
      },
      thumbnailFileAsset: null,
    };
  }

  function buildJob(): Job<ActivityMediaCompressionJob> {
    return {
      data: {
        tenantId,
        attachmentId,
        fileAssetId,
        requestedById: 'teacher-1',
      },
    } as Job<ActivityMediaCompressionJob>;
  }
});

async function createPatternJpeg(width: number, height: number) {
  const pixels = Buffer.alloc(width * height * 3);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 3;
      pixels[index] = (x + y) % 256;
      pixels[index + 1] = (x * 3) % 256;
      pixels[index + 2] = (y * 5) % 256;
    }
  }

  return sharp(pixels, {
    raw: {
      width,
      height,
      channels: 3,
    },
  })
    .jpeg({ quality: 100 })
    .toBuffer();
}
