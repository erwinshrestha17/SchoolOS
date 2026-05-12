import { expect, test, type Page } from '@playwright/test';

const credentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG,
  email: process.env.SCHOOLOS_E2E_EMAIL,
  password: process.env.SCHOOLOS_E2E_PASSWORD,
};

test.describe('Attendance & Fees Workflow Smoke', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !credentials.tenantSlug || !credentials.email || !credentials.password,
      'Set E2E credentials to run attendance/fees smoke tests.',
    );
    await login(page);
  });

  test('attendance page loads and class selector renders', async ({ page }) => {
    await page.goto('/dashboard/attendance');
    await expect(page.getByRole('heading', { name: /Smart Attendance/i })).toBeVisible();
    await expect(page.getByLabel(/Class/i)).toBeVisible();
    await expect(page.getByLabel(/Date/i)).toBeVisible();
  });

  test('attendance register page loads and displays filters', async ({ page }) => {
    await page.goto('/dashboard/attendance/register');
    await expect(page.getByRole('heading', { name: /Attendance Register/i })).toBeVisible();
    await expect(page.getByLabel(/Academic Year/i)).toBeVisible();
    await expect(page.getByLabel(/Month/i)).toBeVisible();
  });

  test('finance page loads and student search renders', async ({ page }) => {
    await page.goto('/dashboard/finance');
    await expect(page.getByRole('heading', { name: /Financial Terminal/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Find student or invoice/i)).toBeVisible();
  });

  test('finance tabs navigation works', async ({ page }) => {
    await page.goto('/dashboard/finance');
    
    // Check Counter tab (default)
    await expect(page.getByText(/Fee Collection Counter/i)).toBeVisible();
    
    // Switch to Day End (Cashier Close)
    await page.getByRole('tab', { name: /Day End/i }).click();
    await expect(page.getByText(/Daily Collection Summary/i)).toBeVisible();
    
    // Switch to Ledger
    await page.getByRole('tab', { name: /Ledger/i }).click();
    await expect(page.getByText(/Billing History/i)).toBeVisible();
    
    // Switch to Analysis
    await page.getByRole('tab', { name: /Analysis/i }).click();
    await expect(page.getByText(/Dues Analysis/i)).toBeVisible();
  });
});

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/School Code/i).fill(credentials.tenantSlug ?? '');
  await page.getByLabel(/Email/i).fill(credentials.email ?? '');
  await page.getByLabel(/Password/i).fill(credentials.password ?? '');
  await page.getByRole('button', { name: /Sign in/i }).click();
  await page.waitForURL('**/dashboard*', { timeout: 20_000 });
}
