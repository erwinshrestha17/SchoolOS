import { createHash, createHmac, randomUUID } from 'crypto';
import { posix } from 'path';

export function buildObjectKey(input: {
  tenantId: string;
  prefix: string;
  fileName: string;
}) {
  const extension = getExtension(input.fileName);
  return posix.join(
    sanitizeSegment(input.tenantId),
    sanitizePrefix(input.prefix),
    `${randomUUID()}${extension}`,
  );
}

export function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function sanitizePrefix(value: string) {
  return value
    .split('/')
    .map((segment) => sanitizeSegment(segment))
    .filter(Boolean)
    .join('/');
}

export function getExtension(fileName: string) {
  const match = /\.[a-zA-Z0-9]+$/.exec(fileName);
  return match?.[0]?.toLowerCase() ?? '';
}

export function encodePathSegment(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function encodeObjectKey(objectKey: string) {
  return objectKey.split('/').map(encodePathSegment).join('/');
}

export function hashHex(value: Buffer | string) {
  return createHash('sha256').update(value).digest('hex');
}

export function hmacHex(secret: string, value: string) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function formatAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

export function getSigningKey(
  secret: string,
  dateStamp: string,
  region: string,
) {
  const dateKey = createHmac('sha256', `AWS4${secret}`)
    .update(dateStamp)
    .digest();
  const regionKey = createHmac('sha256', dateKey).update(region).digest();
  const serviceKey = createHmac('sha256', regionKey).update('s3').digest();
  return createHmac('sha256', serviceKey).update('aws4_request').digest();
}

export function clampSignedUrlTtl(
  requested: number | undefined,
  configured: number,
) {
  return requested ? Math.min(requested, configured) : configured;
}

export function buildExpiresAt(expiresInSeconds: number) {
  return new Date(Date.now() + expiresInSeconds * 1000);
}

export class StorageOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageOperationError';
  }
}
