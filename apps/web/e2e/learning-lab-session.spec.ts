import { expect, test, type Page } from '@playwright/test';

const credentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG,
  email: process.env.SCHOOLOS_E2E_EMAIL,
  password: process.env.SCHOOLOS_E2E_PASSWORD,
};

test.describe('M12 Learning lab session', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !credentials.tenantSlug || !credentials.email || !credentials.password,
      'Set school E2E credentials to run Learning lab smoke.',
    );
    await login(page);
  });

  test('student join route exposes code/QR join controls and no fake data', async ({ page }) => {
    await page.goto('/student/learning/join');
    await expect(page.getByRole('heading', { name: /Join Learning Session/i })).toBeVisible();
    await expect(page.getByLabel(/Session code/i)).toBeVisible();
    await expect(page.getByLabel(/QR token/i)).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/mock|fake|placeholder/i);
  });
});

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/School Code/i).fill(credentials.tenantSlug ?? '');
  await page.getByLabel(/Email/i).fill(credentials.email ?? '');
  await page.getByLabel(/Password/i).fill(credentials.password ?? '');
  await page.getByRole('button', { name: /Sign in/i }).click();
  await page.waitForURL(/\/dashboard(?:$|[/?#])/, { timeout: 20_000 });
}
