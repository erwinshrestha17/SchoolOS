import { expect, test } from '@playwright/test';

test.describe('Phase 2F.2 public browser smoke', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await context.clearPermissions();
  });

  test('loads the public home and login pages', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('banner')).toContainText('SchoolOS');
    await expect(
      page.getByRole('banner').getByRole('link', { name: /^Sign in$/i }),
    ).toBeVisible();

    await page.goto('/login');
    await expect(page).toHaveURL(/\/login(?:$|[?#])/);
    await expect(page.getByLabel(/School Code/i)).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
  });
});

test.describe('Phase 2F.2 authenticated school admin browser smoke', () => {
  test('skips unless seeded API credentials are supplied', async () => {
    test.skip(true, 'Authenticated browser smoke requires seeded local API credentials.');
  });
});

test.describe('Phase 2F.2 platform browser smoke', () => {
  test('skips unless platform seed credentials are supplied', async () => {
    test.skip(true, 'Platform browser smoke requires platform seed credentials.');
  });
});
