import { expect, test } from '@playwright/test';

test.describe('parent web access boundary', () => {
  test('redirects the retired parent Learning route to the staff login', async ({ page }) => {
    await page.goto('/parent/learning');
    await expect(page).toHaveURL(/\/login\?notice=parent-mobile-only$/);
    await expect(page.locator('body')).toContainText(/Staff & Admin Portal/i);
  });
});
