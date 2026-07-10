import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiRoot = resolve(webRoot, '..', 'api');

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
}

/**
 * Every route in APPROVED_DASHBOARD_ROUTES must resolve to a real Next.js
 * page, or the dashboard's safe-route drill-through silently 404s. This is a
 * regression test for a real bug found 2026-07-10: seven backend
 * operational-summary route strings (e.g. '/dashboard/fees/dues') pointed at
 * pages that were never built / had since been renamed, so clicking those
 * cards actually 404'd despite passing the allowlist check.
 */
function extractApprovedRoutes() {
  const source = read('components/ui/operational-summary.tsx');
  const match = source.match(/APPROVED_DASHBOARD_ROUTES = new Set\(\[([\s\S]*?)\]\)/);
  assert.ok(match, 'Could not find APPROVED_DASHBOARD_ROUTES in operational-summary.tsx');
  return [...match[1].matchAll(/"(\/dashboard\/[^"]+)"/g)].map((m) => m[1]);
}

function routeHasRealPage(route) {
  // Dynamic segments (e.g. a hypothetical /dashboard/notices/[noticeId]) are
  // not expected in this static allowlist, but guard anyway rather than
  // crash on an unexpected shape.
  const segments = route.replace('/dashboard/', '').split('/');
  const pagePath = join(webRoot, 'app', 'dashboard', ...segments, 'page.tsx');
  return existsSync(pagePath);
}

describe('dashboard safe-route allowlist points at real pages', () => {
  it('resolves every APPROVED_DASHBOARD_ROUTES entry to an existing page.tsx', () => {
    const routes = extractApprovedRoutes();
    assert.ok(routes.length > 30, 'Expected the allowlist to have its usual full set of routes');

    const missing = routes.filter((route) => !routeHasRealPage(route));
    assert.deepEqual(missing, [], `These allowlisted routes have no page.tsx: ${missing.join(', ')}`);
  });

  it('keeps the backend operational-summary service pointing at the same corrected routes', () => {
    const backendPath = join(apiRoot, 'src/operational-summary/operational-summary.service.ts');
    const backend = readFileSync(backendPath, 'utf8');

    // The seven routes fixed 2026-07-10 — backend and frontend must agree,
    // or resolveOperationalSummaryAction silently drops the action link.
    const correctedRoutes = [
      '/dashboard/attendance/register',
      '/dashboard/fees/invoices',
      '/dashboard/fees/adjustments',
      '/dashboard/homework/review',
      '/dashboard/transport/live-status',
      '/dashboard/accounting/fiscal-periods',
      '/dashboard/notices/deliveries',
    ];
    for (const route of correctedRoutes) {
      assert.ok(backend.includes(`'${route}'`), `Backend missing corrected route: ${route}`);
    }

    const staleRoutes = [
      '/dashboard/attendance/daily',
      '/dashboard/fees/dues',
      '/dashboard/fees/reversals',
      '/dashboard/homework/submissions',
      '/dashboard/transport/gps-quality',
      '/dashboard/accounting/period-close',
      '/dashboard/notices/delivery',
    ];
    for (const route of staleRoutes) {
      assert.ok(!backend.includes(`'${route}'`), `Backend still has stale dead route: ${route}`);
    }
  });
});
