import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestCacheService } from '../common/cache/request-cache.service';
import { RedisCacheService } from '../common/cache/redis-cache.service';
import {
  SubscriptionTier,
  ENTITLEMENT_MATRIX,
  FEATURE_KEYS,
  STANDARD_ALLOWED_ADDONS,
  CUSTOMER_MODULES,
} from '@schoolos/core';

export interface EntitlementsResponse {
  tier: SubscriptionTier | null;
  modules: string[];
  features: string[];
  addOns: string[];
}

/**
 * Internal shape stored in Redis. `hasActiveSubscription` lets `PlansService`
 * report `subscription_missing` without a second subscription query; it is
 * stripped before the public `EntitlementsResponse` is returned.
 */
export interface CachedPlanEntitlements extends EntitlementsResponse {
  hasActiveSubscription: boolean;
}

const EMPTY_ENTITLEMENTS: EntitlementsResponse = {
  tier: null,
  modules: [],
  features: [],
  addOns: [],
};

/**
 * TTL is a backstop for a missed invalidation, not the invalidation mechanism.
 * Suspension is unaffected by it — that check is live, outside this cache.
 */
const PLAN_ENTITLEMENTS_TTL_SECONDS = 300;

export function planEntitlementsKey(tenantId: string) {
  return `entitlements:plan:${tenantId}`;
}

const ADDON_ENTITLEMENTS: Record<
  string,
  { modules: string[]; features: string[] }
> = {
  library: {
    modules: ['library'],
    features: [FEATURE_KEYS.LIBRARY_BASIC, FEATURE_KEYS.LIBRARY_FULL],
  },
  transport: {
    modules: ['transport'],
    features: [
      FEATURE_KEYS.TRANSPORT_BASIC,
      FEATURE_KEYS.TRANSPORT_FULL,
      FEATURE_KEYS.GPS_LIVE_TRACKING,
    ],
  },
  canteen: {
    modules: ['canteen'],
    features: [
      FEATURE_KEYS.CANTEEN_BASIC,
      FEATURE_KEYS.CANTEEN_FULL,
      FEATURE_KEYS.CANTEEN_WALLET_CONTROLS,
    ],
  },
};

@Injectable()
export class EntitlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestCache: RequestCacheService,
    private readonly redisCache: RedisCacheService,
  ) {}

  /**
   * Drop the cached plan projection for one tenant.
   *
   * Must be called after any write to that tenant's subscription, plan
   * assignment, or feature overrides. Writes to `Tenant.isActive` do **not**
   * need this — suspension is evaluated live on every request.
   *
   * The complete set of call sites is listed in
   * docs/performance/CONCURRENCY_CORRECTNESS.md §7.
   */
  async invalidateTenantEntitlements(tenantId: string): Promise<void> {
    await this.redisCache.invalidate(planEntitlementsKey(tenantId));
  }

  /**
   * Drop the cached plan projection for **every** tenant.
   *
   * Editing a `PlatformPlanFeature` changes what every tenant on that plan is
   * entitled to, and the cache is keyed by tenant, so there is no narrower
   * correct invalidation without first resolving the affected tenant set.
   * Platform plan edits are rare; a full flush is the safe choice.
   */
  async invalidateAllTenantEntitlements(): Promise<void> {
    await this.redisCache.invalidatePrefix('entitlements:plan:');
  }

  /**
   * Helper to filter out M0 / platform-related modules or features.
   * M0 is internal/developer/platform-only and must never be exposed to customers.
   */
  private isM0OrPlatform(key: string): boolean {
    const lower = key.toLowerCase();
    return (
      lower === 'm0' ||
      lower === 'platform' ||
      lower.startsWith('module.platform') ||
      lower.startsWith('module.m0') ||
      lower.startsWith('feature.platform') ||
      lower.startsWith('feature.m0') ||
      lower.includes('platform') ||
      lower.includes('m0')
    );
  }

  /**
   * Entitlement resolution is read several times per request by the guard
   * stack and again by handlers, always with the same `tenantId` and always
   * returning the same near-static rows. Memoizing for the lifetime of the
   * request removed the duplicate `Tenant` / `TenantSubscription` reads
   * documented in docs/performance/BASELINE_RESULTS.md §6 without introducing
   * any cross-request staleness: the next request re-reads from PostgreSQL, so
   * suspension and entitlement changes still take effect immediately.
   */
  async getEntitlements(tenantId: string): Promise<EntitlementsResponse> {
    const { hasActiveSubscription: _ignored, ...entitlements } =
      await this.getPlanEntitlementState(tenantId);
    return entitlements;
  }

  /**
   * Entitlement resolution, split into a **live** suspension check and a
   * **cached** plan projection.
   *
   * The suspension check must never be cached: `AGENTS.md` requires suspended
   * tenants to fail closed, and caching a response that encodes `isActive`
   * would keep a just-suspended tenant working until the entry expired. So the
   * tenant row is read live (in practice for free — `JwtAuthGuard` already
   * seeded it into the request cache from its own liveness read) and only the
   * plan-derived half goes to Redis.
   *
   * The cached half depends solely on `TenantSubscription`, `PlatformPlan`,
   * `PlatformPlanFeature` and `TenantFeatureOverride`. None of those encode
   * tenant suspension, so a stale entry can never widen access for a suspended
   * tenant — the live check above rejects first.
   *
   * `hasActiveSubscription` is carried internally so `PlansService` can
   * distinguish "no subscription" from "feature not in plan" without issuing
   * its own subscription query. It is stripped from the public response.
   */
  async getPlanEntitlementState(
    tenantId: string,
  ): Promise<CachedPlanEntitlements> {
    return this.requestCache.resolve(`entitlements:${tenantId}`, async () => {
      // Shares the `tenantStatus:` key with `PlansService.getTenantStatus`,
      // which `JwtAuthGuard` seeds from its live read.
      const tenant = await this.requestCache.resolve(
        `tenantStatus:${tenantId}`,
        () =>
          this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { id: true, isActive: true },
          }),
      );

      if (!tenant) {
        throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
      }

      if (!tenant.isActive) {
        return { ...EMPTY_ENTITLEMENTS, hasActiveSubscription: false };
      }

      return this.redisCache.resolve(
        planEntitlementsKey(tenantId),
        PLAN_ENTITLEMENTS_TTL_SECONDS,
        () => this.loadPlanEntitlements(tenantId),
      );
    });
  }

  private async loadPlanEntitlements(
    tenantId: string,
  ): Promise<CachedPlanEntitlements> {
    // 1. Fetch active subscription
    const subscription = await this.prisma.tenantSubscription.findFirst({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'TRIAL', 'GRACE'] },
      },
      include: {
        plan: {
          include: {
            features: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return { ...EMPTY_ENTITLEMENTS, hasActiveSubscription: false };
    }

    // Resolve SubscriptionTier from subscription plan key
    let tier: SubscriptionTier | null = null;
    const planKey = subscription.plan?.key?.toUpperCase() ?? '';

    if (planKey.includes('STARTER')) {
      tier = SubscriptionTier.STARTER;
    } else if (planKey.includes('STANDARD')) {
      tier = SubscriptionTier.STANDARD;
    } else if (
      planKey.includes('PROFESSIONAL') ||
      planKey.includes('PREMIUM')
    ) {
      tier = SubscriptionTier.PROFESSIONAL;
    } else if (planKey.includes('ENTERPRISE')) {
      tier = SubscriptionTier.ENTERPRISE;
    }

    const modulesSet = new Set<string>();
    const featuresSet = new Set<string>();

    if (tier) {
      const matrix = ENTITLEMENT_MATRIX[tier];
      matrix.modules.forEach((m) => modulesSet.add(m));
      matrix.features.forEach((f) => featuresSet.add(f));
    }

    // Add database-defined plan features
    if (subscription.plan?.features) {
      for (const f of subscription.plan.features) {
        const resolved = resolvePlanFeatureKey(f.featureKey);
        if (resolved.type === 'module') {
          applyModuleCompatibility(modulesSet, resolved.moduleName, f.enabled);
          if (!f.enabled) {
            purgeLegacyModuleFeatureKeys(featuresSet, resolved.moduleName);
          }
          continue;
        }

        if (f.enabled) {
          featuresSet.add(resolved.featureKey);
        } else {
          featuresSet.delete(resolved.featureKey);
        }
      }
    }

    // 2. Standard tier: apply add-ons if enabled
    const activeAddOns: string[] = [];
    if (tier === SubscriptionTier.STANDARD && subscription.addOns) {
      for (const addon of subscription.addOns) {
        const addonLower = addon.toLowerCase();
        if (STANDARD_ALLOWED_ADDONS.includes(addonLower)) {
          activeAddOns.push(addonLower);
          const entitlements = ADDON_ENTITLEMENTS[addonLower];
          if (entitlements) {
            entitlements.modules.forEach((m) => modulesSet.add(m));
            entitlements.features.forEach((f) => featuresSet.add(f));
          }
        }
      }
    }

    // 3. Apply tenant-specific feature overrides
    const overrides = await this.prisma.tenantFeatureOverride.findMany({
      where: { tenantId },
    });

    for (const override of overrides) {
      const key = override.featureKey;
      if (override.enabled) {
        if (key.startsWith('module.')) {
          applyModuleCompatibility(
            modulesSet,
            key.replace('module.', ''),
            true,
          );
        } else {
          featuresSet.add(key);
        }
      } else {
        if (key.startsWith('module.')) {
          const moduleName = key.replace('module.', '');
          applyModuleCompatibility(modulesSet, moduleName, false);
          purgeLegacyModuleFeatureKeys(featuresSet, moduleName);
        } else {
          featuresSet.delete(key);
        }
      }
    }

    // Chat is removed from the active product. Preserve legacy keys in
    // storage, but never surface them as enabled product entitlements.
    modulesSet.delete('communications');
    modulesSet.delete('messaging');
    modulesSet.delete('chat');
    featuresSet.delete(FEATURE_KEYS.MOBILE_PARENT_TEACHER_CHAT);
    for (const feature of Array.from(featuresSet)) {
      if (feature.startsWith('feature.chat.')) featuresSet.delete(feature);
    }

    // Filter out M0 / platform-related features and modules
    const modules = Array.from(modulesSet).filter(
      (m) => !this.isM0OrPlatform(m) && !this.isM0OrPlatform(`module.${m}`),
    );
    const features = Array.from(featuresSet).filter(
      (f) => !this.isM0OrPlatform(f),
    );

    return {
      tier,
      modules,
      features,
      addOns: tier === SubscriptionTier.STANDARD ? activeAddOns : [],
      hasActiveSubscription: true,
    };
  }

  async checkFeatureEnabled(
    tenantId: string,
    featureKey: string,
  ): Promise<boolean> {
    if (this.isM0OrPlatform(featureKey)) {
      return false;
    }
    if (featureKey.startsWith('module.')) {
      return this.checkModuleEnabled(tenantId, featureKey);
    }
    const entitlements = await this.getEntitlements(tenantId);
    return entitlements.features.includes(featureKey);
  }

  async checkModuleEnabled(
    tenantId: string,
    moduleName: string,
  ): Promise<boolean> {
    const cleaned = moduleName.startsWith('module.')
      ? moduleName.replace('module.', '')
      : moduleName;
    if (cleaned === 'chat' || cleaned === 'messaging') {
      return false;
    }
    if (
      this.isM0OrPlatform(cleaned) ||
      this.isM0OrPlatform(`module.${cleaned}`)
    ) {
      return false;
    }
    const entitlements = await this.getEntitlements(tenantId);
    const hasModule = (name: string) => entitlements.modules.includes(name);
    return (
      entitlements.modules.includes(cleaned) ||
      entitlements.features.includes(cleaned) ||
      (cleaned === 'timetable' && entitlements.modules.includes('homework')) ||
      (cleaned === 'communications' &&
        (hasModule('notifications') || hasModule('notices'))) ||
      (cleaned === 'notifications' && hasModule('notices'))
    );
  }

  async assertFeatureEnabled(
    tenantId: string,
    featureKey: string,
  ): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isActive: true },
    });
    if (tenant && !tenant.isActive) {
      throw new ForbiddenException(
        'Your school account is currently suspended. Please contact platform support.',
      );
    }
    const isEnabled = await this.checkFeatureEnabled(tenantId, featureKey);
    if (!isEnabled) {
      throw new ForbiddenException(
        `This action requires the feature '${featureKey}', which is not included in your school's subscription plan. Please contact the school administrator to upgrade.`,
      );
    }
  }

  async assertModuleEnabled(
    tenantId: string,
    moduleName: string,
  ): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { isActive: true },
    });
    if (tenant && !tenant.isActive) {
      throw new ForbiddenException(
        'Your school account is currently suspended. Please contact platform support.',
      );
    }
    const isEnabled = await this.checkModuleEnabled(tenantId, moduleName);
    if (!isEnabled) {
      throw new ForbiddenException(
        `This action requires the module '${moduleName}', which is not included in your school's subscription plan. Please contact the school administrator to upgrade.`,
      );
    }
  }
}

function applyModuleCompatibility(
  modules: Set<string>,
  moduleName: string,
  enabled: boolean,
) {
  if (moduleName === 'communications') {
    for (const replacement of ['notifications', 'notices']) {
      if (enabled) modules.add(replacement);
      else modules.delete(replacement);
    }
    modules.delete('communications');
    return;
  }

  if (moduleName === 'chat' || moduleName === 'messaging') {
    modules.delete(moduleName);
    return;
  }

  if (enabled) modules.add(moduleName);
  else modules.delete(moduleName);
}

const LEGACY_MODULE_FEATURE_ALIASES: Record<string, string[]> = {
  exams: ['academics'],
  fees: ['finance'],
  notifications: ['communications'],
  notices: ['communications'],
};

function resolvePlanFeatureKey(
  featureKey: string,
):
  | { type: 'module'; moduleName: string }
  | { type: 'feature'; featureKey: string } {
  if (featureKey.startsWith('module.')) {
    return {
      type: 'module',
      moduleName: featureKey.replace('module.', ''),
    };
  }

  if (featureKey.startsWith('feature.')) {
    return { type: 'feature', featureKey };
  }

  const legacyModuleAliases: Record<string, string> = {
    academics: 'exams',
    finance: 'fees',
    communications: 'communications',
  };

  const moduleName = legacyModuleAliases[featureKey] ?? featureKey;
  if (
    moduleName === 'communications' ||
    (CUSTOMER_MODULES as readonly string[]).includes(moduleName)
  ) {
    return { type: 'module', moduleName };
  }

  return { type: 'feature', featureKey };
}

function purgeLegacyModuleFeatureKeys(
  features: Set<string>,
  moduleName: string,
) {
  features.delete(moduleName);
  for (const alias of LEGACY_MODULE_FEATURE_ALIASES[moduleName] ?? []) {
    features.delete(alias);
  }
}
