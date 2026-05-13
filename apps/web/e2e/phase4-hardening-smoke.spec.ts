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

test.describe.serial('SchoolOS Phase 4 Hardening Smoke Tests', () => {
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

  test('Library: Dashboard and Reports', async ({ page }) => {
    await page.goto('/dashboard/library');
    await expect(page).toHaveURL(/\/dashboard\/library/);
    await expect(page.getByRole('heading', { name: /Library/i })).toBeVisible();

    // Verify sub-modules or tabs if any (based on folder structure we saw library/ doesn't have subfolders, so it's likely tab-based or single page)
    await expect(page.getByText(/Books/i)).toBeVisible();
    await expect(page.getByText(/Issues/i)).toBeVisible();
  });

  test('Canteen: Operations and POS', async ({ page }) => {
    await page.goto('/dashboard/canteen');
    await expect(page.getByRole('heading', { name: /Canteen/i })).toBeVisible();

    // Check POS link
    await page.goto('/dashboard/canteen/pos');
    await expect(page).toHaveURL(/\/dashboard\/canteen\/pos/);
    await expect(page.getByText(/Terminal/i).or(page.getByText(/Sale/i))).toBeVisible();

    // Check Inventory (Menu items)
    await page.goto('/dashboard/canteen/menu');
    await expect(page.getByRole('heading', { name: /Menu/i })).toBeVisible();
  });

  test('Transport: Tracking and Routes', async ({ page }) => {
    await page.goto('/dashboard/transport');
    await expect(page.getByRole('heading', { name: /Transport/i })).toBeVisible();

    // Check Location/Tracking
    await page.goto('/dashboard/transport/location');
    await expect(page).toHaveURL(/\/dashboard\/transport\/location/);
    await expect(page.getByText(/Live/i).or(page.getByText(/Tracking/i))).toBeVisible();

    // Check Routes
    await page.goto('/dashboard/transport/routes');
    await expect(page.getByRole('heading', { name: /Routes/i })).toBeVisible();
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
