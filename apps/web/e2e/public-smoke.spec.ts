import { expect, test } from '@playwright/test';

test.describe('Public route smoke', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await context.clearPermissions();
  });

  test('home page renders the public SchoolOS landing page', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('banner')).toContainText('SchoolOS');
    await expect(
      page.getByRole('banner').getByRole('link', { name: /^Sign in$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('banner').getByRole('link', { name: /Register school/i }),
    ).toBeVisible();
  });

  test('login page renders expected UI', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveURL(/\/login(?:$|[?#])/);
    await expect(page.getByLabel(/School Code/i)).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign in/i })).toBeVisible();
  });

  test('register page renders expected UI', async ({ page }) => {
    await page.goto('/register');

    await expect(page).toHaveURL(/\/register(?:$|[?#])/);
    await expect(page.getByText(/Create school workspace/i)).toBeVisible();
    await expect(page.getByText(/Enter your school details/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Create workspace/i })).toBeVisible();
  });
});
