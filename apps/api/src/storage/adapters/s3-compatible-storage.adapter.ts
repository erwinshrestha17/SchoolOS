import { createHmac, randomUUID } from 'crypto';
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
  encodeObjectKey,
  encodePathSegment,
  formatAmzDate,
  getSigningKey,
  hashHex,
  StorageOperationError,
} from '../storage.utils';

export class S3CompatibleStorageAdapter implements StorageAdapter {
  constructor(private readonly config: S3CompatibleStorageConfig) {}

  async putObject(input: PutObjectInput): Promise<StoredObjectResult> {
    const objectKey = buildObjectKey(input);
    const request = this.buildSignedHeaderRequest({
      method: 'PUT',
      objectKey,
      body: input.content,
      contentType: input.contentType,
    });

    const response = await fetch(request.url, {
      method: 'PUT',
      headers: request.headers,
      body: input.content as unknown as BodyInit,
    });

    await assertStorageResponse(response, 'upload');

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
    const request = this.buildSignedHeaderRequest({
      method: 'GET',
      objectKey,
      body: Buffer.alloc(0),
    });

    const response = await fetch(request.url, {
      method: 'GET',
      headers: request.headers,
    });

    await assertStorageResponse(response, 'download');
    return Buffer.from(await response.arrayBuffer());
  }

  async deleteObject(objectKey: string) {
    const request = this.buildSignedHeaderRequest({
      method: 'DELETE',
      body: Buffer.alloc(0),
      objectKey,
    });

    const response = await fetch(request.url, {
      method: 'DELETE',
      headers: request.headers,
    });

    await assertStorageResponse(response, 'delete');
  }

  async createSignedReadUrl(input: SignedUrlInput) {
    return this.buildPresignedUrl({
      method: 'GET',
      objectKey: input.objectKey,
      expiresInSeconds: clampSignedUrlTtl(
        input.expiresInSeconds,
        this.config.signedReadUrlTtlSeconds,
      ),
    }).url;
  }

  async createSignedUploadUrl(
    input: SignedUrlInput,
  ): Promise<SignedUploadResult> {
    const expiresInSeconds = clampSignedUrlTtl(
      input.expiresInSeconds,
      this.config.signedUploadUrlTtlSeconds,
    );
    const signed = this.buildPresignedUrl({
      method: 'PUT',
      objectKey: input.objectKey,
      expiresInSeconds,
      contentType: input.contentType,
    });

    return {
      url: signed.url,
      method: 'PUT',
      objectKey: input.objectKey,
      expiresAt: buildExpiresAt(expiresInSeconds),
      headers: signed.headers,
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

    await this.putRawObject(testKey, testContent, 'text/plain');
    const readContent = await this.getObjectBuffer(testKey);

    if (readContent.toString() !== testContent.toString()) {
      throw new StorageOperationError('Storage readiness read check failed');
    }

    const signedUrl = await this.createSignedReadUrl({ objectKey: testKey });
    await this.deleteObject(testKey);

    return {
      provider: this.config.provider,
      bucket: this.config.bucket,
      writeOk: true,
      readOk: true,
      deleteOk: true,
      signedUrlOk: signedUrl.includes('X-Amz-Signature='),
      signedUrl,
    };
  }

  private async putRawObject(
    objectKey: string,
    content: Buffer,
    contentType: string,
  ) {
    const request = this.buildSignedHeaderRequest({
      method: 'PUT',
      objectKey,
      body: content,
      contentType,
    });
    const response = await fetch(request.url, {
      method: 'PUT',
      headers: request.headers,
      body: content as unknown as BodyInit,
    });
    await assertStorageResponse(response, 'upload');
  }

  private buildSignedHeaderRequest(input: {
    method: 'GET' | 'PUT' | 'DELETE';
    objectKey: string;
    body: Buffer;
    contentType?: string;
  }) {
    const target = this.getObjectTarget(input.objectKey);
    const now = new Date();
    const amzDate = formatAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = hashHex(input.body);
    const headers: Record<string, string> = {
      host: target.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };

    if (input.contentType) {
      headers['content-type'] = input.contentType;
    }

    const signedHeaders = Object.keys(headers).sort().join(';');
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((name) => `${name}:${headers[name].trim()}\n`)
      .join('');
    const canonicalRequest = [
      input.method,
      target.path,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');
    const credentialScope = this.getCredentialScope(dateStamp);
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      hashHex(canonicalRequest),
    ].join('\n');
    const signingKey = getSigningKey(
      this.config.secretAccessKey,
      dateStamp,
      this.config.region,
    );
    const signature = createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');

    return {
      url: target.url,
      headers: {
        ...headers,
        authorization: [
          'AWS4-HMAC-SHA256',
          `Credential=${this.config.accessKeyId}/${credentialScope}`,
          `SignedHeaders=${signedHeaders}`,
          `Signature=${signature}`,
        ].join(', '),
      },
    };
  }

  private buildPresignedUrl(input: {
    method: 'GET' | 'PUT';
    objectKey: string;
    expiresInSeconds: number;
    contentType?: string;
  }) {
    const target = this.getObjectTarget(input.objectKey);
    const now = new Date();
    const amzDate = formatAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = this.getCredentialScope(dateStamp);
    const headers: Record<string, string> = { host: target.host };

    if (input.contentType) {
      headers['content-type'] = input.contentType;
    }

    const signedHeaders = Object.keys(headers).sort().join(';');
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((name) => `${name}:${headers[name].trim()}\n`)
      .join('');
    const query = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.config.accessKeyId}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(input.expiresInSeconds),
      'X-Amz-SignedHeaders': signedHeaders,
    });
    const canonicalQuery = toCanonicalQueryString(query);
    const canonicalRequest = [
      input.method,
      target.path,
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      'UNSIGNED-PAYLOAD',
    ].join('\n');
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      hashHex(canonicalRequest),
    ].join('\n');
    const signingKey = getSigningKey(
      this.config.secretAccessKey,
      dateStamp,
      this.config.region,
    );
    const signature = createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');
    query.set('X-Amz-Signature', signature);

    return {
      url: `${target.url}?${toCanonicalQueryString(query)}`,
      headers: input.contentType
        ? { 'content-type': input.contentType }
        : undefined,
    };
  }

  private getObjectTarget(objectKey: string) {
    const endpoint = new URL(this.config.endpoint.replace(/\/$/, ''));
    const encodedKey = encodeObjectKey(objectKey);

    if (this.config.forcePathStyle) {
      const path = `/${encodePathSegment(this.config.bucket)}/${encodedKey}`;
      return {
        host: endpoint.host,
        path,
        url: `${endpoint.origin}${path}`,
      };
    }

    const host = `${this.config.bucket}.${endpoint.host}`;
    const path = `/${encodedKey}`;
    return {
      host,
      path,
      url: `${endpoint.protocol}//${host}${path}`,
    };
  }

  private getCredentialScope(dateStamp: string) {
    return `${dateStamp}/${this.config.region}/s3/aws4_request`;
  }

  private assertConfig() {
    if (!this.config.bucket || !this.config.endpoint) {
      throw new StorageOperationError('Object storage is not configured');
    }
  }
}

function toCanonicalQueryString(params: URLSearchParams) {
  return Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join('&');
}

async function assertStorageResponse(response: Response, operation: string) {
  if (response.ok) return;

  throw new StorageOperationError(
    `Object storage ${operation} failed with status ${response.status}`,
  );
}
