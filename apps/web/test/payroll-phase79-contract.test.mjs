import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  findPayrollPeriodContaining,
  formatPayrollPeriodLabel,
  resolvePayrollPeriod,
} from '@schoolos/core';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) =>
  readFileSync(join(webRoot, relativePath), 'utf8');

describe('Phase 7.9 payroll period labels (shared core calendar)', () => {
  it('labels BS runs by month name and leaves legacy Gregorian labels untouched', () => {
    assert.equal(formatPayrollPeriodLabel(2083, 7), 'Kartik 2083');
    assert.equal(formatPayrollPeriodLabel(2026, 5), '2026-05');
  });

  it('resolves the documented Kartik 2083 bounds', () => {
    const period = resolvePayrollPeriod(2083, 7);
    assert.equal(period.startsOn, '2026-10-18');
    assert.equal(period.endsOn, '2026-11-16');
    assert.equal(period.calendarDays, 30);
    assert.equal(
      findPayrollPeriodContaining('2026-10-03').label,
      'Ashwin 2083',
    );
  });
});

describe('Phase 7.9 payroll web contracts', () => {
  const client = read('lib/api/payroll.ts');
  const view = read('lib/payroll-run-view.ts');
  const panel = read('components/hr/payroll-run-holds-panel.tsx');
  const runs = read('components/hr/payroll-runs.tsx');

  it('uses the documented hold and bank-advice endpoints', () => {
    assert.match(client, /\/holds`/);
    assert.match(
      client,
      /\/holds\/\$\{encodeURIComponent\(holdId\)\}\/release/,
    );
    assert.match(client, /\/bank-advice`/);
    assert.match(client, /\/bank-advice\/export/);
  });

  it('exports bank advice with a CSRF-protected POST, not a GET link', () => {
    const http = read('lib/api/client.ts');
    assert.match(http, /export async function downloadPostFile/);
    assert.match(http, /X-CSRF-Token/);
    assert.match(client, /downloadPostFile\(/);
  });

  it('gates hold and export controls on the server authorization projection', () => {
    assert.match(view, /access\.can\('HOLD'\)/);
    assert.match(view, /access\.can\('RELEASE_HOLD'\)/);
    assert.match(view, /access\.can\('EXPORT_BANK_ADVICE'\)/);
    assert.match(
      runs,
      /canPlaceHold\(selectedRun\.status, selectedRunAccess\)/,
    );
  });

  it('requires a reason to place or release a hold and to re-export', () => {
    assert.match(panel, /holdReasonValid\(holdReason\)/);
    assert.match(panel, /holdReasonValid\(releaseReason\)/);
    assert.match(panel, /holdReasonValid\(reExportReason\)/);
  });

  it('never hides a negative net and blocks saving a draft with one', () => {
    assert.match(runs, /previewNegativeCount > 0/);
    assert.match(runs, /isNegativeNet\(line\)/);
    assert.doesNotMatch(runs, /Math\.max\(0,/);
  });

  it('presents BS months and no longer offers Gregorian month names for periods', () => {
    assert.match(runs, /BS_MONTH_OPTIONS/);
    assert.doesNotMatch(runs, /'January'/);
    assert.match(runs, /payrollRunPeriodLabel\(/);
    assert.match(
      read('app/dashboard/payroll/reports/page.tsx'),
      /currentPayrollBsPeriod\(\)\.bsYear/,
    );
  });

  it('treats the divisor as an optional override and never invents one', () => {
    assert.match(runs, /divisorOverride/);
    assert.match(runs, /Divisor days \(optional\)/);
  });

  it('shows the proration summary without the per-day ledger', () => {
    const proration = read('components/hr/payroll-line-proration.tsx');
    assert.match(proration, /How this was calculated/);
    assert.doesNotMatch(proration, /breakdown\.ledger/);
  });
});
