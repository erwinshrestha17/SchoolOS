import { expect, test } from './fixtures/auth';

test.describe.serial('SchoolOS Accounting Workflow Smoke Tests', () => {
  test('Accounting Dashboard: Navigation and shell integrity', async ({ page }) => {
    await page.goto('/dashboard/accounting');
    await expect(page).toHaveURL(/\/dashboard\/accounting/);
    
    // Verify the backend-owned operational summaries. Do not replace these with
    // browser-derived revenue or balance totals.
    const accountingSummaries = [
      'Open Fiscal Periods',
      'Unposted Journals',
      'Unreconciled Statements',
      'Mapping Issues',
    ];

    for (const summary of accountingSummaries) {
      await expect(page.getByText(new RegExp(summary, 'i'))).toBeVisible();
    }
  });

  test('Journals: List and empty state', async ({ page }) => {
    await page.goto('/dashboard/accounting/journals');
    await expect(page.getByRole('heading', { name: /Journal Entries/i })).toBeVisible();
    
    // Check loading state resolves
    await expect(page.getByText(/Loading journal entries/i)).not.toBeVisible();
    
    // Should show either entries or empty state
    const hasEntries = await page.getByRole('row').count() > 1;
    if (!hasEntries) {
      // Depending on the UI, it might show an empty state message
      // We'll check for a common empty state pattern if possible
    }
  });

  test('Accounts: Chart of Accounts loads', async ({ page }) => {
    await page.goto('/dashboard/accounting/accounts');
    await expect(page.getByRole('heading', { name: /Chart of Accounts/i })).toBeVisible();
    
    // Verify canonical account types without matching account names such as
    // "Library Assets".
    await expect(page.getByText(/^ASSET$/).first()).toBeVisible();
    await expect(page.getByText(/^LIABILITY$/).first()).toBeVisible();
  });

  test('Reports: Reports hub and filters', async ({ page }) => {
    await page.goto('/dashboard/accounting/reports');
    await expect(page.getByText('Accounting Reports', { exact: true }).first()).toBeVisible();
    
    // Verify report selection buttons
    const reports = [
      'Trial Balance',
      'General Ledger',
      'Income Statement',
      'Balance Sheet',
      'Cash Book',
    ];

    for (const report of reports) {
      await expect(page.getByRole('button', { name: new RegExp(report, 'i') })).toBeVisible();
    }

    // Verify filter section
    await expect(page.getByText(/Report Filters/i)).toBeVisible();
    await expect(page.getByText('Fiscal Year', { exact: true })).toBeVisible();
    await expect(page.getByText('Custom Date Range', { exact: true })).toBeVisible();
    await expect(page.getByTestId('accounting-report-pdf-export')).toBeVisible();
    await expect(page.getByTestId('accounting-report-snapshots')).toBeVisible();
  });

  test('Reconciliation: Bank reconciliation workspace loads', async ({ page }) => {
    await page.goto('/dashboard/accounting/reconciliation');
    await expect(page.getByText(/Select Bank\/Cash Account/i)).toBeVisible();
    await expect(page.getByRole('combobox').first()).toBeVisible();
    const autoMatch = page.getByTestId('bank-reconciliation-auto-match');
    if ((await autoMatch.count()) > 0) {
      await expect(autoMatch).toBeVisible();
    }
  });

  test('Management: Fiscal management page loads', async ({ page }) => {
    await page.goto('/dashboard/accounting/management');
    await expect(page.getByRole('heading', { name: /Fiscal Years & Periods/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Close Year|Reopen/i }).first()).toBeVisible();
  });
});
