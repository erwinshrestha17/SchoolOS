import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Phase 4: persona homes must never present partial data as "all clear".
const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('attention panel does not claim "nothing needs attention" on a partial dashboard', () => {
  const panel = read('components/dashboard/dashboard-attention-panel.tsx');
  assert.match(panel, /partial\?: boolean/);
  assert.match(panel, /partial\s*\?\s*'Some sources could not be loaded/);
  for (const consumer of [
    'components/dashboard/operational-dashboard-layout.tsx',
    'app/dashboard/attention/page.tsx',
  ]) {
    assert.match(read(consumer), /partial=\{dashboard\.status === 'partial'\}/);
  }
});

test('summary strip only says "All clear" when every contributing count is known', () => {
  const strip = read('components/dashboard/dashboard-summary-strip.tsx');
  assert.match(strip, /issueCount === 0 && knownCounts\.length === 2/);
  assert.match(strip, /dashboard\.status === 'partial'\s*\?\s*'Partial'/);
});

test('operations rows never report "no open issue" when a metric is missing', () => {
  const panel = read('components/dashboard/dashboard-operations-panel.tsx');
  const allClear = [
    ...panel.matchAll(
      /text: 'No open (notice|transport|staff|accounting) issue'/g,
    ),
  ];
  assert.equal(allClear.length, 4);
  assert.equal(panel.match(/'Partial information only'/g)?.length, 6);
  // Withheld metrics read as out of scope, never as broken.
  assert.match(panel, /'Not part of your role'/);
});

test('homes come from the core resolver shared with the API and switching drops other homes cache', () => {
  const hook = read('lib/home-persona.ts');
  const page = read('app/dashboard/page.tsx');
  const service = read(
    '../api/src/operational-summary/operational-summary.service.ts',
  );
  assert.match(hook, /availableHomePersonas/);
  assert.match(hook, /resolveHomePersona/);
  assert.match(hook, /removeQueries/);
  assert.match(page, /<HomePersonaSwitcher/);
  assert.match(page, /api\.getDashboardSummary\(expectedPersona/);
  // The API refuses a home the session does not hold (never substitutes).
  assert.match(service, /availableHomePersonas/);
  assert.match(service, /This home is not available for your account\./);
});

test('recents are scoped to school + person and revalidated before display', () => {
  const recents = read('lib/recently-viewed.ts');
  const session = read('lib/session.ts');
  const palette = read('components/layout/command-palette.tsx');
  assert.match(recents, /entry\.scope === scope/);
  assert.match(
    session,
    /recentlyViewedScope\(session\?\.tenant\?\.id, session\?\.user\?\.id\)/,
  );
  assert.match(palette, /RECENT_KIND_ACCESS/);
  assert.match(palette, /allowedRecents/);
});

test('entitlements refresh on focus, interval and school switch', () => {
  const provider = read('components/entitlements-provider.tsx');
  assert.match(provider, /visibilitychange/);
  assert.match(provider, /ENTITLEMENTS_REFRESH_MS/);
  assert.match(provider, /\[status, tenantId, refreshTick\]/);
});

test('palette quick actions mirror the create routes permissions and modules', () => {
  const palette = read('components/layout/command-palette.tsx');
  assert.match(palette, /QUICK_ACTIONS/);
  assert.match(palette, /action\.permissions\.every/);
  assert.match(palette, /hasModule\(action\.module\)/);
  assert.match(palette, /label="Actions"/);
});

test('principal and admin homes carry decisions and setup blockers', () => {
  assert.match(
    read('components/dashboard/principal-dashboard.tsx'),
    /<PrincipalDecisionsPanel/,
  );
  assert.match(
    read('components/dashboard/admin-dashboard.tsx'),
    /<SetupBlockersPanel/,
  );
  assert.match(
    read('../api/src/advanced-operations/principal-approval-queue.service.ts'),
    /requestedById: \{ not: actor\.userId \}/,
  );
});

test('staff card says "Not recorded" before any staff attendance is taken', () => {
  const strip = read('components/dashboard/dashboard-summary-strip.tsx');
  assert.match(strip, /present === 0 && anomalies === 0/);
  assert.match(strip, /'Not recorded'/);
});

test('readiness panels treat modules outside the home as out of scope, not failed', () => {
  const panel = read('components/dashboard/dashboard-readiness-section.tsx');
  assert.match(panel, /summary === undefined \|\|/);
  assert.doesNotMatch(
    panel,
    /sourceModules\.some\(\(module\) => !moduleMap\.has\(module\)\)/,
  );
});
