import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

describe('School Settings redesign', () => {
  it('renders the control centre at the settings entry without changing the global sidebar', () => {
    const layout = read('app/dashboard/settings/layout.tsx');
    const frame = read('components/settings/settings-route-frame.tsx');
    const hub = read('components/settings/settings-control-center.tsx');
    assert.match(layout, /SettingsRouteFrame/);
    assert.match(frame, /SettingsControlCenter/);
    assert.match(
      frame,
      /Manage your personal preferences and school configuration/,
    );
    assert.match(hub, /Choose a settings area/);
    assert.doesNotMatch(frame, /Applies only to this school/);
    assert.doesNotMatch(hub, /Upgrade Plan/);
  });

  it('routes legacy ?section= and ?tab= links into the canonical information architecture', () => {
    const frame = read('components/settings/settings-route-frame.tsx');
    for (const destination of [
      'settings/school/identity',
      'settings/school/academic-year',
      'settings/access/users',
      'settings/policies/attendance',
      'settings/system/audit-log',
      'settings/communication',
      'settings/hr-payroll',
      'settings/accounting',
    ])
      assert.match(frame, new RegExp(destination));
    assert.match(frame, /MIGRATED_LEGACY_SECTIONS/);
    assert.match(frame, /remaining\.delete\('section'\)/);
    assert.match(frame, /remaining\.delete\('tab'\)/);
  });

  it('projects authenticated visibility onto one shared settings catalog', () => {
    const frame = read('components/settings/settings-route-frame.tsx');
    const navigation = read(
      'components/settings/settings-navigation.config.ts',
    );
    assert.match(frame, /navigationQuery/);
    assert.match(frame, /backendItemsById/);
    assert.match(navigation, /SETTINGS_NAVIGATION_GROUPS/);
    assert.match(navigation, /backendItemId/);
    assert.doesNotMatch(frame, /View only/);
  });

  it('uses real settings APIs for policy configuration rather than browser-only state', () => {
    const policy = read('components/settings/settings-policy-workspace.tsx');
    assert.match(policy, /api\.getTenantSettings/);
    assert.match(policy, /api\.updateTenantSetting/);
    assert.match(policy, /schoolSettingsApi\.getSchoolSettingsNavigation/);
  });

  it('maps backend capabilities into the four user-facing access states', () => {
    const catalog = read('components/settings/school-settings-catalog.ts');
    const header = read('components/settings/settings-page-header.tsx');
    for (const label of [
      'Can manage',
      'View-only',
      'No access',
      'Platform managed',
    ]) {
      assert.match(header, new RegExp(label));
    }
    assert.match(catalog, /canEditSchoolSettings/);
  });
});
