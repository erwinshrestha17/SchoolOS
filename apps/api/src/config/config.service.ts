import { Injectable } from '@nestjs/common';
import {
  ACCESS_TOKEN_TTL,
  ACCESS_COOKIE_NAME,
  AUTH_COOKIE_NAME,
  CHALLENGE_TOKEN_TTL,
  OTP_ISSUE_LIMIT,
  OTP_ISSUE_WINDOW_MINUTES,
  OTP_LENGTH,
  OTP_TTL_MINUTES,
  PASSWORD_RESET_TTL_MINUTES,
  REFRESH_TOKEN_TTL_DAYS,
} from '../auth/auth.constants';
import {
  normalizeStorageConfig,
  type SchoolOSStorageConfig,
} from '../storage/storage.config';
import type { SchoolOSStorageProvider } from '../storage/storage.types';

@Injectable()
export class ConfigService {
  validateForRuntime() {
    const errors = [
      ...this.validateNumericEnv(),
      ...this.validateStorageEnv(),
      ...(this.isProduction ? this.validateProductionEnv() : []),
    ];

    if (errors.length > 0) {
      throw new Error(
        `Invalid SchoolOS API configuration:\n${errors
          .map((error) => `- ${error}`)
          .join('\n')}`,
      );
    }
  }

  get jwtSecret() {
    return process.env.JWT_SECRET ?? 'school-os-access-secret';
  }

  get jwtIssuer() {
    return process.env.JWT_ISSUER ?? 'schoolos';
  }

  get jwtAudienceWeb() {
    return process.env.JWT_AUDIENCE_WEB ?? 'schoolos-web';
  }

  get jwtAudienceMobile() {
    return process.env.JWT_AUDIENCE_MOBILE ?? 'schoolos-mobile';
  }

  get tokenHashPepper() {
    if (process.env.TOKEN_HASH_PEPPER) {
      return process.env.TOKEN_HASH_PEPPER;
    }
    if (this.isProduction) {
      throw new Error('TOKEN_HASH_PEPPER is required in production');
    }
    return 'school-os-local-hash-pepper-change-me-at-least-32-chars';
  }

  get rateLimitEnabled() {
    return ['1', 'true', 'yes'].includes(
      (process.env.RATE_LIMIT_ENABLED ?? 'true').toLowerCase(),
    );
  }

  get authRateLimitWindow() {
    return Number(process.env.AUTH_RATE_LIMIT_WINDOW ?? 60);
  }

  get authRateLimitMax() {
    return Number(process.env.AUTH_RATE_LIMIT_MAX ?? 5);
  }

  get qrRateLimitWindow() {
    return Number(process.env.QR_RATE_LIMIT_WINDOW ?? 60);
  }

  get qrRateLimitMax() {
    return Number(process.env.QR_RATE_LIMIT_MAX ?? 10);
  }

  get apiKeyRateLimitWindow() {
    return Number(process.env.API_KEY_RATE_LIMIT_WINDOW ?? 60);
  }

  get apiKeyRateLimitMax() {
    return Number(process.env.API_KEY_RATE_LIMIT_MAX ?? 30);
  }

  get challengeSecret() {
    return process.env.JWT_CHALLENGE_SECRET ?? `${this.jwtSecret}-challenge`;
  }

  get accessTokenTtl() {
    return process.env.JWT_ACCESS_TTL ?? ACCESS_TOKEN_TTL;
  }

  get challengeTokenTtl() {
    return process.env.JWT_CHALLENGE_TTL ?? CHALLENGE_TOKEN_TTL;
  }

  get refreshTokenTtlDays() {
    return Number(process.env.JWT_REFRESH_TTL_DAYS ?? REFRESH_TOKEN_TTL_DAYS);
  }

  get bcryptRounds() {
    return Number(process.env.BCRYPT_ROUNDS ?? 12);
  }

  get refreshCookieName() {
    return process.env.REFRESH_COOKIE_NAME ?? AUTH_COOKIE_NAME;
  }

  get accessCookieName() {
    return process.env.ACCESS_COOKIE_NAME ?? ACCESS_COOKIE_NAME;
  }

  get cookieDomain() {
    return process.env.COOKIE_DOMAIN;
  }

  get cookieSameSite(): 'lax' | 'strict' | 'none' {
    const value = process.env.COOKIE_SAME_SITE?.toLowerCase();

    if (value === 'strict' || value === 'none') {
      return value;
    }

    return 'lax';
  }

  get frontendOrigins() {
    const rawOrigins = [
      process.env.FRONTEND_ORIGIN,
      ...(process.env.FRONTEND_ORIGINS?.split(',') ?? []),
    ]
      .map((origin) => origin?.trim())
      .filter((origin): origin is string => Boolean(origin));

    const devOrigins = this.isProduction
      ? []
      : ['http://localhost:3101', 'http://127.0.0.1:3101'];

    const baseOrigins = this.isProduction
      ? []
      : [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:5173',
          'http://localhost:4000',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:5173',
          'http://127.0.0.1:4000',
          ...devOrigins,
        ];

    return Array.from(new Set([...rawOrigins, ...baseOrigins]));
  }

  get otpTtlMinutes() {
    return Number(process.env.OTP_TTL_MINUTES ?? OTP_TTL_MINUTES);
  }

  get passwordResetTtlMinutes() {
    return Number(
      process.env.PASSWORD_RESET_TTL_MINUTES ?? PASSWORD_RESET_TTL_MINUTES,
    );
  }

  get otpLength() {
    return Number(process.env.OTP_LENGTH ?? OTP_LENGTH);
  }

  get otpIssueLimit() {
    return Number(process.env.OTP_ISSUE_LIMIT ?? OTP_ISSUE_LIMIT);
  }

  get otpIssueWindowMinutes() {
    return Number(
      process.env.OTP_ISSUE_WINDOW_MINUTES ?? OTP_ISSUE_WINDOW_MINUTES,
    );
  }

  get emailDeliveryMode() {
    return process.env.EMAIL_DELIVERY_MODE ?? 'log';
  }

  get emailWebhookUrl() {
    return process.env.EMAIL_WEBHOOK_URL;
  }

  get emailWebhookToken() {
    return process.env.EMAIL_WEBHOOK_TOKEN;
  }

  get emailFromAddress() {
    return process.env.EMAIL_FROM_ADDRESS ?? 'no-reply@schoolos.local';
  }

  get storageConfig(): SchoolOSStorageConfig {
    return normalizeStorageConfig(process.env);
  }

  get storageProvider(): SchoolOSStorageProvider {
    return this.storageConfig.provider;
  }

  get localStorageRoot() {
    return process.env.LOCAL_STORAGE_ROOT ?? 'storage';
  }

  get localStoragePublicBaseUrl() {
    return process.env.LOCAL_STORAGE_PUBLIC_BASE_URL ?? '/storage';
  }

  get libraryFinePerDay() {
    return Number(process.env.LIBRARY_FINE_PER_DAY ?? 10);
  }

  get libraryMaxBooksPerStudent() {
    return Number(process.env.LIBRARY_MAX_BOOKS_PER_STUDENT ?? 5);
  }

  get medicalEncryptionKey() {
    if (process.env.MEDICAL_ENCRYPTION_KEY) {
      return process.env.MEDICAL_ENCRYPTION_KEY;
    }

    if (this.isProduction) {
      throw new Error('MEDICAL_ENCRYPTION_KEY is required in production');
    }

    return 'school-os-local-medical-encryption-key-change-me';
  }

  get r2PublicBaseUrl() {
    return (
      process.env.OBJECT_STORAGE_PUBLIC_BASE_URL ??
      process.env.R2_PUBLIC_BASE_URL
    );
  }

  get r2Bucket() {
    return process.env.OBJECT_STORAGE_BUCKET ?? process.env.R2_BUCKET;
  }

  get r2Endpoint() {
    return process.env.OBJECT_STORAGE_ENDPOINT ?? process.env.R2_ENDPOINT;
  }

  get r2AccessKeyId() {
    return (
      process.env.OBJECT_STORAGE_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID
    );
  }

  get r2SecretAccessKey() {
    return (
      process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY ??
      process.env.R2_SECRET_ACCESS_KEY
    );
  }

  get r2Region() {
    return process.env.OBJECT_STORAGE_REGION ?? process.env.R2_REGION ?? 'auto';
  }

  get port() {
    return Number(process.env.PORT ?? 4000);
  }

  get redisHost() {
    return process.env.REDIS_HOST ?? 'localhost';
  }

  get redisPort() {
    return Number(process.env.REDIS_PORT ?? 6379);
  }

  get passwordResetAppUrl() {
    return process.env.PASSWORD_RESET_APP_URL ?? this.frontendOrigins[0];
  }

  get trustProxy() {
    return ['1', 'true', 'yes'].includes(
      (process.env.TRUST_PROXY ?? '').toLowerCase(),
    );
  }

  get isProduction() {
    return process.env.NODE_ENV === 'production';
  }

  get isProductionBootExplicitlyAllowed() {
    return ['1', 'true', 'yes'].includes(
      (process.env.ALLOW_PROD_BOOT ?? '').toLowerCase(),
    );
  }

  private validateNumericEnv() {
    const errors: string[] = [];
    const numericFields: Array<[string, number]> = [
      ['PORT', this.port],
      ['REDIS_PORT', this.redisPort],
      ['JWT_REFRESH_TTL_DAYS', this.refreshTokenTtlDays],
      ['BCRYPT_ROUNDS', this.bcryptRounds],
      ['OTP_TTL_MINUTES', this.otpTtlMinutes],
      ['PASSWORD_RESET_TTL_MINUTES', this.passwordResetTtlMinutes],
      ['OTP_LENGTH', this.otpLength],
      ['OTP_ISSUE_LIMIT', this.otpIssueLimit],
      ['OTP_ISSUE_WINDOW_MINUTES', this.otpIssueWindowMinutes],
      ['LIBRARY_FINE_PER_DAY', this.libraryFinePerDay],
    ];

    for (const [name, value] of numericFields) {
      if (!Number.isFinite(value) || value <= 0) {
        errors.push(`${name} must be a positive number`);
      }
    }

    if (this.bcryptRounds < 10) {
      errors.push('BCRYPT_ROUNDS must be at least 10');
    }

    return errors;
  }

  private validateProductionEnv() {
    const errors: string[] = [];

    if (!this.isProductionBootExplicitlyAllowed) {
      errors.push(
        'ALLOW_PROD_BOOT=true is required when NODE_ENV=production to prevent accidental prod startup',
      );
    }

    if (!process.env.DATABASE_URL) {
      errors.push('DATABASE_URL is required in production');
    }

    this.requireProductionSecret(
      errors,
      'JWT_SECRET',
      process.env.JWT_SECRET,
      'school-os-access-secret',
    );
    this.requireProductionSecret(
      errors,
      'JWT_CHALLENGE_SECRET',
      process.env.JWT_CHALLENGE_SECRET,
      `${this.jwtSecret}-challenge`,
    );
    this.requireProductionSecret(
      errors,
      'MEDICAL_ENCRYPTION_KEY',
      process.env.MEDICAL_ENCRYPTION_KEY,
      'school-os-local-medical-encryption-key-change-me',
    );
    this.requireProductionSecret(
      errors,
      'TOKEN_HASH_PEPPER',
      process.env.TOKEN_HASH_PEPPER,
      'school-os-local-hash-pepper-change-me-at-least-32-chars',
    );

    if (process.env.JWT_ISSUER === 'schoolos' || !process.env.JWT_ISSUER) {
      errors.push(
        'JWT_ISSUER is required in production and must not be default',
      );
    }
    if (
      process.env.JWT_AUDIENCE_WEB === 'schoolos-web' ||
      !process.env.JWT_AUDIENCE_WEB
    ) {
      errors.push(
        'JWT_AUDIENCE_WEB is required in production and must not be default',
      );
    }
    if (
      process.env.JWT_AUDIENCE_MOBILE === 'schoolos-mobile' ||
      !process.env.JWT_AUDIENCE_MOBILE
    ) {
      errors.push(
        'JWT_AUDIENCE_MOBILE is required in production and must not be default',
      );
    }

    if (!process.env.FRONTEND_ORIGIN && !process.env.FRONTEND_ORIGINS?.trim()) {
      errors.push(
        'FRONTEND_ORIGIN or FRONTEND_ORIGINS is required in production',
      );
    }

    for (const origin of this.frontendOrigins) {
      if (origin === '*') {
        errors.push(
          'Wildcard (*) CORS origin is not allowed in production when credentials are enabled',
        );
      }
      try {
        const parsedOrigin = new URL(origin);
        if (parsedOrigin.protocol !== 'https:') {
          errors.push(`Frontend origin ${origin} must use https in production`);
        }
      } catch {
        errors.push(`Frontend origin ${origin} must be a valid URL`);
      }
    }

    if (!process.env.REDIS_HOST) {
      errors.push('REDIS_HOST is required in production');
    }

    if (this.cookieSameSite === 'none' && !this.trustProxy) {
      errors.push('TRUST_PROXY=true is required when COOKIE_SAME_SITE=none');
    }

    if (this.emailDeliveryMode === 'webhook') {
      if (!this.emailWebhookUrl) {
        errors.push(
          'EMAIL_WEBHOOK_URL is required when EMAIL_DELIVERY_MODE=webhook',
        );
      }
      if (!this.emailWebhookToken) {
        errors.push(
          'EMAIL_WEBHOOK_TOKEN is required when EMAIL_DELIVERY_MODE=webhook',
        );
      }
    }

    return errors;
  }

  private validateStorageEnv() {
    try {
      normalizeStorageConfig(process.env);
      return [];
    } catch (error) {
      return [
        error instanceof Error
          ? error.message
          : 'Storage configuration is invalid',
      ];
    }
  }

  private requireProductionSecret(
    errors: string[],
    name: string,
    value: string | undefined,
    unsafeDefault: string,
  ) {
    if (!value) {
      errors.push(`${name} is required in production`);
      return;
    }

    if (value === unsafeDefault || value.length < 32) {
      errors.push(
        `${name} must be at least 32 characters and not a local default`,
      );
    }
  }
}
