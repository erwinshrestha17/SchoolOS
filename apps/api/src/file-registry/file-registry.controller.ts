import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
  Get,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantActiveGuard } from '../auth/guards/tenant-active.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { FileRegistryService } from './file-registry.service';
import { StorageService } from '../storage/storage.service';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

class UploadFileDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @IsString()
  @IsNotEmpty()
  base64Content!: string;

  @IsString()
  @IsNotEmpty()
  module!: string;

  @IsOptional()
  @IsString()
  entityId?: string;
}

class CreateSignedUploadDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @IsString()
  @IsNotEmpty()
  module!: string;

  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  sizeBytes!: number;

  @IsOptional()
  @IsString()
  entityId?: string;
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SAFE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const DANGEROUS_EXTENSIONS = /\.(exe|bat|cmd|com|scr|js|mjs|sh|ps1|php|jar)$/i;
const DEFERRED_CHAT_UPLOAD_MODULES = new Set([
  'messages',
  'parent-teacher-chat',
]);
const MODULE_UPLOAD_PERMISSIONS: Record<string, string[]> = {
  activity: ['activity_feed:create'],
  admissions: ['student_documents:manage'],
  homework: ['homework:create', 'homework:update'],
  'homework-submission': ['homework:submit'],
  reports: ['reports:export'],
  students: ['student_documents:manage'],
  notices: ['notices:create'],
  'notice-delivery': ['notices:create', 'communications:retry_deliveries'],
  messages: ['messaging:create'],
  'parent-teacher-chat': ['messaging:create'],
};

@Controller('files')
@UseGuards(JwtAuthGuard, TenantActiveGuard, RolesPermissionsGuard)
export class FileRegistryController {
  constructor(
    private readonly fileRegistryService: FileRegistryService,
    private readonly storageService: StorageService,
  ) {}

  @Post('upload')
  @Permissions()
  async uploadFile(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: UploadFileDto,
  ) {
    this.validateUpload(dto);
    this.validateModulePermission(dto.module, auth.permissions);

    const stored = await this.storageService.saveBase64Object({
      tenantId: auth.tenantId,
      prefix: dto.module,
      fileName: dto.fileName,
      contentType: dto.contentType,
      base64Content: dto.base64Content,
    });

    const asset = await this.fileRegistryService.registerFile({
      tenantId: auth.tenantId,
      uploadedByUserId: auth.userId,
      originalFilename: dto.fileName,
      objectKey: stored.objectKey,
      mimeType: dto.contentType,
      sizeBytes: stored.sizeBytes,
      provider: stored.provider,
      bucket: stored.bucket,
      checksumSha256: stored.checksumSha256,
      module: dto.module,
      entityId: dto.entityId,
    });
    const uploaded = await this.fileRegistryService.markUploaded(
      auth.tenantId,
      asset.id,
      auth.userId,
    );

    return {
      id: uploaded.id,
      fileName: uploaded.originalFilename,
      publicUrl: null,
      protectedUrl: await this.fileRegistryService.getSignedUrl(
        auth.tenantId,
        uploaded.id,
      ),
    };
  }

  @Post('signed-upload')
  @Permissions()
  async createSignedUpload(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: CreateSignedUploadDto,
  ) {
    this.validateUploadMetadata(dto);
    this.validateUploadSize(dto.sizeBytes);
    this.validateModulePermission(dto.module, auth.permissions);

    return this.fileRegistryService.createSignedUpload(auth, {
      fileName: dto.fileName,
      contentType: dto.contentType,
      module: dto.module,
      entityId: dto.entityId,
      sizeBytes: dto.sizeBytes,
    });
  }

  @Post(':id/complete-upload')
  @Permissions()
  async completeSignedUpload(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
  ) {
    return this.fileRegistryService.completeSignedUpload(auth, id);
  }

  @Get(':id/view')
  async getFileView(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    const asset = await this.fileRegistryService.getFileMetadata(
      auth.tenantId,
      id,
    );
    await this.fileRegistryService.assertFileAccessForAuth(asset, auth);
    const url = await this.fileRegistryService.getSignedUrl(auth.tenantId, id);

    return {
      id: asset.id,
      fileName: asset.originalFilename,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      url,
    };
  }

  @Get(':id/signed-preview')
  async getSignedPreview(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
  ) {
    return this.fileRegistryService.createSignedPreviewUrl(auth, id);
  }

  @Get(':id/signed-download')
  async getSignedDownload(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
  ) {
    return this.fileRegistryService.createSignedDownloadUrl(auth, id);
  }

  @Get(':id/preview')
  async previewFile(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const asset = await this.fileRegistryService.getFileMetadata(
      auth.tenantId,
      id,
    );
    await this.fileRegistryService.assertFileAccessForAuth(asset, auth);
    await this.fileRegistryService.auditAccess(
      auth.tenantId,
      id,
      auth.userId,
      'preview',
    );
    const content = await this.storageService.getObjectBuffer(asset.objectKey);

    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${asset.originalFilename.replace(/"/g, '')}"`,
    );
    return res.send(content);
  }

  @Get(':id/download')
  async downloadFile(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const asset = await this.fileRegistryService.getFileMetadata(
      auth.tenantId,
      id,
    );
    await this.fileRegistryService.assertFileAccessForAuth(asset, auth);
    await this.fileRegistryService.auditAccess(
      auth.tenantId,
      id,
      auth.userId,
      'download',
    );
    const content = await this.storageService.getObjectBuffer(asset.objectKey);

    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asset.originalFilename.replace(/"/g, '')}"`,
    );
    return res.send(content);
  }

  private validateUpload(dto: UploadFileDto) {
    this.validateUploadMetadata(dto);
    this.validateUploadSize(Buffer.byteLength(dto.base64Content, 'base64'));
  }

  private validateUploadMetadata(dto: {
    fileName: string;
    contentType: string;
  }) {
    if (!SAFE_MIME_TYPES.has(dto.contentType)) {
      throw new BadRequestException('Unsupported file type');
    }
    if (DANGEROUS_EXTENSIONS.test(dto.fileName)) {
      throw new BadRequestException('Dangerous file extension rejected');
    }
  }

  private validateUploadSize(sizeBytes: number) {
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      throw new BadRequestException('File size must be greater than zero');
    }
    if (sizeBytes > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('File exceeds upload size limit');
    }
  }

  private validateModulePermission(moduleName: string, permissions: string[]) {
    if (DEFERRED_CHAT_UPLOAD_MODULES.has(moduleName)) {
      throw new ForbiddenException(
        'New chat attachments are unavailable while chat is deferred',
      );
    }

    const requiredPermissions = MODULE_UPLOAD_PERMISSIONS[moduleName];

    if (!requiredPermissions) {
      throw new BadRequestException('Unsupported upload module');
    }

    if (
      !requiredPermissions.some((permission) =>
        permissions.includes(permission),
      )
    ) {
      throw new ForbiddenException(
        'Insufficient permissions for upload module',
      );
    }
  }
}
