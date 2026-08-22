import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { AuthMethod, SecurityDomain } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PlatformApiKeysService } from '../../platform/platform-api-keys.service';
import { TENANT_ID_KEY } from '../../prisma/prisma.service';
import { AuthenticatedRequest } from '../auth-request.interface';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    @Inject(forwardRef(() => PlatformApiKeysService))
    private readonly apiKeysService: PlatformApiKeysService,
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const apiKey = this.extractApiKey(request);
    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    const validated = await this.apiKeysService.validateApiKey(apiKey);
    if (!validated) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Set request.auth context for API key access
    request.auth = {
      userId: 'api-key-integration',
      tenantId: validated.tenantId,
      originalTenantId: validated.tenantId,
      isSupportOverride: false,
      securityDomain: SecurityDomain.SCHOOL,
      tenantSlug: '',
      email: null,
      authMethod: AuthMethod.PASSWORD,
      roles: ['api_key_integration'],
      permissions: validated.scopes,
    };

    // Bind the tenant into CLS so PrismaService's tenant-scoping extension
    // applies. Without this the extension sees `undefined` and returns query
    // args unchanged -- i.e. every query on an API-key request would run with
    // no tenant filter at all. Mirrors JwtAuthGuard.
    const hasActiveCls =
      typeof this.cls.isActive === 'function' ? this.cls.isActive() : true;

    if (hasActiveCls) {
      this.cls.set(TENANT_ID_KEY, validated.tenantId);
    }

    return true;
  }

  private extractApiKey(request: AuthenticatedRequest): string | null {
    const headerKey = request.headers['x-api-key'];
    if (headerKey) {
      if (Array.isArray(headerKey)) {
        return headerKey[0];
      }
      return headerKey;
    }

    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer sk_schoolos_')) {
      return authHeader.slice(7);
    }

    return null;
  }
}
