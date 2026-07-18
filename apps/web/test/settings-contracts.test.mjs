import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
}

describe('SchoolOS Settings Page Contracts', () => {
  it('keeps the settings index thin and defers to the role-aware control centre', () => {
    const page = read('app/dashboard/settings/page.tsx');
    const frame = read('components/settings/settings-route-frame.tsx');
    const sidebar = read('components/layout/sidebar.tsx');

    assert.ok(page.length < 600, 'settings index must stay a thin page');
    assert.match(frame, /SettingsControlCenter/);
    assert.match(frame, /getSchoolSettingsNavigation/);
    assert.doesNotMatch(page, /SETTINGS_SECTIONS|SettingsSidebar|UnsavedBar/);
    assert.equal(
      sidebar.match(/href: ['"]\/dashboard\/settings['"]/g)?.length,
      1,
      'the global sidebar must contain one Settings destination',
    );
  });

  it('uses one route metadata catalog while keeping backend visibility authoritative', () => {
    const frame = read('components/settings/settings-route-frame.tsx');
    const navigation = read(
      'components/settings/settings-navigation.config.ts',
    );

    assert.match(frame, /schoolSettingsApi\.getSchoolSettingsNavigation/);
    assert.match(frame, /backendItemsById/);
    assert.match(frame, /SETTINGS_NAVIGATION/);
    assert.match(navigation, /searchKeywords/);
    assert.match(navigation, /backendItemId/);
    assert.match(navigation, /requiredPermission/);
    assert.doesNotMatch(frame, /Applies only to this school|View only/);
  });

  it('renders a compact grouped landing with optional readiness and recent changes', () => {
    const hub = read('components/settings/settings-control-center.tsx');

    assert.match(hub, /overview\.attention/);
    assert.match(hub, /overview\.recentChanges/);
    assert.match(hub, /SETTINGS_NAVIGATION_GROUPS/);
    assert.match(hub, /Only settings supported for your account/);
    assert.match(hub, /Platform managed/i);
    assert.doesNotMatch(hub, /Your access|SCHOOL_SETTINGS_ACCESS_LABELS/);
    assert.doesNotMatch(hub, /min-h-44/, 'no large card wall on the overview');
    assert.doesNotMatch(hub, /Upgrade Plan/);
  });

  it('strictly separates school settings from platform settings', () => {
    const hub = read('components/settings/settings-control-center.tsx');
    const frame = read('components/settings/settings-route-frame.tsx');

    const forbidden = [
      'SaaS billing',
      'Provider credentials',
      'Feature flags',
      'Subscription plans',
      'Tenant suspension',
      'Infrastructure health',
    ];

    for (const source of [hub, frame]) {
      for (const item of forbidden) {
        assert.doesNotMatch(
          source,
          new RegExp(item, 'i'),
          `Found platform-only term: ${item}`,
        );
      }
      assert.doesNotMatch(source, /href=["']\/platform/);
    }
  });

  it('resolves policy access per settings domain from the backend navigation', () => {
    const policy = read('components/settings/settings-policy-workspace.tsx');
    const catalog = read('components/settings/settings-policy-catalog.ts');

    assert.match(policy, /navigationItemId/);
    assert.match(policy, /canEditSchoolSettings/);
    assert.match(policy, /PermissionDenied/);
    assert.match(policy, /SchoolSettingsPageHeader/);
    assert.match(policy, /SettingsPermissionNotice/);
    assert.match(policy, /Using platform default/);
    assert.doesNotMatch(policy, /Applies only to this school/);
    assert.doesNotMatch(policy, /Not configured yet/);
    assert.match(policy, /Change history/);
    assert.match(policy, /operationalImpact/);
    assert.match(catalog, /navigationItemId:/);
    assert.match(catalog, /operationalImpact:/);
  });

  it('maintains tenant scoping for all settings updates', () => {
    const policy = read('components/settings/settings-policy-workspace.tsx');

    assert.match(
      policy,
      /api\.updateTenantSetting\(field\.key, form\[field\.key\]\)/,
    );
    assert.doesNotMatch(policy, /api\.updateGlobalSetting/);
    assert.doesNotMatch(policy, /tenantId: ['"]all['"]/);
  });

  it('collects a reason for owner-sensitive user suspension', () => {
    const users = read('components/settings/users-access-workspace.tsx');
    const usersApi = read('lib/api/users.ts');

    assert.match(users, /statusReason/);
    assert.match(users, /School Configuration Owner/);
    assert.match(usersApi, /reason\?: string/);
  });

  it('connects the settings audit workspace to safe tenant-scoped audit logs', () => {
    const workspace = read('components/settings/audit-log-workspace.tsx');
    const api = read('lib/api/settings-governance.ts');

    assert.match(workspace, /settingsGovernanceApi\.listTenantAuditLogs/);
    assert.match(api, /\/settings\/audit-logs/);
    assert.doesNotMatch(
      workspace,
      /log\.before|log\.after|ipAddress|userAgent/,
    );
  });

  it('redirects every legacy or duplicate settings route to its canonical owner', () => {
    const redirects = [
      [
        'app/dashboard/account-security/page.tsx',
        '/dashboard/settings/personal/security',
      ],
      ['app/dashboard/my-profile/page.tsx', '/dashboard/my-workspace'],
      [
        'app/dashboard/notifications/preferences/page.tsx',
        '/dashboard/settings/personal/notifications',
      ],
      ['app/dashboard/settings/overview/page.tsx', '/dashboard/settings'],
      [
        'app/dashboard/settings/profile/page.tsx',
        '/dashboard/settings/school/identity',
      ],
      [
        'app/dashboard/settings/school-profile/page.tsx',
        '/dashboard/settings/school/identity',
      ],
      [
        'app/dashboard/settings/branding-documents/page.tsx',
        '/dashboard/settings/school/branding',
      ],
      [
        'app/dashboard/settings/documents-templates/page.tsx',
        '/dashboard/settings/school/branding',
      ],
      [
        'app/dashboard/settings/academic/page.tsx',
        '/dashboard/settings/school/academic-year',
      ],
      [
        'app/dashboard/settings/academic-calendar/page.tsx',
        '/dashboard/settings/school/academic-year',
      ],
      [
        'app/dashboard/settings/classes-sections/page.tsx',
        '/dashboard/settings/school/academic-structure',
      ],
      [
        'app/dashboard/settings/academic-structure/page.tsx',
        '/dashboard/settings/school/academic-structure',
      ],
      [
        'app/dashboard/settings/attendance/page.tsx',
        '/dashboard/settings/policies/attendance',
      ],
      [
        'app/dashboard/settings/activity-consent/page.tsx',
        '/dashboard/settings/policies/activity-consent',
      ],
      [
        'app/dashboard/settings/users-roles/page.tsx',
        '/dashboard/settings/access/roles',
      ],
      [
        'app/dashboard/settings/roles-permissions/page.tsx',
        '/dashboard/settings/access/roles',
      ],
      [
        'app/dashboard/settings/users-access/page.tsx',
        '/dashboard/settings/access/users',
      ],
      [
        'app/dashboard/settings/notifications/page.tsx',
        '/dashboard/settings/communication',
      ],
      [
        'app/dashboard/settings/integrations/page.tsx',
        '/dashboard/settings/system/integrations',
      ],
      [
        'app/dashboard/settings/audit-log/page.tsx',
        '/dashboard/settings/system/audit-log',
      ],
      [
        'app/dashboard/settings/audit-export/page.tsx',
        '/dashboard/settings/system/audit-log',
      ],
      [
        'app/dashboard/settings/security-audit/page.tsx',
        '/dashboard/settings/system/audit-log',
      ],
      [
        'app/dashboard/settings/billing/page.tsx',
        '/dashboard/settings/school/modules',
      ],
      [
        'app/dashboard/settings/modules/page.tsx',
        '/dashboard/settings/school/modules',
      ],
      [
        'app/dashboard/settings/plans/page.tsx',
        '/dashboard/settings/school/modules',
      ],
    ];

    for (const [file, destination] of redirects) {
      const source = read(file);
      assert.match(
        source,
        /redirectWithSearchParams|redirect\(/,
        `${file} must redirect`,
      );
      assert.ok(
        source.includes(destination),
        `${file} must target ${destination}`,
      );
    }

    const helper = read('lib/redirect-with-search-params.ts');
    assert.match(helper, /Array\.isArray\(value\)/);
    assert.match(helper, /query\.append/);
    assert.match(helper, /omit/);
  });

  it('provides canonical routes for every supported settings IA group', () => {
    const routes = [
      'personal/profile',
      'personal/security',
      'personal/notifications',
      'school/identity',
      'school/branding',
      'school/academic-year',
      'school/academic-structure',
      'school/modules',
      'policies/attendance',
      'policies/activity-consent',
      'access/users',
      'access/roles',
      'system/integrations',
      'system/audit-log',
    ];
    for (const route of routes) {
      read(`app/dashboard/settings/${route}/page.tsx`);
    }
  });
});
