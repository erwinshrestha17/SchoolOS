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
    const calendarApi = read('lib/api/academic-calendar-settings.ts');
    assert.match(api, /settings\/workspaces/);
    assert.match(api, /getSchoolSettingsOverview/);
    assert.match(api, /getSchoolProfile/);
    assert.match(api, /updateSchoolProfile/);
    assert.match(api, /getBrandingDocuments/);
    assert.match(api, /updateBrandingDocuments/);
    assert.match(calendarApi, /academic-calendar/);
    assert.match(calendarApi, /createAcademicYear/);
    assert.match(calendarApi, /upsertCalendarDay/);
  });

  it('renders overview, profile, branding, and calendar through dedicated workspaces', () => {
    const overview = read('app/dashboard/settings/overview/page.tsx');
    const profile = read('app/dashboard/settings/school-profile/page.tsx');
    const branding = read('app/dashboard/settings/branding-documents/page.tsx');
    const calendar = read('app/dashboard/settings/academic-calendar/page.tsx');
    assert.match(overview, /SettingsOverviewWorkspace/);
    assert.match(profile, /SchoolProfileWorkspace/);
    assert.match(branding, /BrandingDocumentsWorkspace/);
    assert.match(calendar, /AcademicCalendarWorkspace/);
  });

  it('uses protected file actions instead of raw logo urls', () => {
    const workspace = read('components/settings/branding-documents-workspace.tsx');
    assert.match(workspace, /ProtectedFileButton/);
    assert.match(workspace, /uploadSchoolLogo/);
    assert.match(workspace, /removeSchoolLogo/);
    assert.doesNotMatch(workspace, /window\.open/);
  });

  it('uses strict BS inputs without browser-local calendar conversion', () => {
    const workspace = read('components/settings/academic-calendar-workspace.tsx');
    assert.match(workspace, /parseBsDateInput/);
    assert.match(workspace, /toGregorianDateFromBs/);
    assert.match(workspace, /YYYY-MM-DD/);
    assert.doesNotMatch(workspace, /new Date\(\)/);
  });
});
