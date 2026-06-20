import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

describe('School Settings redesign', () => {
  it('replaces the default settings entry with the control centre without changing the global sidebar', () => {
    const layout = read('app/dashboard/settings/layout.tsx');
    const frame = read('components/settings/settings-route-frame.tsx');
    const hub = read('components/settings/settings-control-center.tsx');
    assert.match(layout, /SettingsRouteFrame/);
    assert.match(frame, /SettingsControlCenter/);
    assert.match(hub, /SCHOOL_SETTINGS_CATEGORIES/);
    assert.match(hub, /School only/);
    assert.match(hub, /Configuration status is intentionally conservative/);
    assert.doesNotMatch(hub, /Upgrade Plan/);
  });

  it('routes legacy settings links into the canonical school-settings information architecture', () => {
    const frame = read('components/settings/settings-route-frame.tsx');
    assert.match(frame, /settings\/profile/);
    assert.match(frame, /settings\/academic/);
    assert.match(frame, /settings\/users-roles/);
    assert.match(frame, /settings\/attendance/);
    assert.match(frame, /settings\/audit-export/);
    assert.match(frame, /SCHOOL_SETTINGS_CATEGORIES/);
  });

  it('provides all fourteen stable school settings routes', () => {
    const catalog = read('components/settings/school-settings-catalog.ts');
    for (const route of [
      'profile', 'academic', 'users-roles', 'modules', 'admissions', 'attendance',
      'fees', 'exams-report-cards', 'homework-timetable-learning', 'communication',
      'documents-templates', 'security', 'integrations', 'audit-export',
    ]) assert.match(catalog, new RegExp(`/dashboard/settings/${route}`));
    assert.doesNotMatch(catalog, /platform\//);
  });

  it('uses real settings APIs for policy configuration rather than browser-only state', () => {
    const policy = read('components/settings/settings-policy-workspace.tsx');
    assert.match(policy, /api\.getTenantSettings/);
    assert.match(policy, /api\.updateTenantSetting/);
    assert.match(policy, /schoolSettingsApi\.getSchoolSettingsNavigation/);
  });
});
