import { expect, test, type Page } from '@playwright/test';

const credentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG,
  email: process.env.SCHOOLOS_E2E_EMAIL,
  password: process.env.SCHOOLOS_E2E_PASSWORD,
};

test.describe('M12 Learning smart board', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !credentials.tenantSlug || !credentials.email || !credentials.password,
      'Set school E2E credentials to run Learning smart-board smoke.',
    );
    await login(page);
  });

  test('smart-board launch surface loads and links to safe board runtime', async ({ page }) => {
    await page.goto('/dashboard/learning/smart-board/launch');
    await expect(page.getByRole('heading', { name: /Smart Board Launch/i })).toBeVisible();
    await expect(page.locator('body')).toContainText(/safe|answer keys|session/i);
    await expect(
      page.getByText(/Application error|Unhandled Runtime Error|This page could not be found|Internal Server Error/i),
    ).toHaveCount(0);
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
