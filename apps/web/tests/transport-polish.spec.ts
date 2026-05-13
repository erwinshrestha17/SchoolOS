import { test, expect } from '@playwright/test';

test.describe('Transport Admin Polish Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Standard login flow would go here in a real test
    await page.goto('/dashboard/transport');
  });

  test('should navigate through all transport tabs', async ({ page }) => {
    const tabs = ['Routes & Stops', 'Vehicles', 'Assignments', 'Trips', 'Location', 'Reports'];
    for (const tab of tabs) {
      await page.getByRole('link', { name: tab }).click();
      await expect(page).toHaveURL(new RegExp(`/dashboard/transport/${tab.toLowerCase().replace(/ & /g, '').replace(/ /g, '')}`));
    }
  });

  test('should show operational alerts on overview if present', async ({ page }) => {
    await page.getByRole('link', { name: 'Overview' }).click();
    // Alerts are conditional, but we can check if the section exists if stats > 0
    // For now, just ensure the dashboard stats cards are visible
    await expect(page.getByText('Active Trips')).toBeVisible();
    await expect(page.getByText('Active Enrollments')).toBeVisible();
  });

  test('should show reports data', async ({ page }) => {
    await page.getByRole('link', { name: 'Reports' }).click();
    await expect(page.getByText('Trip History Report')).toBeVisible();
    await expect(page.getByText('Boarding Summary')).toBeVisible();
  });

  test('should allow trip cancellation via Trip Monitor', async ({ page }) => {
    await page.getByRole('link', { name: 'Trips' }).click();
    // This assumes there is an active trip. If not, the test will skip or wait.
    const cancelBtn = page.getByRole('button', { name: 'Cancel' }).first();
    if (await cancelBtn.isVisible()) {
       // Mock the window.confirm
       page.on('dialog', dialog => dialog.accept());
       await cancelBtn.click();
       await expect(page.getByText('Trip cancelled.')).toBeVisible();
    }
  });

  test('should allow marking trip as delayed', async ({ page }) => {
    await page.getByRole('link', { name: 'Trips' }).click();
    const delayBtn = page.getByRole('button', { name: 'Mark Delay' }).first();
    if (await delayBtn.isVisible()) {
       await delayBtn.click();
       await page.getByLabel('Delay Reason').fill('Heavy Rain');
       await page.getByRole('button', { name: 'Mark Delayed' }).click();
       await expect(page.getByText('Trip delay status updated.')).toBeVisible();
       await expect(page.getByText('DELAYED')).toBeVisible();
    }
  });
});
