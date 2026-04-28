import { Injectable } from '@nestjs/common';
import { StorageProvider } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join, posix } from 'path';
import { ConfigService } from '../config/config.service';

@Injectable()
export class StorageService {
  constructor(private readonly configService: ConfigService) {}

  async saveBase64Object(input: {
    tenantId: string;
    prefix: string;
    fileName: string;
    contentType: string;
    base64Content: string;
  }) {
    return this.saveBufferObject({
      tenantId: input.tenantId,
      prefix: input.prefix,
      fileName: input.fileName,
      contentType: input.contentType,
      content: Buffer.from(input.base64Content, 'base64'),
    });
  }

  async saveBufferObject(input: {
    tenantId: string;
    prefix: string;
    fileName: string;
    contentType: string;
    content: Buffer;
  }) {
    const extension = getExtension(input.fileName);
    const objectKey = posix.join(
      sanitizeSegment(input.tenantId),
      sanitizeSegment(input.prefix),
      `${randomUUID()}${extension}`,
    );

    if (this.configService.storageProvider === 'r2') {
      return {
        provider: StorageProvider.R2,
        objectKey,
        publicUrl: this.configService.r2PublicBaseUrl
          ? `${this.configService.r2PublicBaseUrl.replace(/\/$/, '')}/${objectKey}`
          : null,
        sizeBytes: input.content.byteLength,
      };
    }

    const localRoot = this.configService.localStorageRoot;
    const absolutePath = join(process.cwd(), localRoot, objectKey);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.content);

    return {
      provider: StorageProvider.LOCAL,
      objectKey,
      publicUrl: `${this.configService.localStoragePublicBaseUrl.replace(/\/$/, '')}/${objectKey}`,
      sizeBytes: input.content.byteLength,
    };
  }
}

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function getExtension(fileName: string) {
  const match = fileName.match(/\.[a-zA-Z0-9]+$/);

  return match?.[0]?.toLowerCase() ?? '';
}
