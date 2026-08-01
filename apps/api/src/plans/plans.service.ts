import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

import { EntitlementsService } from './entitlements.service';
import { RequestCacheService } from '../common/cache/request-cache.service';
import { SUSPENDED_TENANT_MESSAGE } from './tenant-access.constants';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementsService: EntitlementsService,
    private readonly requestCache: RequestCacheService,
  ) {}

  /**
   * Read by `EntitlementGuard` on every request and again by
   * `checkFeatureEnabled`. Memoized per request only — see
   * `RequestCacheService`. Suspension still fails closed on the next request.
   */
  async getTenantStatus(tenantId: string) {
    return this.requestCache.resolve(`tenantStatus:${tenantId}`, () =>
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, isActive: true },
      }),
    );
  }

  async assertTenantActive(tenantId: string): Promise<void> {
    if (tenantId === 'platform') {
      return;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, isActive: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    if (!tenant.isActive) {
      throw new ForbiddenException(SUSPENDED_TENANT_MESSAGE);
    }
  }

  async shouldProcessTenantJob(
    tenantId: string | null | undefined,
  ): Promise<boolean> {
    if (!tenantId || tenantId === 'platform') {
      return true;
    }

    const tenant = await this.getTenantStatus(tenantId);
    return Boolean(tenant?.isActive);
  }

  async checkFeatureEnabled(
    tenantId: string,
    featureKey: string,
  ): Promise<EntitlementCheckResult> {
    // Reuses the request-memoized status read rather than issuing a third
    // identical `Tenant` query per request (BASELINE_RESULTS.md §6, queries
    // 7/8/10). Behaviour is unchanged: same row, same fail-closed semantics.
    const tenant = await this.getTenantStatus(tenantId);

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    if (!tenant.isActive) {
      return {
        allowed: false,
        reason: 'tenant_inactive',
        message: SUSPENDED_TENANT_MESSAGE,
      };
    }

    // Subscription presence now comes from the same resolved entitlement state
    // the feature check uses, instead of a separate `TenantSubscription` query
    // per request. Same predicate (`status in ACTIVE/TRIAL/GRACE`), same
    // `subscription_missing` reason — one fewer round-trip.
    const planState =
      await this.entitlementsService.getPlanEntitlementState(tenantId);

    if (!planState.hasActiveSubscription) {
      return {
        allowed: false,
        reason: 'subscription_missing',
        message: 'No active subscription found for your tenant.',
      };
    }

    const allowed = await this.entitlementsService.checkFeatureEnabled(
      tenantId,
      featureKey,
    );

    if (!allowed) {
      return {
        allowed: false,
        reason: 'feature_locked',
        message: `The feature '${featureKey}' is not included in your current subscription plan.`,
      };
    }

    return { allowed: true };
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
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isActive: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    if (!tenant.isActive) {
      throw new ForbiddenException(SUSPENDED_TENANT_MESSAGE);
    }

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
          'No active subscription found. Free limit of 10 reached. Please contact SchoolOS support.',
        );
      }
      return;
    }

    const limit = subscription.plan?.usageLimits?.[0];
    if (limit && currentCount >= limit.limit) {
      throw new ForbiddenException(
        `Plan limit reached for ${usageKey}. Current: ${currentCount}, Limit: ${limit.limit}. Please upgrade your plan or contact SchoolOS support.`,
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
