import { expect, test, type Page } from '@playwright/test';

const schoolAdminCredentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG ?? 'default-school',
  email: process.env.SCHOOLOS_E2E_EMAIL ?? 'admin@schoolos.com',
  password: process.env.SCHOOLOS_E2E_PASSWORD ?? 'admin123',
};

test.describe('SchoolOS UX Polish: Keyboard Navigation', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await login(page, schoolAdminCredentials);
  });

  test('Marks Entry: Keyboard navigation between cells', async ({ page }) => {
    await page.goto('/dashboard/academics/marks');
    
    // Select context to load data (using data from seed)
    await page.locator('[data-testid="filter-exam-term"]').selectOption({ label: /First Term/i });
    await page.locator('[data-testid="filter-class"]').selectOption({ label: /Class 1/i });
    await page.locator('[data-testid="filter-subject"]').selectOption({ label: /English/i });
    await page.locator('[data-testid="filter-component"]').selectOption({ index: 1 });

    // Wait for table to load
    const firstInput = page.locator('[data-row="0"][data-col="0"]');
    await expect(firstInput).toBeVisible({ timeout: 10000 });

    // Test ArrowDown
    await firstInput.focus();
    await page.keyboard.press('ArrowDown');
    const secondInput = page.locator('[data-row="1"][data-col="0"]');
    await expect(secondInput).toBeFocused();

    // Test ArrowRight
    await page.keyboard.press('ArrowRight');
    const statusSelect = page.locator('[data-row="1"][data-col="1"]');
    await expect(statusSelect).toBeFocused();

    // Test Enter (should move down)
    await page.keyboard.press('Enter');
    const thirdInput = page.locator('[data-row="2"][data-col="1"]');
    await expect(thirdInput).toBeFocused();

    // Test Shift+Enter (should move up)
    await page.keyboard.press('Shift+Enter');
    await expect(statusSelect).toBeFocused();
  });

  test('CAS Records: Keyboard navigation in batch roster', async ({ page }) => {
    await page.goto('/dashboard/academics/cas');
    
    // Select class to load roster
    await page.locator('select').first().selectOption({ index: 1 }); // Academic Year
    await page.locator('select').nth(1).selectOption({ index: 1 }); // Class
    
    // Find the batch roster input
    const firstCasInput = page.locator('[data-cas-row="0"][data-cas-col="0"]');
    await expect(firstCasInput).toBeVisible({ timeout: 10000 });

    // Test navigation
    await firstCasInput.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-cas-row="1"][data-cas-col="0"]')).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-cas-row="1"][data-cas-col="1"]')).toBeFocused();
  });
});

async function login(
  page: Page,
  credentials: { tenantSlug: string; email: string; password: string },
) {
  await page.goto('/login');
  await page.getByLabel(/School Code/i).fill(credentials.tenantSlug);
  await page.getByLabel(/Email/i).fill(credentials.email);
  await page.getByLabel(/Password/i).fill(credentials.password);
  await page.getByRole('button', { name: /Sign in/i }).click();
  await page.waitForURL(/\/dashboard/);
}
