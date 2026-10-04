import type { Browser, Locator, Page } from '@playwright/test';
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
 * Phase 7.12 (7X): the payables workflow with three independent people.
 * The preparer maps Accounts Payable, adds a vendor and records and submits a
 * bill; a different approver approves it (posting it to AP); a third person
 * pays it. Every control comes from the server's resource authorization.
 */
test('M11 payables: prepare, approve and pay a vendor bill with one duty per person', async ({
  authStateFor,
  browser,
}) => {
  // Three paced sign-ins (13 s apart, see credential-pacing) plus the flow.
  test.setTimeout(240_000);
  const runKey = Date.now().toString();
  const vendorName = `E2E Vendor ${runKey}`;
  const description = `E2E stationery ${runKey}`;

  // --- Preparer: Accounts Payable mapping, vendor, bill. ---
  const preparer = await rolePage(browser, authStateFor, 'e2eAccountant');
  await ensureAccountsPayableAccount(preparer.page, preparer.state);
  await preparer.page.goto('/dashboard/accounting/payables');
  await expect(preparer.page.getByTestId('payables-workspace')).toBeVisible();
  const mapButton = preparer.page.getByRole('button', {
    name: 'Map Accounts Payable',
  });
  if (await mapButton.isVisible().catch(() => false)) {
    await selectOptionByText(
      preparer.page.getByLabel('Accounts Payable account'),
      /^2100 · Accounts Payable/,
    );
    await mapButton.click();
    await expect(mapButton).toHaveCount(0, { timeout: 15_000 });
  }

  await preparer.page.getByRole('tab', { name: 'Vendors' }).click();
  await preparer.page.getByRole('button', { name: 'Add vendor' }).click();
  const vendorDialog = preparer.page.getByRole('dialog');
  await vendorDialog.getByLabel('Registered name').fill(vendorName);
  await vendorDialog.getByRole('button', { name: 'Add vendor' }).click();
  await expect(vendorDialog).toHaveCount(0);

  await preparer.page.getByRole('tab', { name: 'Vendor bills' }).click();
  await preparer.page.getByRole('button', { name: 'Record bill' }).click();
  const billDialog = preparer.page.getByRole('dialog');
  await expect(billDialog.getByText('Record a vendor bill')).toBeVisible();
  await selectOptionByText(
    // The required marker is part of the label text, so match by role.
    billDialog.getByRole('combobox', { name: /^Vendor\b(?!')/ }),
    new RegExp(vendorName),
  );
  await selectOptionByText(
    billDialog.getByLabel('Expense account'),
    /^5040 · Stationery Expense/,
  );
  await billDialog.getByLabel('Amount before VAT (NPR)').fill('1500.00');
  await billDialog.getByLabel('Description').fill(description);
  await billDialog.getByRole('button', { name: 'Save draft' }).click();

  const detail = preparer.page.getByRole('dialog');
  await expect(detail.getByText(/^Vendor bill BILL-/)).toBeVisible();
  const billTitle = await detail.getByText(/^Vendor bill BILL-/).innerText();
  const billNumber = billTitle.replace('Vendor bill ', '').trim();
  await expect(
    detail.getByRole('button', { name: 'Approve and post' }),
  ).toHaveCount(0);
  await detail.getByRole('button', { name: 'Submit for approval' }).click();
  await expect(
    detail.getByRole('button', { name: 'Submit for approval' }),
  ).toHaveCount(0);
  // The preparer can never approve their own bill.
  await expect(
    detail.getByRole('button', { name: 'Approve and post' }),
  ).toHaveCount(0);
  await preparer.context.close();

  // --- Approver (independent of the preparer): approve and post. ---
  const approver = await rolePage(browser, authStateFor, 'accountingApprover');
  await approver.page.goto('/dashboard/accounting/payables?view=expenses');
  await approver.page
    .getByPlaceholder('Search bill, vendor or description')
    .fill(billNumber);
  await approver.page.getByRole('row').filter({ hasText: billNumber }).click();
  const approverDetail = approver.page.getByRole('dialog');
  await approverDetail
    .getByRole('button', { name: 'Approve and post' })
    .click();
  await expect(
    approverDetail.getByRole('button', { name: 'Approve and post' }),
  ).toHaveCount(0, { timeout: 15_000 });
  await expect(approverDetail.getByText('POSTED').first()).toBeVisible();
  await approver.context.close();

  // --- Payer (independent of preparer and approver): pay in full. ---
  const payer = await rolePage(browser, authStateFor, 'accountingPoster');
  await payer.page.goto('/dashboard/accounting/payables');
  await payer.page
    .getByPlaceholder('Search vendor, payable or bill number')
    .fill(vendorName);
  // The vendor summary table also lists the vendor; open the payable row.
  await payer.page
    .getByRole('row')
    .filter({ hasText: vendorName })
    .filter({ hasText: /AP-\d+/ })
    .click();
  const payable = payer.page.getByRole('dialog');
  await expect(payable.getByText('Record a payment')).toBeVisible();
  await payable.getByLabel('Amount cleared (NPR)').fill('1500.00');
  const paidFrom = payable.getByLabel('Paid from');
  const firstAccount = await paidFrom
    .locator('option')
    .nth(1)
    .getAttribute('value');
  expect(firstAccount).toBeTruthy();
  await paidFrom.selectOption(firstAccount as string);
  const settleResponse = payer.page.waitForResponse(
    (response) =>
      /\/accounting\/payables\/[^/]+\/settlements$/.test(
        new URL(response.url()).pathname,
      ) && response.request().method() === 'POST',
  );
  await payable.getByRole('button', { name: 'Record payment' }).click();
  expect((await settleResponse).status()).toBe(201);
  await expect(payable.getByText('PAID').first()).toBeVisible({
    timeout: 15_000,
  });
  await payer.context.close();
});

async function rolePage(
  browser: Browser,
  authStateFor: (role: SchoolE2eRole) => Promise<StorageState>,
  role: SchoolE2eRole,
) {
  const state = await authStateFor(role);
  const context = await browser.newContext({ storageState: state });
  return { state, context, page: await context.newPage() };
}

/** The demo chart has no Accounts Payable account; the preparer adds one. */
async function ensureAccountsPayableAccount(page: Page, state: StorageState) {
  const list = await page.request.get(`${API_BASE_URL}/accounting/accounts`);
  expect(list.ok()).toBeTruthy();
  const accounts = (await list.json()).data as Array<{ code: string }>;
  if (accounts.some((account) => account.code === '2100')) return;
  const created = await page.request.post(
    `${API_BASE_URL}/accounting/accounts`,
    {
      headers: csrfHeaders(state),
      data: { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
    },
  );
  expect(created.ok()).toBeTruthy();
}

async function selectOptionByText(select: Locator, text: RegExp) {
  const value = await select
    .locator('option')
    .filter({ hasText: text })
    .first()
    .getAttribute('value');
  if (!value) throw new Error(`Option ${text} was not available.`);
  await select.selectOption(value);
}

function csrfHeaders(state: StorageState): Record<string, string> {
  const csrf = state.cookies.find(
    (cookie) =>
      cookie.name === 'schoolos_csrf' || cookie.name === '__Host-schoolos_csrf',
  );
  return csrf ? { 'X-CSRF-Token': csrf.value } : {};
}
