import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PlansService } from '../../plans/plans.service';
import { AuthenticatedRequest } from '../auth-request.interface';

@Injectable()
export class TenantActiveGuard implements CanActivate {
  constructor(private readonly plansService: PlansService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenantId = request.auth?.tenantId;

    if (!tenantId) {
      throw new UnauthorizedException('Authentication required');
    }

    if (tenantId === 'platform') {
      return true;
    }

    await this.plansService.assertTenantActive(tenantId);
    return true;
  }
}
