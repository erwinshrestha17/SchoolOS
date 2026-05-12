import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthContext } from '../auth/auth.types';
import { AuthenticatedRequest } from '../auth/auth-request.interface';
import { PrismaService } from '../prisma/prisma.service';
import { FEATURE_ENTITLEMENTS_KEY } from './feature-entitlement.decorator';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['TRIAL', 'ACTIVE', 'GRACE']);

@Injectable()
export class FeatureEntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const featureKeys =
      this.reflector.getAllAndOverride<string[]>(FEATURE_ENTITLEMENTS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (featureKeys.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = request.auth;
    if (!auth) throw new UnauthorizedException('Authentication required');

    for (const featureKey of featureKeys) {
      await this.assertFeatureAllowed(auth, featureKey);
    }

    return true;
  }

  private async assertFeatureAllowed(actor: AuthContext, featureKey: string) {
    const override = await this.prisma.tenantFeatureOverride.findUnique({
      where: {
        tenantId_featureKey: {
          tenantId: actor.tenantId,
          featureKey,
        },
      },
      select: { enabled: true },
    });

    if (override?.enabled === false) {
      throw new ForbiddenException(
        `Feature ${featureKey} is disabled for this tenant`,
      );
    }

    if (override?.enabled === true) return;

    const subscription = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId: actor.tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: {
          include: {
            features: {
              where: { featureKey },
              select: { enabled: true },
            },
          },
        },
      },
    });

    if (!subscription) {
      return;
    }

    if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
      throw new ForbiddenException(
        `Feature ${featureKey} is unavailable because the tenant subscription is ${subscription.status}`,
      );
    }

    if (subscription.plan.status !== 'ACTIVE') {
      throw new ForbiddenException(
        `Feature ${featureKey} is unavailable because the tenant plan is not active`,
      );
    }

    const feature = subscription.plan.features[0];
    if (!feature?.enabled) {
      throw new ForbiddenException(
        `Feature ${featureKey} is not included in the tenant plan`,
      );
    }
  }
}
