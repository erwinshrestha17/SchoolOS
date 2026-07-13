import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/auth';

test.describe.serial('M7 payroll lifecycle', () => {
  test('uses backend allowed actions from draft through posting and reversal', async ({
    page,
  }) => {
    await page.goto('/dashboard/payroll/runs');
    await expect(page.getByText(/Payroll Runs — Phase 2 accounting boundary/i)).toBeVisible();

    const existingVerificationRun = page
      .getByRole('row')
      .filter({ hasText: 'July 2026' });
    if ((await existingVerificationRun.count()) > 0) {
      await existingVerificationRun.getByRole('button', { name: 'View' }).click();
    } else {
      await page.getByRole('button', { name: 'New Draft Run' }).click();
      await expect(page.getByRole('heading', { name: 'Create Draft from Preview' })).toBeVisible();
      const draftSelects = page.locator('select');
      await draftSelects.nth(0).selectOption('2026');
      await draftSelects.nth(1).selectOption('7');
      await page.getByRole('spinbutton').fill('30');
      await page.getByRole('button', { name: 'Preview' }).click();
      const saveDraft = page.getByRole('button', { name: 'Save as Draft' });
      await expect(saveDraft).toBeEnabled({ timeout: 20_000 });
      await saveDraft.click();
    }

    await expect(
      page.getByText(/Payroll Status: (DRAFT|GENERATED)/),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Submit for Review' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve Run' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Post to M11 Accounting' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Reverse Payroll' })).toHaveCount(0);

    await performAction(page, 'Submit for Review', 'Submit Review');
    await expectPayrollStatus(page, 'UNDER_REVIEW');
    await expect(page.getByRole('button', { name: 'Complete Review' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Return for Correction' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve Run' })).toHaveCount(0);

    await performAction(page, 'Complete Review', 'Complete Review');
    await expectPayrollStatus(page, 'REVIEWED');
    await expect(page.getByRole('button', { name: 'Approve Run' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Post to M11 Accounting' })).toHaveCount(0);

    await performAction(page, 'Approve Run', 'Approve');
    await expectPayrollStatus(page, 'APPROVED');
    await expect(page.getByRole('button', { name: 'Post to M11 Accounting' })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Salary Slip PDF' }).first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/salary-slip-.*\.pdf$/);

    await performAction(page, 'Post to M11 Accounting', 'Post to M11');
    await expectPayrollStatus(page, 'POSTED');
    await expect(page.getByRole('button', { name: 'Post to M11 Accounting' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'View Journal' })).toBeVisible();

    await page.getByRole('button', { name: 'View Journal' }).click();
    const entryHeading = page.getByRole('heading', { name: /^Entry JE-/ });
    await expect(entryHeading).toBeVisible();
    await expect(page.getByText(/PAYROLL_RUN/).last()).toBeVisible();
    await entryHeading.locator('xpath=../..').getByRole('button').click();

    await page.reload();
    await expectPayrollStatus(page, 'POSTED');
    await expect(page.getByRole('button', { name: 'Reverse Payroll' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Post to M11 Accounting' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Reverse Payroll' }).click();
    await expect(page.getByRole('heading', { name: 'Reverse Payroll' })).toBeVisible();
    await page
      .getByPlaceholder(/Provide reason for this reverse payroll/i)
      .fill('Authenticated lifecycle reversal verification');
    await page.getByRole('button', { name: 'Reverse Payroll', exact: true }).last().click();
    await expectPayrollStatus(page, 'CANCELLED');
    await expect(page.getByRole('button', { name: 'Reverse Payroll' })).toHaveCount(0);
  });
});

async function performAction(page: Page, openLabel: string, confirmLabel: string) {
  await page.getByRole('button', { name: openLabel }).click();
  const confirm = page
    .locator('button[type="submit"]')
    .filter({ hasText: confirmLabel });
  await expect(confirm).toBeVisible();
  await confirm.click();
  await expect(confirm).not.toBeVisible();
}

async function expectPayrollStatus(page: Page, status: string) {
  await expect(
    page.getByText(`Payroll Status: ${status}`, { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
}
