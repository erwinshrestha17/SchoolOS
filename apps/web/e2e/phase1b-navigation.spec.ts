import { expect, test } from '@playwright/test';

test.describe('Phase 1B navigation smoke', () => {
  test('opens core dashboard routes for an already authenticated browser session', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /Admin Command Center/i })).toBeVisible();

    await page.goto('/dashboard/students');
    await expect(page.getByRole('heading', { name: /^Students$/i })).toBeVisible();

    await page.goto('/dashboard/attendance');
    await expect(page.getByRole('heading', { name: /Attendance/i })).toBeVisible();

    await page.goto('/dashboard/finance');
    await expect(page.getByRole('heading', { name: /Fee Collection/i })).toBeVisible();

    await page.goto('/dashboard/notices');
    await expect(page.getByRole('heading', { name: /^Notices$/i })).toBeVisible();
    await expect(page.getByText(/Notice Center/i)).toBeVisible();
  });
});
