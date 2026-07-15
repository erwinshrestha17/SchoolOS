import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(webRoot, '..', '..');

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
}

describe('reference dashboard foundation', () => {
  it('keeps the active repository-grounded web design and readiness sources', () => {
    const designPath = join(
      repoRoot,
      'docs/architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md',
    );
    const readinessPath = join(
      repoRoot,
      'docs/production/SCHOOLOS_GA_RELEASE_POLICY.md',
    );
    assert.equal(existsSync(designPath), true);
    assert.equal(existsSync(readinessPath), true);
    const design = readFileSync(designPath, 'utf8');
    const readiness = readFileSync(readinessPath, 'utf8');
    for (const marker of [
      'M1 Admissions and Student Profiles',
      'M2 Smart Attendance',
      'M3 Fees and Receipts',
      'M4 Academics, Exams, CAS, Report Cards',
      'M5 Activity Feed and Milestones',
      'M6 Homework and Timetable',
      'M7 HR and Payroll',
      'M8 Library',
      'M9 Transport',
      'M10 Canteen',
      'M11 Accounting and Finance',
      'M12 Notifications and Delivery',
      'M15 Notices and Announcements',
    ]) {
      assert.match(design, new RegExp(marker.replace(/[&/]/g, '\\$&')));
    }
    assert.match(design, /Chat\/conversations are deferred/);
    assert.match(readiness, /Internal QA/);
  });

  it('provides the requested shared dashboard composition primitives', () => {
    const requiredFiles = [
      'components/dashboard/module-tabs.tsx',
    ];

    for (const relativePath of requiredFiles) {
      assert.equal(
        existsSync(join(webRoot, relativePath)),
        true,
        `Missing shared primitive: ${relativePath}`,
      );
    }
  });

  it('keeps the primary module action before the More Actions menu', () => {
    const header = read('components/ui/module-header.tsx');
    assert.ok(
      header.indexOf('{primaryAction}') < header.indexOf('<ActionMenu'),
      'Primary action must appear before the More Actions menu',
    );
    // The More Actions trigger is icon-only (canonical ActionMenu default
    // trigger) and must still carry an accessible label since it has no
    // visible text.
    assert.match(header, /label="Open more actions"/);
  });

  it('keeps the permission-scoped real-API operations composition route', () => {
    const operations = read('app/dashboard/operations/page.tsx');
    const layout = read('app/dashboard/layout.tsx');
    const sidebar = read('components/layout/sidebar.tsx');

    assert.match(layout, /prefix: ['"]\/dashboard\/operations['"]/);
    assert.doesNotMatch(sidebar, /href: '\/dashboard\/operations'/);
    for (const helper of [
      'libraryApi.getOverdueBooksReport',
      'transportApi.getReports',
      'transportApi.getStaleGpsReport',
      'canteenApi.getDailyMealCountReport',
      'canteenApi.getLowBalanceWallets',
    ]) {
      assert.match(operations, new RegExp(helper.replace('.', '\\.')));
    }
    assert.match(operations, /A date-bounded issue summary is not available/);
    assert.doesNotMatch(operations, /allergenTags|dietaryWarning/);
  });

  it('keeps the legacy communications route as an M15 compatibility redirect', () => {
    const communications = read('app/dashboard/communications/page.tsx');
    const noticesWorkspace = read('components/notices/notices-workspace.tsx');
    const layout = read('app/dashboard/layout.tsx');
    const sidebar = read('components/layout/sidebar.tsx');

    // /dashboard/notices is the canonical M15 workspace; the older route is
    // retained only as a compatibility redirect.
    assert.match(layout, /prefix: ['"]\/dashboard\/communications['"]/);
    assert.match(sidebar, /href: '\/dashboard\/notices'/);
    assert.match(communications, /redirect\('\/dashboard\/notices'\)/);
    assert.match(noticesWorkspace, /communicationsApi\.getCommunicationsSummary/);
    assert.equal((noticesWorkspace.match(/<SummaryCard/g) ?? []).length, 4);
    assert.match(noticesWorkspace, /<WorkspaceTabs/);
    assert.match(noticesWorkspace, /<WorkSurface/);
    assert.doesNotMatch(noticesWorkspace, /provider-diagnostics/);
    assert.doesNotMatch(noticesWorkspace, /title="Provider Status"/);
    assert.doesNotMatch(noticesWorkspace, /setTimeout|setInterval/);
  });
});
