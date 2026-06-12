import { expect, test, type Page } from '@playwright/test';

const credentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG,
  email: process.env.SCHOOLOS_E2E_PARENT_EMAIL ?? process.env.SCHOOLOS_E2E_EMAIL,
  password: process.env.SCHOOLOS_E2E_PARENT_PASSWORD ?? process.env.SCHOOLOS_E2E_PASSWORD,
};

test.describe('M12 parent Learning summary', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !credentials.tenantSlug || !credentials.email || !credentials.password,
      'Set parent or school E2E credentials to run Learning parent-summary smoke.',
    );
    await login(page);
  });

  test('parent summary route loads without leaderboard or raw answers', async ({ page }) => {
    await page.goto('/parent/learning');
    await expect(page.getByRole('heading', { name: /Parent Learning Summary/i })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/leaderboard|rank|correct answer|raw answer/i);
  });
});

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/School Code/i).fill(credentials.tenantSlug ?? '');
  await page.getByLabel(/Email/i).fill(credentials.email ?? '');
  await page.getByLabel(/Password/i).fill(credentials.password ?? '');
  await page.getByRole('button', { name: /Sign in/i }).click();
  await page.waitForURL(/\/(?:dashboard|parent|student)(?:$|[/?#])/, {
    timeout: 20_000,
  });
}
