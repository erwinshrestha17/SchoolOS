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
    assert.match(api, /getSchoolIntegrationsStatus/);
    assert.match(api, /getSchoolProfile/);
    assert.match(api, /updateSchoolProfile/);
    assert.match(api, /getBrandingDocuments/);
    assert.match(api, /updateBrandingDocuments/);
    assert.match(calendarApi, /academic-calendar/);
    assert.match(calendarApi, /createAcademicYear/);
    assert.match(calendarApi, /upsertCalendarDay/);
  });

  it('replaces integrations placeholders with safe status contracts', () => {
    const page = read('app/dashboard/settings/system/integrations/page.tsx');
    const legacyPage = read('app/dashboard/settings/integrations/page.tsx');
    const workspace = read(
      'components/settings/integrations-status-workspace.tsx',
    );
    const api = read('lib/api/school-settings.ts');

    assert.match(page, /IntegrationsStatusWorkspace/);
    assert.match(legacyPage, /redirectWithSearchParams/);
    assert.match(api, /settings\/workspaces/);
    assert.match(api, /\/integrations/);
    assert.match(workspace, /ModuleLockedState/);
    for (const label of [
      'disabled',
      'dev-log',
      'mock',
      'configured',
      'needs attention',
      'unavailable',
    ]) {
      assert.match(workspace, new RegExp(label));
    }
    assert.doesNotMatch(page, /contract-needed|School API & webhooks/);
    assert.doesNotMatch(
      workspace,
      /providerId|apiToken|secretKey|bucket|queue|callback URL|webhook URL/i,
    );
  });

  it('renders profile, branding, and calendar through dedicated workspaces', () => {
    const overview = read('app/dashboard/settings/overview/page.tsx');
    const profile = read('app/dashboard/settings/school/identity/page.tsx');
    const branding = read('app/dashboard/settings/school/branding/page.tsx');
    const calendar = read(
      'app/dashboard/settings/school/academic-year/page.tsx',
    );
    assert.match(overview, /redirect\('\/dashboard\/settings'\)/);
    assert.match(profile, /SchoolProfileWorkspace/);
    assert.match(branding, /BrandingDocumentsWorkspace/);
    assert.match(calendar, /AcademicCalendarWorkspace/);
  });

  it('uses protected file actions instead of raw logo urls', () => {
    const workspace = read(
      'components/settings/branding-documents-workspace.tsx',
    );
    assert.match(workspace, /ProtectedFileButton/);
    assert.match(workspace, /uploadSchoolLogo/);
    assert.match(workspace, /removeSchoolLogo/);
    assert.doesNotMatch(workspace, /window\.open/);
  });

  it('uses strict BS inputs without browser-local calendar conversion', () => {
    const workspace = read(
      'components/settings/academic-calendar-workspace.tsx',
    );
    assert.match(workspace, /parseBsDateInput/);
    assert.match(workspace, /toGregorianDateFromBs/);
    assert.match(workspace, /YYYY-MM-DD/);
    assert.doesNotMatch(workspace, /new Date\(\)/);
  });
});
