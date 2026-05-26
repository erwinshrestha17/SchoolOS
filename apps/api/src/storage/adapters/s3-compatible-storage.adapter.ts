import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { S3CompatibleStorageConfig } from '../storage.config';
import {
  PutObjectInput,
  SignedUrlInput,
  SignedUploadResult,
  StorageAdapter,
  StorageReadinessResult,
  StoredObjectResult,
} from '../storage.types';
import {
  buildExpiresAt,
  buildObjectKey,
  clampSignedUrlTtl,
  hashHex,
  StorageOperationError,
} from '../storage.utils';

type S3Command =
  | PutObjectCommand
  | GetObjectCommand
  | DeleteObjectCommand
  | HeadBucketCommand;

type S3ClientLike = {
  send(command: S3Command): Promise<unknown>;
};

type PresignCommand = GetObjectCommand | PutObjectCommand;

type PresignUrl = (
  client: S3Client,
  command: PresignCommand,
  options: { expiresIn: number },
) => Promise<string>;

export class S3CompatibleStorageAdapter implements StorageAdapter {
  private readonly client: S3ClientLike;
  private readonly presignClient: S3Client;
  private readonly presignUrl: PresignUrl;

  constructor(
    private readonly config: S3CompatibleStorageConfig,
    client?: S3ClientLike,
    presignUrl: PresignUrl = getSignedUrl,
  ) {
    const sdkClient = createS3Client(config);
    this.client = client ?? sdkClient;
    this.presignClient = sdkClient;
    this.presignUrl = presignUrl;
  }

  async putObject(input: PutObjectInput): Promise<StoredObjectResult> {
    const objectKey = buildObjectKey(input);
    await this.sendCommand(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
        Body: input.content,
        ContentType: input.contentType,
      }),
      'upload',
    );

    return {
      provider: this.config.provider,
      bucket: this.config.bucket,
      objectKey,
      sizeBytes: input.content.byteLength,
      checksumSha256: hashHex(input.content),
      publicUrl: null,
    };
  }

  async getObjectBuffer(objectKey: string) {
    const response = await this.sendCommand<{ Body?: unknown }>(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
      }),
      'download',
    );

    if (!response.Body) {
      throw new StorageOperationError(
        'Object storage download returned no data',
      );
    }

    return streamBodyToBuffer(response.Body);
  }

  async deleteObject(objectKey: string) {
    try {
      await this.sendCommand(
        new DeleteObjectCommand({
          Bucket: this.config.bucket,
          Key: objectKey,
        }),
        'delete',
      );
    } catch (error) {
      if (isProviderNotFoundError(error)) return;
      throw error;
    }
  }

  async createSignedReadUrl(input: SignedUrlInput) {
    const expiresIn = clampSignedUrlTtl(
      input.expiresInSeconds,
      this.config.signedReadUrlTtlSeconds,
    );

    return this.createPresignedUrl(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: input.objectKey,
      }),
      expiresIn,
      'signed read URL',
    );
  }

  async createSignedUploadUrl(
    input: SignedUrlInput,
  ): Promise<SignedUploadResult> {
    const expiresInSeconds = clampSignedUrlTtl(
      input.expiresInSeconds,
      this.config.signedUploadUrlTtlSeconds,
    );
    const url = await this.createPresignedUrl(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.objectKey,
        ContentType: input.contentType,
      }),
      expiresInSeconds,
      'signed upload URL',
    );

    return {
      url,
      method: 'PUT',
      objectKey: input.objectKey,
      expiresAt: buildExpiresAt(expiresInSeconds),
      headers: input.contentType
        ? { 'content-type': input.contentType }
        : undefined,
    };
  }

  async checkReadiness() {
    this.assertConfig();
    return true;
  }

  async testConnection(): Promise<StorageReadinessResult> {
    this.assertConfig();

    const testKey = `platform-test-${randomUUID()}.txt`;
    const testContent = Buffer.from('SchoolOS Storage Connection Test');
    let deleteAttempted = false;

    try {
      await this.putRawObject(testKey, testContent, 'text/plain');
      const readContent = await this.getObjectBuffer(testKey);

      if (readContent.toString() !== testContent.toString()) {
        throw new StorageOperationError('Storage readiness read check failed');
      }

      const signedUrl = await this.createSignedReadUrl({ objectKey: testKey });
      await this.deleteObject(testKey);
      deleteAttempted = true;

      return {
        provider: this.config.provider,
        bucket: this.config.bucket,
        writeOk: true,
        readOk: true,
        deleteOk: true,
        signedUrlOk: signedUrl.includes('X-Amz-Signature='),
        signedUrl,
      };
    } finally {
      if (!deleteAttempted) {
        await this.deleteObject(testKey).catch(() => undefined);
      }
    }
  }

  private async putRawObject(
    objectKey: string,
    content: Buffer,
    contentType: string,
  ) {
    await this.sendCommand(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
        Body: content,
        ContentType: contentType,
      }),
      'upload',
    );
  }

  private async createPresignedUrl(
    command: PresignCommand,
    expiresIn: number,
    operation: string,
  ) {
    try {
      return await this.presignUrl(this.presignClient, command, {
        expiresIn,
      });
    } catch (error) {
      throw normalizeProviderError(error, operation);
    }
  }

  private async sendCommand<T>(command: S3Command, operation: string) {
    try {
      return (await this.client.send(command)) as T;
    } catch (error) {
      if (operation === 'delete' && isRawProviderNotFoundError(error)) {
        throw error;
      }

      throw normalizeProviderError(error, operation);
    }
  }

  private assertConfig() {
    if (
      !this.config.bucket ||
      !this.config.endpoint ||
      !this.config.accessKeyId ||
      !this.config.secretAccessKey
    ) {
      throw new StorageOperationError('Object storage is not configured');
    }
  }
}

function createS3Client(config: S3CompatibleStorageConfig) {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

async function streamBodyToBuffer(body: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (typeof body === 'string') {
    return Buffer.from(body);
  }

  if (
    typeof body === 'object' &&
    body !== null &&
    'transformToByteArray' in body &&
    typeof body.transformToByteArray === 'function'
  ) {
    return Buffer.from(await body.transformToByteArray());
  }

  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  throw new StorageOperationError(
    'Object storage download returned unreadable data',
  );
}

function normalizeProviderError(error: unknown, operation: string) {
  const statusCode = getProviderStatusCode(error);
  const statusLabel = statusCode ? ` with status ${statusCode}` : '';

  return new StorageOperationError(
    `Object storage ${operation} failed${statusLabel}`,
  );
}

function getProviderStatusCode(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const metadata = '$metadata' in error ? error.$metadata : null;
  if (
    typeof metadata === 'object' &&
    metadata !== null &&
    'httpStatusCode' in metadata &&
    typeof metadata.httpStatusCode === 'number'
  ) {
    return metadata.httpStatusCode;
  }

  return null;
}

function isRawProviderNotFoundError(error: unknown) {
  const statusCode = getProviderStatusCode(error);
  if (statusCode === 404) return true;

  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const name =
    'name' in error && typeof error.name === 'string' ? error.name : '';

  return ['NoSuchKey', 'NotFound', 'NotFoundException'].includes(name);
}

function isProviderNotFoundError(error: unknown) {
  return (
    isRawProviderNotFoundError(error) ||
    (error instanceof StorageOperationError &&
      /Object storage delete failed with status 404/.test(error.message))
  );
}
