import { test, expect } from './fixtures/auth';

test.describe('controlled workspace visual states', () => {
  test.skip(
    process.env.SCHOOLOS_VISUAL_FIXTURES !== '1',
    'Set SCHOOLOS_VISUAL_FIXTURES=1 to expose the authenticated test-only fixture route.',
  );

  test('renders representative states at desktop and narrow widths', async ({
    page,
  }, testInfo) => {
    await page.goto('/dashboard/visual-fixtures/workspace-states');
    await expect(
      page.getByRole('heading', { name: 'Workspace state fixtures' }),
    ).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('tab', { name: 'Error' }).click();
    await expect(page.getByText('Fixture workspace unavailable')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('workspace-error-1440.png'),
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('tab', { name: 'Permission' }).click();
    await expect(page.getByText('Permission denied')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('workspace-permission-390.png'),
      fullPage: true,
    });
  });
});
