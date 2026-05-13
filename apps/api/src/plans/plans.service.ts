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

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async checkFeatureEnabled(
    tenantId: string,
    featureKey: string,
  ): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isActive: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    if (!tenant.isActive) {
      return false;
    }

    // 1. Check for manual overrides
    const override = await this.prisma.tenantFeatureOverride.findUnique({
      where: { tenantId_featureKey: { tenantId, featureKey } },
    });

    if (override) {
      return override.enabled;
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
      return false;
    }

    // 3. Check plan features
    const feature = subscription.plan?.features?.[0];
    return feature?.enabled ?? false;
  }

  async checkModuleEnabled(
    tenantId: string,
    moduleName: string,
  ): Promise<boolean> {
    return this.checkFeatureEnabled(tenantId, `module.${moduleName}`);
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
      throw new ForbiddenException('No active subscription found');
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
