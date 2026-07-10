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

  test('canonical fees overview and collection workspace load', async ({ page }) => {
    await page.goto('/dashboard/fees');
    await expect(page.getByRole('heading', { name: /Fees & Receipts/i })).toBeVisible();
    await expect(page.getByRole('navigation', { name: /Fees and receipts navigation/i })).toBeVisible();

    await page.getByRole('link', { name: /^Collect$/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/fees\/collect/);
    await expect(page.getByRole('heading', { name: /Collect payment/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Find student or invoice/i)).toBeVisible();
  });

  test('legacy finance route redirects to canonical fees', async ({ page }) => {
    await page.goto('/dashboard/finance');
    await expect(page).toHaveURL(/\/dashboard\/fees(?:$|[?#])/);
    await expect(page.getByRole('heading', { name: /Fees & Receipts/i })).toBeVisible();
  });

  test('fees route navigation preserves one primary job per screen', async ({ page }) => {
    await page.goto('/dashboard/fees');
    await page.getByRole('link', { name: /^Receipts$/i }).click();
    await expect(page.getByRole('heading', { name: /Receipt center/i })).toBeVisible();

    await page.getByRole('link', { name: /Cashier Close/i }).click();
    await expect(page.getByRole('heading', { name: /Cashier close/i })).toBeVisible();
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
