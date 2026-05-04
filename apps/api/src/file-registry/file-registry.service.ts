import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { FileStatus, Prisma } from '@prisma/client';

@Injectable()
export class FileRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
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
    return this.prisma.fileAsset.create({
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
        status: (FileStatus?.UPLOADED || 'UPLOADED') as FileStatus,
      },
    });
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
        status: (FileStatus?.DELETED || 'DELETED') as FileStatus,
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

    // Placeholder for actual S3/R2 signed URL generation
    // For now, return a simulated URL if it's not local, or the publicUrl
    return asset.objectKey.startsWith('http')
      ? asset.objectKey
      : `https://storage.schoolos.cloud/${asset.objectKey}?token=simulated-jwt-for-${assetId}`;
  }

  private get apiBaseUrl() {
    const configuredBaseUrl = process.env.API_PUBLIC_BASE_URL?.trim();

    if (configuredBaseUrl) {
      return configuredBaseUrl.replace(/\/$/, '');
    }

    return `http://localhost:${this.configService.port}/api/v1`;
  }
}
