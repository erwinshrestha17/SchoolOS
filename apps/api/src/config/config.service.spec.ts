import { ConfigService } from './config.service';

describe('ConfigService production validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('allows local development defaults', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;
    delete process.env.JWT_CHALLENGE_SECRET;
    delete process.env.MEDICAL_ENCRYPTION_KEY;

    expect(() => {
      new ConfigService().validateForRuntime();
    }).not.toThrow();
  });

  it('fails fast in production when required secrets are missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_PROD_BOOT;
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;
    delete process.env.JWT_CHALLENGE_SECRET;
    delete process.env.MEDICAL_ENCRYPTION_KEY;
    delete process.env.FRONTEND_ORIGIN;
    delete process.env.FRONTEND_ORIGINS;
    delete process.env.REDIS_HOST;

    expect(() => {
      new ConfigService().validateForRuntime();
    }).toThrow(/DATABASE_URL is required in production/);
  });

  it('accepts a complete production baseline', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_PROD_BOOT = 'true';
    process.env.DATABASE_URL =
      'postgresql://schoolos:schoolos@db:5432/schoolos';
    process.env.REDIS_HOST = 'redis';
    process.env.REDIS_PORT = '6379';
    process.env.JWT_SECRET = 'x'.repeat(40);
    process.env.JWT_CHALLENGE_SECRET = 'y'.repeat(40);
    process.env.MEDICAL_ENCRYPTION_KEY = 'z'.repeat(40);
    process.env.FRONTEND_ORIGIN =
      'https://app.schoolos.local,https://platform.schoolos.local,https://admin.schoolos.local';
    process.env.EMAIL_DELIVERY_MODE = 'log';
    process.env.STORAGE_PROVIDER = 'local';

    expect(() => {
      new ConfigService().validateForRuntime();
    }).not.toThrow();
  });

  it('requires explicit production boot opt-in', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_PROD_BOOT;
    process.env.DATABASE_URL =
      'postgresql://schoolos:schoolos@db:5432/schoolos';
    process.env.REDIS_HOST = 'redis';
    process.env.JWT_SECRET = 'x'.repeat(40);
    process.env.JWT_CHALLENGE_SECRET = 'y'.repeat(40);
    process.env.MEDICAL_ENCRYPTION_KEY = 'z'.repeat(40);
    process.env.FRONTEND_ORIGIN = 'https://schoolos.example.com';

    expect(() => {
      new ConfigService().validateForRuntime();
    }).toThrow(/ALLOW_PROD_BOOT=true is required/);
  });

  it('requires https frontend origins in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_PROD_BOOT = 'true';
    process.env.DATABASE_URL =
      'postgresql://schoolos:schoolos@db:5432/schoolos';
    process.env.REDIS_HOST = 'redis';
    process.env.JWT_SECRET = 'x'.repeat(40);
    process.env.JWT_CHALLENGE_SECRET = 'y'.repeat(40);
    process.env.MEDICAL_ENCRYPTION_KEY = 'z'.repeat(40);
    process.env.FRONTEND_ORIGIN = 'http://schoolos.example.com';

    expect(() => {
      new ConfigService().validateForRuntime();
    }).toThrow(/must use https in production/);
  });

  it('allows local HTTP origins outside production', () => {
    process.env.NODE_ENV = 'development';
    process.env.FRONTEND_ORIGINS =
      'http://localhost:3000,http://127.0.0.1:3101';

    expect(() => {
      new ConfigService().validateForRuntime();
    }).not.toThrow();
  });

  it('normalizes generic S3-compatible storage configuration', () => {
    process.env.STORAGE_PROVIDER = 'minio';
    process.env.OBJECT_STORAGE_BUCKET = 'schoolos-media';
    process.env.OBJECT_STORAGE_REGION = 'us-east-1';
    process.env.OBJECT_STORAGE_ENDPOINT = 'http://localhost:9000';
    process.env.OBJECT_STORAGE_ACCESS_KEY_ID = 'minioadmin';
    process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY = 'miniosecret';
    process.env.OBJECT_STORAGE_FORCE_PATH_STYLE = 'true';

    const storageConfig = new ConfigService().storageConfig;

    expect(storageConfig).toEqual(
      expect.objectContaining({
        provider: 'minio',
        bucket: 'schoolos-media',
        endpoint: 'http://localhost:9000',
        forcePathStyle: true,
      }),
    );
  });

  it('preserves R2 env aliases during storage config migration', () => {
    process.env.STORAGE_PROVIDER = 'r2';
    process.env.R2_BUCKET = 'schoolos-r2';
    process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
    process.env.R2_ACCESS_KEY_ID = 'access-key';
    process.env.R2_SECRET_ACCESS_KEY = 'secret-key';

    const storageConfig = new ConfigService().storageConfig;

    expect(storageConfig).toEqual(
      expect.objectContaining({
        provider: 'r2',
        bucket: 'schoolos-r2',
        region: 'auto',
        forcePathStyle: true,
      }),
    );
  });

  it('rejects long signed URL TTLs at startup validation', () => {
    process.env.STORAGE_PROVIDER = 'local';
    process.env.STORAGE_SIGNED_READ_URL_TTL_SECONDS = '3600';

    expect(() => {
      new ConfigService().validateForRuntime();
    }).toThrow(/Signed URL TTL must be a positive integer/);
  });

  it('explicitly rejects local HTTP origins in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_PROD_BOOT = 'true';
    process.env.DATABASE_URL =
      'postgresql://schoolos:schoolos@db:5432/schoolos';
    process.env.REDIS_HOST = 'redis';
    process.env.JWT_SECRET = 'x'.repeat(40);
    process.env.JWT_CHALLENGE_SECRET = 'y'.repeat(40);
    process.env.MEDICAL_ENCRYPTION_KEY = 'z'.repeat(40);
    process.env.FRONTEND_ORIGIN = 'http://localhost:3000';

    expect(() => {
      new ConfigService().validateForRuntime();
    }).toThrow(/must use https in production/);
  });
});
