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
  it('renders a school management settings console with all operational sections', () => {
    const page = read('app/dashboard/settings/page.tsx');

    const requiredSections = [
      'profile',
      'branding',
      'academic',
      'fees',
      'attendance',
      'payroll',
      'accounting',
      'communication',
      'security',
      'data',
    ];

    for (const section of requiredSections) {
      assert.ok(page.includes(section), `Missing section key: ${section}`);
    }

    const requiredLabels = [
      'School Name',
      'School Address',
      'Contact Phone',
      'Contact Email',
      'PAN / Registration Number',
      'Principal Name',
      'Municipality',
      'Ward Number',
      'District',
      'Province',
      'School Type',
      'iEMIS School Code',
      'Active Fee Plan',
      'Attendance Lock',
      'Payroll Approval',
      'Fiscal Year',
      'Sensitive Staff Fields',
      'Import / Export',
    ];

    for (const label of requiredLabels) {
      assert.match(page, new RegExp(label), `Missing field/section label: ${label}`);
    }
  });

  it('ensures each settings section has a visible console structure', () => {
    const page = read('app/dashboard/settings/page.tsx');

    assert.match(page, /SettingsSidebar/);
    assert.match(page, /SectionHeader/);
    assert.match(page, /UnsavedBar/);
    assert.match(page, /EditableSettingsSection/);
  });

  it('strictly separates school settings from platform settings', () => {
    const page = read('app/dashboard/settings/page.tsx');

    const forbidden = [
      'SaaS billing',
      'Provider credentials',
      'Feature flags',
      'Subscription plans',
      'Tenant suspension',
      'Infrastructure health',
    ];

    for (const item of forbidden) {
      assert.doesNotMatch(page, new RegExp(item, 'i'), `Found platform-only term: ${item}`);
    }
  });

  it('maintains tenant scoping for all settings updates', () => {
    const page = read('app/dashboard/settings/page.tsx');

    assert.match(page, /api\.updateTenantSetting\(field\.key, nextValue\)/);
    assert.doesNotMatch(page, /api\.updateGlobalSetting/);
    assert.doesNotMatch(page, /tenantId: ['"]all['"]/);
  });

  it('uses normalized communication chat-hour setting keys', () => {
    const page = read('app/dashboard/settings/page.tsx');

    assert.match(page, /chat_sunday_to_thursday_start/);
    assert.match(page, /chat_sunday_to_thursday_end/);
    assert.match(page, /chat_friday_start/);
    assert.match(page, /chat_friday_end/);
    assert.doesNotMatch(page, /TODO: Backend schema normalization/);
  });

  it('wires school logo branding to private File Registry APIs', () => {
    const page = read('app/dashboard/settings/page.tsx');
    const apiClient = read('lib/api/platform.ts');

    assert.match(page, /data-testid="school-logo-upload-panel"/);
    assert.match(page, /TENANT_LOGO_MAX_BYTES = 1024 \* 1024/);
    assert.match(page, /TENANT_LOGO_MIME_TYPES/);
    assert.match(page, /api\.uploadSchoolLogo\(file\)/);
    assert.match(page, /api\.getSchoolLogoPreview\(\)/);
    assert.match(page, /api\.getSchoolLogoDownload\(\)/);
    assert.match(page, /api\.removeSchoolLogo\(\)/);
    assert.match(page, /ConfirmDialog/);
    assert.match(page, /Private File Registry/);
    assert.doesNotMatch(page, /Logo and Stamp uploads are managed via the File Registry \(Coming Soon\)/);
    assert.match(apiClient, /uploadSchoolLogo:/);
    assert.match(apiClient, /getSchoolLogoPreview:/);
    assert.match(apiClient, /getSchoolLogoDownload:/);
    assert.match(apiClient, /removeSchoolLogo:/);
  });
});
