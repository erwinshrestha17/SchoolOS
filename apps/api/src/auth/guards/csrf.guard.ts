import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { parseCookie, verifyCsrfToken } from '../auth.utils';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // 1. Safe methods do not require CSRF
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(request.method)) {
      return true;
    }

    // 2. Bearer token requests (mobile/API clients) do not require CSRF
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return true;
    }

    // 3. Allow public unauthenticated paths like login/register/otp
    const path = request.path;
    const publicPrefixes = [
      '/api/v1/auth/login',
      '/api/v1/auth/otp/',
      '/api/v1/auth/password-recovery/',
      '/api/v1/tenants/register',
    ];
    if (publicPrefixes.some((prefix) => path.startsWith(prefix))) {
      return true;
    }

    // 4. Validate double-submit CSRF cookie
    const cookieName = this.configService.isProduction
      ? '__Host-schoolos_csrf'
      : 'schoolos_csrf';

    const csrfCookie = parseCookie(request.headers.cookie, cookieName);
    const csrfHeader = request.headers['x-csrf-token'];

    if (!csrfCookie) {
      throw new ForbiddenException('CSRF cookie missing');
    }

    if (!csrfHeader) {
      throw new ForbiddenException('CSRF header missing');
    }

    if (csrfCookie !== csrfHeader) {
      throw new ForbiddenException('CSRF token mismatch');
    }

    // 5. Cryptographically verify signature
    const isValid = verifyCsrfToken(csrfCookie, this.configService.jwtSecret);
    if (!isValid) {
      throw new ForbiddenException('Invalid CSRF token signature');
    }

    return true;
  }
}
