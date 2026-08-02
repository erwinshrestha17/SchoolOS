import { expect, test } from './fixtures/auth';

/**
 * FEE-17 Receipt Register: authenticated export to protected download.
 *
 * Mirrors fee-01-student-ledger-export.spec.ts. Requires the seeded local
 * stack (API on :4000) and `module.reports` entitlement on the tenant.
 *
 * Known footprint: each run leaves a completed ReportExport row and File
 * Registry asset. `db:clean:e2e` does not sweep report exports.
 */

test.describe.serial('FEE-17 Receipt Register export', () => {
  test.slow();

  test('Accountant exports FEE-17 as PDF and retrieves the protected snapshot', async ({
    browser,
    authStateFor,
  }) => {
    const context = await browser.newContext({
      storageState: await authStateFor('accountant'),
    });
    const page = await context.newPage();

    try {
      await page.goto('/dashboard/reports');

      const reportButton = page.getByRole('button', {
        name: /Receipt Register/i,
      });
      await expect(reportButton).toBeVisible();
      await reportButton.click();

      await expect(
        page.getByRole('heading', { name: /Receipt Register/i }),
      ).toBeVisible();

      const pdfButton = page.getByRole('button', { name: /Download PDF/i });
      await expect(pdfButton).toBeEnabled();
      await pdfButton.click();

      await expect(page.getByText(/Export ready/i)).toBeVisible({
        timeout: 30_000,
      });

      await page.getByRole('button', { name: /^Refresh$/i }).click();

      const snapshotRow = page
        .locator('div')
        .filter({ hasText: /Receipt Register/ })
        .filter({ hasText: /COMPLETED/ })
        .filter({ hasText: /PDF/ })
        .last();
      await expect(snapshotRow).toBeVisible({ timeout: 30_000 });

      const openSnapshot = snapshotRow
        .getByRole('button', { name: /Open Snapshot/i })
        .last();
      await expect(openSnapshot).toBeEnabled();

      const downloadResponse = page.waitForResponse(
        (response) =>
          /\/reports\/export-history\/[^/]+\/download/.test(response.url()) &&
          response.request().method() === 'GET',
        { timeout: 30_000 },
      );
      await openSnapshot.click();
      const response = await downloadResponse;

      expect(response.ok()).toBe(true);
      expect(response.url()).toContain('/reports/export-history/');
      expect(response.url()).not.toMatch(/^https?:\/\/(s3|storage|blob)\./);
    } finally {
      await context.close();
    }
  });

  test('Unauthorized role is not offered the FEE-17 export', async ({
    browser,
    authStateFor,
  }) => {
    const context = await browser.newContext({
      storageState: await authStateFor('unauthorized'),
    });
    const page = await context.newPage();

    try {
      await page.goto('/dashboard/reports');
      await expect(
        page.getByRole('button', { name: /Receipt Register/i }),
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
