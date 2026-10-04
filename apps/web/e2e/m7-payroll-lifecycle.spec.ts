import type { Browser, BrowserContext, Page } from '@playwright/test';
import {
  findPayrollPeriodContaining,
  getNepalSchoolDay,
  nextPayrollPeriod,
  type PayrollPeriodBounds,
} from '@schoolos/core';
import {
  expect,
  test,
  type SchoolE2eRole,
  type StorageState,
} from './fixtures/auth';

const API_BASE_URL =
  process.env.SCHOOLOS_E2E_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:4000/api/v1';

/**
 * Phase 7.12 rewrite. Since 7.9 payroll periods are BS months, and the
 * payroll duty policy requires a different person for each duty:
 * preparer (create, validate, submit) → reviewer → approver (approve,
 * finalize) → poster (post to M11). Every control on the page comes from the
 * server's resource authorization for the signed-in person.
 */
test.describe.serial('M7 payroll lifecycle', () => {
  test('a fresh BS period moves through validate, review, approve, finalize, post and reverse with one duty per person', async ({
    browser,
    authStateFor,
  }) => {
    // Four paced sign-ins (13 s apart, see credential-pacing), warning
    // acknowledgements paced under the API rate limit, and the run.
    test.setTimeout(480_000);

    const officer = await openAs(browser, authStateFor, 'payrollOfficer');
    const period = await findUnusedPeriod(officer.page);

    // --- Preparer: preview and save a draft for the fresh BS period. ---
    await officer.page.goto('/dashboard/payroll/runs');
    await officer.page.getByRole('button', { name: 'New Draft Run' }).click();
    await expect(
      officer.page.getByRole('heading', { name: 'Create Draft from Preview' }),
    ).toBeVisible();
    await officer.page
      .getByLabel('BS Year')
      .selectOption(String(period.bsYear));
    await officer.page
      .getByLabel('BS Month')
      .selectOption(String(period.bsMonth));
    await officer.page.getByRole('button', { name: 'Preview' }).click();
    const saveDraft = officer.page.getByRole('button', {
      name: 'Save as Draft',
    });
    await expect(saveDraft).toBeEnabled({ timeout: 20_000 });
    const createRunResponse = officer.page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith('/payroll/runs') &&
        response.request().method() === 'POST',
    );
    await saveDraft.click();
    const created = await createRunResponse;
    expect(created.status()).toBe(201);
    const runId: string = (await created.json()).data.id;
    await expectPayrollStatus(officer.page, /DRAFT|GENERATED/);

    // The preparer is offered only preparation duties.
    await expect(
      officer.page.getByRole('button', { name: 'Validate Payroll' }),
    ).toBeVisible();
    for (const forbidden of [
      'Approve Run',
      'Complete Review',
      'Finalize Payroll',
      'Post to M11 Accounting',
      'Reverse Payroll',
    ]) {
      await expect(
        officer.page.getByRole('button', { name: forbidden }),
      ).toHaveCount(0);
    }
    const directApprove = await officer.page.request.post(
      `${API_BASE_URL}/payroll/runs/${runId}/approve`,
      { headers: await csrfHeaders(officer.page) },
    );
    expect(directApprove.status()).toBe(403);

    await performAction(officer.page, 'Validate Payroll', 'Validate');
    await expectPayrollStatus(officer.page, /VALIDATED/);

    const reviewer = await openAs(browser, authStateFor, 'payrollReviewer');
    await submitForReview(officer.page, reviewer.page, period);
    await expectPayrollStatus(officer.page, /UNDER_REVIEW/);

    // --- Reviewer: exercise Return for Correction (reason required). ---
    await openRun(reviewer.page, period);
    await expectPayrollStatus(reviewer.page, /UNDER_REVIEW/);
    await expect(
      reviewer.page.getByRole('button', { name: 'Approve Run' }),
    ).toHaveCount(0);
    await reviewer.page
      .getByRole('button', { name: 'Return for Correction' })
      .click();
    await expect(
      reviewer.page.getByRole('heading', {
        name: 'Return Payroll for Correction',
      }),
    ).toBeVisible();
    const rejectConfirm = reviewer.page
      .locator('button[type="submit"]')
      .filter({ hasText: 'Return for Correction' });
    await rejectConfirm.click();
    await expect(
      reviewer.page.getByText(
        'Please provide a reason or remarks for this action.',
      ),
    ).toBeVisible();
    await reviewer.page
      .getByPlaceholder(
        /Provide reason for this return payroll for correction/i,
      )
      .fill('Lifecycle verification: exercising the correction path.');
    await rejectConfirm.click();
    await expect(rejectConfirm).not.toBeVisible();

    // --- Preparer: re-validate and resubmit the returned run. ---
    await openRun(officer.page, period);
    await expectPayrollStatus(officer.page, /DRAFT|GENERATED|VALIDATED/);
    if (
      await officer.page
        .getByRole('button', { name: 'Validate Payroll' })
        .isVisible()
    ) {
      await performAction(officer.page, 'Validate Payroll', 'Validate');
      await expectPayrollStatus(officer.page, /VALIDATED/);
    }
    await submitForReview(officer.page, reviewer.page, period);
    await expectPayrollStatus(officer.page, /UNDER_REVIEW/);

    // --- Reviewer: complete the review. ---
    await openRun(reviewer.page, period);
    await performAction(reviewer.page, 'Complete Review', 'Complete Review');
    await expectPayrollStatus(reviewer.page, /REVIEWED/);
    await expect(
      reviewer.page.getByRole('button', { name: 'Approve Run' }),
    ).toHaveCount(0);

    // --- Approver: approve, then finalize (payslips are issued here). ---
    const approver = await openAs(browser, authStateFor, 'payrollApprover');
    await openRun(approver.page, period);
    await expect(
      approver.page.getByRole('button', { name: 'Complete Review' }),
    ).toHaveCount(0);
    await performAction(approver.page, 'Approve Run', 'Approve');
    await expectPayrollStatus(approver.page, /APPROVED/);
    await expect(
      approver.page.getByRole('button', { name: 'Post to M11 Accounting' }),
    ).toHaveCount(0);
    await performAction(approver.page, 'Finalize Payroll', 'Finalize');
    await expectPayrollStatus(approver.page, /FINALIZED/);

    // The slip opens through the shared PDF helper (a new tab in some
    // Chromium builds, a download in others), so assert on the response.
    const slipResponse = approver.page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith('/salary-slip.pdf') &&
        response.request().method() === 'GET',
    );
    await approver.page
      .getByRole('button', { name: 'Download Salary Slip PDF' })
      .first()
      .click();
    const slip = await slipResponse;
    expect(slip.status()).toBe(200);
    expect(slip.headers()['content-type']).toContain('application/pdf');
    // The page hands the bytes to a blob, so re-read them for the check.
    const slipBytes = await approver.page.request.get(slip.url());
    expect(slipBytes.ok()).toBeTruthy();
    expect((await slipBytes.body()).subarray(0, 5).toString('latin1')).toBe(
      '%PDF-',
    );

    // --- Poster (independent of preparer and approver): post to M11. ---
    const poster = await openAs(browser, authStateFor, 'payrollPoster');
    await openRun(poster.page, period);
    await performAction(poster.page, 'Post to M11 Accounting', 'Post to M11');
    await expectPayrollStatus(poster.page, /POSTED/);
    await expect(
      poster.page.getByRole('button', { name: 'Post to M11 Accounting' }),
    ).toHaveCount(0);

    // Duplicate posting is refused even by a direct backend call.
    const duplicatePost = await poster.page.request.post(
      `${API_BASE_URL}/payroll/runs/${runId}/post-to-accounting`,
      { headers: await csrfHeaders(poster.page) },
    );
    expect(duplicatePost.ok()).toBe(false);

    await poster.page.getByRole('button', { name: 'View Journal' }).click();
    const entryHeading = poster.page.getByRole('heading', {
      name: /^Entry JE-/,
    });
    await expect(entryHeading).toBeVisible();
    await entryHeading.locator('xpath=../..').getByRole('button').click();

    // --- Reversal (reason required) cancels the run through M11. ---
    await poster.page.reload();
    await openRun(poster.page, period);
    await expectPayrollStatus(poster.page, /POSTED/);
    await poster.page.getByRole('button', { name: 'Reverse Payroll' }).click();
    await expect(
      poster.page.getByRole('heading', { name: 'Reverse Payroll' }),
    ).toBeVisible();
    await poster.page
      .getByPlaceholder(/Provide reason for this reverse payroll/i)
      .fill('Authenticated lifecycle reversal verification');
    await poster.page
      .getByRole('button', { name: 'Reverse Payroll', exact: true })
      .last()
      .click();
    await expectPayrollStatus(poster.page, /CANCELLED/);
    await expect(
      poster.page.getByRole('button', { name: 'Reverse Payroll' }),
    ).toHaveCount(0);

    for (const actor of [officer, reviewer, approver, poster]) {
      await actor.context.close();
    }
  });
});

interface Actor {
  context: BrowserContext;
  page: Page;
}

async function openAs(
  browser: Browser,
  authStateFor: (role: SchoolE2eRole) => Promise<StorageState>,
  role: SchoolE2eRole,
): Promise<Actor> {
  const context = await browser.newContext({
    storageState: await authStateFor(role),
  });
  return { context, page: await context.newPage() };
}

/** The first BS month after the current one that has no run at all. */
async function findUnusedPeriod(page: Page): Promise<PayrollPeriodBounds> {
  let candidate = findPayrollPeriodContaining(
    getNepalSchoolDay().gregorianDate,
  );
  for (let offset = 0; offset < 12; offset += 1) {
    candidate = nextPayrollPeriod(candidate);
    const response = await page.request.get(
      `${API_BASE_URL}/payroll/runs?year=${String(candidate.bsYear)}&month=${String(candidate.bsMonth)}&limit=1`,
    );
    expect(response.ok(), 'payroll officer can list runs').toBeTruthy();
    const body = (await response.json()).data;
    if ((body.total ?? body.items?.length ?? 0) === 0) return candidate;
  }
  throw new Error(
    'No unused BS payroll period in the next 12 months; use a fresh database.',
  );
}

async function openRun(page: Page, period: PayrollPeriodBounds) {
  await page.goto('/dashboard/payroll/runs');
  await page
    .getByRole('row')
    .filter({ hasText: period.label })
    .getByRole('button', { name: 'View' })
    .click();
}

/**
 * Submits for review. A fresh period raises WARNING exceptions for staff
 * without salary structures or attendance; the reviewer acknowledges them
 * (reason-bound, audited) through the same endpoint the readiness page uses,
 * which m7-payroll-readiness.spec.ts exercises in the UI.
 */
async function submitForReview(
  officerPage: Page,
  reviewerPage: Page,
  period: PayrollPeriodBounds,
) {
  await officerPage.getByRole('button', { name: 'Submit for Review' }).click();
  const confirm = officerPage
    .locator('button[type="submit"]')
    .filter({ hasText: 'Submit Review' });
  await expect(confirm).toBeVisible();
  const errorToast = officerPage.getByText('Action Error').first();
  await confirm.click();
  await Promise.race([
    confirm
      .waitFor({ state: 'hidden', timeout: 10_000 })
      .catch(() => undefined),
    errorToast
      .waitFor({ state: 'visible', timeout: 10_000 })
      .catch(() => undefined),
  ]);
  if (await errorToast.isVisible().catch(() => false)) {
    await officerPage.getByRole('button', { name: 'Cancel' }).click();
    await acknowledgeOpenWarnings(reviewerPage, period);
    await openRun(officerPage, period);
    await performAction(officerPage, 'Submit for Review', 'Submit Review');
  }
}

async function acknowledgeOpenWarnings(
  page: Page,
  period: PayrollPeriodBounds,
) {
  const headers = await csrfHeaders(page);
  for (let sweep = 0; sweep < 10; sweep += 1) {
    const response = await page.request.get(
      `${API_BASE_URL}/payroll/exceptions?year=${String(period.bsYear)}&month=${String(period.bsMonth)}&severity=WARNING&status=OPEN&limit=100`,
    );
    expect(response.ok(), 'reviewer can read payroll exceptions').toBeTruthy();
    const items: { id: string }[] = (await response.json()).data.items ?? [];
    if (items.length === 0) return;
    for (const item of items) {
      const acknowledged = await page.request.post(
        `${API_BASE_URL}/payroll/exceptions/${item.id}/acknowledge`,
        {
          headers,
          data: {
            reason:
              'Lifecycle verification: staff without salary structures are outside this run.',
          },
        },
      );
      expect(acknowledged.ok()).toBeTruthy();
      // Stay under the real 100-requests-per-minute API limit.
      await page.waitForTimeout(700);
    }
  }
}

async function csrfHeaders(page: Page): Promise<Record<string, string>> {
  const csrfCookie = (await page.context().cookies()).find(
    (cookie) =>
      cookie.name === 'schoolos_csrf' || cookie.name === '__Host-schoolos_csrf',
  );
  return csrfCookie ? { 'X-CSRF-Token': csrfCookie.value } : {};
}

async function performAction(
  page: Page,
  openLabel: string,
  confirmLabel: string,
) {
  await page.getByRole('button', { name: openLabel }).click();
  const confirm = page
    .locator('button[type="submit"]')
    .filter({ hasText: confirmLabel });
  await expect(confirm).toBeVisible();
  await confirm.click();
  await expect(confirm).not.toBeVisible();
}

async function expectPayrollStatus(page: Page, status: RegExp) {
  await expect(
    page.getByText(new RegExp(`^Payroll Status: (${status.source})$`)),
  ).toBeVisible({ timeout: 20_000 });
}
