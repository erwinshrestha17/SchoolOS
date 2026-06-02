import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
}

describe('Phase 3B Library frontend contracts', () => {
  it('adds the Library dashboard routes', () => {
    for (const route of [
      'app/dashboard/library/page.tsx',
      'app/dashboard/library/books/page.tsx',
      'app/dashboard/library/copies/page.tsx',
      'app/dashboard/library/issues/page.tsx',
      'app/dashboard/library/overdue/page.tsx',
    ]) {
      assert.equal(existsSync(join(webRoot, route)), true, `Missing ${route}`);
    }
  });

  it('enables Library and implemented operations modules in the dashboard sidebar', () => {
    const sidebar = read('components/layout/sidebar.tsx');

    assert.match(sidebar, /label: 'Library'/);
    assert.match(sidebar, /href: '\/dashboard\/library'/);
    assert.doesNotMatch(sidebar, /#library-coming-soon/);
    assert.match(sidebar, /href: '\/dashboard\/transport'[\s\S]*label: 'Transport'/);
    assert.match(sidebar, /href: '\/dashboard\/canteen'[\s\S]*label: 'Canteen'/);
  });

  it('adds Library API client methods for the Phase 3A backend endpoints', () => {
    const libraryApi = read('lib/api/library.ts');

    for (const helper of [
      'listBooks',
      'createBook',
      'updateBook',
      'listCopies',
      'createCopy',
      'updateCopy',
      'updateCopyStatus',
      'listIssues',
      'issueCopy',
      'returnIssue',
      'listOverdue',
      'getIssuedBooksReport',
      'getOverdueBooksReport',
      'getFineSummary',
      'getBorrowerHistory',
      'downloadIssuedBooksCsv',
      'sendOverdueReminders',
      'postFineToFees',
    ]) {
      assert.match(libraryApi, new RegExp(`${helper}:`), `Missing ${helper}`);
    }

    for (const endpoint of [
      '/library/books',
      '/library/copies',
      '/library/issues',
      '/library/overdue',
      '/library/overdue/reminders',
      '/library/reports/issued',
      '/library/reports/overdue',
      '/library/reports/fines',
      '/library/reports/borrower-history',
      '/library/reports/issued.csv',
    ]) {
      assert.match(libraryApi, new RegExp(endpoint.replaceAll('/', '\\/')));
    }

    assert.match(libraryApi, /encodeURIComponent\(fineId\).*post-to-fees/s);
    const clientApi = read('lib/api/client.ts');
    assert.match(clientApi, /credentials:\s*'include'/);
    assert.match(libraryApi, /downloadCsv/);
    assert.doesNotMatch(libraryApi, /Authorization:\s*`Bearer/);
  });

  it('builds Library UI sections with real API calls and production states', () => {
    const workspace = read('components/library/library-workspace.tsx');

    for (const section of [
      'Total books',
      'Total copies',
      'Available copies',
      'Issued copies',
      'Overdue issues',
      'Lost / damaged',
      'Book Catalogue',
      'Copy Management',
      'Issue / Return',
      'Overdue Issues',
      'Reports & Exports',
      'Export issued CSV',
      'Issued Books',
      'Overdue Books',
      'Fine exposure',
    ]) {
      assert.match(workspace, new RegExp(section.replace('/', '\\/')));
    }

    for (const apiCall of [
      'libraryApi.listBooks',
      'libraryApi.createBook',
      'libraryApi.updateBook',
      'libraryApi.listCopies',
      'libraryApi.createCopy',
      'libraryApi.updateCopy',
      'libraryApi.updateCopyStatus',
      'libraryApi.listIssues',
      'libraryApi.issueCopy',
      'libraryApi.returnIssue',
      'libraryApi.listOverdue',
      'libraryApi.getIssuedBooksReport',
      'libraryApi.getOverdueBooksReport',
      'libraryApi.getFineSummary',
      'libraryApi.downloadIssuedBooksCsv',
      'libraryApi.sendOverdueReminders',
      'libraryApi.postFineToFees',
    ]) {
      assert.match(workspace, new RegExp(apiCall.replace('.', '\\.')));
    }

    assert.match(workspace, /library-issued-books-csv-export/);
    assert.match(workspace, /library-fine-post-to-fees/);
    assert.match(workspace, /library-fine-open-invoice/);
    assert.match(workspace, /\/dashboard\/finance\?invoiceId=/);
    assert.match(workspace, /overdueQuery\.data\?\.items/);
    assert.match(workspace, /LoadingState/);
    assert.match(workspace, /EmptyState/);
    assert.match(workspace, /ErrorNotice/);
    assert.doesNotMatch(workspace, /demo-|fake-|placeholderId/i);
  });

  it('adds a scanner-first Library issue workflow without bypassing form validation', () => {
    const workspace = read('components/library/library-workspace.tsx');

    for (const marker of [
      'Copy barcode / QR scan',
      'LibraryCopyScanner',
      'copyMatchesScan',
      'QrBorrowerSummary',
      'recentCopyScans',
      'onSubmit={props.onIssueSubmit}',
      'copies={availableCopies}',
    ]) {
      assert.match(workspace, new RegExp(marker.replaceAll('/', '\\/')));
    }

    assert.doesNotMatch(
      workspace,
      /preventDefault:\s*\(\)\s*=>\s*\{\s*\}\s*\}\s*as any/,
    );
  });

  it('keeps the shared QR resolver compatible with Library and Canteen scans', () => {
    const resolver = read('components/ui/qr-resolver.tsx');

    assert.match(resolver, /id: data\.id \?\? data\.studentId/);
    assert.match(resolver, /normalizeQrPurpose/);
    assert.match(resolver, /purpose === 'CANTEEN_POS' \|\| purpose === 'CANTEEN_SERVE'/);
    assert.match(resolver, /return 'CANTEEN'/);
    assert.match(resolver, /inputRef\.current\?\.focus/);
  });
});
