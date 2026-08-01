import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) =>
  readFileSync(join(webRoot, relativePath), 'utf8');

describe('FIN/UI-P0-01 Accountant foundation', () => {
  it('freezes exactly the eight approved Accountant destinations', () => {
    const layout = read('app/dashboard/accounting/layout.tsx');
    const navBlock = layout.match(/const navItems = \[([\s\S]*?)\n  \];/)?.[1];
    assert.ok(navBlock, 'Accounting navigation array is missing');
    const labels = [...navBlock.matchAll(/label: '([^']+)'/g)].map(
      (match) => match[1],
    );
    assert.deepEqual(labels, [
      'Finance Dashboard',
      'Fees & Receivables',
      'Collections & Receipts',
      'Cash & Bank',
      'Expenses & Payables',
      'Payroll Handoff',
      'Reports',
      'Audit Trail',
    ]);

    for (const route of [
      'receivables',
      'collections',
      'cash-bank',
      'payables',
      'payroll-handoff',
    ]) {
      assert.equal(
        existsSync(join(webRoot, `app/dashboard/accounting/${route}/page.tsx`)),
        true,
        `Missing Accountant destination: ${route}`,
      );
    }

    assert.doesNotMatch(navBlock, /Budgets|Chart of Accounts|Fiscal Periods/);
  });

  it('uses stable keyed columns instead of positional finance cells', () => {
    const table = read('components/accounting/report-table.tsx');
    const accountingViews = [
      'components/accounting/accounting-audit-workspace.tsx',
      'components/accounting/accounting-dashboard-view.tsx',
      'components/accounting/accounting-reports-view.tsx',
      'components/accounting/bank-reconciliation-workspace.tsx',
      'components/accounting/chart-of-accounts-view.tsx',
      'components/accounting/journal-entries-view.tsx',
    ]
      .map(read)
      .join('\n');

    assert.match(table, /Readonly<Record<string, ReportTableCell>>/);
    assert.match(table, /data-grid-cell/);
    assert.match(table, /first:sticky first:left-0/);
    assert.match(table, /sort\.onChange/);
    assert.match(table, /pagination\.onPageChange/);
    assert.match(table, /resize-x/);
    assert.doesNotMatch(table, /value:\s*any|Array<\{[\s\S]*?cells:\s*Array/);
    assert.doesNotMatch(accountingViews, /<ReportTable[\s\S]{0,120}headers=/);
    assert.doesNotMatch(accountingViews, /cells:\s*\[/);
  });
});
