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
    assert.match(hub, /School foundation/);
    assert.match(hub, /People & access/);
    assert.match(hub, /Operational policies/);
    assert.match(hub, /Data & governance/);
    assert.doesNotMatch(hub, /Upgrade Plan/);
  });

  it('routes core legacy settings links to focused workspaces', () => {
    const frame = read('components/settings/settings-route-frame.tsx');
    assert.match(frame, /school-profile/);
    assert.match(frame, /branding-documents/);
    assert.match(frame, /academic-calendar/);
    assert.match(frame, /users-access/);
    assert.match(frame, /roles-permissions/);
    assert.match(frame, /policies\/attendance/);
    assert.match(frame, /audit-log/);
  });

  it('uses real settings APIs for policy configuration rather than browser-only state', () => {
    const policy = read('components/settings/settings-policy-workspace.tsx');
    assert.match(policy, /api\.getTenantSettings/);
    assert.match(policy, /api\.updateTenantSetting/);
    assert.match(policy, /schoolSettingsApi\.getSchoolSettingsNavigation/);
  });
});
