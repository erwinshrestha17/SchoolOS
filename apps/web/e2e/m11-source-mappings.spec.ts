import { expect, test } from './fixtures/auth';
import type { Page } from '@playwright/test';

test.describe.serial('M11 source mapping workflow', () => {
  test('creates, rejects overlap, reports health, and archives a mapping', async ({
    page,
  }) => {
    const sourceType = `E2E_FEES_${Date.now()}`;

    await page.goto('/dashboard/accounting/source-mappings');
    await expect(
      page.getByRole('heading', { name: 'Source posting mappings' }),
    ).toBeVisible();
    await expect(page.getByText(/does not prove end-to-end posting readiness/i)).toBeVisible();

    await createMapping(page, sourceType);
    const mappingRow = page.getByRole('row').filter({ hasText: sourceType });
    await expect(mappingRow).toBeVisible();
    await expect(mappingRow.getByText('Active', { exact: true })).toBeVisible();

    await createMapping(page, sourceType, false);
    await expect(
      page.getByRole('alert').filter({
        hasText: /active mapping already covers this source and effective period/i,
      }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await mappingRow.getByRole('button', { name: 'Archive' }).click();
    const archiveDialog = page.getByRole('dialog', {
      name: 'Archive source mapping?',
    });
    await archiveDialog
      .getByPlaceholder('Why is this mapping being archived?')
      .fill('Authenticated M11 browser verification cleanup');
    await archiveDialog.getByRole('button', { name: 'Archive mapping' }).click();

    await expect(mappingRow.getByText('Archived', { exact: true })).toBeVisible();
  });
});

async function createMapping(
  page: Page,
  sourceType: string,
  expectSuccess = true,
) {
  await page.getByRole('button', { name: 'Add source mapping' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add source mapping' });
  await expect(dialog).toBeVisible();

  const selects = dialog.locator('select');
  await selects.nth(0).selectOption('FEES');
  await dialog.getByPlaceholder('PAYROLL_RUN').fill(sourceType);
  await dialog.getByPlaceholder('APPROVAL').fill('PAYMENT');
  await selects.nth(1).selectOption({ label: '5010 · Salary Expense' });
  await selects.nth(2).selectOption({ label: '2200 · Salary Payable' });
  await dialog.getByRole('button', { name: 'Save mapping' }).click();

  if (expectSuccess) {
    await expect(dialog).not.toBeVisible();
  }
}
