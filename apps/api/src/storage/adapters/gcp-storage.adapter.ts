import { type GcpStorageConfig } from '../storage.config';
import {
  type PutObjectInput,
  type SignedUrlInput,
  type SignedUploadResult,
  type StorageAdapter,
  type StorageReadinessResult,
  type StoredObjectResult,
} from '../storage.types';

export class GcpStorageAdapter implements StorageAdapter {
  constructor(private readonly config: GcpStorageConfig) {}

  putObject(_input: PutObjectInput): Promise<StoredObjectResult> {
    return Promise.reject(this.notImplemented());
  }

  getObjectBuffer(_objectKey: string): Promise<Buffer> {
    return Promise.reject(this.notImplemented());
  }

  deleteObject(_objectKey: string): Promise<void> {
    return Promise.reject(this.notImplemented());
  }

  createSignedReadUrl(_input: SignedUrlInput): Promise<string> {
    return Promise.reject(this.notImplemented());
  }

  createSignedUploadUrl(_input: SignedUrlInput): Promise<SignedUploadResult> {
    return Promise.reject(this.notImplemented());
  }

  checkReadiness(): Promise<boolean> {
    return Promise.reject(this.notImplemented());
  }

  testConnection(): Promise<StorageReadinessResult> {
    return Promise.reject(this.notImplemented());
  }

  private notImplemented() {
    return new Error(
      `Storage provider ${this.config.provider} is configured but its adapter is not enabled yet`,
    );
  }
}
