import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) =>
  readFileSync(join(webRoot, relativePath), 'utf8');

describe('Phase 7.11d fiscal-close preview', () => {
  const panel = read('components/accounting/fiscal-close-preview-panel.tsx');
  const periodActions = read('components/accounting/fiscal-period-actions.tsx');
  const yearDialog = read('components/accounting/fiscal-year-close-dialog.tsx');
  const client = read('lib/api/accounting.ts');

  it('loads the server preview for both closes', () => {
    assert.match(client, /\/close-preview`/g);
    assert.match(periodActions, /api\.getFiscalPeriodClosePreview\(periodId\)/);
    assert.match(
      yearDialog,
      /api\.getFiscalYearClosePreview\(fiscalYear\.id\)/,
    );
    assert.doesNotMatch(periodActions, /getFiscalPeriodCloseReadiness/);
    assert.doesNotMatch(yearDialog, /getFiscalYearCloseReadiness/);
  });

  it('binds the close to the reviewed fingerprint and every acknowledged warning', () => {
    assert.match(client, /expectedPreviewFingerprint: string;/);
    assert.match(client, /acknowledgedWarningCodes: string\[\];/);
    assert.match(
      panel,
      /expectedPreviewFingerprint: preview\.previewFingerprint/,
    );
    for (const dialog of [periodActions, yearDialog]) {
      assert.match(dialog, /closeRequestFromPreview\(/);
      assert.match(dialog, /allWarningsAcknowledged\(preview, acknowledged\)/);
      assert.match(dialog, /\.can\(\s*'close',?\s*\)/);
      // A refused (stale) close re-reads the preview and clears acknowledgements.
      assert.match(dialog, /previewQuery\.refetch\(\)/);
    }
    assert.match(panel, /type="checkbox"/);
  });

  it('shows restricted items without a count and closing lines from the server', () => {
    assert.match(panel, /\(Restricted\)/);
    assert.match(panel, /item\.resolutionRoute/);
    assert.match(panel, /closing\.lines\.map/);
    assert.match(panel, /closing\.supplementary/);
    assert.match(panel, /closing\.netResult/);
    assert.doesNotMatch(panel, /parseFloat|Number\(line|toFixed\(/);
  });
});
