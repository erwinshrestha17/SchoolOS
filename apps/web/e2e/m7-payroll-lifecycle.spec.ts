import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/auth';

const API_BASE_URL =
  process.env.SCHOOLOS_E2E_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:4000/api/v1';

test.describe.serial('M7 payroll lifecycle', () => {
  test('provisions a fresh period and uses backend allowed actions from draft through posting and reversal', async ({
    page,
  }) => {
    const { year, month } = await findUnusedPeriod(page);
    const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString(
      'en-US',
      { month: 'long', timeZone: 'UTC' },
    );
    const periodLabel = `${monthName} ${String(year)}`;

    // --- Readiness before the run exists: recompute from the backend and
    // confirm zero unresolved blocking exceptions before any draft is created. ---
    await page.goto('/dashboard/payroll/readiness');
    await expect(
      page.getByRole('heading', { name: 'Payroll readiness and exceptions' }),
    ).toBeVisible();
    await page.getByLabel('Year').fill(String(year));
    await page.getByLabel('Month').selectOption(String(month));
    await page.getByRole('button', { name: 'Apply period' }).click();

    const recheckResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/payroll/readiness/recheck') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Recheck source data' }).click();
    const recheckBody = (await (await recheckResponse).json()).data;
    expect(recheckBody.blockingExceptionCount).toBe(0);
    await expect(page.getByText('Calculated by the backend')).toBeVisible({
      timeout: 20_000,
    });

    // --- Preview + create the fresh draft run. ---
    await page.goto('/dashboard/payroll/runs');
    await expect(page.getByText(/Payroll Runs — Phase 2 accounting boundary/i)).toBeVisible();

    await page.getByRole('button', { name: 'New Draft Run' }).click();
    await expect(page.getByRole('heading', { name: 'Create Draft from Preview' })).toBeVisible();
    const draftSelects = page.locator('select');
    await draftSelects.nth(0).selectOption(String(year));
    await draftSelects.nth(1).selectOption(String(month));
    await page.getByRole('spinbutton').fill('30');
    await page.getByRole('button', { name: 'Preview' }).click();
    const saveDraft = page.getByRole('button', { name: 'Save as Draft' });
    await expect(saveDraft).toBeEnabled({ timeout: 20_000 });
    const createRunResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith('/payroll/runs') &&
        response.request().method() === 'POST',
    );
    await saveDraft.click();
    const runId: string = (await (await createRunResponse).json()).data.id;

    await expect(
      page.getByText(/Payroll Status: (DRAFT|GENERATED)/),
    ).toBeVisible({ timeout: 20_000 });

    // --- Draft/Generated: only Submit for Review is available from backend allowedActions. ---
    await expect(page.getByRole('button', { name: 'Submit for Review' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve Run' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Post to M11 Accounting' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Reverse Payroll' })).toHaveCount(0);

    const directApprove = await page.request.post(
      `${API_BASE_URL}/payroll/runs/${runId}/approve`,
      { headers: await csrfHeaders(page) },
    );
    expect(directApprove.ok()).toBe(false);

    // --- Submit for review; a freshly provisioned period outside the seeded
    // attendance window raises WARNING exceptions that must be acknowledged
    // (with an audited reason) before the backend allows the transition. ---
    await page.getByRole('button', { name: 'Submit for Review' }).click();
    const submitConfirm = page
      .locator('button[type="submit"]')
      .filter({ hasText: 'Submit Review' });
    await expect(submitConfirm).toBeVisible();
    const errorToast = page.getByText('Action Error').first();
    await submitConfirm.click();
    await Promise.race([
      submitConfirm.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined),
      errorToast.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined),
    ]);

    if (await errorToast.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Cancel' }).click();
      await acknowledgeAllOpenWarnings(page, year, month);
      await page.goto('/dashboard/payroll/runs');
      await page
        .getByRole('row')
        .filter({ hasText: periodLabel })
        .getByRole('button', { name: 'View' })
        .click();
      await performAction(page, 'Submit for Review', 'Submit Review');
    }
    await expectPayrollStatus(page, 'UNDER_REVIEW');
    await expect(page.getByRole('button', { name: 'Complete Review' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Return for Correction' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve Run' })).toHaveCount(0);

    // --- Actually exercise Return for Correction: it requires an audited
    // reason and returns the run to a correctable pre-review state. ---
    await page.getByRole('button', { name: 'Return for Correction' }).click();
    await expect(page.getByRole('heading', { name: 'Return Payroll for Correction' })).toBeVisible();
    const rejectConfirm = page.locator('button[type="submit"]').filter({ hasText: 'Return for Correction' });
    await rejectConfirm.click();
    await expect(
      page.getByText('Please provide a reason or remarks for this action.'),
    ).toBeVisible();
    await page
      .getByPlaceholder(/Provide reason for this return payroll for correction/i)
      .fill('Fresh-period lifecycle verification: exercising the correction path.');
    await rejectConfirm.click();
    await expect(rejectConfirm).not.toBeVisible();
    await expect(
      page.getByText(/Payroll Status: (DRAFT|GENERATED)/),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Submit for Review' })).toBeVisible();

    await performAction(page, 'Submit for Review', 'Submit Review');
    await expectPayrollStatus(page, 'UNDER_REVIEW');

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

    // Duplicate posting must not be reachable even via a direct backend call.
    const duplicatePost = await page.request.post(
      `${API_BASE_URL}/payroll/runs/${runId}/post-to-accounting`,
      { headers: await csrfHeaders(page) },
    );
    expect(duplicatePost.ok()).toBe(false);

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

async function csrfHeaders(page: Page): Promise<Record<string, string>> {
  const csrfCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'schoolos_csrf' || cookie.name === '__Host-schoolos_csrf',
  );
  return csrfCookie ? { 'X-CSRF-Token': csrfCookie.value } : {};
}

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

async function findUnusedPeriod(
  page: Page,
): Promise<{ year: number; month: number }> {
  const now = new Date();
  const candidates: { year: number; month: number }[] = [];
  for (let offset = 0; offset <= 6; offset += 1) {
    const forward = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1),
    );
    candidates.push({
      year: forward.getUTCFullYear(),
      month: forward.getUTCMonth() + 1,
    });
    if (offset > 0) {
      const backward = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1),
      );
      candidates.push({
        year: backward.getUTCFullYear(),
        month: backward.getUTCMonth() + 1,
      });
    }
  }

  for (const candidate of candidates) {
    const response = await page.request.get(
      `${API_BASE_URL}/payroll/runs?month=${String(candidate.month)}&year=${String(candidate.year)}&limit=1`,
    );
    if (!response.ok()) continue;
    const body = (await response.json()).data;
    const total = body.total ?? body.items?.length ?? 0;
    if (total === 0) return candidate;
  }

  throw new Error(
    'No unused payroll period found in the evergreen fiscal window; reseed the database to free up a period.',
  );
}

// A freshly provisioned period has almost no salary structures/attendance
// configured for most staff (only a handful of canonical seed staff do), so a
// fresh draft run can legitimately raise dozens of WARNING-severity source-data
// exceptions across staff. The UI acknowledgement dialog itself (reason +
// permission + audit) is already covered end-to-end by
// m7-payroll-readiness.spec.ts; here we clear the backlog via the same
// authenticated acknowledge endpoint so the lifecycle test stays focused on
// run status transitions rather than clicking through every staff member.
async function acknowledgeAllOpenWarnings(
  page: Page,
  year: number,
  month: number,
) {
  const headers = await csrfHeaders(page);

  for (let sweep = 0; sweep < 10; sweep += 1) {
    const response = await page.request.get(
      `${API_BASE_URL}/payroll/exceptions?year=${String(year)}&month=${String(month)}&severity=WARNING&status=OPEN&limit=100`,
    );
    if (!response.ok()) break;
    const body = (await response.json()).data;
    const items: { id: string }[] = body.items ?? [];
    if (items.length === 0) break;

    for (const item of items) {
      await page.request.post(
        `${API_BASE_URL}/payroll/exceptions/${item.id}/acknowledge`,
        {
          headers,
          data: {
            reason:
              'Fresh-period lifecycle verification: acknowledged to unblock submission while salary structures remain unconfigured for most staff.',
          },
        },
      );
    }
  }
}
