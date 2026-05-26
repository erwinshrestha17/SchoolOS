import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '../config/config.service';
import { StorageService } from '../storage/storage.service';
import {
  FileStatus,
  FileVisibility,
  Prisma,
  StorageProvider,
} from '@prisma/client';
import { UsageService } from '../usage/usage.service';
import type { AuthContext } from '../auth/auth.types';
import {
  getParentStudentIds,
  getStudentOwnId,
  isParentOnly,
} from '../common/security/parent-scope';
import { MAX_SIGNED_URL_TTL_SECONDS } from '../storage/storage.types';

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
    provider?: StorageProvider;
    bucket?: string | null;
    checksumSha256?: string | null;
    ownerType?: string | null;
    ownerId?: string | null;
    visibility?: FileVisibility;
    metadata?: Prisma.InputJsonValue;
  }) {
    await this.usageService.checkLimit(
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
        storageProvider: input.provider ?? this.currentStorageProvider(),
        bucket: input.bucket ?? this.currentStorageBucket(),
        checksumSha256: input.checksumSha256 ?? null,
        ownerType: input.ownerType ?? input.module ?? 'file_registry',
        ownerId: input.ownerId ?? input.entityId ?? null,
        visibility: input.visibility ?? FileVisibility.PRIVATE,
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

  async registerGeneratedFile(input: {
    tenantId: string;
    generatedByUserId: string;
    originalFilename: string;
    content: Buffer;
    mimeType: string;
    module: string;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    const stored = await this.storageService.saveBufferObject({
      tenantId: input.tenantId,
      prefix: input.module,
      fileName: input.originalFilename,
      contentType: input.mimeType,
      content: input.content,
    });

    const asset = await this.registerFile({
      tenantId: input.tenantId,
      uploadedByUserId: input.generatedByUserId,
      originalFilename: input.originalFilename,
      objectKey: stored.objectKey,
      mimeType: input.mimeType,
      sizeBytes: stored.sizeBytes,
      provider: stored.provider,
      bucket: stored.bucket,
      checksumSha256: stored.checksumSha256,
      module: input.module,
      entityId: input.entityId,
      metadata: input.metadata,
    });

    return this.markUploaded(input.tenantId, asset.id, input.generatedByUserId);
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

    if (!asset || asset.softDeletedAt || asset.deletedAt) {
      throw new NotFoundException('File not found');
    }

    if (asset.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied');
    }

    return asset;
  }

  async assertFileAccessForAuth(
    asset: Awaited<ReturnType<FileRegistryService['getFileMetadata']>>,
    auth: AuthContext,
  ) {
    if (asset.tenantId !== auth.tenantId) {
      throw new ForbiddenException('Access denied');
    }

    if (asset.visibility === FileVisibility.OWNER) {
      await this.assertOwnerScopedAccess(asset, auth);
      return;
    }

    if (asset.module === 'notices' || asset.module === 'notice-delivery') {
      if (!auth.permissions.includes('notices:read')) {
        throw new ForbiddenException(
          'You do not have permission to view this notice file',
        );
      }
      return;
    }

    if (asset.module === 'messages') {
      if (!auth.permissions.includes('messaging:read')) {
        throw new ForbiddenException(
          'You do not have permission to view this message file',
        );
      }
      return;
    }

    if (asset.module === 'parent-teacher-chat') {
      await this.assertParentTeacherChatFileAccess(asset.entityId, auth);
      return;
    }

    if (asset.module === 'students') {
      await this.assertStudentFileAccess(asset.entityId, auth);
      return;
    }

    const requiredPermissions = FILE_READ_PERMISSIONS[asset.module ?? ''];
    if (requiredPermissions) {
      if (
        !requiredPermissions.some((permission) =>
          auth.permissions.includes(permission),
        )
      ) {
        throw new ForbiddenException(
          'You do not have permission to view this file',
        );
      }
      return;
    }

    if (asset.uploadedByUserId && asset.uploadedByUserId === auth.userId) {
      return;
    }

    if (auth.roles.some((role) => TENANT_FILE_ADMIN_ROLES.includes(role))) {
      return;
    }

    throw new ForbiddenException(
      'You do not have permission to view this file',
    );
  }

  async softDeleteFile(tenantId: string, assetId: string, userId: string) {
    const asset = await this.getFileMetadata(tenantId, assetId);

    await this.prisma.fileAsset.update({
      where: { id: assetId },
      data: {
        status: FileStatus?.DELETED || 'DELETED',
        softDeletedAt: new Date(),
        deletedAt: new Date(),
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

  async createSignedPreviewUrl(auth: AuthContext, assetId: string) {
    return this.createSignedFileUrl(auth, assetId, 'preview');
  }

  async createSignedDownloadUrl(auth: AuthContext, assetId: string) {
    return this.createSignedFileUrl(auth, assetId, 'download');
  }

  async getProtectedDownload(
    tenantId: string,
    assetId: string,
    userId: string,
  ) {
    const asset = await this.getFileMetadata(tenantId, assetId);
    await this.auditAccess(tenantId, assetId, userId, 'download');

    return {
      asset,
      content: await this.storageService.getObjectBuffer(asset.objectKey),
    };
  }

  private async assertParentTeacherChatFileAccess(
    threadId: string | null,
    auth: AuthContext,
  ) {
    if (!threadId) {
      throw new ForbiddenException('Chat attachment is not linked to a thread');
    }

    if (
      auth.roles.some((role) =>
        ['platform_super_admin', 'admin', 'principal'].includes(role),
      )
    ) {
      return;
    }

    const thread = await this.prisma.parentTeacherThread.findFirst({
      where: { id: threadId, tenantId: auth.tenantId },
      select: { guardianId: true, classTeacherId: true },
    });

    if (!thread) {
      throw new ForbiddenException('Chat attachment thread is unavailable');
    }

    if (isParentOnly(auth)) {
      const guardian = await this.prisma.guardian.findFirst({
        where: { tenantId: auth.tenantId, userId: auth.userId },
        select: { id: true },
      });
      if (guardian?.id === thread.guardianId) return;
    }

    if (
      auth.roles.some((role) => ['teacher', 'subject_teacher'].includes(role))
    ) {
      const staff = await this.prisma.staff.findFirst({
        where: { tenantId: auth.tenantId, userId: auth.userId },
        select: { id: true },
      });
      if (staff?.id === thread.classTeacherId) return;
    }

    throw new ForbiddenException('You cannot access this chat attachment');
  }

  private async createSignedFileUrl(
    auth: AuthContext,
    assetId: string,
    action: 'preview' | 'download',
  ) {
    const asset = await this.getFileMetadata(auth.tenantId, assetId);
    await this.assertFileAccessForAuth(asset, auth);

    const expiresInSeconds = this.signedReadUrlTtlSeconds();
    const url = await this.storageService.createSignedReadUrl({
      objectKey: asset.objectKey,
      expiresInSeconds,
    });

    await this.auditAccess(auth.tenantId, asset.id, auth.userId, action);

    return {
      id: asset.id,
      fileName: asset.originalFilename,
      mimeType: asset.mimeType,
      sizeBytes: Number(asset.sizeBytes),
      url,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      expiresInSeconds,
    };
  }

  private async assertOwnerScopedAccess(
    asset: Awaited<ReturnType<FileRegistryService['getFileMetadata']>>,
    auth: AuthContext,
  ) {
    if (!asset.ownerType || !asset.ownerId) {
      throw new ForbiddenException('This file is missing owner information');
    }

    if (asset.ownerType === 'student' || asset.ownerType === 'students') {
      await this.assertStudentFileAccess(asset.ownerId, auth);
      return;
    }

    if (asset.uploadedByUserId === auth.userId) {
      return;
    }

    throw new ForbiddenException(
      'You do not have permission to view this file',
    );
  }

  private async assertStudentFileAccess(
    studentId: string | null,
    auth: AuthContext,
  ) {
    if (!studentId) {
      throw new ForbiddenException('Student file is not linked to a student');
    }

    const parentStudentIds = await getParentStudentIds(this.prisma, auth);
    if (parentStudentIds !== null) {
      if (parentStudentIds.includes(studentId)) return;
      throw new ForbiddenException(
        'You can only view files for your linked child',
      );
    }

    const studentOwnId = await getStudentOwnId(this.prisma, auth);
    if (studentOwnId !== null) {
      if (studentOwnId === studentId) return;
      throw new ForbiddenException('You can only view your own student files');
    }

    if (
      auth.permissions.includes('student_documents:manage') ||
      auth.permissions.includes('students:read')
    ) {
      return;
    }

    throw new ForbiddenException(
      'You do not have permission to view student files',
    );
  }

  private currentStorageProvider(): StorageProvider {
    const provider = this.configService.storageProvider;

    switch (provider) {
      case 's3':
        return StorageProvider.S3;
      case 'r2':
        return StorageProvider.R2;
      case 'minio':
        return StorageProvider.MINIO;
      case 'gcp':
        return StorageProvider.GCP;
      case 'local':
      default:
        return StorageProvider.LOCAL;
    }
  }

  private currentStorageBucket() {
    const config = this.configService.storageConfig;
    if (!config) {
      return null;
    }
    return 'bucket' in config ? config.bucket : null;
  }

  private signedReadUrlTtlSeconds() {
    const config = this.configService.storageConfig;
    if (!config) {
      return 300;
    }

    return Math.min(config.signedReadUrlTtlSeconds, MAX_SIGNED_URL_TTL_SECONDS);
  }

  private get apiBaseUrl() {
    const configuredBaseUrl = process.env.API_PUBLIC_BASE_URL?.trim();

    if (configuredBaseUrl) {
      return configuredBaseUrl.replace(/\/$/, '');
    }

    return `http://localhost:${this.configService.port}/api/v1`;
  }
}

const TENANT_FILE_ADMIN_ROLES = ['platform_super_admin', 'admin', 'principal'];

const FILE_READ_PERMISSIONS: Record<string, string[]> = {
  activity: ['activity_feed:read'],
  homework: ['homework:read', 'homework:create', 'homework:update'],
  'homework-submission': ['homework:read', 'homework:submit'],
  attendance: ['attendance:read', 'reports:read'],
  reports: ['reports:read', 'reports:export'],
  academics: ['academics:read', 'reports:read'],
  accounting: ['accounting:read', 'accounting:reports:read'],
  finance: ['fees:manage', 'receipts:read', 'receipts:manage'],
  admissions: ['admissions:read'],
  settings: ['settings:read'],
};
