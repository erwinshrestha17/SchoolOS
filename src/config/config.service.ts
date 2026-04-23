import { Injectable } from '@nestjs/common';
import {
  ACCESS_TOKEN_TTL,
  AUTH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_DAYS,
} from '../auth/auth.constants';

@Injectable()
export class ConfigService {
  get jwtSecret() {
    return process.env.JWT_SECRET ?? 'school-os-access-secret';
  }

  get accessTokenTtl() {
    return process.env.JWT_ACCESS_TTL ?? ACCESS_TOKEN_TTL;
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

  get isProduction() {
    return process.env.NODE_ENV === 'production';
  }
}
