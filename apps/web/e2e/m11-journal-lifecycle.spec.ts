import type { Browser, Locator, Page } from "@playwright/test";
import {
  expect,
  test,
  type SchoolE2eRole,
  type StorageState,
} from "./fixtures/auth";

const API_BASE_URL =
  process.env.SCHOOLOS_E2E_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000/api/v1";
const WEB_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ??
  `http://localhost:${process.env.SCHOOLOS_WEB_E2E_PORT ?? "3101"}`;

const voucherCases = [
  {
    label: "Journal Voucher",
    accountLabels: [/^5010 - /, /^2200 - /],
  },
  {
    label: "Expense Voucher",
    accountLabels: [/^5040 - /, /^1000 - /],
  },
  {
    label: "Payment Voucher",
    accountLabels: [/^2200 - /, /^1010 - /],
  },
  {
    label: "Receipt Voucher",
    accountLabels: [/^4000 - /, /^1000 - /],
  },
  {
    label: "Contra Voucher",
    accountLabels: [/^1000 - /, /^1010 - /],
  },
] as const;

test("M11 voucher and journal lifecycle preserves approval and immutable correction boundaries", async ({
  authStateFor,
  browser,
}) => {
  const runKey = Date.now().toString();
  const narrations = voucherCases.map(
    (voucher, index) => `E2E ${voucher.label} ${runKey}-${index + 1}`,
  );

  const preparer = await rolePage(browser, authStateFor, "e2eAccountant");
  for (let index = 0; index < voucherCases.length; index += 1) {
    await createAndSubmitVoucher(
      preparer.page,
      voucherCases[index],
      narrations[index],
      1000 + index * 100,
    );
  }

  const unbalanced = await preparer.context.request.post(
    `${API_BASE_URL}/accounting/journals`,
    {
      headers: csrfHeaders(preparer.state),
      data: await unbalancedJournalPayload(preparer.context.request, runKey),
    },
  );
  expect(unbalanced.status()).toBe(409);
  expect(await unbalanced.text()).toContain("must be balanced");
  await preparer.context.close();

  const approver = await rolePage(browser, authStateFor, "accountingApprover");
  for (const narration of narrations) {
    await approveAndPostVoucher(approver.page, narration);
  }

  const postedResponse = await approver.context.request.get(
    `${API_BASE_URL}/accounting/journals`,
  );
  expect(postedResponse.ok()).toBeTruthy();
  const postedPayload = await postedResponse.json();
  const postedItems = (postedPayload.data ?? []) as Array<{
    id: string;
    narration: string;
    status: string;
    totalDebit: string | number;
    totalCredit: string | number;
  }>;
  const created = narrations.map((narration) =>
    postedItems.find((entry) => entry.narration === narration),
  );
  for (const entry of created) {
    expect(entry?.status).toBe("POSTED");
    expect(Number(entry?.totalDebit)).toBe(Number(entry?.totalCredit));
  }

  await reverseVoucher(approver.page, narrations[0]);
  await correctVoucher(approver.page, narrations[1]);

  const originalReversedId = created[0]?.id;
  expect(originalReversedId).toBeTruthy();
  const duplicateReversal = await approver.context.request.post(
    `${API_BASE_URL}/accounting/journals/${originalReversedId}/reverse`,
    {
      headers: csrfHeaders(approver.state),
      data: { reason: "Duplicate E2E reversal must remain blocked" },
    },
  );
  expect(duplicateReversal.status()).toBe(409);

  const finalResponse = await approver.context.request.get(
    `${API_BASE_URL}/accounting/journals`,
  );
  const finalPayload = await finalResponse.json();
  const finalItems = (finalPayload.data ?? []) as Array<{
    id: string;
    status: string;
    reversalOfId?: string | null;
    correctionOfId?: string | null;
    totalDebit: string | number;
    totalCredit: string | number;
  }>;
  expect(
    finalItems.filter((entry) => entry.reversalOfId === originalReversedId),
  ).toHaveLength(1);
  expect(
    finalItems.some((entry) => entry.correctionOfId === created[1]?.id),
  ).toBeTruthy();
  for (const linkedEntry of finalItems.filter(
    (entry) => entry.reversalOfId || entry.correctionOfId,
  )) {
    expect(Number(linkedEntry.totalDebit)).toBe(
      Number(linkedEntry.totalCredit),
    );
  }

  await approver.context.close();
});

async function createAndSubmitVoucher(
  page: Page,
  voucher: (typeof voucherCases)[number],
  narration: string,
  amount: number,
) {
  await page.goto(`${WEB_BASE_URL}/dashboard/accounting`);
  await expect(page.getByText("Operational Quick Actions")).toBeVisible();
  await page.locator("button").filter({ hasText: voucher.label }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(`Create ${voucher.label}`)).toBeVisible();
  await dialog.getByLabel("Amount").fill(String(amount));
  await dialog.getByLabel("Narration").fill(narration);
  await dialog.getByLabel(/Reference/).fill(`REF-${narration.slice(-15)}`);
  const accountSelects = dialog.getByRole("combobox");
  await selectOptionByText(accountSelects.nth(0), voucher.accountLabels[0]);
  await selectOptionByText(accountSelects.nth(1), voucher.accountLabels[1]);
  await dialog
    .getByRole("button", { name: `Save Draft ${voucher.label}` })
    .click();
  await expect(dialog).not.toBeVisible();

  await openJournal(page, narration);
  const detail = page.getByRole("dialog");
  await expect(detail.getByText("DRAFT", { exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Submit for Approval" }).click();
  await expect(detail).not.toBeVisible();
}

async function approveAndPostVoucher(page: Page, narration: string) {
  await openJournal(page, narration);
  let detail = page.getByRole("dialog");
  await expect(detail.getByText("SUBMITTED", { exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Approve Journal" }).click();
  await expect(detail).not.toBeVisible();

  await openJournal(page, narration);
  detail = page.getByRole("dialog");
  await expect(detail.getByText("APPROVED", { exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Post Journal" }).click();
  await expect(detail).not.toBeVisible();

  await expect(
    journalRow(page, narration).getByText("POSTED", { exact: true }),
  ).toBeVisible();
}

async function reverseVoucher(page: Page, narration: string) {
  await openJournal(page, narration);
  const detail = page.getByRole("dialog");
  await detail.getByRole("button", { name: "Reverse", exact: true }).click();
  await detail
    .locator("textarea")
    .fill("E2E reversal with required audit reason");
  await detail.getByRole("button", { name: "Confirm Reversal" }).click();
  await expect(detail).not.toBeVisible();
  await expect(
    journalRow(page, narration).getByText("REVERSED", { exact: true }),
  ).toBeVisible();
}

async function correctVoucher(page: Page, narration: string) {
  await openJournal(page, narration);
  const detail = page.getByRole("dialog");
  await detail.getByRole("button", { name: "Correct", exact: true }).click();
  await detail
    .locator("textarea")
    .fill("E2E correction with required audit reason");
  await detail.getByRole("button", { name: "Confirm Correction" }).click();
  await expect(detail).not.toBeVisible();
}

async function openJournal(page: Page, narration: string) {
  await page.goto(`${WEB_BASE_URL}/dashboard/accounting/journals`);
  const row = journalRow(page, narration);
  await expect(row).toBeVisible();
  await row.getByTitle("View Details").click();
}

function journalRow(page: Page, narration: string) {
  return page.getByRole("row").filter({ hasText: narration });
}

async function selectOptionByText(select: Locator, text: RegExp) {
  const value = await select
    .locator("option")
    .filter({ hasText: text })
    .getAttribute("value");
  if (!value) throw new Error(`Account option ${text} was not available.`);
  await select.selectOption(value);
}

async function rolePage(
  browser: Browser,
  authStateFor: (role: SchoolE2eRole) => Promise<StorageState>,
  role: SchoolE2eRole,
) {
  const state = await authStateFor(role);
  const context = await browser.newContext({ storageState: state });
  const page = await context.newPage();
  return { state, context, page };
}

async function unbalancedJournalPayload(
  request: {
    get: (
      url: string,
    ) => Promise<{ ok: () => boolean; json: () => Promise<unknown> }>;
  },
  runKey: string,
) {
  const response = await request.get(`${API_BASE_URL}/accounting/accounts`);
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    data: Array<{ id: string; code: string }>;
  };
  const debit = payload.data.find((account) => account.code === "5000");
  const credit = payload.data.find((account) => account.code === "1000");
  expect(debit && credit).toBeTruthy();
  return {
    entryDate: new Date().toISOString().slice(0, 10),
    narration: `E2E unbalanced journal ${runKey}`,
    lines: [
      { chartAccountId: debit!.id, side: "DEBIT", amount: 100 },
      { chartAccountId: credit!.id, side: "CREDIT", amount: 99 },
    ],
  };
}

function csrfHeaders(state: StorageState) {
  const csrfCookie = state.cookies.find(
    (cookie) =>
      cookie.name === "__Host-schoolos_csrf" || cookie.name === "schoolos_csrf",
  );
  if (!csrfCookie)
    throw new Error("Authenticated E2E state is missing its CSRF cookie.");
  return { "X-CSRF-Token": csrfCookie.value };
}
