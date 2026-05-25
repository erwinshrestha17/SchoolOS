import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ENTITLEMENT_KEY } from '../decorators/entitlement.decorator';
import { REQUIRED_MODULE_KEY } from '../decorators/required-module.decorator';
import { REQUIRED_FEATURE_KEY } from '../decorators/required-feature.decorator';
import { PlansService } from '../../plans/plans.service';
import { EntitlementsService } from '../../plans/entitlements.service';
import { AuthenticatedRequest } from '../auth-request.interface';

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly plansService: PlansService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.getAllAndOverride<string>(
      REQUIRED_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredFeature = this.reflector.getAllAndOverride<string>(
      REQUIRED_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const featureKey = this.reflector.getAllAndOverride<string>(
      ENTITLEMENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenantId = request.auth?.tenantId;

    console.log('Guard inputs at top:', {
      requiredModule,
      requiredFeature,
      featureKey,
      tenantId,
    });

    if (!requiredModule && !requiredFeature && !featureKey) {
      return true;
    }

    if (!tenantId) {
      throw new ForbiddenException('Tenant identification missing');
    }

    // Platform level requests don't need entitlement checks for tenant features
    if (tenantId === 'platform') {
      return true;
    }

    // Check if tenant is active/suspended
    const tenantStatus = await this.plansService.getTenantStatus(tenantId);
    if (!tenantStatus) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    if (!tenantStatus.isActive) {
      throw new ForbiddenException(
        'Your school account is currently suspended. Please contact platform support.',
      );
    }

    // 1. Check required module if present
    if (requiredModule) {
      const allowed = await this.entitlementsService.checkModuleEnabled(
        tenantId,
        requiredModule,
      );
      console.log('Check module allowed:', allowed);
      if (!allowed) {
        throw new ForbiddenException(
          `The module '${requiredModule}' is not included in your school's subscription plan. Please contact the school administrator to upgrade.`,
        );
      }
    }

    // 2. Check required feature if present
    if (requiredFeature) {
      const allowed = await this.entitlementsService.checkFeatureEnabled(
        tenantId,
        requiredFeature,
      );
      if (!allowed) {
        throw new ForbiddenException(
          `The feature '${requiredFeature}' is not included in your school's subscription plan. Please contact the school administrator to upgrade.`,
        );
      }
    }

    // 3. Check legacy feature key if present (keeping PlansService call for contract spec)
    if (featureKey) {
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
    }

    return true;
  }
}
