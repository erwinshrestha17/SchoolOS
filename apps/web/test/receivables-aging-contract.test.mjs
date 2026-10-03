import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

describe('Phase 7.11b receivables aging contracts', () => {
  const workspace = read(
    'components/accounting/receivables-aging-workspace.tsx',
  );
  const page = read('app/dashboard/accounting/receivables/page.tsx');
  const summary = read('components/finance/defaulter-aging-summary.tsx');
  const overview = read('components/finance/fee-overview.tsx');
  const accountingApi = read('lib/api/accounting.ts');

  it('makes the accounting receivables page aging-first', () => {
    assert.match(page, /<ReceivablesAgingWorkspace \/>/);
    assert.match(accountingApi, /\/accounting\/reports\/receivables-aging/);
    assert.match(
      accountingApi,
      /\/accounting\/reports\/receivables-reconciliation/,
    );
  });

  it('gates on accounting report access and stays read-only', () => {
    assert.match(
      workspace,
      /hasPermissions\(\[\s*'accounting:reports:read',\s*'accounting:read',?\s*\]\)/,
    );
    assert.match(workspace, /PermissionDenied/);
    assert.doesNotMatch(workspace, /useMutation/);
  });

  it('shows the shared buckets and never ages or adds money on the client', () => {
    assert.match(workspace, /RECEIVABLES_AGING_BUCKETS\.map/);
    assert.match(workspace, /RECEIVABLES_AGING_BUCKET_LABELS/);
    assert.doesNotMatch(workspace, /\.reduce\(/);
    assert.doesNotMatch(workspace, /daysOverdueOn|agingBucketForDays/);
  });

  it('drills each invoice to the student ledger and shows the ledger comparison', () => {
    assert.match(workspace, /href=\{row\.ledgerHref\}/);
    assert.match(workspace, /Receivables vs ledger/);
    assert.match(workspace, /Unexplained difference/);
    assert.match(workspace, /Unapplied advances held/);
  });

  it('uses the Nepal school day and BS dates', () => {
    assert.match(workspace, /getNepalSchoolDay\(new Date\(\)\)\.gregorianDate/);
    assert.match(workspace, /formatBsDate/);
    assert.doesNotMatch(workspace, /font-mono/);
  });

  it('exports the fees aging summary as of today and only for permitted users', () => {
    assert.match(
      summary,
      /asOfDate: getNepalSchoolDay\(new Date\(\)\)\.gregorianDate/,
    );
    assert.match(
      summary,
      /hasPermissions\(\['reports:export', 'ledger:read'\]\)/,
    );
    assert.doesNotMatch(summary, /filters: \{\}/);
  });

  it('points Fees Home links at parameters the target pages read', () => {
    assert.match(overview, /\/dashboard\/fees\/reports\?report=aging/);
    assert.doesNotMatch(overview, /agingBucket=all/);
    assert.doesNotMatch(overview, /outstanding=true/);
  });
});
