import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  SubscriptionTier,
  ENTITLEMENT_MATRIX,
  FEATURE_KEYS,
  STANDARD_ALLOWED_ADDONS,
} from '@schoolos/core';

export interface EntitlementsResponse {
  tier: SubscriptionTier | null;
  modules: string[];
  features: string[];
  addOns: string[];
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
  constructor(private readonly prisma: PrismaService) {}

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

  async getEntitlements(tenantId: string): Promise<EntitlementsResponse> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, isActive: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    if (!tenant.isActive) {
      return {
        tier: null,
        modules: [],
        features: [],
        addOns: [],
      };
    }

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
      return {
        tier: null,
        modules: [],
        features: [],
        addOns: [],
      };
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
        if (f.enabled) {
          if (f.featureKey.startsWith('module.')) {
            applyModuleCompatibility(
              modulesSet,
              f.featureKey.replace('module.', ''),
              true,
            );
          } else {
            featuresSet.add(f.featureKey);
          }
        } else {
          if (f.featureKey.startsWith('module.')) {
            applyModuleCompatibility(
              modulesSet,
              f.featureKey.replace('module.', ''),
              false,
            );
          } else {
            featuresSet.delete(f.featureKey);
          }
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
          applyModuleCompatibility(
            modulesSet,
            key.replace('module.', ''),
            false,
          );
        } else {
          featuresSet.delete(key);
        }
      }
    }

    // Chat is outside the active release boundary. Preserve legacy keys in
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
// Trigger build
