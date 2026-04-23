import { Injectable } from '@nestjs/common';
import {
  ACCESS_TOKEN_TTL,
  AUTH_COOKIE_NAME,
  CHALLENGE_TOKEN_TTL,
  OTP_ISSUE_LIMIT,
  OTP_ISSUE_WINDOW_MINUTES,
  OTP_LENGTH,
  OTP_TTL_MINUTES,
  PASSWORD_RESET_TTL_MINUTES,
  REFRESH_TOKEN_TTL_DAYS,
} from '../auth/auth.constants';

@Injectable()
export class ConfigService {
  get jwtSecret() {
    return process.env.JWT_SECRET ?? 'school-os-access-secret';
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

    if (rawOrigins.length > 0) {
      return Array.from(new Set(rawOrigins));
    }

    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:4000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:4000',
    ];
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
}
