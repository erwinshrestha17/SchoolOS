import { Injectable, ExecutionContext } from '@nestjs/common';
import {
  ThrottlerGuard,
  type ThrottlerStorage,
  type ThrottlerModuleOptions,
  type ThrottlerRequest,
} from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '../../config/config.service';

interface ThrottledHttpRequest {
  path?: string;
  headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    super(options, storageService, reflector);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.configService.rateLimitEnabled) {
      return true;
    }
    return super.canActivate(context);
  }

  protected override async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    const { context, throttler } = requestProps;
    const req = context.switchToHttp().getRequest<ThrottledHttpRequest>();
    const path = req.path ?? '';

    // Determine the rate limit parameters based on request path/throttler name/headers
    let limit = requestProps.limit;
    let ttl = requestProps.ttl;

    const apiKeyHeader = req.headers['x-api-key'];
    const authorizationHeader = req.headers.authorization;
    const hasBearerApiKeyHeader = Array.isArray(authorizationHeader)
      ? authorizationHeader.some((header) =>
          header.startsWith('Bearer sk_schoolos_'),
        )
      : (authorizationHeader?.startsWith('Bearer sk_schoolos_') ?? false);
    const hasApiKeyHeader =
      typeof apiKeyHeader !== 'undefined' || hasBearerApiKeyHeader;

    if (throttler.name === 'auth' || path.includes('/api/v1/auth/')) {
      limit = this.configService.authRateLimitMax;
      ttl = this.configService.authRateLimitWindow * 1000;
    } else if (
      throttler.name === 'qr' ||
      path.includes('/students/qr/resolve') ||
      path.endsWith('/qr')
    ) {
      limit = this.configService.qrRateLimitMax;
      ttl = this.configService.qrRateLimitWindow * 1000;
    } else if (
      throttler.name === 'apiKey' ||
      path.includes('/platform/api-keys') ||
      hasApiKeyHeader
    ) {
      limit = this.configService.apiKeyRateLimitMax;
      ttl = this.configService.apiKeyRateLimitWindow * 1000;
    }

    return super.handleRequest({
      ...requestProps,
      limit,
      ttl,
    });
  }
}
