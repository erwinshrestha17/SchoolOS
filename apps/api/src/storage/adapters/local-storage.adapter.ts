import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { dirname, isAbsolute, join, normalize } from 'path';
import { type LocalStorageConfig } from '../storage.config';
import {
  type PutObjectInput,
  type SignedUrlInput,
  type SignedUploadResult,
  type StorageAdapter,
  type StorageReadinessResult,
  type StoredObjectResult,
} from '../storage.types';
import {
  buildExpiresAt,
  buildObjectKey,
  clampSignedUrlTtl,
  hmacHex,
  hashHex,
} from '../storage.utils';

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly config: LocalStorageConfig) {}

  async putObject(input: PutObjectInput): Promise<StoredObjectResult> {
    const objectKey = buildObjectKey(input);
    const absolutePath = this.getLocalObjectPath(objectKey);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.content);

    return {
      provider: 'local',
      bucket: null,
      objectKey,
      sizeBytes: input.content.byteLength,
      checksumSha256: hashHex(input.content),
      publicUrl: null,
    };
  }

  async getObjectBuffer(objectKey: string) {
    return readFile(this.getLocalObjectPath(objectKey));
  }

  async deleteObject(objectKey: string) {
    await unlink(this.getLocalObjectPath(objectKey)).catch(() => {});
  }

  async createSignedReadUrl(input: SignedUrlInput) {
    return this.createSignedLocalUrl(input, 'GET');
  }

  async createSignedUploadUrl(
    input: SignedUrlInput,
  ): Promise<SignedUploadResult> {
    const expiresInSeconds = clampSignedUrlTtl(
      input.expiresInSeconds,
      this.config.signedUploadUrlTtlSeconds,
    );

    return {
      url: this.createSignedLocalUrl(input, 'PUT'),
      method: 'PUT',
      objectKey: input.objectKey,
      expiresAt: buildExpiresAt(expiresInSeconds),
      headers: input.contentType ? { 'content-type': input.contentType } : {},
    };
  }

  async checkReadiness() {
    await mkdir(this.getRootPath(), { recursive: true });
    return true;
  }

  async testConnection(): Promise<StorageReadinessResult> {
    const testKey = `platform-test-${randomUUID()}.txt`;
    const testContent = Buffer.from('SchoolOS Storage Connection Test');
    const absolutePath = this.getLocalObjectPath(testKey);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, testContent);
    const readContent = await readFile(absolutePath);

    if (readContent.toString() !== testContent.toString()) {
      throw new Error('Storage readiness read check failed');
    }

    const signedUrl = await this.createSignedReadUrl({ objectKey: testKey });
    await unlink(absolutePath).catch(() => {});

    return {
      provider: 'local',
      bucket: null,
      writeOk: true,
      readOk: true,
      deleteOk: true,
      signedUrlOk: signedUrl.includes('signature='),
      signedUrl,
    };
  }

  private createSignedLocalUrl(input: SignedUrlInput, method: 'GET' | 'PUT') {
    const expiresInSeconds = clampSignedUrlTtl(
      input.expiresInSeconds,
      method === 'GET'
        ? this.config.signedReadUrlTtlSeconds
        : this.config.signedUploadUrlTtlSeconds,
    );
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const signature = hmacHex(
      this.config.signingSecret,
      `${method}:${input.objectKey}:${expires}`,
    );

    return `${this.config.publicBaseUrl.replace(/\/$/, '')}/${encodeURIComponent(
      input.objectKey,
    )}?expires=${expires}&signature=${signature}`;
  }

  private getRootPath() {
    return normalize(
      isAbsolute(this.config.localRoot)
        ? this.config.localRoot
        : join(process.cwd(), this.config.localRoot),
    );
  }

  private getLocalObjectPath(objectKey: string) {
    const root = this.getRootPath();
    const resolved = normalize(join(root, objectKey));

    if (resolved !== root && !resolved.startsWith(`${root}/`)) {
      throw new Error('Invalid storage object key');
    }

    return resolved;
  }
}
