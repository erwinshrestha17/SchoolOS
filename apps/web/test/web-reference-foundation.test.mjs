import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(webRoot, '..', '..');

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
}

describe('reference dashboard foundation', () => {
  it('keeps the single repository-grounded product and readiness source', () => {
    const sourceOfTruthPath = join(repoRoot, 'AGENTS.md');
    assert.equal(existsSync(sourceOfTruthPath), true);
    const sourceOfTruth = readFileSync(sourceOfTruthPath, 'utf8');
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
      assert.match(sourceOfTruth, new RegExp(marker.replace(/[&/]/g, '\\$&')));
    }
    assert.match(sourceOfTruth, /Chat\/conversations are not part of the active product/);
    assert.match(sourceOfTruth, /controlled-pilot readiness/);
    assert.match(sourceOfTruth, /single repository-wide source of truth/);
    assert.match(sourceOfTruth, /Prose never proves implementation completion/);
    assert.match(sourceOfTruth, /relevant tests must pass/);
    const playbooks = readdirSync(repoRoot)
      .filter((file) => /^SCHOOLOS_.*_DESIGN_ASTRA\.md$/.test(file))
      .sort();
    assert.deepEqual(playbooks, [
      'SCHOOLOS_APP_DESIGN_ASTRA.md',
      'SCHOOLOS_WEB_DESIGN_ASTRA.md',
    ]);
    for (const playbook of playbooks) {
      assert.ok(sourceOfTruth.includes(playbook));
      const content = readFileSync(join(repoRoot, playbook), 'utf8');
      assert.match(content, /If this playbook conflicts with `AGENTS\.md`/);
      assert.match(content, /`AGENTS\.md` wins/);
    }
  });

  it('provides the requested shared dashboard composition primitives', () => {
    const requiredFiles = ['components/dashboard/module-tabs.tsx'];

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
    assert.match(header, /label="Open more actions"/);
  });

  it('keeps the permission-scoped real-API operations composition route', () => {
    const operations = read('app/dashboard/operations/page.tsx');
    const layout = read('app/dashboard/layout.tsx');
    const principalNav = read('components/layout/sidebar-persona-nav.config.ts');

    assert.match(layout, /prefix: ['"]\/dashboard\/operations['"]/);
    assert.match(principalNav, /href: ['"]\/dashboard\/operations\/overview['"]/);
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
    const personaNav = [
      read('components/layout/sidebar-persona-nav.config.ts'),
      read('components/layout/sidebar-persona-nav.base.ts'),
    ].join('\n');

    assert.match(layout, /prefix: ['"]\/dashboard\/communications['"]/);
    assert.match(personaNav, /href: '\/dashboard\/notices'/);
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
