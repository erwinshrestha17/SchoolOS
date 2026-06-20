import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
}

describe('dashboard command center', () => {
  it('keeps the dashboard backed by the existing operational summary contract', () => {
    const page = read('app/dashboard/page.tsx');

    assert.match(page, /api\.getDashboardSummary/);
    assert.match(page, /DashboardCommandCenter/);
    assert.match(page, /resolveOperationalSummaryAction/);
    assert.match(page, /OperationalSummaryLoading/);
    assert.match(page, /OperationalSummaryError/);
    assert.match(page, /SummaryStatusBadge/);
  });

  it('keeps dashboard drill-through actions on the shared safe-route allowlist', () => {
    const commandCenter = read('components/dashboard/dashboard-command-center.tsx');

    assert.match(commandCenter, /resolveOperationalSummaryAction/);
    assert.match(commandCenter, /function safeRoute/);
    assert.match(commandCenter, /function firstSafeAction/);
    assert.doesNotMatch(commandCenter, /window\.open|signedUrl|objectKey|bucket/);
  });

  it('uses a priority-first operations layout instead of generic repeated summaries', () => {
    const commandCenter = read('components/dashboard/dashboard-command-center.tsx');

    for (const marker of [
      'Needs attention today',
      'Today at a glance',
      'Run today’s school workflows',
      'Academic readiness',
      'Department queues',
      'Recent activity',
      'Module readiness',
      'DashboardUnavailableState',
    ]) {
      assert.ok(commandCenter.includes(marker), `Missing dashboard section: ${marker}`);
    }

    assert.doesNotMatch(commandCenter, /title="Operational summary"/);
  });

  it('uses current product labels for visible module names', () => {
    const commandCenter = read('components/dashboard/dashboard-command-center.tsx');

    for (const label of [
      'Library',
      'Transport',
      'Canteen',
      'Accounting & Finance',
      'Notices & Communication',
      'Learning Layer',
    ]) {
      assert.ok(commandCenter.includes(label), `Missing visible product label: ${label}`);
    }
  });
});
