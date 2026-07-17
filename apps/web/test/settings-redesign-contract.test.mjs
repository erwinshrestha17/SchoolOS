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
    assert.match(hub, /Applies only to this school/);
    assert.doesNotMatch(hub, /Upgrade Plan/);
  });

  it('routes legacy ?section= and ?tab= links into the canonical information architecture', () => {
    const frame = read('components/settings/settings-route-frame.tsx');
    for (const destination of [
      'settings/school-profile',
      'settings/academic-calendar',
      'settings/users-access',
      'settings/attendance',
      'settings/audit-export',
      'settings/communication',
      'settings/hr-payroll',
      'settings/accounting',
    ]) assert.match(frame, new RegExp(destination));
    assert.match(frame, /migratedLegacySections/);
  });

  it('hides unauthorized items instead of hardcoding the full catalog', () => {
    const frame = read('components/settings/settings-route-frame.tsx');
    assert.match(frame, /navigationQuery/);
    assert.match(frame, /groups\.map/);
    assert.doesNotMatch(frame, /SCHOOL_SETTINGS_CATEGORIES/);
  });

  it('uses real settings APIs for policy configuration rather than browser-only state', () => {
    const policy = read('components/settings/settings-policy-workspace.tsx');
    assert.match(policy, /api\.getTenantSettings/);
    assert.match(policy, /api\.updateTenantSetting/);
    assert.match(policy, /schoolSettingsApi\.getSchoolSettingsNavigation/);
  });

  it('keeps access labels aligned with the six-level settings access contract', () => {
    const catalog = read('components/settings/school-settings-catalog.ts');
    for (const label of ['View only', 'Edit', 'Approve', 'Manage', 'Delegate']) {
      assert.match(catalog, new RegExp(label));
    }
    assert.match(catalog, /canEditSchoolSettings/);
  });
});
