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

const LARGE_IMPORT_ROW_COUNT = 600;

test("M11 queued bank statement import handles >500 row files in the background and is idempotent on resubmit", async ({
  authStateFor,
  browser,
}) => {
  const runKey = Date.now().toString();
  const accountant = await roleContext(browser, authStateFor, "e2eAccountant");

  const accountsResponse = await accountant.context.request.get(
    `${API_BASE_URL}/accounting/accounts`,
  );
  expect(accountsResponse.ok()).toBeTruthy();
  const accountsPayload = (await accountsResponse.json()) as {
    data: Array<{ id: string; code: string; name: string }>;
  };
  const bankAccount = accountsPayload.data.find(
    (account) => account.code === "1000",
  );
  expect(bankAccount).toBeTruthy();

  const beforeSummaryResponse = await accountant.context.request.get(
    `${API_BASE_URL}/accounting/bank-reconciliation/${bankAccount!.id}/summary`,
  );
  expect(beforeSummaryResponse.ok()).toBeTruthy();
  const beforeSummary = (await beforeSummaryResponse.json()) as {
    data: { totalStatements: number };
  };

  const csv = buildLargeStatementCsv(runKey, LARGE_IMPORT_ROW_COUNT);

  const page = await accountant.context.newPage();
  await page.goto("/dashboard/accounting/reconciliation");
  await page
    .getByLabel("Select Bank/Cash Account")
    .selectOption(bankAccount!.id);

  await uploadStatement(page, csv);

  await expect(
    page.getByTestId("bank-import-queued-message"),
  ).toContainText(`Queued a background import of ${LARGE_IMPORT_ROW_COUNT} rows`);

  const jobsSection = page.getByTestId("bank-import-jobs");
  await expect(jobsSection).toBeVisible();
  const jobStatus = jobsSection.getByTestId("bank-import-job-status").first();

  // The status list polls every 2s while a job is QUEUED/RUNNING; a full reload
  // plus re-selecting the account is a reload-proof way to force a fresh fetch too.
  await expect(async () => {
    await page.reload();
    await page
      .getByLabel("Select Bank/Cash Account")
      .selectOption(bankAccount!.id);
    await expect(jobStatus).toHaveText("COMPLETED", { timeout: 3_000 });
  }).toPass({ timeout: 30_000, intervals: [1_000, 2_000, 3_000] });

  await expect(
    jobsSection.getByText(
      `${LARGE_IMPORT_ROW_COUNT} / ${LARGE_IMPORT_ROW_COUNT} rows processed`,
    ),
  ).toBeVisible();

  const afterSummaryResponse = await accountant.context.request.get(
    `${API_BASE_URL}/accounting/bank-reconciliation/${bankAccount!.id}/summary`,
  );
  expect(afterSummaryResponse.ok()).toBeTruthy();
  const afterSummary = (await afterSummaryResponse.json()) as {
    data: { totalStatements: number };
  };
  expect(afterSummary.data.totalStatements).toBe(
    beforeSummary.data.totalStatements + LARGE_IMPORT_ROW_COUNT,
  );

  const jobsListResponse = await accountant.context.request.get(
    `${API_BASE_URL}/accounting/bank-reconciliation/${bankAccount!.id}/import-jobs`,
  );
  expect(jobsListResponse.ok()).toBeTruthy();
  const jobsList = (await jobsListResponse.json()) as {
    data: Array<{ id: string; status: string; totalRows: number }>;
  };
  expect(jobsList.data.length).toBeGreaterThanOrEqual(1);
  const completedJob = jobsList.data[0];
  expect(completedJob.status).toBe("COMPLETED");
  expect(completedJob.totalRows).toBe(LARGE_IMPORT_ROW_COUNT);

  // Resubmitting the exact same file must be detected as a duplicate and must not
  // create a second job or double-insert the statement lines.
  const resubmitResponse = await accountant.context.request.post(
    `${API_BASE_URL}/accounting/bank-reconciliation/${bankAccount!.id}/import-queue`,
    {
      headers: csrfHeaders(accountant.state),
      data: { lines: parseCsvToLines(csv) },
    },
  );
  expect(resubmitResponse.ok()).toBeTruthy();
  const resubmitBody = (await resubmitResponse.json()) as {
    data: { reused: boolean; status: string; jobId: string | null };
  };
  expect(resubmitBody.data.reused).toBe(true);
  expect(resubmitBody.data.status).toBe("COMPLETED");

  const jobsListAfterResubmitResponse = await accountant.context.request.get(
    `${API_BASE_URL}/accounting/bank-reconciliation/${bankAccount!.id}/import-jobs`,
  );
  const jobsListAfterResubmit =
    (await jobsListAfterResubmitResponse.json()) as {
      data: Array<{ id: string }>;
    };
  expect(jobsListAfterResubmit.data.length).toBe(jobsList.data.length);

  const summaryAfterResubmitResponse = await accountant.context.request.get(
    `${API_BASE_URL}/accounting/bank-reconciliation/${bankAccount!.id}/summary`,
  );
  const summaryAfterResubmit = (await summaryAfterResubmitResponse.json()) as {
    data: { totalStatements: number };
  };
  expect(summaryAfterResubmit.data.totalStatements).toBe(
    afterSummary.data.totalStatements,
  );

  await accountant.context.close();
});

test("M11 bank statement queued import rejects files that fit the sync path and files over the background cap", async ({
  authStateFor,
  browser,
}) => {
  const accountant = await roleContext(browser, authStateFor, "e2eAccountant");
  const accountsResponse = await accountant.context.request.get(
    `${API_BASE_URL}/accounting/accounts`,
  );
  const accountsPayload = (await accountsResponse.json()) as {
    data: Array<{ id: string; code: string }>;
  };
  const bankAccount = accountsPayload.data.find(
    (account) => account.code === "1000",
  );
  expect(bankAccount).toBeTruthy();

  const smallResponse = await accountant.context.request.post(
    `${API_BASE_URL}/accounting/bank-reconciliation/${bankAccount!.id}/import-queue`,
    {
      headers: csrfHeaders(accountant.state),
      data: {
        lines: [
          {
            statementDate: new Date().toISOString().slice(0, 10),
            description: "Too small for the queue",
            debitAmount: 5,
            creditAmount: 0,
          },
        ],
      },
    },
  );
  expect(smallResponse.status()).toBe(400);
  expect(await smallResponse.text()).toContain("synchronously");

  const oversizedLine = {
    statementDate: new Date().toISOString().slice(0, 10),
    description: "Oversized batch line",
    debitAmount: 1,
    creditAmount: 0,
  };
  const oversizedResponse = await accountant.context.request.post(
    `${API_BASE_URL}/accounting/bank-reconciliation/${bankAccount!.id}/import-queue`,
    {
      headers: csrfHeaders(accountant.state),
      data: { lines: Array.from({ length: 25_001 }, () => oversizedLine) },
    },
  );
  expect(oversizedResponse.status()).toBe(400);

  await accountant.context.close();
});

function buildLargeStatementCsv(runKey: string, rowCount: number): string {
  const date = new Date().toISOString().slice(0, 10);
  const header = "Date,Description,Reference,Debit,Credit";
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const amount = (10 + (index % 50)).toFixed(2);
    return `${date},Bulk import row ${index} ${runKey},BULK-${runKey}-${index},${amount},0`;
  });
  return [header, ...rows].join("\n");
}

function parseCsvToLines(csv: string) {
  return csv
    .split("\n")
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const [statementDate, description, reference, debit, credit] =
        line.split(",");
      return {
        statementDate,
        description,
        reference,
        debitAmount: Number(debit).toFixed(2),
        creditAmount: Number(credit).toFixed(2),
      };
    });
}

async function uploadStatement(
  page: import("@playwright/test").Page,
  csv: string,
) {
  await page.locator('input[type="file"]').setInputFiles({
    name: "e2e-large-bank-statement.csv",
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
