import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '../../config/config.service';
import { AuthenticatedRequest } from '../auth-request.interface';
import { JwtAccessPayload } from '../auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = header.slice(7);
    let payload: JwtAccessPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtAccessPayload>(token, {
        secret: this.configService.jwtSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    request.auth = {
      userId: payload.sub,
      tenantId: payload.tenantId,
      tenantSlug: payload.tenantSlug,
      email: payload.email,
      authMethod: payload.authMethod,
      roles: payload.roles,
      permissions: payload.permissions,
    };

    return true;
  }
}
