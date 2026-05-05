import {
  Body,
  Controller,
  Post,
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
      publicUrl: stored.publicUrl,
    };
  }
}
