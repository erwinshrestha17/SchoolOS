import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

const SETTINGS_SURFACES = [
  'components/settings/academic-structure-workspace.tsx',
  'components/settings/users-access-workspace.tsx',
  'components/settings/activity-consent-settings-workspace.tsx',
  'components/settings/personal-profile-workspace.tsx',
  'components/settings/settings-route-frame.tsx',
];

const HOMEWORK_SURFACE = 'app/dashboard/homework/page.tsx';
const PAYROLL_SURFACE = 'app/dashboard/payroll/readiness/page.tsx';
const COMMUNICATIONS_SURFACES = [
  'app/dashboard/communications/templates/page.tsx',
  'app/dashboard/communications/provider-diagnostics/page.tsx',
];
const HEADER_SURFACE = 'components/layout/header.tsx';

describe('Slice 4 settings authorization UI', () => {
  it('uses canonical settings capabilities instead of raw permission checks', () => {
    for (const path of SETTINGS_SURFACES) {
      const source = read(path);
      assert.doesNotMatch(
        source,
        /permissions\.includes\(/,
        `${path} must not use raw permissions.includes`,
      );
      assert.doesNotMatch(
        source,
        /grantedPermissions\.has\(/,
        `${path} must not use raw grantedPermissions.has`,
      );
      assert.doesNotMatch(
        source,
        /new Set\(.*permissions/,
        `${path} must not build raw permission sets`,
      );
    }

    const routeFrame = read('components/settings/settings-route-frame.tsx');
    assert.match(routeFrame, /useSettingsCapabilities/);
    assert.match(
      routeFrame,
      /hasPermission\(session, definition\.requiredPermission as PermissionKey\)/,
    );
    assert.match(routeFrame, /canAccessInstitutionalSettings/);
  });
});

describe('Slice 4 homework authorization UI', () => {
  it('uses canonical homework capabilities instead of raw permission sets', () => {
    const source = read(HOMEWORK_SURFACE);
    assert.doesNotMatch(
      source,
      /new Set\(session\?\.user\.permissions/,
      `${HOMEWORK_SURFACE} must not build raw permission sets`,
    );
    assert.match(source, /useHomeworkCapabilities/);
    assert.match(source, /homeworkCaps\.canCreate/);
    assert.match(source, /homeworkCaps\.canReview/);
  });
});

describe('Slice 4 payroll authorization UI', () => {
  it('uses canonical payroll capabilities instead of raw includes', () => {
    const source = read(PAYROLL_SURFACE);
    assert.doesNotMatch(
      source,
      /permissions\.includes\("payroll:run:review"\)/,
      `${PAYROLL_SURFACE} must not use raw payroll:run:review includes`,
    );
    assert.match(source, /usePayrollCapabilities/);
    assert.match(source, /payrollCaps\.canReview/);
  });
});

describe('Slice 4 communications authorization UI', () => {
  it('uses canonical communications capabilities instead of raw permission sets', () => {
    for (const path of COMMUNICATIONS_SURFACES) {
      const source = read(path);
      assert.doesNotMatch(
        source,
        /new Set\(session\?\.user\.permissions/,
        `${path} must not build raw permission sets`,
      );
      assert.match(source, /useCommunicationsCapabilities/);
    }
  });
});

describe('Slice 4 header authorization UI', () => {
  it('uses canonical staff:read check instead of raw permissions.includes', () => {
    const source = read(HEADER_SURFACE);
    assert.doesNotMatch(
      source,
      /permissions\.includes\("staff:read"\)/,
      `${HEADER_SURFACE} must not use raw staff:read includes`,
    );
    assert.match(source, /usePermissionAccess/);
    assert.match(source, /checkPermission\("staff:read"\)/);
  });
});

describe('Slice 4 dashboard persona routing', () => {
  it('routes hr and accountant personas to explicit dashboard compositions', () => {
    const page = read('app/dashboard/page.tsx');
    const hr = read('components/dashboard/hr-dashboard.tsx');
    const accountant = read('components/dashboard/accountant-dashboard.tsx');
    const personaCore = read('../../packages/core/src/dashboard-persona.ts');

    assert.match(page, /isSupportedDashboardPersona/);
    assert.match(page, /canFetchDashboard/);
    assert.match(page, /compositionPersona === "hr"/);
    assert.match(page, /compositionPersona === "accountant"/);
    assert.match(page, /<HrDashboard dashboard=\{projectedDashboard\} \/>/);
    assert.match(
      page,
      /<AccountantDashboard dashboard=\{projectedDashboard\} \/>/,
    );
    assert.doesNotMatch(page, /persona="general"/);
    assert.match(hr, /persona="hr"/);
    assert.match(accountant, /persona="accountant"/);
    assert.match(personaCore, /HR_DASHBOARD_MODULES/);
    assert.match(personaCore, /ACCOUNTANT_DASHBOARD_MODULES/);
    assert.match(personaCore, /isSupportedDashboardPersona/);
    assert.doesNotMatch(personaCore, /return "general"/);
  });

  it('does not fetch dashboard summary for unsupported personas', () => {
    const page = read('app/dashboard/page.tsx');
    assert.match(page, /enabled:\s*\n\s*canFetchDashboard/);
    assert.match(page, /Module workspace/);
  });
});

describe('Slice 4 institutional settings hub visibility', () => {
  it('gates sidebar and command palette settings on capabilities', () => {
    const sidebar = read('components/layout/sidebar.tsx');
    const palette = read('components/layout/command-palette.tsx');
    const personaNavConfig = read(
      'components/layout/sidebar-persona-nav.config.ts',
    );

    assert.match(sidebar, /useSettingsCapabilities/);
    assert.match(sidebar, /shouldShowSettingsHub\([\s\S]*schoolWebPersona/);
    assert.match(palette, /shouldShowSettingsHub\([\s\S]*schoolWebPersona/);
    assert.match(personaNavConfig, /persona === 'principal'/);
  });
});
