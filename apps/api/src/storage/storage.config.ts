import {
  DEFAULT_SIGNED_READ_URL_TTL_SECONDS,
  DEFAULT_SIGNED_UPLOAD_URL_TTL_SECONDS,
  MAX_SIGNED_URL_TTL_SECONDS,
  SchoolOSStorageProvider,
} from './storage.types';

export type LocalStorageConfig = {
  provider: 'local';
  localRoot: string;
  publicBaseUrl: string;
  signingSecret: string;
  signedReadUrlTtlSeconds: number;
  signedUploadUrlTtlSeconds: number;
};

export type S3CompatibleStorageConfig = {
  provider: 's3' | 'r2' | 'minio';
  bucket: string;
  region: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string | null;
  forcePathStyle: boolean;
  signedReadUrlTtlSeconds: number;
  signedUploadUrlTtlSeconds: number;
};

export type GcpStorageConfig = {
  provider: 'gcp';
  bucket: string;
  projectId: string;
  serviceAccountJsonBase64: string;
  publicBaseUrl: string | null;
  signedReadUrlTtlSeconds: number;
  signedUploadUrlTtlSeconds: number;
};

export type SchoolOSStorageConfig =
  | LocalStorageConfig
  | S3CompatibleStorageConfig
  | GcpStorageConfig;

export class StorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageConfigurationError';
  }
}

export function normalizeStorageConfig(
  env: NodeJS.ProcessEnv = process.env,
): SchoolOSStorageConfig {
  const provider = normalizeProvider(env.STORAGE_PROVIDER);
  const signedReadUrlTtlSeconds = normalizeTtl(
    env.STORAGE_SIGNED_READ_URL_TTL_SECONDS,
    DEFAULT_SIGNED_READ_URL_TTL_SECONDS,
  );
  const signedUploadUrlTtlSeconds = normalizeTtl(
    env.STORAGE_SIGNED_UPLOAD_URL_TTL_SECONDS,
    DEFAULT_SIGNED_UPLOAD_URL_TTL_SECONDS,
  );

  if (provider === 'local') {
    return {
      provider,
      localRoot: env.LOCAL_STORAGE_ROOT?.trim() || 'storage',
      publicBaseUrl: env.LOCAL_STORAGE_PUBLIC_BASE_URL?.trim() || '/storage',
      signingSecret:
        env.STORAGE_SIGNING_SECRET?.trim() ||
        env.JWT_SECRET?.trim() ||
        'school-os-local-storage-signing-secret',
      signedReadUrlTtlSeconds,
      signedUploadUrlTtlSeconds,
    };
  }

  if (provider === 'gcp') {
    return {
      provider,
      bucket: requireEnv(env.GCP_STORAGE_BUCKET, 'GCP_STORAGE_BUCKET'),
      projectId: requireEnv(env.GCP_PROJECT_ID, 'GCP_PROJECT_ID'),
      serviceAccountJsonBase64: requireEnv(
        env.GCP_SERVICE_ACCOUNT_JSON_BASE64,
        'GCP_SERVICE_ACCOUNT_JSON_BASE64',
      ),
      publicBaseUrl: optionalEnv(env.GCP_STORAGE_PUBLIC_BASE_URL),
      signedReadUrlTtlSeconds,
      signedUploadUrlTtlSeconds,
    };
  }

  return {
    provider,
    bucket: requireEnv(
      firstEnv(env.OBJECT_STORAGE_BUCKET, env.R2_BUCKET),
      storageEnvName(provider, 'OBJECT_STORAGE_BUCKET', 'R2_BUCKET'),
    ),
    region:
      firstEnv(env.OBJECT_STORAGE_REGION, env.R2_REGION) ||
      defaultRegion(provider),
    endpoint: requireEnv(
      firstEnv(env.OBJECT_STORAGE_ENDPOINT, env.R2_ENDPOINT),
      storageEnvName(provider, 'OBJECT_STORAGE_ENDPOINT', 'R2_ENDPOINT'),
    ),
    accessKeyId: requireEnv(
      firstEnv(env.OBJECT_STORAGE_ACCESS_KEY_ID, env.R2_ACCESS_KEY_ID),
      storageEnvName(
        provider,
        'OBJECT_STORAGE_ACCESS_KEY_ID',
        'R2_ACCESS_KEY_ID',
      ),
    ),
    secretAccessKey: requireEnv(
      firstEnv(env.OBJECT_STORAGE_SECRET_ACCESS_KEY, env.R2_SECRET_ACCESS_KEY),
      storageEnvName(
        provider,
        'OBJECT_STORAGE_SECRET_ACCESS_KEY',
        'R2_SECRET_ACCESS_KEY',
      ),
    ),
    publicBaseUrl: optionalEnv(
      firstEnv(env.OBJECT_STORAGE_PUBLIC_BASE_URL, env.R2_PUBLIC_BASE_URL),
    ),
    forcePathStyle: normalizeBoolean(
      env.OBJECT_STORAGE_FORCE_PATH_STYLE,
      provider === 'r2' || provider === 'minio',
    ),
    signedReadUrlTtlSeconds,
    signedUploadUrlTtlSeconds,
  };
}

function normalizeProvider(
  provider: string | undefined,
): SchoolOSStorageProvider {
  const normalized = provider?.trim().toLowerCase() || 'local';

  if (
    normalized === 'local' ||
    normalized === 's3' ||
    normalized === 'r2' ||
    normalized === 'minio' ||
    normalized === 'gcp'
  ) {
    return normalized;
  }

  throw new StorageConfigurationError(
    `Unsupported STORAGE_PROVIDER "${normalized}". Expected local, s3, r2, minio, or gcp.`,
  );
}

function normalizeTtl(value: string | undefined, fallback: number) {
  const ttl = Number(value ?? fallback);

  if (!Number.isInteger(ttl) || ttl <= 0 || ttl > MAX_SIGNED_URL_TTL_SECONDS) {
    throw new StorageConfigurationError(
      `Signed URL TTL must be a positive integer no greater than ${MAX_SIGNED_URL_TTL_SECONDS} seconds`,
    );
  }

  return ttl;
}

function normalizeBoolean(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  return ['1', 'true', 'yes'].includes(value.trim().toLowerCase());
}

function requireEnv(value: string | undefined, name: string) {
  const normalized = value?.trim();

  if (!normalized) {
    throw new StorageConfigurationError(`${name} is required`);
  }

  return normalized;
}

function optionalEnv(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function firstEnv(...values: Array<string | undefined>) {
  return values.find((value) => Boolean(value?.trim()));
}

function defaultRegion(provider: SchoolOSStorageProvider) {
  if (provider === 'r2') return 'auto';
  return 'us-east-1';
}

function storageEnvName(
  provider: SchoolOSStorageProvider,
  genericName: string,
  r2AliasName: string,
) {
  if (provider === 'r2') {
    return `${genericName} or ${r2AliasName}`;
  }

  return genericName;
}
