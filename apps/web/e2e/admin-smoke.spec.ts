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

test.describe.serial('SchoolOS Web Admin Smoke Tests', () => {
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

  test('Dashboard: Navigation and shell integrity', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /Admin Command Center/i })).toBeVisible();
    
    // Verify sidebar navigation to refactored modules
    const navItems = [
      { name: /Students/i, url: /\/students/ },
      { name: /Attendance/i, url: /\/attendance/ },
      { name: /Fees/i, url: /\/finance/ },
      { name: /HR/i, url: /\/payroll/ },
      { name: /Notices/i, url: /\/notices/ },
    ];

    for (const item of navItems) {
      await page.getByRole('link', { name: item.name }).first().click();
      await expect(page).toHaveURL(item.url);
    }
  });

  test('Finance: Collection counter and invoice selection', async ({ page }) => {
    await page.goto('/dashboard/finance');
    await expect(page.getByRole('heading', { name: /Fee Collection/i })).toBeVisible();
    
    // Check for the polished search input
    const searchInput = page.getByPlaceholder(/Search student by name or ID/i);
    await expect(searchInput).toBeVisible();
    
    // Verify collection cards (assuming data exists)
    await expect(page.getByText(/Recent Collections/i)).toBeVisible();
  });

  test('Attendance: Roster loading and interactions', async ({ page }) => {
    await page.goto('/dashboard/attendance');
    await expect(page.getByRole('heading', { name: /^Attendance$/i })).toBeVisible();
    
    // Verify section header
    await expect(page.getByText(/Record daily student presence/i)).toBeVisible();
    
    // Verify that class selection triggers roster load
    await page.getByLabel(/Class/i).selectOption({ index: 1 });
    // Assuming some data loads or empty state shows
    await expect(page.getByTestId('attendance-roster') || page.getByText(/No students found/i)).toBeVisible();
  });

  test('Communications: Multi-tab form interactions', async ({ page }) => {
    await page.goto('/dashboard/notices');
    await expect(page.getByRole('heading', { name: /Notice Center/i })).toBeVisible();
    
    // Test Tab Switching
    const tabs = ['Events', 'Delivery Records', 'Consent Management', 'Notices'];
    for (const tab of tabs) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      // Verify specific header content per tab
      if (tab === 'Events') {
        await expect(page.getByRole('heading', { name: /Event Publisher/i })).toBeVisible();
      } else if (tab === 'Delivery Records') {
        await expect(page.getByRole('heading', { name: /Delivery Records/i })).toBeVisible();
      } else if (tab === 'Consent Management') {
        await expect(page.getByRole('heading', { name: /Consent Management/i })).toBeVisible();
      }
    }
  });

  test('HR: Staff directory and card layouts', async ({ page }) => {
    await page.goto('/dashboard/payroll');
    await expect(page.getByRole('heading', { name: /HR & Payroll/i })).toBeVisible();
    
    await page.getByRole('button', { name: /Staff Directory/i }).click();
    await expect(page.getByRole('heading', { name: /Staff Directory/i })).toBeVisible();
    
    // Check for stylized staff cards (assuming data exists)
    await expect(page.getByText(/Active Staff Members/i) || page.getByText(/No staff records/i)).toBeVisible();
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
