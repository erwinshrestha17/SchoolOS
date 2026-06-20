import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const webRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), 'utf8');

describe('M3 fees workspace contract', () => {
  it('uses the shared module workspace and keeps one cashier primary action', () => {
    const page = read('app/dashboard/finance/page.tsx');

    assert.match(page, /<ModuleHeader/);
    assert.match(page, /<KpiGrid/);
    assert.match(page, /<ModuleTabs/);
    assert.match(page, />\s*Record Payment\s*</);
    assert.match(page, /moreActionItems/);
    assert.match(page, /value: 'collection'[\s\S]*label: 'Collection'/);
    assert.match(page, /value: 'ledger'[\s\S]*label: 'Ledger & Receipts'/);
    assert.match(page, /value: 'reversals'[\s\S]*label: 'Refunds \/ Reversals'/);
    assert.match(page, /activeTab === 'ledger' \|\| activeTab === 'reversals'/);
    assert.match(page, /value: 'close'[\s\S]*label: 'Cashier Close'/);
    assert.match(page, /value: 'reports'[\s\S]*label: 'Reports'/);
    assert.match(page, /Receipt History & Reprint/);
    assert.match(page, /Cashier Close/);
  });

  it('does not present browser-derived invoice totals as official KPIs', () => {
    const page = read('app/dashboard/finance/page.tsx');

    assert.doesNotMatch(page, /invoices\.reduce/);
    assert.doesNotMatch(page, /collectionRate/);
    assert.match(page, /Needs a real M3 daily summary API/);
    assert.match(page, /defaultersQuery\.data\.totalOutstanding/);
    assert.match(page, /Cashier Close Status/);
    assert.match(page, /Receipts Issued/);
  });

  it('matches defaulter metadata and guards duplicate payment submission', () => {
    const financeApi = read('lib/api/finance.ts');
    const queue = read('components/finance/defaulter-queue-tab.tsx');
    const counter = read('components/finance/collection-counter.tsx');

    assert.match(financeApi, /request<DefaultersResponse>/);
    assert.match(queue, /defaultersQuery\.data\?\.items/);
    assert.match(counter, /isSubmitting/);
    assert.match(counter, /invoiceDetailQuery\.data\.outstandingAmount/);
  });
});
