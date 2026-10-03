import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) =>
  readFileSync(join(webRoot, relativePath), 'utf8');

describe('Phase 7.11c Expenses & Payables workspace', () => {
  const page = read('app/dashboard/accounting/payables/page.tsx');
  const workspace = read('components/accounting/payables-workspace.tsx');
  const client = read('lib/api/payables.ts');

  it('unlocks the payables destination with the real workspace', () => {
    assert.doesNotMatch(page, /AccountantDestinationUnavailable/);
    assert.match(page, /<PayablesWorkspace \/>/);
    assert.match(page, /<Suspense/);
    assert.match(page, /sourceModule="M11"/);
  });

  it('calls only the payables API routes the server declares', () => {
    for (const path of [
      "'/accounting/payables-setup'",
      "'/accounting/vendors'",
      '/accounting/vendors/${encodeURIComponent(id)}/deactivate',
      "'/accounting/vendor-bills'",
      '/accounting/vendor-bills/${encodeURIComponent(id)}/submit',
      '/accounting/vendor-bills/${encodeURIComponent(id)}/approve',
      '/accounting/vendor-bills/${encodeURIComponent(id)}/reject',
      '/accounting/vendor-bills/${encodeURIComponent(id)}/reverse',
      "'/accounting/payables'",
      '/accounting/payables/${encodeURIComponent(id)}/settlements',
      '/accounting/payable-settlements/${encodeURIComponent(id)}/reverse',
      "'/accounting/reports/payables-aging'",
    ]) {
      assert.ok(client.includes(path), `missing API path ${path}`);
    }
    // The old direct-expense journal route is not part of the payables domain.
    assert.doesNotMatch(client, /'\/accounting\/expenses'/);
  });

  it('follows each record’s server projection for every action', () => {
    assert.match(workspace, /resourceAccess</);
    for (const action of ['submit', 'approve', 'reject', 'reverse', 'settle']) {
      assert.match(workspace, new RegExp(`\\.can\\('${action}'\\)`));
    }
    assert.doesNotMatch(workspace, /allowedActions|canApprove:|canSettle:/);
  });

  it('never computes money or tax in the browser', () => {
    assert.match(
      workspace,
      /Tax amounts come from the bill and are not computed by SchoolOS\./,
    );
    assert.doesNotMatch(workspace, /parseFloat|Number\(amount|toFixed\(/);
    assert.doesNotMatch(workspace, /0\.13|0\.015|\* ?13|vatRate|tdsRate/i);
    // Totals, balances and buckets are read from the server response.
    assert.match(workspace, /totals\.totalOutstanding/);
    assert.match(workspace, /row\.outstanding/);
  });

  it('binds approval to the reviewed content and makes writes idempotent', () => {
    assert.match(workspace, /bill\?\.contentFingerprint/);
    assert.match(client, /expectedFingerprint/);
    assert.match(workspace, /idempotencyKey/);
    assert.match(client, /idempotencyKey: string;\s+amount: string;/);
  });

  it('uses BS dates for entry and display', () => {
    assert.match(workspace, /BsDateField/);
    assert.match(workspace, /formatBsDate\(/);
    assert.match(workspace, /toGregorianDateFromBs/);
  });

  it('shows a setup state instead of auto-creating an AP account', () => {
    assert.match(workspace, /Accounts Payable is not set up/);
    assert.match(workspace, /SchoolOS never creates this account/);
    // The mapping endpoint replaces the whole set: the form keeps the others.
    assert.match(workspace, /mappingType !== 'ACCOUNTS_PAYABLE'/);
  });
});
