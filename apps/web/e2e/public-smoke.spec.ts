import { expect, test } from '@playwright/test';

test.describe('Public route smoke', () => {
  test('login page renders expected UI', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/School Code/i)).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign in/i })).toBeVisible();
  });

  test('register page renders expected heading', async ({ page }) => {
    await page.goto('/register');
    await expect(
      page.getByRole('heading', { name: /Create school workspace/i }),
    ).toBeVisible();
  });
});
