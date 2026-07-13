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

test("M11 fiscal controls enforce backend readiness, lock, close, and reasoned reopen", async ({
  authStateFor,
  browser,
}) => {
  const runKey = Date.now().toString();
  const fiscalController = await roleContext(
    browser,
    authStateFor,
    "accountingFiscalController",
  );
  const fiscalYearName = `E2E Fiscal Controls ${runKey}`;
  const existingYearsResponse = await fiscalController.context.request.get(
    `${API_BASE_URL}/accounting/fiscal-years`,
  );
  expect(existingYearsResponse.ok()).toBeTruthy();
  const existingYears = (await existingYearsResponse.json()) as {
    data: Array<{ startDate: string }>;
  };
  const earliestStart = existingYears.data.reduce(
    (earliest, year) =>
      new Date(year.startDate).getTime() < earliest.getTime()
        ? new Date(year.startDate)
        : earliest,
    new Date("2026-01-01T00:00:00.000Z"),
  );
  const fiscalEnd = new Date(earliestStart);
  fiscalEnd.setUTCDate(fiscalEnd.getUTCDate() - 1);
  const fiscalStart = new Date(fiscalEnd);
  fiscalStart.setUTCDate(fiscalStart.getUTCDate() - 6);
  const fiscalStartDate = fiscalStart.toISOString().slice(0, 10);
  const fiscalEndDate = fiscalEnd.toISOString().slice(0, 10);
  const createYearResponse = await fiscalController.context.request.post(
    `${API_BASE_URL}/accounting/fiscal-years`,
    {
      headers: csrfHeaders(fiscalController.state),
      data: {
        name: fiscalYearName,
        startDate: fiscalStartDate,
        endDate: fiscalEndDate,
      },
    },
  );
  expect(createYearResponse.ok()).toBeTruthy();
  const createdYear = (await createYearResponse.json()) as {
    data: { id: string; periods: Array<{ id: string }> };
  };
  const periodId = createdYear.data.periods[0]?.id;
  expect(periodId).toBeTruthy();

  const readinessResponse = await fiscalController.context.request.get(
    `${API_BASE_URL}/accounting/fiscal-periods/${periodId}/close-readiness`,
  );
  expect(readinessResponse.ok()).toBeTruthy();
  const readiness = (await readinessResponse.json()) as {
    data: {
      readyToClose: boolean;
      blockers: unknown[];
      unavailableChecks: string[];
    };
  };
  expect(readiness.data.readyToClose).toBeTruthy();
  expect(readiness.data.blockers).toHaveLength(0);
  expect(readiness.data.unavailableChecks).toContain(
    "NEEDS_POSTING_FAILURE_CONTRACT",
  );

  const page = await fiscalController.context.newPage();
  await page.goto("/dashboard/accounting/fiscal-periods");
  const periodCard = page.getByTestId(`fiscal-period-${periodId}`);
  await expect(periodCard).toBeVisible();
  await periodCard.getByTitle("Lock Period").click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Reason for action")
    .fill("E2E month-end review lock");
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(periodCard.getByText("LOCKED", { exact: true })).toBeVisible();

  const accountant = await roleContext(
    browser,
    authStateFor,
    "e2eAccountant",
  );
  const accountsResponse = await accountant.context.request.get(
    `${API_BASE_URL}/accounting/accounts`,
  );
  const accounts = (await accountsResponse.json()) as {
    data: Array<{ id: string; code: string }>;
  };
  const cash = accounts.data.find((account) => account.code === "1000");
  const income = accounts.data.find((account) => account.code === "4000");
  expect(cash && income).toBeTruthy();
  const lockedPosting = await accountant.context.request.post(
    `${API_BASE_URL}/accounting/journals`,
    {
      headers: csrfHeaders(accountant.state),
      data: {
        entryDate: fiscalStartDate,
        narration: `Blocked locked-period journal ${runKey}`,
        lines: [
          { chartAccountId: cash!.id, side: "DEBIT", amount: 100 },
          { chartAccountId: income!.id, side: "CREDIT", amount: 100 },
        ],
      },
    },
  );
  expect(lockedPosting.status()).toBe(409);
  expect((await lockedPosting.text()).toLowerCase()).toContain("locked");
  await accountant.context.close();

  await periodCard.getByTitle("Close Period").click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Backend checks are ready to close"),
  ).toBeVisible();
  await expect(
    dialog.getByText(/Posting-failure.*remain explicitly unavailable/),
  ).toBeVisible();
  await dialog
    .getByLabel("Reason for action")
    .fill("E2E verified close with backend readiness");
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(periodCard.getByText("CLOSED", { exact: true })).toBeVisible();

  await periodCard.getByTitle("Reopen Period").click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Reason for action")
    .fill("E2E authorized correction requires reopen");
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(periodCard.getByText("OPEN", { exact: true })).toBeVisible();

  const otherTenant = await roleContext(
    browser,
    authStateFor,
    "otherTenant",
  );
  const crossTenantReadiness = await otherTenant.context.request.get(
    `${API_BASE_URL}/accounting/fiscal-periods/${periodId}/close-readiness`,
  );
  expect([403, 404]).toContain(crossTenantReadiness.status());
  const crossTenantBody = await crossTenantReadiness.text();
  expect(crossTenantBody).not.toContain(fiscalYearName);
  expect(crossTenantBody).not.toContain('"tenantId"');
  await otherTenant.context.close();

  const readOnly = await roleContext(
    browser,
    authStateFor,
    "principalReadOnly",
  );
  const readOnlyPage = await readOnly.context.newPage();
  await readOnlyPage.goto("/dashboard/accounting/fiscal-periods");
  const readOnlyPeriod = readOnlyPage.getByTestId(`fiscal-period-${periodId}`);
  await expect(readOnlyPeriod).toBeVisible();
  await expect(readOnlyPeriod.getByTitle("Lock Period")).toHaveCount(0);
  await expect(readOnlyPeriod.getByTitle("Reopen Period")).toHaveCount(0);
  await readOnly.context.close();

  await fiscalController.context.close();
});

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
