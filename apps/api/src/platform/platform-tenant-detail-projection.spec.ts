import type { PlatformTenantDetail } from '@schoolos/core';
import { systemRolePermissions } from '@schoolos/core';
import { projectPlatformTenantDetail } from './platform-tenant-detail-projection';

const detail: PlatformTenantDetail = {
  id: 'tenant-1',
  name: 'Projection School',
  slug: 'projection-school',
  plan: 'standard',
  isActive: true,
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-21T00:00:00.000Z',
  studentCount: 120,
  staffCount: 18,
  usage: {
    tenantId: 'tenant-1',
    studentCount: 120,
    staffCount: 18,
    userCount: 138,
    storageSizeBytes: 4096,
  },
  panNumber: 'PAN-SECRET',
  subscription: {
    id: 'subscription-1',
    tenantId: 'tenant-1',
    planId: 'plan-1',
    planKey: 'standard',
    planName: 'Standard',
    status: 'ACTIVE',
    startsAt: '2026-08-20T00:00:00.000Z',
  },
  billingProfile: {
    tenantId: 'tenant-1',
    billingEmail: 'billing@example.test',
    preferredBillingCycle: 'MONTHLY',
  },
  recentAudit: [
    {
      id: 'audit-1',
      action: 'tenant_updated',
      resource: 'tenants',
      tenantId: 'tenant-1',
      createdAt: '2026-08-21T00:00:00.000Z',
    },
  ],
  onboarding: {
    tenantId: 'tenant-1',
    completed: 0,
    total: 1,
    progressPercent: 0,
    items: [
      {
        key: 'school-profile',
        label: 'School profile',
        completed: false,
        source: 'computed',
        href: '/dashboard/settings/school-profile',
        required: true,
      },
    ],
  },
  overrides: [
    { featureKey: 'module.library', enabled: true, reason: 'Contract add-on' },
  ],
  enabledFeatures: ['module.library'],
  usageCounters: [
    {
      tenantId: 'tenant-1',
      usageKey: 'students',
      value: 120,
      limit: 200,
      period: 'MONTHLY',
      periodStart: '2026-08-01T00:00:00.000Z',
      exceeded: false,
    },
  ],
  providerReadiness: [
    {
      providerId: 'provider-1',
      type: 'EMAIL',
      name: 'Email provider',
      status: 'ready',
      message: 'Ready',
    },
  ],
  supportOverrideHistory: [
    {
      id: 'override-1',
      platformUserId: 'operator-1',
      platformUserEmail: 'operator@example.test',
      reason: 'Investigating attendance incident',
      permissionScopes: ['ATTENDANCE'],
      readOnly: true,
      startsAt: '2026-08-21T00:00:00.000Z',
      expiresAt: '2026-08-21T00:30:00.000Z',
      isActive: true,
      createdAt: '2026-08-21T00:00:00.000Z',
    },
  ],
};

describe('platform tenant detail projection', () => {
  it('keeps support detail read-only and removes billing, subscription, and provider data', () => {
    const projected = projectPlatformTenantDetail(detail, {
      roles: ['platform_support'],
      permissions: systemRolePermissions.platform_support ?? [],
    });

    expect(projected).toMatchObject({
      id: detail.id,
      usage: detail.usage,
      recentAudit: detail.recentAudit,
      onboarding: detail.onboarding,
    });
    expect(projected).not.toHaveProperty('panNumber');
    expect(projected).not.toHaveProperty('billingProfile');
    expect(projected).not.toHaveProperty('subscription');
    expect(projected).not.toHaveProperty('overrides');
    expect(projected).not.toHaveProperty('enabledFeatures');
    expect(projected).not.toHaveProperty('providerReadiness');
    expect(projected).not.toHaveProperty('supportOverrideHistory');
  });

  it('keeps billing detail and removes audit, onboarding, provider, and support identifiers', () => {
    const projected = projectPlatformTenantDetail(detail, {
      roles: ['platform_billing_admin'],
      permissions: systemRolePermissions.platform_billing_admin ?? [],
    });

    expect(projected).toMatchObject({
      id: detail.id,
      usage: detail.usage,
      panNumber: detail.panNumber,
      billingProfile: detail.billingProfile,
      subscription: detail.subscription,
      overrides: detail.overrides,
      enabledFeatures: detail.enabledFeatures,
    });
    expect(projected).not.toHaveProperty('recentAudit');
    expect(projected).not.toHaveProperty('onboarding');
    expect(projected).not.toHaveProperty('providerReadiness');
    expect(projected).not.toHaveProperty('supportOverrideHistory');
  });

  it('returns only the tenant summary without a matching cross-domain permission', () => {
    const projected = projectPlatformTenantDetail(detail, {
      roles: ['platform_support'],
      permissions: ['platform:tenants:read'],
    });

    expect(projected).toEqual({
      id: detail.id,
      name: detail.name,
      slug: detail.slug,
      plan: detail.plan,
      isActive: detail.isActive,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
      studentCount: detail.studentCount,
      staffCount: detail.staffCount,
    });
  });

  it('preserves the platform super-admin bypass used by PlatformGuard', () => {
    const projected = projectPlatformTenantDetail(detail, {
      roles: ['platform_super_admin'],
      permissions: [],
    });

    for (const field of [
      'usage',
      'panNumber',
      'subscription',
      'billingProfile',
      'recentAudit',
      'onboarding',
      'overrides',
      'enabledFeatures',
      'usageCounters',
      'providerReadiness',
      'supportOverrideHistory',
    ]) {
      expect(projected).toHaveProperty(field);
    }
  });
});
