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
  it('renders a tabbed school management hub with all operational sections', () => {
    const page = read('app/dashboard/settings/page.tsx');

    const requiredTabs = [
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

    for (const tab of requiredTabs) {
      assert.match(page, new RegExp(`value="${tab}"`), `Missing tab value: ${tab}`);
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
      'Data Import / Export',
    ];

    for (const label of requiredLabels) {
      assert.match(page, new RegExp(label), `Missing field/section label: ${label}`);
    }
  });

  it('ensures each settings section has a visible card structure', () => {
    const page = read('app/dashboard/settings/page.tsx');

    assert.match(page, /<SectionWrapper/);
    assert.match(page, /title=/);
    assert.match(page, /description=/);
    assert.match(page, /onSave=\{save\}/);
    assert.match(page, /isSaving=\{isSaving\}/);
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

    assert.match(page, /api\.updateTenantSetting\(key, form\[key\]\)/);
    assert.doesNotMatch(page, /api\.updateGlobalSetting/);
    assert.doesNotMatch(page, /tenantId: ['"]all['"]/);
  });
});
