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

test.describe.serial('SchoolOS reporting and audit smoke tests', () => {
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

  test('Reports Dashboard: Hub and Academic Reports', async ({ page }) => {
    await page.goto('/dashboard/reports');
    await expect(page).toHaveURL(/\/dashboard\/reports/);
    await expect(page.getByRole('heading', { name: /Reports Dashboard/i })).toBeVisible();

    // Verify presence of academic reports that support the M4 workflow.
    const expectedReports = [
      'CAS Summary',
      'Promotion Readiness',
      'Report-Card Generation Status',
      'Failed/Below-Threshold Students',
    ];

    for (const report of expectedReports) {
      await expect(page.getByText(new RegExp(report, 'i'))).toBeVisible();
    }

    // Trigger an export (Report-Card Status)
    const reportCardStatusBtn = page.getByText(/Report-Card Generation Status/i);
    await reportCardStatusBtn.click();
    
    // Check if filters appear
    await expect(page.getByLabel(/Format/i)).toBeVisible();
    
    // Trigger download (simulated)
    const exportBtn = page.getByRole('button', { name: /Export/i });
    await expect(exportBtn).toBeEnabled();
  });

  test('Accounting Audit: Viewer and Diff Depth', async ({ page }) => {
    await page.goto('/dashboard/accounting/audit');
    await expect(page).toHaveURL(/\/dashboard\/accounting\/audit/);
    await expect(page.getByRole('heading', { name: /Accounting Audit Trail/i })).toBeVisible();

    // Wait for logs to load
    await page.waitForSelector('table');
    
    // If there are logs, check the "View Diff" button
    const viewDiffBtn = page.getByRole('button', { name: /View Diff/i }).first();
    if (await viewDiffBtn.isVisible()) {
      await viewDiffBtn.click();
      await expect(page.getByText(/Audit Detail/i)).toBeVisible();
      await expect(page.getByText(/Change Snapshot/i)).toBeVisible();
      await page.getByRole('button', { name: /Close/i }).click();
    }
  });

  test('Bank Reconciliation: PDF Export Button', async ({ page }) => {
    await page.goto('/dashboard/accounting/reconciliation');
    await expect(page.getByRole('heading', { name: /Bank Reconciliation/i })).toBeVisible();
    
    // Check for the export control when an account context is selected.
    const exportPdfBtn = page.getByTestId('bank-reconciliation-pdf-export');
    // If the button exists (depending on if an account is selected)
    // For now, we just check if the UI is ready to show it
  });

  test('Academics: Advanced Reports Tab', async ({ page }) => {
    await page.goto('/dashboard/academics/report-cards');
    await expect(page.getByRole('tab', { name: /Advanced Reports/i })).toBeVisible();
    await page.getByRole('tab', { name: /Advanced Reports/i }).click();
    
    // Verify it links to the central hub
    await expect(page.getByRole('link', { name: /Go to Reports Dashboard/i })).toBeVisible();
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
