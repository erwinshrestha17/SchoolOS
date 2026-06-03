import { expect, test, type Page } from '@playwright/test';

const API_BASE_URL =
  process.env.SCHOOLOS_E2E_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:4000/api/v1';

const schoolAdminCredentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG,
  email: process.env.SCHOOLOS_E2E_EMAIL,
  password: process.env.SCHOOLOS_E2E_PASSWORD,
};

const libraryRoutes = [
  '/dashboard/library',
  '/dashboard/library/books',
  '/dashboard/library/copies',
  '/dashboard/library/issues',
  '/dashboard/library/fines',
  '/dashboard/library/reports',
];

const canteenRoutes = [
  '/dashboard/canteen',
  '/dashboard/canteen/menu',
  '/dashboard/canteen/plans',
  '/dashboard/canteen/enrollments',
  '/dashboard/canteen/serving',
  '/dashboard/canteen/wallets',
  '/dashboard/canteen/pos',
  '/dashboard/canteen/controls',
  '/dashboard/canteen/reports',
];

const transportRoutes = [
  '/dashboard/transport',
  '/dashboard/transport/routes',
  '/dashboard/transport/vehicles',
  '/dashboard/transport/assignments',
  '/dashboard/transport/trips',
  '/dashboard/transport/location',
];

test.describe.serial('SchoolOS Phase 4 operations smoke', () => {
  test.beforeEach(async ({ context, page }) => {
    test.skip(
      !schoolAdminCredentials.tenantSlug ||
        !schoolAdminCredentials.email ||
        !schoolAdminCredentials.password,
      'Set SchoolOS E2E credentials to run Phase 4 operations smoke tests.',
    );

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

  test('Library admin routes and scan/report surfaces load without fatal errors', async ({ page }) => {
    await assertRoutesLoad(page, libraryRoutes);
    await page.goto('/dashboard/library');
    await expect(page.getByRole('button', { name: /User profile menu/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('body')).toContainText(/scan|barcode|QR/i);
    await page.goto('/dashboard/library/reports');
    await expect(page.getByRole('button', { name: /User profile menu/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('body')).toContainText(/export|report/i);
  });

  test('Canteen POS, wallet, inventory, and reports load without fatal errors', async ({ page }) => {
    await assertRoutesLoad(page, canteenRoutes);
    await page.goto('/dashboard/canteen/pos');
    await expect(page.getByRole('button', { name: /User profile menu/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('body')).toContainText(/QR|manual|search|student/i);
    await expect(page.getByRole('button', { name: /Create POS sale/i })).toBeVisible();
    await page.goto('/dashboard/canteen/menu');
    await expect(page.getByRole('button', { name: /User profile menu/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('body')).toContainText(/stock|inventory|menu/i);
  });

  test('Transport admin routes and latest-location surface load without parent tracking UI', async ({ page }) => {
    await assertRoutesLoad(page, transportRoutes);
    await page.goto('/dashboard/transport/location');
    await expect(page.getByRole('button', { name: /User profile menu/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('body')).toContainText(/latest|location|tracking|status/i);
    await expect(page.locator('body')).not.toContainText(/parent portal/i);
  });
});

async function assertRoutesLoad(page: Page, routes: string[]) {
  const runtimeErrors: string[] = [];
  const authFailures: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('response', (response) => {
    const status = response.status();
    if (![401, 403].includes(status)) {
      return;
    }

    const url = new URL(response.url());
    if (url.pathname.includes('/api/v1/')) {
      authFailures.push(`${status} ${url.pathname}${url.search}`);
    }
  });

  for (const route of routes) {
    await page.goto(route);
    const expectedPathname = new URL(route, page.url()).pathname;
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe(expectedPathname);
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByRole('button', { name: /User profile menu/i })).toBeVisible({
      timeout: 15_000,
    });
  }

  expect(runtimeErrors).toEqual([]);
  expect(authFailures).toEqual([]);
}

async function login(
  page: Page,
  credentials: { tenantSlug?: string; email?: string; password?: string },
) {
  await page.goto('/login');
  await expect(page.getByLabel(/School Code/i)).toBeVisible();

  await page.getByLabel(/School Code/i).fill(credentials.tenantSlug ?? '');
  await page.getByLabel(/Email/i).fill(credentials.email ?? '');
  await page.getByLabel(/Password/i).fill(credentials.password ?? '');

  await Promise.all([
    page.waitForURL(/\/dashboard(?:$|[/?#])/, { timeout: 20_000 }),
    page.getByRole('button', { name: /Sign in/i }).click(),
  ]);

  await expect(page.getByRole('button', { name: /User profile menu/i })).toBeVisible({
    timeout: 15_000,
  });
}
