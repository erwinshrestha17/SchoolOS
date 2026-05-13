import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { StorageService } from '../storage/storage.service';
import { FileStatus, Prisma } from '@prisma/client';
import { UsageService } from '../usage/usage.service';

@Injectable()
export class FileRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
    private readonly usageService: UsageService,
  ) {}

  async registerFile(input: {
    tenantId: string;
    uploadedByUserId: string;
    originalFilename: string;
    objectKey: string;
    mimeType: string;
    sizeBytes: number;
    module?: string;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    await this.usageService.verifyLimit(
      input.tenantId,
      'storage.bytes',
      input.sizeBytes,
    );
    await this.storageService.checkReadiness();

    const asset = await this.prisma.fileAsset.create({
      data: {
        tenantId: input.tenantId,
        uploadedByUserId: input.uploadedByUserId,
        originalFilename: input.originalFilename,
        objectKey: input.objectKey,
        mimeType: input.mimeType,
        sizeBytes: BigInt(input.sizeBytes),
        module: input.module,
        entityId: input.entityId,
        metadata: input.metadata || {},
        status: FileStatus.PENDING,
      },
    });

    await this.usageService.incrementUsage(
      input.tenantId,
      'storage.bytes',
      input.sizeBytes,
    );

    await this.auditService.record({
      action: 'file_registered',
      resource: 'file_registry',
      resourceId: asset.id,
      tenantId: input.tenantId,
      userId: input.uploadedByUserId,
      after: { objectKey: input.objectKey, filename: input.originalFilename },
    });

    return asset;
  }

  async markUploaded(tenantId: string, assetId: string, userId: string) {
    const asset = await this.getFileMetadata(tenantId, assetId);

    if (asset.status === FileStatus.UPLOADED) {
      return asset;
    }

    const updated = await this.prisma.fileAsset.update({
      where: { id: assetId },
      data: { status: FileStatus.UPLOADED },
    });

    await this.auditService.record({
      action: 'file_uploaded',
      resource: 'file_registry',
      resourceId: assetId,
      tenantId,
      userId,
    });

    return updated;
  }

  async linkToEntity(
    tenantId: string,
    assetId: string,
    module: string,
    entityId: string,
    userId: string,
  ) {
    const asset = await this.getFileMetadata(tenantId, assetId);

    const updated = await this.prisma.fileAsset.update({
      where: { id: assetId },
      data: { module, entityId },
    });

    await this.auditService.record({
      action: 'file_linked',
      resource: 'file_registry',
      resourceId: assetId,
      tenantId,
      userId,
      after: { module, entityId },
    });

    return updated;
  }

  async getFileMetadata(tenantId: string, assetId: string) {
    const asset = await this.prisma.fileAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset || asset.softDeletedAt) {
      throw new NotFoundException('File not found');
    }

    if (asset.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied');
    }

    return asset;
  }

  async softDeleteFile(tenantId: string, assetId: string, userId: string) {
    const asset = await this.getFileMetadata(tenantId, assetId);

    await this.prisma.fileAsset.update({
      where: { id: assetId },
      data: {
        status: FileStatus?.DELETED || 'DELETED',
        softDeletedAt: new Date(),
      },
    });

    await this.auditService.record({
      action: 'file_deleted',
      resource: 'file_registry',
      resourceId: assetId,
      tenantId,
      userId,
      after: { objectKey: asset.objectKey, filename: asset.originalFilename },
    });
  }

  async auditAccess(
    tenantId: string,
    assetId: string,
    userId: string,
    action: 'preview' | 'download',
  ) {
    await this.auditService.record({
      action: `file_${action}`,
      resource: 'file_registry',
      resourceId: assetId,
      tenantId,
      userId,
    });
  }

  async listFilesByEntity(tenantId: string, module: string, entityId: string) {
    return this.prisma.fileAsset.findMany({
      where: {
        tenantId,
        module,
        entityId,
        softDeletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSignedUrl(tenantId: string, assetId: string) {
    const asset = await this.getFileMetadata(tenantId, assetId);

    if (asset.module === 'students' && asset.entityId) {
      const metadata = asset.metadata as Prisma.JsonObject | null;
      if (metadata?.kind === 'PHOTO') {
        return `${this.apiBaseUrl}/students/${encodeURIComponent(
          asset.entityId,
        )}/photo/preview`;
      }
    }

    if (asset.module === 'activity') {
      const attachment = await this.prisma.activityAttachment.findFirst({
        where: {
          tenantId,
          fileAssetId: asset.id,
        },
        select: { id: true },
      });

      if (attachment) {
        return `${this.apiBaseUrl}/activity-feed/attachments/${encodeURIComponent(attachment.id)}/preview`;
      }
    }

    return `${this.apiBaseUrl}/files/${encodeURIComponent(asset.id)}/preview`;
  }

  private get apiBaseUrl() {
    const configuredBaseUrl = process.env.API_PUBLIC_BASE_URL?.trim();

    if (configuredBaseUrl) {
      return configuredBaseUrl.replace(/\/$/, '');
    }

    return `http://localhost:${this.configService.port}/api/v1`;
  }
}
