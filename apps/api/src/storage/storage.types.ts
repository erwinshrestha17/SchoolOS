export type SchoolOSStorageProvider = 'local' | 's3' | 'r2' | 'minio' | 'gcp';

export interface PutObjectInput {
  tenantId: string;
  prefix: string;
  fileName: string;
  contentType: string;
  content: Buffer;
}

export interface StoredObjectResult {
  provider: SchoolOSStorageProvider;
  bucket: string | null;
  objectKey: string;
  sizeBytes: number;
  checksumSha256?: string;
  publicUrl?: string | null;
}

export interface SignedUrlInput {
  objectKey: string;
  expiresInSeconds?: number;
  contentType?: string;
}

export interface SignedUploadResult {
  url: string;
  method: 'PUT' | 'POST';
  objectKey: string;
  expiresAt: Date;
  headers?: Record<string, string>;
}

export interface StorageReadinessResult {
  provider: SchoolOSStorageProvider;
  bucket: string | null;
  writeOk: boolean;
  readOk: boolean;
  deleteOk: boolean;
  signedUrlOk?: boolean;
  signedUrl?: string | null;
}

export interface StorageAdapter {
  putObject(input: PutObjectInput): Promise<StoredObjectResult>;
  getObjectBuffer(objectKey: string): Promise<Buffer>;
  deleteObject(objectKey: string): Promise<void>;
  createSignedReadUrl(input: SignedUrlInput): Promise<string>;
  createSignedUploadUrl(input: SignedUrlInput): Promise<SignedUploadResult>;
  checkReadiness(): Promise<boolean>;
  testConnection(): Promise<StorageReadinessResult>;
}

export const DEFAULT_SIGNED_READ_URL_TTL_SECONDS = 300;
export const DEFAULT_SIGNED_UPLOAD_URL_TTL_SECONDS = 300;
export const MAX_SIGNED_URL_TTL_SECONDS = 900;
