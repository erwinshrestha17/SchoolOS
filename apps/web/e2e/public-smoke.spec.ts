import { expect, test } from '@playwright/test';

test.describe('Public route smoke', () => {
  test('home page renders the public SchoolOS landing page', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: /One operating system for every school workflow/i }),
    ).toBeVisible();
    await expect(page.getByRole('banner').getByRole('link', { name: /^Sign in$/i })).toBeVisible();
  });

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
