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
      'app/dashboard/library/reservations/page.tsx',
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
      'archiveCopy',
      'listIssues',
      'issueCopy',
      'returnIssue',
      'listReservations',
      'createReservation',
      'cancelReservation',
      'fulfillReservation',
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
      '/library/reservations',
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
    assert.match(
      libraryApi,
      /\/library\/copies\/\$\{encodeURIComponent\(copyId\)\}\/archive/,
    );
    const clientApi = read('lib/api/client.ts');
    assert.match(clientApi, /credentials:\s*["']include["']/);
    assert.match(libraryApi, /downloadCsv/);
    assert.doesNotMatch(libraryApi, /Authorization:\s*`Bearer/);
  });

  it('builds Library UI sections with real API calls and production states', () => {
    const workspace = read('components/library/library-workspace.tsx');
    const page = read('app/dashboard/library/page.tsx');
    const reservationsPage = read('app/dashboard/library/reservations/page.tsx');

    assert.match(page, /<ModuleHeader/);
    assert.match(page, /primaryAction=/);
    assert.match(page, /moreActionItems=/);
    assert.match(page, /Issue \/ Return/);
    assert.match(page, /\/dashboard\/library\/catalog/);
    assert.match(page, /\/dashboard\/library\/copies/);
    assert.match(page, /\/dashboard\/library\/reservations/);
    assert.match(page, /eyebrow="M8 Library"/);
    assert.doesNotMatch(page, /M8A/);

    for (const section of [
      'Books on loan',
      'Overdue issues',
      'Reservations waiting',
      'Catalogue copies',
      'Book Catalogue',
      'Copy Management',
      'Issue / Return',
      'Reservation Queue',
      'Create Reservation',
      'Overdue Issues',
      'Reports & Exports',
      'Export issued CSV',
      'Issued Books',
      'Overdue Books',
      'Fine exposure',
    ]) {
      assert.match(workspace, new RegExp(section.replace('/', '\\/')));
    }

    assert.match(workspace, /<SummaryGrid/);
    assert.match(workspace, /<SummaryCard/);
    assert.match(workspace, /<WorkSurface/);
    assert.match(workspace, /status: "ISSUED"/);
    assert.match(workspace, /activeLoansQuery\.data\?\.meta\.total/);
    assert.match(workspace, /reservationsQuery\.data\?\.meta\.total/);
    assert.match(workspace, /needs summary API/);
    assert.match(workspace, /Remaining Issues/);
    assert.match(workspace, /listPageSize/);
    assert.match(workspace, /page: String\(bookPage\)/);
    assert.match(workspace, /page: String\(copyPage\)/);
    assert.match(workspace, /page: String\(issuePage\)/);
    assert.match(workspace, /page: String\(overduePage\)/);
    assert.match(workspace, /page: String\(finePage\)/);
    assert.match(workspace, /PaginationControls/);

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
      'libraryApi.listReservations',
      'libraryApi.createReservation',
      'libraryApi.cancelReservation',
      'libraryApi.fulfillReservation',
      'libraryApi.listOverdue',
      'libraryApi.getIssuedBooksReport',
      'libraryApi.getOverdueBooksReport',
      'libraryApi.getFineSummary',
      'libraryApi.downloadIssuedBooksCsv',
      'libraryApi.sendOverdueReminders',
      'libraryApi.postFineToFees',
      'libraryApi.resolveScannedCopy',
    ]) {
      assert.match(workspace, new RegExp(apiCall.replace('.', '\\.')));
    }

    assert.match(workspace, /library-issued-books-csv-export/);
    assert.match(workspace, /library-fine-post-to-fees/);
    assert.match(workspace, /library-fine-open-invoice/);
    assert.match(workspace, /\/dashboard\/fees\/collect\?invoiceId=/);
    assert.match(workspace, /copyStatusReasons/);
    assert.match(workspace, /cleanReservationPayload/);
    assert.match(workspace, /cleanFulfillmentPayload/);
    assert.match(workspace, /ReservationRow/);
    assert.match(workspace, /library-reservations/);
    assert.match(reservationsPage, /initialTab="reservations"/);
    assert.match(workspace, /Audit reason/);
    assert.match(workspace, /onArchiveCopy/);
    assert.match(workspace, /Archive library copy/);
    assert.match(workspace, /Archive copies instead of deleting them/);
    assert.match(workspace, /archiveCopyMutation/);
    assert.match(workspace, /confirmDisabled=/);
    assert.match(workspace, /reason: copyStatusReasons\[copy\.id\]/);
    assert.match(workspace, /overdueQuery\.data\?\.items/);
    assert.match(workspace, /LoadingState/);
    assert.match(workspace, /EmptyState/);
    assert.match(workspace, /ErrorNotice/);
    assert.match(workspace, /var\(--primary\)/);
    assert.doesNotMatch(workspace, /bg-\[var\(--color-mod-library-accent\)\]/);
    assert.doesNotMatch(
      workspace,
      /rounded-\[2rem\]|rounded-\[3rem\]|Unknown book|Unknown author|Unknown borrower|\bN\/A\b/,
    );
    assert.doesNotMatch(workspace, /demo-|fake-|placeholderId/i);
  });

  it('keeps Library selector and report rows explicit about missing source data', () => {
    const workspace = read('components/library/library-workspace.tsx');
    const selector = read('components/library/book-selector.tsx');

    assert.match(selector, /ISBN not recorded/);
    assert.match(workspace, /Borrower record unavailable/);
    assert.match(workspace, /Author not recorded/);
    assert.match(workspace, /Barcode not recorded/);

    for (const source of [workspace, selector]) {
      assert.doesNotMatch(source, /\bN\/A\b|\bUnknown\b/);
      assert.doesNotMatch(source, /shadow-xl|rounded-\[2rem\]|rounded-\[2\.5rem\]|rounded-\[30px\]/);
    }
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
      if (marker === 'copyMatchesScan') {
        assert.doesNotMatch(workspace, /copyMatchesScan/);
      } else {
        assert.match(workspace, new RegExp(marker.replaceAll('/', '\\/')));
      }
    }
    assert.match(workspace, /onResolveCopyScan/);
    assert.match(workspace, /resolveCopyScanMutation/);
    assert.match(workspace, /Checking\.\.\./);

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
