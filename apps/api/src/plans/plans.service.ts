import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export enum PlanKey {
  FREE = 'free',
  BASIC = 'basic',
  STANDARD = 'standard',
  PREMIUM = 'premium',
}

export interface EntitlementCheckResult {
  allowed: boolean;
  reason?:
    | 'tenant_inactive'
    | 'subscription_missing'
    | 'feature_locked'
    | 'usage_limit_exceeded';
  message?: string;
}

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async getTenantStatus(tenantId: string) {
    return this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, isActive: true },
    });
  }

  async checkFeatureEnabled(
    tenantId: string,
    featureKey: string,
  ): Promise<EntitlementCheckResult> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isActive: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    if (!tenant.isActive) {
      return {
        allowed: false,
        reason: 'tenant_inactive',
        message:
          'Your school account is currently suspended. Please contact platform support.',
      };
    }

    // 1. Check for manual overrides
    const override = await this.prisma.tenantFeatureOverride.findUnique({
      where: { tenantId_featureKey: { tenantId, featureKey } },
    });

    if (override) {
      return {
        allowed: override.enabled,
        reason: override.enabled ? undefined : 'feature_locked',
        message: override.enabled
          ? undefined
          : `The feature '${featureKey}' has been manually disabled for your tenant.`,
      };
    }

    // 2. Check active subscription
    const subscription = await this.prisma.tenantSubscription.findFirst({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'TRIAL', 'GRACE'] },
      },
      include: {
        plan: {
          include: {
            features: {
              where: { featureKey },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return {
        allowed: false,
        reason: 'subscription_missing',
        message: 'No active subscription found for your tenant.',
      };
    }

    // 3. Check plan features
    const feature = subscription.plan?.features?.[0];
    const allowed = feature?.enabled ?? false;

    return {
      allowed,
      reason: allowed ? undefined : 'feature_locked',
      message: allowed
        ? undefined
        : `The feature '${featureKey}' is not included in your current '${subscription.plan?.name}' plan.`,
    };
  }

  async checkModuleEnabled(
    tenantId: string,
    moduleName: string,
  ): Promise<boolean> {
    const result = await this.checkFeatureEnabled(
      tenantId,
      `module.${moduleName}`,
    );
    return result.allowed;
  }

  async validateLimit(
    tenantId: string,
    usageKey: string,
    currentCount: number,
  ) {
    const subscription = await this.prisma.tenantSubscription.findFirst({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'TRIAL', 'GRACE'] },
      },
      include: {
        plan: {
          include: {
            usageLimits: {
              where: { usageKey },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      // Default free limits if no subscription
      if (
        currentCount >= 10 &&
        (usageKey === 'students.count' || usageKey === 'staff.count')
      ) {
        throw new ForbiddenException(
          'No active subscription found. Free limit of 10 reached.',
        );
      }
      return;
    }

    const limit = subscription.plan?.usageLimits?.[0];
    if (limit && currentCount >= limit.limit) {
      throw new ForbiddenException(
        `Plan limit reached for ${usageKey}. Current: ${currentCount}, Limit: ${limit.limit}. Please upgrade your plan.`,
      );
    }
  }

  async getTenantPlan(tenantId: string): Promise<string> {
    const subscription = await this.prisma.tenantSubscription.findFirst({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'TRIAL', 'GRACE'] },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    return subscription?.plan?.key || 'free';
  }
}
