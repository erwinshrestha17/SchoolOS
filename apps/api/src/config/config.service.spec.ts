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
    process.env.FRONTEND_ORIGIN = 'https://schoolos.example.com';
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
});
