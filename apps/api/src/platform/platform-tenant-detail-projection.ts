import type { PermissionKey, PlatformTenantDetail } from '@schoolos/core';

export interface PlatformTenantDetailActor {
  roles: readonly string[];
  permissions: readonly string[];
}

function canRead(
  actor: PlatformTenantDetailActor,
  permission: PermissionKey,
): boolean {
  return (
    actor.roles.includes('platform_super_admin') ||
    actor.permissions.includes(permission)
  );
}

/**
 * The tenant summary is available under platform:tenants:read. Cross-domain
 * detail is projected with the same granular permissions as its owning
 * endpoint so this shared response cannot bypass platform RBAC.
 */
export function projectPlatformTenantDetail(
  detail: PlatformTenantDetail,
  actor: PlatformTenantDetailActor,
): PlatformTenantDetail {
  const projected: PlatformTenantDetail = {
    id: detail.id,
    name: detail.name,
    slug: detail.slug,
    plan: detail.plan,
    isActive: detail.isActive,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    studentCount: detail.studentCount,
    staffCount: detail.staffCount,
  };

  if (canRead(actor, 'platform:usage:read')) {
    projected.usage = detail.usage;
    projected.usageCounters = detail.usageCounters;
  }

  if (canRead(actor, 'platform:subscriptions:read')) {
    projected.subscription = detail.subscription;
    projected.overrides = detail.overrides;
    projected.enabledFeatures = detail.enabledFeatures;
  }

  if (canRead(actor, 'platform:billing:read')) {
    projected.panNumber = detail.panNumber;
    projected.billingProfile = detail.billingProfile;
  }

  if (canRead(actor, 'platform:audit:read')) {
    projected.recentAudit = detail.recentAudit;
  }

  if (
    canRead(actor, 'platform:audit:read') &&
    (canRead(actor, 'platform:tenants:status') ||
      canRead(actor, 'platform:support:override'))
  ) {
    projected.supportOverrideHistory = detail.supportOverrideHistory;
  }

  if (canRead(actor, 'platform:onboarding:read')) {
    projected.onboarding = detail.onboarding;
  }

  if (canRead(actor, 'platform:providers:read')) {
    projected.providerReadiness = detail.providerReadiness;
  }

  return projected;
}
