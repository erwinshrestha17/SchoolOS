import { StorageProvider } from '@prisma/client';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { ConfigService } from '../config/config.service';
import { S3CompatibleStorageAdapter } from './adapters/s3-compatible-storage.adapter';
import {
  normalizeStorageConfig,
  S3CompatibleStorageConfig,
} from './storage.config';
import { StorageService } from './storage.service';
import { StorageOperationError } from './storage.utils';

describe('StorageService', () => {
  const originalEnv = { ...process.env };
  let tempRoot: string | undefined;

  afterEach(async () => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();

    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = undefined;
    }
  });

  it('writes and reads local private objects from a bounded storage root', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'schoolos-storage-'));
    process.env.STORAGE_PROVIDER = 'local';
    process.env.LOCAL_STORAGE_ROOT = tempRoot;
    process.env.LOCAL_STORAGE_PUBLIC_BASE_URL = '/protected-storage';

    const service = new StorageService(new ConfigService());
    const saved = await service.saveBufferObject({
      tenantId: 'tenant-a',
      prefix: 'student-documents',
      fileName: 'profile.pdf',
      contentType: 'application/pdf',
      content: Buffer.from('pdf-body'),
    });

    await expect(service.getObjectBuffer(saved.objectKey)).resolves.toEqual(
      Buffer.from('pdf-body'),
    );
    expect(saved.provider).toBe(StorageProvider.LOCAL);
    expect(saved.objectKey).toMatch(
      /^tenant-a\/student-documents\/[a-f0-9-]+\.pdf$/,
    );
    expect(saved.publicUrl).toBeNull();
    expect(saved.checksumSha256).toHaveLength(64);
  });

  it('rejects unsafe local object keys', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'schoolos-storage-'));
    process.env.STORAGE_PROVIDER = 'local';
    process.env.LOCAL_STORAGE_ROOT = tempRoot;

    const service = new StorageService(new ConfigService());

    await expect(service.getObjectBuffer('../outside.txt')).rejects.toThrow(
      'Invalid storage object key',
    );
  });

  it('creates short-lived signed local read URLs', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'schoolos-storage-'));
    process.env.STORAGE_PROVIDER = 'local';
    process.env.LOCAL_STORAGE_ROOT = tempRoot;
    process.env.LOCAL_STORAGE_PUBLIC_BASE_URL = '/protected-storage';
    process.env.STORAGE_SIGNED_READ_URL_TTL_SECONDS = '120';
    process.env.STORAGE_SIGNING_SECRET = 'test-signing-secret';

    const service = new StorageService(new ConfigService());
    const signedUrl = await service.createSignedReadUrl({
      objectKey: 'tenant-a/notices/file.pdf',
    });

    expect(signedUrl).toContain('/protected-storage/');
    expect(signedUrl).toContain('expires=');
    expect(signedUrl).toContain('signature=');
  });

  it('maps generic S3 config to standard virtual-host addressing defaults', () => {
    const config = normalizeStorageConfig({
      STORAGE_PROVIDER: 's3',
      OBJECT_STORAGE_BUCKET: 'schoolos-media',
      OBJECT_STORAGE_REGION: 'ap-south-1',
      OBJECT_STORAGE_ACCESS_KEY_ID: 'access-key',
      OBJECT_STORAGE_SECRET_ACCESS_KEY: 'secret-key',
    } as NodeJS.ProcessEnv);

    expect(config).toEqual(
      expect.objectContaining({
        provider: 's3',
        bucket: 'schoolos-media',
        region: 'ap-south-1',
        endpoint: 'https://s3.ap-south-1.amazonaws.com',
        forcePathStyle: false,
      }),
    );
  });

  it('maps R2 aliases to path-style S3-compatible config', () => {
    const config = getR2Config();

    expect(config).toEqual(
      expect.objectContaining({
        provider: 'r2',
        bucket: 'schoolos-assets',
        endpoint: 'https://account.r2.cloudflarestorage.com',
        region: 'auto',
        forcePathStyle: true,
      }),
    );
  });

  it('maps MinIO generic env to path-style S3-compatible config', () => {
    const config = normalizeStorageConfig({
      STORAGE_PROVIDER: 'minio',
      OBJECT_STORAGE_BUCKET: 'schoolos-media',
      OBJECT_STORAGE_REGION: 'us-east-1',
      OBJECT_STORAGE_ENDPOINT: 'http://localhost:9000',
      OBJECT_STORAGE_ACCESS_KEY_ID: 'minioadmin',
      OBJECT_STORAGE_SECRET_ACCESS_KEY: 'miniosecret',
    } as NodeJS.ProcessEnv);

    expect(config).toEqual(
      expect.objectContaining({
        provider: 'minio',
        endpoint: 'http://localhost:9000',
        forcePathStyle: true,
      }),
    );
  });

  it('uploads S3-compatible objects through the AWS SDK adapter', async () => {
    const send = jest.fn().mockResolvedValue({});
    const adapter = new S3CompatibleStorageAdapter(
      getR2Config(),
      { send },
      mockPresignUrl(),
    );

    const saved = await adapter.putObject({
      tenantId: 'tenant-a',
      prefix: 'activity media',
      fileName: 'photo.jpg',
      contentType: 'image/jpeg',
      content: Buffer.from('image-body'),
    });

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0][0] as CommandWithInput;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toEqual(
      expect.objectContaining({
        Bucket: 'schoolos-assets',
        Key: saved.objectKey,
        ContentType: 'image/jpeg',
        Body: Buffer.from('image-body'),
      }),
    );
    expect(saved.provider).toBe('r2');
    expect(saved.publicUrl).toBeNull();
    expect(saved.objectKey).toMatch(
      /^tenant-a\/activity-media\/[a-f0-9-]+\.jpg$/,
    );
  });

  it('downloads S3-compatible objects through the AWS SDK adapter', async () => {
    const send = jest
      .fn()
      .mockResolvedValue({ Body: Buffer.from('object-body') });
    const adapter = new S3CompatibleStorageAdapter(
      getR2Config(),
      { send },
      mockPresignUrl(),
    );

    await expect(
      adapter.getObjectBuffer('tenant-a/notices/file.pdf'),
    ).resolves.toEqual(Buffer.from('object-body'));

    const command = send.mock.calls[0][0] as CommandWithInput;
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input).toEqual(
      expect.objectContaining({
        Bucket: 'schoolos-assets',
        Key: 'tenant-a/notices/file.pdf',
      }),
    );
  });

  it('creates bounded S3-compatible signed read URLs with no provider secret leakage', async () => {
    configureR2Env();
    process.env.STORAGE_SIGNED_READ_URL_TTL_SECONDS = '60';
    const service = new StorageService(new ConfigService());

    const signedUrl = await service.createSignedReadUrl({
      objectKey: 'tenant-a/notices/file.pdf',
      expiresInSeconds: 120,
    });

    expect(signedUrl).toContain('X-Amz-Expires=60');
    expect(signedUrl).toContain('X-Amz-Signature=');
    expect(signedUrl).not.toContain('secret-key');
  });

  it('creates bounded signed upload URLs with required upload headers', async () => {
    const adapter = new S3CompatibleStorageAdapter(
      getR2Config({ signedUploadUrlTtlSeconds: 90 }),
      { send: jest.fn() },
      mockPresignUrl('https://signed-upload.test/object?X-Amz-Signature=abc'),
    );

    const result = await adapter.createSignedUploadUrl({
      objectKey: 'tenant-a/uploads/photo.jpg',
      expiresInSeconds: 300,
      contentType: 'image/jpeg',
    });

    expect(result).toEqual(
      expect.objectContaining({
        url: 'https://signed-upload.test/object?X-Amz-Signature=abc',
        method: 'PUT',
        objectKey: 'tenant-a/uploads/photo.jpg',
        headers: { 'content-type': 'image/jpeg' },
      }),
    );
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 90_000 + 1_000,
    );
  });

  it('normalizes provider errors into safe storage errors', async () => {
    const send = jest.fn().mockRejectedValue({
      name: 'CredentialsProviderError',
      message: 'secret-key leaked by provider',
      $metadata: { httpStatusCode: 403 },
    });
    const adapter = new S3CompatibleStorageAdapter(
      getR2Config(),
      { send },
      mockPresignUrl(),
    );

    await expect(
      adapter.putObject({
        tenantId: 'tenant-a',
        prefix: 'documents',
        fileName: 'file.pdf',
        contentType: 'application/pdf',
        content: Buffer.from('pdf'),
      }),
    ).rejects.toThrow('Object storage upload failed with status 403');
    await expect(
      adapter.putObject({
        tenantId: 'tenant-a',
        prefix: 'documents',
        fileName: 'file.pdf',
        contentType: 'application/pdf',
        content: Buffer.from('pdf'),
      }),
    ).rejects.not.toThrow(/secret-key/);
  });

  it('validates missing object storage env during production startup', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_PROD_BOOT = 'true';
    process.env.DATABASE_URL =
      'postgresql://schoolos:schoolos@localhost:5432/schoolos';
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
    process.env.REDIS_HOST = 'localhost';
    process.env.STORAGE_PROVIDER = 'r2';
    process.env.R2_BUCKET = 'schoolos-assets';

    expect(() => {
      new ConfigService().validateForRuntime();
    }).toThrow(/OBJECT_STORAGE_ENDPOINT or R2_ENDPOINT is required/);
  });

  it('treats deleteObject as idempotent when provider reports missing objects', async () => {
    const send = jest.fn().mockRejectedValue({
      name: 'NoSuchKey',
      $metadata: { httpStatusCode: 404 },
    });
    const adapter = new S3CompatibleStorageAdapter(
      getR2Config(),
      { send },
      mockPresignUrl(),
    );

    await expect(
      adapter.deleteObject('tenant-a/missing.pdf'),
    ).resolves.toBeUndefined();
    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
  });

  it('runs testConnection through mocked provider client commands', async () => {
    const send = jest.fn(async (command) => {
      if (command instanceof GetObjectCommand) {
        return { Body: Buffer.from('SchoolOS Storage Connection Test') };
      }
      return {};
    });
    const adapter = new S3CompatibleStorageAdapter(
      getR2Config(),
      { send },
      mockPresignUrl('https://signed-read.test/object?X-Amz-Signature=abc'),
    );

    await expect(adapter.testConnection()).resolves.toEqual(
      expect.objectContaining({
        provider: 'r2',
        bucket: 'schoolos-assets',
        writeOk: true,
        readOk: true,
        deleteOk: true,
        signedUrlOk: true,
        signedUrl: 'https://signed-read.test/object?X-Amz-Signature=abc',
      }),
    );

    expect(
      send.mock.calls.map(([command]) => command.constructor.name),
    ).toEqual(['PutObjectCommand', 'GetObjectCommand', 'DeleteObjectCommand']);
  });

  it('fails closed when R2 credentials are incomplete', async () => {
    process.env.STORAGE_PROVIDER = 'r2';
    process.env.R2_BUCKET = 'schoolos-assets';

    const service = new StorageService(new ConfigService());

    await expect(service.checkReadiness()).rejects.toThrow(
      'OBJECT_STORAGE_ENDPOINT or R2_ENDPOINT is required',
    );
  });
});

interface CommandWithInput {
  input: object;
  constructor: { name: string };
}

function configureR2Env() {
  process.env.STORAGE_PROVIDER = 'r2';
  process.env.R2_BUCKET = 'schoolos-assets';
  process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
  process.env.R2_ACCESS_KEY_ID = 'access-key';
  process.env.R2_SECRET_ACCESS_KEY = 'secret-key';
  process.env.R2_PUBLIC_BASE_URL = 'https://assets.schoolos.test';
}

function getR2Config(
  overrides: Partial<S3CompatibleStorageConfig> = {},
): S3CompatibleStorageConfig {
  return {
    provider: 'r2',
    bucket: 'schoolos-assets',
    region: 'auto',
    endpoint: 'https://account.r2.cloudflarestorage.com',
    accessKeyId: 'access-key',
    secretAccessKey: 'secret-key',
    publicBaseUrl: 'https://assets.schoolos.test',
    forcePathStyle: true,
    signedReadUrlTtlSeconds: 60,
    signedUploadUrlTtlSeconds: 60,
    ...overrides,
  };
}

function mockPresignUrl(
  url = 'https://signed-read.test/object?X-Amz-Signature=abc',
) {
  return jest.fn().mockResolvedValue(url);
}
