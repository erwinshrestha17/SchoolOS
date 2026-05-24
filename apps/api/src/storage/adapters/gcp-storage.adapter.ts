import { GcpStorageConfig } from '../storage.config';
import {
  PutObjectInput,
  SignedUrlInput,
  SignedUploadResult,
  StorageAdapter,
  StorageReadinessResult,
  StoredObjectResult,
} from '../storage.types';

export class GcpStorageAdapter implements StorageAdapter {
  constructor(private readonly config: GcpStorageConfig) {}

  async putObject(_input: PutObjectInput): Promise<StoredObjectResult> {
    throw this.notImplemented();
  }

  async getObjectBuffer(_objectKey: string): Promise<Buffer> {
    throw this.notImplemented();
  }

  async deleteObject(_objectKey: string): Promise<void> {
    throw this.notImplemented();
  }

  async createSignedReadUrl(_input: SignedUrlInput): Promise<string> {
    throw this.notImplemented();
  }

  async createSignedUploadUrl(
    _input: SignedUrlInput,
  ): Promise<SignedUploadResult> {
    throw this.notImplemented();
  }

  async checkReadiness(): Promise<boolean> {
    throw this.notImplemented();
  }

  async testConnection(): Promise<StorageReadinessResult> {
    throw this.notImplemented();
  }

  private notImplemented() {
    return new Error(
      `Storage provider ${this.config.provider} is configured but its adapter is not enabled yet`,
    );
  }
}
