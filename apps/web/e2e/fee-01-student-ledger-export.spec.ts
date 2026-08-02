import { expect, test } from './fixtures/auth';

/**
 * FEE-01 Student Fee Ledger: authenticated export to protected download.
 *
 * Covers the half of the export contract that unit and integration tests
 * cannot reach -- a real signed-in Accountant driving the reports centre,
 * the export actually being recorded in the File Registry, and the protected
 * snapshot being retrievable through an authenticated request rather than a
 * public URL.
 *
 * Requires the seeded local stack (API on :4000) and the `module.reports`
 * entitlement on the tenant -- the reports centre is gated by
 * `@Entitlement('module.reports')` and fails closed without it. Set
 * SCHOOLOS_E2E_LEDGER_STUDENT_ID to a student in the E2E tenant that has
 * invoices; without it the ledger filter has nothing to resolve and the spec
 * skips rather than asserting on an empty report.
 *
 * Known footprint: each run leaves a completed ReportExport row and its File
 * Registry asset in the target tenant. `db:clean:e2e` covers only academics and
 * notices, so report exports are not swept.
 */

const LEDGER_STUDENT_ID = process.env.SCHOOLOS_E2E_LEDGER_STUDENT_ID;

test.describe.serial('FEE-01 Student Fee Ledger export', () => {
  // PDF generation plus the File Registry round trip exceeds the default budget.
  test.slow();

  test.skip(
    !LEDGER_STUDENT_ID,
    'Set SCHOOLOS_E2E_LEDGER_STUDENT_ID to a seeded student with invoices.',
  );

  test('Accountant exports FEE-01 as PDF and retrieves the protected snapshot', async ({
    browser,
    authStateFor,
  }) => {
    const context = await browser.newContext({
      storageState: await authStateFor('accountant'),
    });
    const page = await context.newPage();

    try {
      await page.goto('/dashboard/reports');

      // The report must be offered to the Accountant by the backend registry;
      // this is the permission-filtered list, not a hardcoded menu.
      const reportButton = page.getByRole('button', {
        name: /Student Fee Ledger/i,
      });
      await expect(reportButton).toBeVisible();
      await reportButton.click();

      await expect(
        page.getByRole('heading', { name: /Student Fee Ledger/i }),
      ).toBeVisible();

      // studentId is a required filter; the backend rejects the export without
      // it. Match the placeholder exactly -- the topbar's global search
      // ("Search students or invoices...") also matches a loose /Student/i, and
      // filling that navigates away from the reports centre.
      await page
        .getByPlaceholder('Student', { exact: true })
        .fill(LEDGER_STUDENT_ID!);

      const pdfButton = page.getByRole('button', { name: /Download PDF/i });
      await expect(pdfButton).toBeEnabled();
      await pdfButton.click();

      // Backend-confirmed completion, not an optimistic client message.
      await expect(page.getByText(/Export ready/i)).toBeVisible({
        timeout: 30_000,
      });

      // The export must appear in File Registry history as a COMPLETED PDF.
      await page.getByRole('button', { name: /^Refresh$/i }).click();

      const snapshotRow = page
        .locator('div')
        .filter({ hasText: /Student Fee Ledger/ })
        .filter({ hasText: /COMPLETED/ })
        .filter({ hasText: /PDF/ })
        .last();
      await expect(snapshotRow).toBeVisible({ timeout: 30_000 });

      // Protected download: retrieved through an authenticated request that
      // returns real PDF bytes, never a public object URL.
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

      // Served through the authenticated protected-download route, never a
      // public object URL.
      expect(response.ok()).toBe(true);
      expect(response.url()).toContain('/reports/export-history/');
      expect(response.url()).not.toMatch(/^https?:\/\/(s3|storage|blob)\./);
    } finally {
      await context.close();
    }
  });

  test('Unauthorized role is not offered the FEE-01 export', async ({
    browser,
    authStateFor,
  }) => {
    const context = await browser.newContext({
      storageState: await authStateFor('unauthorized'),
    });
    const page = await context.newPage();

    try {
      await page.goto('/dashboard/reports');
      // Backend authorization is authoritative: the permission-filtered list
      // must not offer a finance report to a role without finance permissions.
      await expect(
        page.getByRole('button', { name: /Student Fee Ledger/i }),
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
