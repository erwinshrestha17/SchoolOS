import { expect, test, type Page } from '@playwright/test';

const credentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG,
  email: process.env.SCHOOLOS_E2E_EMAIL,
  password: process.env.SCHOOLOS_E2E_PASSWORD,
};

test.describe('Dashboard widget smoke', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !credentials.tenantSlug || !credentials.email || !credentials.password,
      'Set E2E credentials to run dashboard smoke tests.',
    );
    await login(page);
  });

  test('verifies all dashboard widgets are visible', async ({ page }) => {
    // 1. Check KPIs
    await expect(page.getByText('Total Students', { exact: false })).toBeVisible();
    await expect(page.getByText("Today's Attendance", { exact: false })).toBeVisible();
    await expect(page.getByText('Monthly Collection', { exact: false })).toBeVisible();

    // 2. Check Operational Alerts
    await expect(page.getByRole('heading', { name: /Operational Alerts/i })).toBeVisible();

    // 3. Check Quick Actions
    await expect(page.getByRole('heading', { name: /Quick Actions/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /New Admission/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Mark Attendance/i })).toBeVisible();

    // 4. Check Snapshots/Charts
    await expect(page.getByRole('heading', { name: /Fee Collection/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Attendance Mix/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Notification Health/i })).toBeVisible();

    // 5. Check Recent Activity
    await expect(page.getByRole('heading', { name: /Recent Activity/i })).toBeVisible();
  });

  test('verifies quick actions navigation', async ({ page }) => {
    // Test one quick action
    await page.getByRole('link', { name: /New Admission/i }).click();
    await expect(page).toHaveURL(/.*admissions.*/);
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
