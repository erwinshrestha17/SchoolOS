import { expect, test, type Page } from '@playwright/test';

const credentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG,
  email: process.env.SCHOOLOS_E2E_EMAIL,
  password: process.env.SCHOOLOS_E2E_PASSWORD,
};

test.describe('Phase 1B navigation smoke', () => {
  test.beforeEach(() => {
    test.skip(
      !credentials.tenantSlug || !credentials.email || !credentials.password,
      'Set SCHOOLOS_E2E_TENANT_SLUG, SCHOOLOS_E2E_EMAIL, and SCHOOLOS_E2E_PASSWORD to run authenticated browser smoke tests.',
    );
  });

  test('logs in and opens core dashboard routes', async ({ page }) => {
    await login(page);

    await expectDashboardLoaded(page);

    // Students / Admissions
    await page.goto('/dashboard/admissions');
    await expect(page.getByRole('heading', { name: /^Students|Admissions$/i })).toBeVisible();

    // Student Detail
    // Find the first "View Profile" link and navigate if available
    const viewProfileLink = page.getByRole('link', { name: /View Profile/i }).first();
    if (await viewProfileLink.isVisible()) {
      await viewProfileLink.click();
      await expect(page.getByRole('heading', { name: /Student Profile/i })).toBeVisible();
    }

    // Attendance & Register
    await page.goto('/dashboard/attendance');
    await expect(page.getByRole('heading', { name: /Attendance/i })).toBeVisible();
    await page.goto('/dashboard/attendance/register');
    await expect(page.getByRole('heading', { name: /Monthly Register/i })).toBeVisible();

    // Finance
    await page.goto('/dashboard/finance');
    await expect(page.getByRole('heading', { name: /Fee Collection/i })).toBeVisible();

    // Notices
    await page.goto('/dashboard/notices');
    await expect(page.getByRole('heading', { name: /^Notices$/i })).toBeVisible();
    
    // Header components: Notifications & Global Search
    await expect(page.getByPlaceholder(/Search students/i)).toBeVisible();
    await expect(page.getByLabel(/Notifications/i)).toBeVisible();
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

async function expectDashboardLoaded(page: Page) {
  await expect(
    page.getByRole('heading', { name: /Admin Command Center|Dashboard/i }),
  ).toBeVisible({ timeout: 15_000 });
}
