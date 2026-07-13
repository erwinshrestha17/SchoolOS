import type { Browser } from "@playwright/test";
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

test("M11 bank reconciliation previews and idempotently commits a statement before explicit matching", async ({
  authStateFor,
  browser,
}) => {
  const runKey = Date.now().toString();
  const preparer = await roleContext(browser, authStateFor, "e2eAccountant");
  const accountsResponse = await preparer.context.request.get(
    `${API_BASE_URL}/accounting/accounts`,
  );
  expect(accountsResponse.ok()).toBeTruthy();
  const accountsPayload = (await accountsResponse.json()) as {
    data: Array<{ id: string; code: string; name: string }>;
  };
  const bankAccount = accountsPayload.data.find(
    (account) => account.code === "1010",
  );
  const incomeAccount = accountsPayload.data.find(
    (account) => account.code === "4000",
  );
  expect(bankAccount && incomeAccount).toBeTruthy();

  const narration = `E2E bank reconciliation ${runKey}`;
  const amount = 4321.25;
  const createResponse = await preparer.context.request.post(
    `${API_BASE_URL}/accounting/journals`,
    {
      headers: csrfHeaders(preparer.state),
      data: {
        entryDate: new Date().toISOString().slice(0, 10),
        narration,
        lines: [
          {
            chartAccountId: bankAccount!.id,
            side: "DEBIT",
            amount,
          },
          {
            chartAccountId: incomeAccount!.id,
            side: "CREDIT",
            amount,
          },
        ],
      },
    },
  );
  expect(createResponse.ok()).toBeTruthy();
  const created = (await createResponse.json()) as { data: { id: string } };
  const journalId = created.data.id;
  const submitResponse = await preparer.context.request.post(
    `${API_BASE_URL}/accounting/journals/${journalId}/submit`,
    {
      headers: csrfHeaders(preparer.state),
      data: { reason: "E2E reconciliation setup" },
    },
  );
  expect(submitResponse.ok()).toBeTruthy();
  await preparer.context.close();

  const approver = await roleContext(
    browser,
    authStateFor,
    "accountingApprover",
  );
  const approveResponse = await approver.context.request.post(
    `${API_BASE_URL}/accounting/journals/${journalId}/approve`,
    { headers: csrfHeaders(approver.state), data: {} },
  );
  expect(approveResponse.ok()).toBeTruthy();
  const postResponse = await approver.context.request.post(
    `${API_BASE_URL}/accounting/journals/${journalId}/post`,
    { headers: csrfHeaders(approver.state), data: {} },
  );
  expect(postResponse.ok()).toBeTruthy();
  const posted = (await postResponse.json()) as {
    data: { entryNumber: string };
  };
  await approver.context.close();

  const accountant = await roleContext(
    browser,
    authStateFor,
    "e2eAccountant",
  );
  const page = await accountant.context.newPage();
  await page.goto("/dashboard/accounting/reconciliation");
  await page
    .getByLabel("Select Bank/Cash Account")
    .selectOption(bankAccount!.id);

  const csv = [
    "Date,Description,Reference,Debit,Credit",
    `${new Date().toISOString().slice(0, 10)},${narration},${posted.data.entryNumber},${amount},0`,
    `${new Date().toISOString().slice(0, 10)},Unmatched E2E row ${runKey},UNMATCHED-${runKey},19.75,0`,
  ].join("\n");
  await uploadStatement(page, csv);
  const preview = page.getByTestId("bank-import-preview");
  await expect(preview).toBeVisible();
  await expect(preview.getByText(narration)).toBeVisible();
  await preview.getByRole("button", { name: "Commit 2 rows" }).click();
  await expect(page.getByText("Bank statement imported successfully")).toBeVisible();

  await uploadStatement(page, csv);
  await page
    .getByTestId("bank-import-preview")
    .getByRole("button", { name: "Commit 2 rows" })
    .click();
  await expect(
    page.getByText(/already committed.*No rows were duplicated/i),
  ).toBeVisible();

  const duplicatePreview = await accountant.context.request.post(
    `${API_BASE_URL}/accounting/bank-reconciliation/${bankAccount!.id}/import-preview`,
    {
      headers: csrfHeaders(accountant.state),
      data: {
        lines: [
          {
            statementDate: new Date().toISOString().slice(0, 10),
            description: "Duplicate row",
            debitAmount: 10,
            creditAmount: 0,
          },
          {
            statementDate: new Date().toISOString().slice(0, 10),
            description: "Duplicate row",
            debitAmount: 10,
            creditAmount: 0,
          },
        ],
      },
    },
  );
  expect(duplicatePreview.status()).toBe(400);
  expect(await duplicatePreview.text()).toContain("duplicates another row");

  await page.getByTestId("bank-reconciliation-auto-match").click();
  const suggestions = page.getByTestId("bank-reconciliation-suggestions");
  await expect(suggestions.getByText(narration)).toBeVisible();
  const suggestion = suggestions.locator("div.rounded-xl", {
    hasText: narration,
  });
  await suggestion.getByRole("button", { name: "Review" }).click();
  const confirmDialog = page.getByRole("dialog");
  await expect(confirmDialog.getByText("Confirm Reconciliation")).toBeVisible();
  await confirmDialog.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Transaction reconciled")).toBeVisible();
  await expect(page.getByText(`Unmatched E2E row ${runKey}`)).toBeVisible();

  const summaryResponse = await accountant.context.request.get(
    `${API_BASE_URL}/accounting/bank-reconciliation/${bankAccount!.id}/summary`,
  );
  expect(summaryResponse.ok()).toBeTruthy();
  const summary = (await summaryResponse.json()) as {
    data: { reconciledStatements: number; unreconciledStatements: number };
  };
  expect(summary.data.reconciledStatements).toBeGreaterThanOrEqual(1);
  expect(summary.data.unreconciledStatements).toBeGreaterThanOrEqual(1);

  const pdfResponsePromise = page.waitForResponse((response) =>
    response.url().includes(
      `/accounting/reports/bank-reconciliation/${bankAccount!.id}/export.pdf`,
    ),
  );
  await page.getByRole("button", { name: "Export PDF" }).click();
  const pdfResponse = await pdfResponsePromise;
  expect(pdfResponse.ok()).toBeTruthy();
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  const protectedPdf = await accountant.context.request.get(
    `${API_BASE_URL}/accounting/reports/bank-reconciliation/${bankAccount!.id}/export.pdf`,
  );
  expect(protectedPdf.ok()).toBeTruthy();
  expect(protectedPdf.headers()["content-type"]).toContain("application/pdf");
  expect((await protectedPdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  await accountant.context.close();
});

async function uploadStatement(page: import("@playwright/test").Page, csv: string) {
  await page.locator('input[type="file"]').setInputFiles({
    name: "e2e-bank-statement.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
}

async function roleContext(
  browser: Browser,
  authStateFor: (role: SchoolE2eRole) => Promise<StorageState>,
  role: SchoolE2eRole,
) {
  const state = await authStateFor(role);
  const context = await browser.newContext({ storageState: state });
  return { state, context };
}

function csrfHeaders(state: StorageState) {
  const csrfCookie = state.cookies.find(
    (cookie) =>
      cookie.name === "__Host-schoolos_csrf" ||
      cookie.name === "schoolos_csrf",
  );
  if (!csrfCookie) {
    throw new Error("Authenticated E2E state is missing its CSRF cookie.");
  }
  return { "X-CSRF-Token": csrfCookie.value };
}
