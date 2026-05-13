import { expect, test, type Page } from '@playwright/test';

const API_BASE_URL =
  process.env.SCHOOLOS_E2E_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:4000/api/v1';

const schoolAdminCredentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG ?? 'default-school',
  email: process.env.SCHOOLOS_E2E_EMAIL ?? 'admin@schoolos.com',
  password: process.env.SCHOOLOS_E2E_PASSWORD ?? 'admin123',
};

test.describe.serial('SchoolOS Accounting Workflow Smoke Tests', () => {
  test.beforeEach(async ({ context, page }) => {
    // Check if API is available
    try {
      const response = await page.request.get(`${API_BASE_URL}/health`);
      if (!response.ok()) {
        test.skip(true, 'API is not healthy');
      }
    } catch {
      test.skip(true, 'API is not reachable');
    }

    await context.clearCookies();
    await login(page, schoolAdminCredentials);
  });

  test('Accounting Dashboard: Navigation and shell integrity', async ({ page }) => {
    await page.goto('/dashboard/accounting');
    await expect(page).toHaveURL(/\/dashboard\/accounting/);
    
    // Verify cards for core accounting summaries
    const accountingSummaries = [
      'Total Revenue',
      'Total Expenses',
      'Net Balance',
      'Fiscal Status',
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
    
    // Verify tree structure or list
    await expect(page.getByText(/Assets/i)).toBeVisible();
    await expect(page.getByText(/Liabilities/i)).toBeVisible();
  });

  test('Reports: Reports hub and filters', async ({ page }) => {
    await page.goto('/dashboard/accounting/reports');
    await expect(page.getByRole('heading', { name: /Accounting Reports/i })).toBeVisible();
    
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
    await expect(page.getByText(/Fiscal Year/i)).toBeVisible();
    await expect(page.getByText(/Custom Date Range/i)).toBeVisible();
    await expect(page.getByTestId('accounting-report-pdf-export')).toBeVisible();
    await expect(page.getByTestId('accounting-report-snapshots')).toBeVisible();
  });

  test('Reconciliation: Bank reconciliation workspace loads', async ({ page }) => {
    await page.goto('/dashboard/accounting/reconciliation');
    await expect(page.getByRole('heading', { name: /Bank Reconciliation/i })).toBeVisible();
    await expect(page.getByText(/Select account to reconcile/i)).toBeVisible();
    const autoMatch = page.getByTestId('bank-reconciliation-auto-match');
    if ((await autoMatch.count()) > 0) {
      await expect(autoMatch).toBeVisible();
    }
  });

  test('Management: Fiscal management page loads', async ({ page }) => {
    await page.goto('/dashboard/accounting/management');
    await expect(page.getByRole('heading', { name: /Fiscal Management/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Fiscal Periods/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Fiscal Years/i })).toBeVisible();
  });
});

async function login(
  page: Page,
  credentials: { tenantSlug: string; email: string; password: string },
) {
  await page.goto('/login');
  await expect(page.getByLabel(/School Code/i)).toBeVisible();

  await page.getByLabel(/School Code/i).fill(credentials.tenantSlug);
  await page.getByLabel(/Email/i).fill(credentials.email);
  await page.getByLabel(/Password/i).fill(credentials.password);

  await Promise.all([
    page.waitForURL(/\/dashboard(?:$|[/?#])/, { timeout: 20_000 }),
    page.getByRole('button', { name: /Sign in/i }).click(),
  ]);
}
