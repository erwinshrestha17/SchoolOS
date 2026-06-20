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
  it('keeps the repository-grounded UI/API alignment audit', () => {
    const auditPath = join(
      repoRoot,
      'docs/implementation/WEB_UI_API_ALIGNMENT_AUDIT.md',
    );
    assert.equal(existsSync(auditPath), true);
    const audit = readFileSync(auditPath, 'utf8');
    for (const marker of [
      'M1 Admissions & Students',
      'M2 Attendance',
      'M3 Fees & Receipts',
      'M4 Academics',
      'M5 Activity Feed',
      'M6 Homework & Timetable',
      'M7 HR & Payroll',
      'M8 Library',
      'M9 Transport',
      'M10 Canteen',
      'M11 Accounting',
      'M12 Notices & Communication',
      'Internal QA ready',
    ]) {
      assert.match(audit, new RegExp(marker.replace(/[&/]/g, '\\$&')));
    }
    assert.match(audit, /cannot be used as seed or fallback production truth/);
  });

  it('provides the requested shared dashboard composition primitives', () => {
    const requiredFiles = [
      'components/dashboard/dashboard-shell.tsx',
      'components/dashboard/module-page-header.tsx',
      'components/dashboard/kpi-card.tsx',
      'components/dashboard/module-tabs.tsx',
      'components/dashboard/data-filter-bar.tsx',
      'components/dashboard/data-table-toolbar.tsx',
      'components/dashboard/context-side-panel.tsx',
      'components/dashboard/status-badge.tsx',
      'components/dashboard/pagination-controls.tsx',
      'components/dashboard/metric-trend.tsx',
      'components/dashboard/protected-preview-card.tsx',
      'components/dashboard/action-menu.tsx',
      'components/dashboard/empty-state.tsx',
      'components/dashboard/loading-state.tsx',
      'components/dashboard/error-state.tsx',
      'components/dashboard/permission-state.tsx',
    ];

    for (const relativePath of requiredFiles) {
      assert.equal(
        existsSync(join(webRoot, relativePath)),
        true,
        `Missing shared primitive: ${relativePath}`,
      );
    }
  });

  it('reuses authenticated shell and protected-file primitives', () => {
    assert.match(
      read('components/dashboard/dashboard-shell.tsx'),
      /from '\.\.\/layout\/dashboard-shell'/,
    );
    const preview = read('components/dashboard/protected-preview-card.tsx');
    assert.match(preview, /ProtectedFileButton/);
    assert.doesNotMatch(preview, /window\.open|fetch\(/);
  });

  it('keeps the primary module action before More Actions', () => {
    const header = read('components/ui/module-header.tsx');
    assert.ok(
      header.indexOf('{primaryAction}') < header.indexOf('More Actions'),
      'Primary action must appear before More Actions',
    );
  });

  it('adds a permission-scoped real-API operations hub', () => {
    const operations = read('app/dashboard/operations/page.tsx');
    const layout = read('app/dashboard/layout.tsx');
    const sidebar = read('components/layout/sidebar.tsx');

    assert.match(layout, /prefix: '\/dashboard\/operations'/);
    assert.match(sidebar, /href: '\/dashboard\/operations'/);
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

  it('adds a permission-scoped communications composition route', () => {
    const communications = read('app/dashboard/communications/page.tsx');
    const layout = read('app/dashboard/layout.tsx');
    const sidebar = read('components/layout/sidebar.tsx');

    assert.match(layout, /prefix: '\/dashboard\/communications'/);
    assert.match(sidebar, /href: '\/dashboard\/communications'/);
    assert.match(communications, /communicationsApi\.listNotificationDeliveryFailures/);
    assert.match(communications, /messagingApi\.listParentTeacherThreads/);
    assert.match(communications, /A safe provider-health contract is not exposed/);
    assert.doesNotMatch(communications, /setTimeout|setInterval/);
  });
});
