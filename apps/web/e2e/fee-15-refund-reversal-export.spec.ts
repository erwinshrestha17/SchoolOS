import { expect, test } from './fixtures/auth';

/**
 * FEE-15 Refund and Reversal Register: authenticated export to protected download.
 *
 * Mirrors fee-01-student-ledger-export.spec.ts. Requires the seeded local
 * stack (API on :4000), `module.reports` entitlement, and FEE-15 fixtures
 * from `pnpm db:seed` (demo-seed chain: REF-DEMO-001 + PAY-DEMO-REV-001).
 *
 * Known footprint: each run leaves a completed ReportExport row and File
 * Registry asset. `db:clean:e2e` does not sweep report exports.
 */

const API_BASE_URL =
  process.env.SCHOOLOS_E2E_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:4000/api/v1';

type ExportHistoryItem = {
  id: string;
  reportKey: string;
  financialReportId: string | null;
  status: string;
  displayedTotals: Record<string, string> | null;
};

type ExportHistoryResponse = {
  items: ExportHistoryItem[];
};

function parseExportHistory(body: unknown): ExportHistoryResponse {
  const envelope = body as { data?: ExportHistoryResponse };
  return envelope.data ?? (body as ExportHistoryResponse);
}

test.describe.serial('FEE-15 Refund and Reversal Register export', () => {
  test.slow();

  test('Accountant exports FEE-15 as PDF and retrieves the protected snapshot', async ({
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
        name: /Refund and Reversal Register/i,
      });
      await expect(reportButton).toBeVisible();
      await reportButton.click();

      await expect(
        page.getByRole('heading', { name: /Refund and Reversal Register/i }),
      ).toBeVisible();

      await page.getByPlaceholder('From Date').fill('2026-07-01');
      await page.getByPlaceholder('To Date').fill('2026-07-31');

      const pdfButton = page.getByRole('button', { name: /Download PDF/i });
      await expect(pdfButton).toBeEnabled();
      await pdfButton.click();

      await expect(page.getByText(/Export ready/i)).toBeVisible({
        timeout: 30_000,
      });

      const historyResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/reports/export-history') &&
          response.request().method() === 'GET' &&
          response.ok(),
        { timeout: 30_000 },
      );
      await page.getByRole('button', { name: /^Refresh$/i }).click();
      const historyResponse = await historyResponsePromise;
      const history = parseExportHistory(await historyResponse.json());
      const latestFee15 = history.items.find(
        (item) => item.reportKey === 'refund-reversal-report',
      );
      expect(latestFee15).toBeDefined();
      expect(latestFee15?.financialReportId).toBe('FEE-15');
      expect(latestFee15?.status).toBe('COMPLETED');
      expect(Number(latestFee15?.displayedTotals?.rowCount ?? '0')).toBeGreaterThan(
        0,
      );
      expect(Number(latestFee15?.displayedTotals?.refundCount ?? '0')).toBeGreaterThan(
        0,
      );
      expect(latestFee15?.displayedTotals?.totalAmount).toBeTruthy();

      const snapshotRow = page
        .locator('div')
        .filter({ hasText: /Refund and Reversal Register/ })
        .filter({ hasText: /COMPLETED/ })
        .filter({ hasText: /PDF/ })
        .last();
      await expect(snapshotRow).toBeVisible({ timeout: 30_000 });

      const openSnapshot = snapshotRow
        .getByRole('button', { name: /Open Snapshot/i })
        .last();
      await expect(openSnapshot).toBeEnabled();

      expect(latestFee15?.id).toBeTruthy();
      const pdfText = await page.evaluate(
        async ({ exportId, apiBase }) => {
          const response = await fetch(
            `${apiBase}/reports/export-history/${encodeURIComponent(exportId)}/download`,
            { credentials: 'include' },
          );
          if (!response.ok) {
            throw new Error(`Download failed with HTTP ${response.status}`);
          }
          const bytes = new Uint8Array(await response.arrayBuffer());
          let text = '';
          for (const byte of bytes) {
            text += String.fromCharCode(byte);
          }
          return text;
        },
        { exportId: latestFee15!.id, apiBase: API_BASE_URL },
      );

      expect(pdfText.length).toBeGreaterThan(0);
      expect(pdfText).toContain('REF-DEMO-001');
    } finally {
      await context.close();
    }
  });

  test('Unauthorized role is not offered the FEE-15 export', async ({
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
        page.getByRole('button', { name: /Refund and Reversal Register/i }),
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
