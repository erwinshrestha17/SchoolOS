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

test.describe.serial('SchoolOS Phase 2A Academics Admin Flow Smoke Tests', () => {
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

  test('Academics Hub: Workflow navigation', async ({ page }) => {
    await page.goto('/dashboard/academics');
    await expect(page).toHaveURL(/\/dashboard\/academics/);
    await expect(page.getByRole('heading', { name: /Academic Workflow/i })).toBeVisible();
    
    const workflowSteps = [
      'Exam Terms',
      'Assessment Components',
      'Marks Entry',
      'CAS Records',
      'Marks Lock',
      'Result Preview',
      'Report Cards',
      'Promotion',
      'Publish Results'
    ];

    for (const step of workflowSteps) {
      await expect(page.getByRole('heading', { name: new RegExp(step, 'i') })).toBeVisible();
    }
  });

  test('Exam Terms Setup: Navigation and workspace', async ({ page }) => {
    await page.goto('/dashboard/academics/exam-terms');
    await expect(page.getByRole('heading', { name: /Exam Terms/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Initialize Exam Term/i })).toBeVisible();
  });

  test('Assessment Components: Setup workspace', async ({ page }) => {
    await page.goto('/dashboard/academics/assessment-components');
    await expect(page.getByRole('heading', { name: /Assessment Components/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Add Assessment Map/i })).toBeVisible();
  });

  test('Marks Entry: Filter integration', async ({ page }) => {
    await page.goto('/dashboard/academics/marks');
    await expect(page.getByRole('heading', { name: /Marks Entry/i })).toBeVisible();
    await expect(page.getByText(/Select context to begin/i)).toBeVisible();
    
    await expect(page.locator('[data-testid="filter-exam-term"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-class"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-subject"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-component"]')).toBeVisible();
  });

  test('CAS Records: Management workspace', async ({ page }) => {
    await page.goto('/dashboard/academics/cas');
    await expect(page.getByRole('heading', { name: /CAS Records/i })).toBeVisible();
    await expect(page.getByText(/CAS Entry/i)).toBeVisible();
  });

  test('Marks Lock & Review: Request list', async ({ page }) => {
    await page.goto('/dashboard/academics/locks');
    await expect(page.getByRole('heading', { name: /Marks Lock & Review/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Marks Lock/i })).toBeVisible();
  });

  test('Report Cards: Batch generation', async ({ page }) => {
    await page.goto('/dashboard/academics/report-cards');
    await expect(page.getByRole('heading', { name: /Report Cards/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Start Generation/i })).toBeVisible();
    const downloadButtons = page.locator('[data-testid="report-card-download-pdf"]');
    if ((await downloadButtons.count()) > 0) {
      await expect(downloadButtons.first()).toBeVisible();
    }
    await expect(page.getByTestId('report-card-history').or(page.getByText(/Select History on a report card/i))).toBeVisible();
  });

  test('Promotion Readiness: Eligibility check', async ({ page }) => {
    await page.goto('/dashboard/academics/promotion');
    await expect(page.getByRole('heading', { name: /Promotion Readiness/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Promotion/i })).toBeVisible();
  });

  test('Result Publishing: Notifications and visibility', async ({ page }) => {
    await page.goto('/dashboard/academics/publishing');
    await expect(page.getByRole('heading', { name: /Result Publishing/i })).toBeVisible();
    await expect(page.getByText(/Select an exam term to control result visibility/i)).toBeVisible();
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
