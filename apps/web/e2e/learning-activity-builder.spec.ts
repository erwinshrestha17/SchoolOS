import { expect, test, type Page } from '@playwright/test';

const credentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG,
  email: process.env.SCHOOLOS_E2E_EMAIL,
  password: process.env.SCHOOLOS_E2E_PASSWORD,
};

test.describe('M12 Learning activity builder', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !credentials.tenantSlug || !credentials.email || !credentials.password,
      'Set school E2E credentials to run Learning builder smoke.',
    );
    await login(page);
  });

  test('teacher/admin can open builder and activity routes without fatal errors', async ({ page }) => {
    for (const route of [
      '/dashboard/learning',
      '/dashboard/learning/activities',
      '/dashboard/learning/activities/new',
    ]) {
      await page.goto(route);
      await expectUsableLearningRoute(page);
    }

    await page.goto('/dashboard/learning/activities/new');
    await expect(page.getByRole('heading', { name: /Teacher Activity Builder/i })).toBeVisible();
    await expect(page.getByLabel(/Title/i)).toBeVisible();
    await expect(page.getByLabel(/Difficulty/i)).toBeVisible();
    await expect(page.getByText(/Multiple choice|True false|Short answer/i)).toBeVisible();
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

async function expectUsableLearningRoute(page: Page) {
  await expect(page.locator('h1:visible, h2:visible').first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByText(/Application error|Unhandled Runtime Error|This page could not be found|Internal Server Error/i),
  ).toHaveCount(0);
}
