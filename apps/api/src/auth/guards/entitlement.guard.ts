import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ENTITLEMENT_KEY } from '../decorators/entitlement.decorator';
import { PlansService } from '../../plans/plans.service';
import { AuthenticatedRequest } from '../auth-request.interface';

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly plansService: PlansService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.getAllAndOverride<string>(
      ENTITLEMENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!featureKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenantId = request.auth?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant identification missing');
    }

    // Platform level requests don't need entitlement checks for tenant features
    if (tenantId === 'platform') {
      return true;
    }

    const result = await this.plansService.checkFeatureEnabled(
      tenantId,
      featureKey,
    );

    if (!result.allowed) {
      throw new ForbiddenException(
        result.message ||
          `Feature '${featureKey}' is not enabled for your tenant.`,
      );
    }

    return true;
  }
}
