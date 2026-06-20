import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

describe('School Settings workspaces', () => {
  it('uses isolated typed APIs for settings workspaces', () => {
    const api = read('lib/api/school-settings.ts');
    assert.match(api, /settings\/workspaces/);
    assert.match(api, /getSchoolSettingsOverview/);
    assert.match(api, /getSchoolProfile/);
    assert.match(api, /updateSchoolProfile/);
  });

  it('renders the overview and school profile through dedicated workspaces', () => {
    const overview = read('app/dashboard/settings/overview/page.tsx');
    const profile = read('app/dashboard/settings/school-profile/page.tsx');
    assert.match(overview, /SettingsOverviewWorkspace/);
    assert.match(profile, /SchoolProfileWorkspace/);
  });
});
