import { expect, test, type Page } from '@playwright/test';

const credentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG,
  email: process.env.SCHOOLOS_E2E_EMAIL,
  password: process.env.SCHOOLOS_E2E_PASSWORD,
};

test.describe('P0/P1 responsive and keyboard hardening', () => {
  test.beforeEach(() => {
    test.skip(
      !credentials.tenantSlug || !credentials.email || !credentials.password,
      'Set seeded school E2E credentials to run responsive and keyboard checks.',
    );
  });

  test('keeps canonical workspaces usable at common laptop and compact widths', async ({
    page,
  }) => {
    await login(page);

    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 1024, height: 768 },
    ]) {
      await page.setViewportSize(viewport);
      for (const route of [
        '/dashboard/homework',
        '/dashboard/library/issue-return',
        '/dashboard/transport/assignments',
        '/dashboard/canteen/stock',
        '/dashboard/settings',
      ]) {
        await page.goto(route);
        await expectUsableRoute(page);
      }
    }
  });

  test('keeps the remote student selector keyboard-operable', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard/activity/milestones');

    const trigger = page.getByRole('button', { name: /^Student$/i });
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    const search = page.getByRole('combobox', { name: /Search student/i });
    await expect(search).toBeFocused();
    await search.fill('ra');
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  });

  test('keeps representative operational content visible at practical 200 percent zoom', async ({
    page,
  }) => {
    await login(page);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/dashboard/library/issue-return');
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });

    await expect(
      page.locator('h1:visible, h2:visible, [role="heading"]:visible').first(),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Issue \/ Return/i }).first()).toBeVisible();
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

async function expectUsableRoute(page: Page) {
  await expect(
    page.locator('h1:visible, h2:visible, [role="heading"]:visible').first(),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByText(
      /Application error|Unhandled Runtime Error|This page could not be found|Internal Server Error/i,
    ),
  ).toHaveCount(0);
}
