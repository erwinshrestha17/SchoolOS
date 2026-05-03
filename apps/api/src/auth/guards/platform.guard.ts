import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../auth-request.interface';

@Injectable()
export class PlatformGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = request.auth;

    if (!auth) {
      throw new UnauthorizedException('Authentication required');
    }

    const isPlatformAdmin = auth.roles.includes('platform_super_admin');
    const isPlatformSupport = auth.roles.includes('platform_support');
    const isPlatformBilling = auth.roles.includes('platform_billing_admin');

    if (!isPlatformAdmin && !isPlatformSupport && !isPlatformBilling) {
      throw new ForbiddenException(
        'Access restricted to platform administrators only',
      );
    }

    return true;
  }
}
