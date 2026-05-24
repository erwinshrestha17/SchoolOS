import { Injectable } from '@nestjs/common';
import { StorageProvider } from '@prisma/client';
import { ConfigService } from '../config/config.service';
import { GcpStorageAdapter } from './adapters/gcp-storage.adapter';
import { LocalStorageAdapter } from './adapters/local-storage.adapter';
import { S3CompatibleStorageAdapter } from './adapters/s3-compatible-storage.adapter';
import { SchoolOSStorageConfig } from './storage.config';
import {
  SignedUrlInput,
  StorageAdapter,
  StoredObjectResult,
} from './storage.types';

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
    const stored = await this.adapter.putObject(input);

    return {
      ...stored,
      provider: toPrismaStorageProvider(stored.provider),
    };
  }

  async getObjectBuffer(objectKey: string) {
    return this.adapter.getObjectBuffer(objectKey);
  }

  async deleteObject(objectKey: string) {
    await this.adapter.deleteObject(objectKey);
  }

  async createSignedReadUrl(input: SignedUrlInput) {
    return this.adapter.createSignedReadUrl(input);
  }

  async createSignedUploadUrl(input: SignedUrlInput) {
    return this.adapter.createSignedUploadUrl(input);
  }

  async checkReadiness() {
    return this.adapter.checkReadiness();
  }

  async testConnection() {
    return this.adapter.testConnection();
  }

  private get adapter(): StorageAdapter {
    return createStorageAdapter(this.configService.storageConfig);
  }
}

function createStorageAdapter(config: SchoolOSStorageConfig): StorageAdapter {
  switch (config.provider) {
    case 'local':
      return new LocalStorageAdapter(config);
    case 's3':
    case 'r2':
    case 'minio':
      return new S3CompatibleStorageAdapter(config);
    case 'gcp':
      return new GcpStorageAdapter(config);
  }
}

function toPrismaStorageProvider(
  provider: StoredObjectResult['provider'],
): StorageProvider {
  switch (provider) {
    case 'local':
      return StorageProvider.LOCAL;
    case 'r2':
      return StorageProvider.R2;
    case 's3':
      return StorageProvider.S3;
    case 'minio':
      return StorageProvider.MINIO;
    case 'gcp':
      return StorageProvider.GCP;
  }
}
