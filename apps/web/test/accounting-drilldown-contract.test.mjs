import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

describe('Phase 7.11a accounting drill-down contracts', () => {
  const view = read('components/accounting/accounting-reports-view.tsx');
  const dialog = read('components/accounting/journal-detail-dialog.tsx');
  const filters = read('components/accounting/report-filters.tsx');
  const core = read('../../packages/core/src/types/accounting.ts');

  it('drills statement rows into the account ledger with the matching stage', () => {
    assert.match(view, /const drillToLedger = \(accountId: string, stage/);
    // Trial balance keeps its own stage; income statement is pre-closing;
    // balance sheet is a position, so post-closing.
    assert.match(
      view,
      /drillToLedger\(\s*row\.accountId,\s*trialBalance\.stage/,
    );
    assert.match(view, /drillToLedger\(r\.accountId, 'PRE_CLOSING'\)/);
    assert.match(view, /drillToLedger\(e\.accountId, 'PRE_CLOSING'\)/);
    assert.match(view, /drillToLedger\(accountId, 'POST_CLOSING'\)/);
    assert.match(view, /stage: ledgerStage/);
    assert.match(filters, /value=\{accountId \?\? ''\}/);
  });

  it('drills ledger and cash book rows into the journal', () => {
    const journalDrills = view.match(
      /onActivate: \(\) => openJournalDetail\(row\.journalEntryId\)/g,
    );
    assert.ok(journalDrills && journalDrills.length >= 3);
  });

  it('pages the ledger on the server and shows a brought-forward balance', () => {
    assert.match(view, /page: ledgerPage/);
    assert.match(view, /onPageChange: setLedgerPage/);
    assert.match(view, /pageOpeningBalance/);
    assert.match(view, /Balance brought forward/);
    assert.match(view, /Totals and closing balance/);
  });

  it('never computes money on the client for the trial-balance opening', () => {
    assert.doesNotMatch(view, /Number\(debit\)\s*-\s*Number\(credit\)/);
  });

  it('reads journal detail from the server and renders resolved evidence', () => {
    assert.match(dialog, /queryFn: \(\) => api\.getJournalEntry\(/);
    assert.match(dialog, /source\?\.restricted/);
    assert.match(dialog, /Restricted\. You do not have access to this module/);
    assert.match(dialog, /accounting-source-approvals/);
    assert.match(dialog, /downloadProtectedFile\(document\.fileAssetId/);
    assert.match(dialog, /Open original journal/);
    assert.doesNotMatch(dialog, /buildSourceDrilldown/);
    assert.doesNotMatch(dialog, /entry\.postedBy|entry\.reference/);
  });

  it('shares the corrected report contract in core', () => {
    assert.match(
      core,
      /AccountingLedgerStage = "PRE_CLOSING" \| "POST_CLOSING"/,
    );
    assert.match(core, /comparisonSupported\?: false/);
    assert.match(core, /pageOpeningBalance\?: string/);
    assert.match(core, /export type JournalSourceSummary/);
  });

  it('keeps BS dates and avoids monospace', () => {
    assert.match(dialog, /formatBsDateTime/);
    assert.doesNotMatch(dialog, /font-mono/);
    assert.doesNotMatch(view, /font-mono/);
  });
});
