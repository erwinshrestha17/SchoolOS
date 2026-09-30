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
    ...panel.matchAll(/text: 'No open (notice|transport|staff) issue'/g),
  ];
  assert.equal(allClear.length, 3);
  assert.equal(panel.match(/'Partial information only'/g)?.length, 4);
});
