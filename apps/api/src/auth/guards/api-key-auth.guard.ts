import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { AuthMethod } from '@prisma/client';
import { PlatformApiKeysService } from '../../platform/platform-api-keys.service';
import { AuthenticatedRequest } from '../auth-request.interface';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    @Inject(forwardRef(() => PlatformApiKeysService))
    private readonly apiKeysService: PlatformApiKeysService,
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
      tenantSlug: '',
      email: null,
      authMethod: AuthMethod.PASSWORD,
      roles: ['api_key_integration'],
      permissions: validated.scopes,
    };

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

    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer sk_schoolos_')) {
      return authHeader.slice(7);
    }

    return null;
  }
}
