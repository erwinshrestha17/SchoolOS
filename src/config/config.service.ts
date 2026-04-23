// config.service.ts - replace your current one
import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import {
  ACCESS_TOKEN_TTL,
  AUTH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_DAYS,
} from '../auth/auth.constants';

@Injectable()
export class ConfigService {
  constructor(private readonly config: NestConfigService) {}

  get jwtSecret() {
    return this.config.get<string>('JWT_SECRET') ?? 'school-os-access-secret';
  }

  get accessTokenTtl() {
    return this.config.get<string>('JWT_ACCESS_TTL') ?? ACCESS_TOKEN_TTL;
  }

  get refreshTokenTtlDays() {
    return Number(
      this.config.get<string>('JWT_REFRESH_TTL_DAYS') ?? REFRESH_TOKEN_TTL_DAYS,
    );
  }

  get bcryptRounds() {
    return Number(this.config.get<string>('BCRYPT_ROUNDS') ?? 12);
  }

  get refreshCookieName() {
    return this.config.get<string>('REFRESH_COOKIE_NAME') ?? AUTH_COOKIE_NAME;
  }

  get isProduction() {
    return this.config.get<string>('NODE_ENV') === 'production';
  }
}
