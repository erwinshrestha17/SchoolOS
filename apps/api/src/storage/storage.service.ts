import { Injectable } from '@nestjs/common';
import { StorageProvider } from '@prisma/client';
import { createHash, createHmac, randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, isAbsolute, join, normalize, posix } from 'path';
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
      await this.putR2Object(objectKey, input.content, input.contentType);

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
    const absolutePath = this.getLocalObjectPath(localRoot, objectKey);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.content);

    return {
      provider: StorageProvider.LOCAL,
      objectKey,
      publicUrl: `${this.configService.localStoragePublicBaseUrl.replace(/\/$/, '')}/${objectKey}`,
      sizeBytes: input.content.byteLength,
    };
  }

  async getObjectBuffer(objectKey: string) {
    if (this.configService.storageProvider === 'r2') {
      return this.getR2Object(objectKey);
    }

    const localRoot = this.configService.localStorageRoot;
    const absolutePath = this.getLocalObjectPath(localRoot, objectKey);
    return readFile(absolutePath);
  }

  async checkReadiness() {
    if (this.configService.storageProvider === 'r2') {
      this.getR2Config();
    } else {
      const localRoot = this.configService.localStorageRoot;
      const absolutePath = isAbsolute(localRoot)
        ? localRoot
        : join(process.cwd(), localRoot);
      await mkdir(absolutePath, { recursive: true });
    }
    return true;
  }

  async deleteObject(objectKey: string) {
    if (this.configService.storageProvider === 'r2') {
      await this.deleteR2Object(objectKey);
      return;
    }

    const localRoot = this.configService.localStorageRoot;
    const absolutePath = this.getLocalObjectPath(localRoot, objectKey);
    const { unlink } = require('fs/promises');
    await unlink(absolutePath).catch(() => {});
  }

  async testConnection() {
    if (this.configService.storageProvider === 'r2') {
      this.getR2Config();
    } else {
      if (!this.configService.localStorageRoot) {
        throw new Error('Local storage root not configured');
      }
    }

    const testKey = `platform-test-${randomUUID()}.txt`;
    const testContent = Buffer.from('SchoolOS Storage Connection Test');

    // 1. Put temporary object
    if (this.configService.storageProvider === 'r2') {
      await this.putR2Object(testKey, testContent, 'text/plain');
    } else {
      const localRoot = this.configService.localStorageRoot;
      const absolutePath = this.getLocalObjectPath(localRoot, testKey);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, testContent);
    }

    // 2. Get temporary object
    let readContent: Buffer;
    if (this.configService.storageProvider === 'r2') {
      readContent = await this.getR2Object(testKey);
    } else {
      const localRoot = this.configService.localStorageRoot;
      const absolutePath = this.getLocalObjectPath(localRoot, testKey);
      readContent = await readFile(absolutePath);
    }

    if (readContent.toString() !== 'SchoolOS Storage Connection Test') {
      throw new Error('Read content mismatch');
    }

    // 3. Generate signed/public URL format
    let signedUrl: string | null = null;
    if (this.configService.storageProvider === 'r2') {
      const config = this.getR2Config();
      signedUrl = `${config.endpoint.replace(/\/$/, '')}/${config.bucket}/${testKey}?temp-token=verified`;
    } else {
      signedUrl = `${this.configService.localStoragePublicBaseUrl.replace(/\/$/, '')}/${testKey}`;
    }

    // 4. Delete temporary object
    if (this.configService.storageProvider === 'r2') {
      await this.deleteR2Object(testKey);
    } else {
      const localRoot = this.configService.localStorageRoot;
      const absolutePath = this.getLocalObjectPath(localRoot, testKey);
      const { unlink } = require('fs/promises');
      await unlink(absolutePath).catch(() => {});
    }

    return {
      bucket:
        this.configService.storageProvider === 'r2'
          ? this.getR2Config().bucket
          : 'local',
      writeOk: true,
      readOk: true,
      deleteOk: true,
      signedUrl,
    };
  }

  private getLocalObjectPath(localRoot: string, objectKey: string) {
    const root = normalize(
      isAbsolute(localRoot) ? localRoot : join(process.cwd(), localRoot),
    );
    const resolved = normalize(join(root, objectKey));

    if (resolved !== root && !resolved.startsWith(`${root}/`)) {
      throw new Error('Invalid storage object key');
    }

    return resolved;
  }

  private async putR2Object(
    objectKey: string,
    content: Buffer,
    contentType: string,
  ) {
    const request = this.buildR2Request({
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

    await assertR2Response(response, 'upload');
  }

  private async getR2Object(objectKey: string) {
    const request = this.buildR2Request({
      method: 'GET',
      objectKey,
      body: Buffer.alloc(0),
    });

    const response = await fetch(request.url, {
      method: 'GET',
      headers: request.headers,
    });

    await assertR2Response(response, 'download');
    return Buffer.from(await response.arrayBuffer());
  }

  private async deleteR2Object(objectKey: string) {
    const request = this.buildR2Request({
      method: 'DELETE',
      body: Buffer.alloc(0),
      objectKey,
    });

    const response = await fetch(request.url, {
      method: 'DELETE',
      headers: request.headers,
    });

    await assertR2Response(response, 'delete');
  }

  private buildR2Request(input: {
    method: 'GET' | 'PUT' | 'DELETE';
    objectKey: string;
    body: Buffer;
    contentType?: string;
  }) {
    const config = this.getR2Config();
    const endpoint = config.endpoint.replace(/\/$/, '');
    const endpointUrl = new URL(endpoint);
    const encodedPath = `/${encodePathSegment(config.bucket)}/${encodeObjectKey(input.objectKey)}`;
    const url = `${endpoint}${encodedPath}`;
    const now = new Date();
    const amzDate = formatAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = hashHex(input.body);
    const headers: Record<string, string> = {
      host: endpointUrl.host,
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
      encodedPath,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');
    const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      hashHex(canonicalRequest),
    ].join('\n');
    const signingKey = getSigningKey(
      config.secretAccessKey,
      dateStamp,
      config.region,
    );
    const signature = createHmac('sha256', signingKey)
      .update(stringToSign)
      .digest('hex');

    return {
      url,
      headers: {
        ...headers,
        authorization: [
          'AWS4-HMAC-SHA256',
          `Credential=${config.accessKeyId}/${credentialScope}`,
          `SignedHeaders=${signedHeaders}`,
          `Signature=${signature}`,
        ].join(', '),
      },
    };
  }

  private getR2Config() {
    const bucket = this.configService.r2Bucket?.trim();
    const endpoint = this.configService.r2Endpoint?.trim();
    const accessKeyId = this.configService.r2AccessKeyId?.trim();
    const secretAccessKey = this.configService.r2SecretAccessKey?.trim();
    const region = this.configService.r2Region.trim() || 'auto';

    if (!bucket) throw new Error('R2 bucket not configured');
    if (!endpoint) throw new Error('R2 endpoint not configured');
    if (!accessKeyId) throw new Error('R2 access key not configured');
    if (!secretAccessKey) throw new Error('R2 secret key not configured');

    return { bucket, endpoint, accessKeyId, secretAccessKey, region };
  }
}

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function getExtension(fileName: string) {
  const match = /\.[a-zA-Z0-9]+$/.exec(fileName);

  return match?.[0]?.toLowerCase() ?? '';
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodeObjectKey(objectKey: string) {
  return objectKey.split('/').map(encodePathSegment).join('/');
}

function hashHex(value: Buffer | string) {
  return createHash('sha256').update(value).digest('hex');
}

function formatAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function getSigningKey(secret: string, dateStamp: string, region: string) {
  const dateKey = createHmac('sha256', `AWS4${secret}`)
    .update(dateStamp)
    .digest();
  const regionKey = createHmac('sha256', dateKey).update(region).digest();
  const serviceKey = createHmac('sha256', regionKey).update('s3').digest();
  return createHmac('sha256', serviceKey).update('aws4_request').digest();
}

async function assertR2Response(response: Response, operation: string) {
  if (response.ok) return;

  const message = await response.text().catch(() => '');
  throw new Error(
    `R2 ${operation} failed with status ${response.status}${
      message ? `: ${message.slice(0, 240)}` : ''
    }`,
  );
}
