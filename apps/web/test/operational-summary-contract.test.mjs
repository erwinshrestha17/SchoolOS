import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

describe('operational summary web contracts', () => {
  it('uses verified dashboard and platform summary endpoints', () => {
    const client = read('lib/api/operational-summary.ts');
    assert.match(client, /'\/dashboard\/summary'/);
    assert.match(client, /`\/dashboard\/\$\{encodeURIComponent\(module\)\}\/summary`/);
    assert.match(client, /'\/platform\/summary'/);
  });

  it('renders all operational summary states through shared UI', () => {
    const component = read('components/ui/operational-summary.tsx');
    for (const state of ['ready', 'empty', 'partial', 'locked', 'permissionDenied']) {
      assert.match(component, new RegExp(state));
    }
    assert.match(component, /ModuleLockedState/);
    assert.match(component, /ErrorState/);
    assert.match(component, /LoadingState/);
  });

  it('does not trust arbitrary next-action routes', () => {
    const component = read('components/ui/operational-summary.tsx');
    assert.match(component, /APPROVED_DASHBOARD_ROUTES/);
    assert.match(component, /resolveOperationalSummaryAction/);
    assert.match(component, /return APPROVED_DASHBOARD_ROUTES\.has\(action\.route\) \? action\.route : null/);
  });

  it('mounts summaries only at dashboard and module landing surfaces', () => {
    const dashboard = read('app/dashboard/page.tsx');
    const shell = read('components/layout/dashboard-shell.tsx');
    assert.match(dashboard, /api\.getDashboardSummary/);
    assert.match(shell, /MODULE_LANDING_SUMMARIES/);
    assert.match(shell, /ModuleOperationalSummary/);
  });
});
