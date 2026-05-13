import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { FileRegistryService } from './file-registry.service';
import { StorageService } from '../storage/storage.service';
import { IsNotEmpty, IsString } from 'class-validator';

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
const MODULE_UPLOAD_PERMISSIONS: Record<string, string[]> = {
  activity: ['activity_feed:create'],
  homework: ['homework:create', 'homework:update'],
  'homework-submission': ['homework:submit'],
  reports: ['reports:export'],
  students: ['student_documents:manage'],
};

@Controller('files')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class FileRegistryController {
  constructor(
    private readonly fileRegistryService: FileRegistryService,
    private readonly storageService: StorageService,
  ) {}

  @Post('upload')
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
      module: dto.module,
    });

    return {
      id: asset.id,
      fileName: asset.originalFilename,
      publicUrl: null,
      protectedUrl: await this.fileRegistryService.getSignedUrl(
        auth.tenantId,
        asset.id,
      ),
    };
  }

  @Get(':id/view')
  async getFileView(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    const asset = await this.fileRegistryService.getFileMetadata(
      auth.tenantId,
      id,
    );
    const url = await this.fileRegistryService.getSignedUrl(auth.tenantId, id);

    return {
      id: asset.id,
      fileName: asset.originalFilename,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      url,
    };
  }

  private validateUpload(dto: UploadFileDto) {
    if (!SAFE_MIME_TYPES.has(dto.contentType)) {
      throw new BadRequestException('Unsupported file type');
    }
    if (DANGEROUS_EXTENSIONS.test(dto.fileName)) {
      throw new BadRequestException('Dangerous file extension rejected');
    }
    const sizeBytes = Buffer.byteLength(dto.base64Content, 'base64');
    if (sizeBytes > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('File exceeds upload size limit');
    }
  }

  private validateModulePermission(moduleName: string, permissions: string[]) {
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
