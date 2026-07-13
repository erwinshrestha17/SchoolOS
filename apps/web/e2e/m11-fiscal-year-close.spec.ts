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

test("M11 fiscal-year close readiness blocks, recomputes, closes, blocks posting, and reopens with reason", async ({
  authStateFor,
  browser,
}) => {
  const runKey = Date.now().toString();
  const fiscalController = await roleContext(
    browser,
    authStateFor,
    "accountingFiscalController",
  );

  // --- Provision a fresh, non-overlapping fiscal year. ---
  const fiscalYearName = `E2E Fiscal Year Close ${runKey}`;
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
      data: { name: fiscalYearName, startDate: fiscalStartDate, endDate: fiscalEndDate },
    },
  );
  expect(createYearResponse.ok()).toBeTruthy();
  const createdYear = (await createYearResponse.json()) as {
    data: { id: string; periods: Array<{ id: string }> };
  };
  const fiscalYearId = createdYear.data.id;
  const periodIds = createdYear.data.periods.map((period) => period.id);
  // The 7-day provisioning window can straddle a calendar-month boundary,
  // in which case the backend creates one period per month touched.
  const periodId = periodIds[0];
  expect(periodId).toBeTruthy();

  // --- Blocking issue displayed: an open period blocks close before any activity exists. ---
  const initialReadiness = await getReadiness(fiscalController, fiscalYearId);
  expect(initialReadiness.readyToClose).toBe(false);
  expect(initialReadiness.readinessStatus).toBe("BLOCKED");
  expect(
    initialReadiness.issues.find(
      (issue: { code: string }) => issue.code === "OPEN_PERIODS",
    ),
  ).toMatchObject({ severity: "BLOCKING" });
  expect(initialReadiness.allowedActions).toEqual([]);

  // --- Attempted close blocked by the backend even with a valid reason. ---
  const blockedClose = await fiscalController.context.request.post(
    `${API_BASE_URL}/accounting/fiscal-years/${fiscalYearId}/close-year`,
    {
      headers: csrfHeaders(fiscalController.state),
      data: { reason: "Attempting close while a period is still open." },
    },
  );
  expect(blockedClose.status()).toBe(409);
  expect((await blockedClose.text())).toContain("OPEN_PERIODS");

  // --- Post real revenue activity so the fiscal-year close has closing entries to generate. ---
  const accountant = await roleContext(browser, authStateFor, "e2eAccountant");
  const accountsResponse = await accountant.context.request.get(
    `${API_BASE_URL}/accounting/accounts`,
  );
  const accounts = (await accountsResponse.json()) as {
    data: Array<{ id: string; code: string }>;
  };
  const cash = accounts.data.find((account) => account.code === "1000");
  const income = accounts.data.find((account) => account.code === "4000");
  expect(cash && income).toBeTruthy();

  const createJournal = await accountant.context.request.post(
    `${API_BASE_URL}/accounting/journals`,
    {
      headers: csrfHeaders(accountant.state),
      data: {
        entryDate: fiscalStartDate,
        narration: `E2E fiscal-year close revenue ${runKey}`,
        lines: [
          { chartAccountId: cash!.id, side: "DEBIT", amount: 5000 },
          { chartAccountId: income!.id, side: "CREDIT", amount: 5000 },
        ],
      },
    },
  );
  expect(createJournal.ok()).toBeTruthy();
  const createdJournal = (await createJournal.json()) as { data: { id: string } };

  const submitJournal = await accountant.context.request.post(
    `${API_BASE_URL}/accounting/journals/${createdJournal.data.id}/submit`,
    { headers: csrfHeaders(accountant.state), data: {} },
  );
  expect(submitJournal.ok()).toBeTruthy();
  await accountant.context.close();

  const approver = await roleContext(browser, authStateFor, "accountingApprover");
  const approveJournal = await approver.context.request.post(
    `${API_BASE_URL}/accounting/journals/${createdJournal.data.id}/approve`,
    { headers: csrfHeaders(approver.state), data: {} },
  );
  expect(approveJournal.ok()).toBeTruthy();
  const postJournal = await approver.context.request.post(
    `${API_BASE_URL}/accounting/journals/${createdJournal.data.id}/post`,
    { headers: csrfHeaders(approver.state), data: {} },
  );
  expect(postJournal.ok()).toBeTruthy();
  await approver.context.close();

  // --- Resolve the OPEN_PERIODS issue: lock then close every period, in
  // order (a period cannot close until its predecessor is closed). ---
  for (const id of periodIds) {
    const lockPeriod = await fiscalController.context.request.post(
      `${API_BASE_URL}/accounting/fiscal-periods/${id}/lock`,
      {
        headers: csrfHeaders(fiscalController.state),
        data: { reason: "E2E fiscal-year close verification lock" },
      },
    );
    expect(lockPeriod.ok()).toBeTruthy();
    const closePeriod = await fiscalController.context.request.post(
      `${API_BASE_URL}/accounting/fiscal-periods/${id}/close`,
      {
        headers: csrfHeaders(fiscalController.state),
        data: { reason: "E2E fiscal-year close verification period close" },
      },
    );
    expect(closePeriod.ok()).toBeTruthy();
  }

  // --- Recompute readiness: the blocking issue is gone, warnings remain informational. ---
  const recomputed = await getReadiness(fiscalController, fiscalYearId);
  expect(recomputed.blockingIssueCount).toBe(0);
  expect(recomputed.readyToClose).toBe(true);
  expect(recomputed.allowedActions).toEqual(["CLOSE"]);

  // --- Close the fiscal year through the real UI, backed by the readiness API. ---
  const page = await fiscalController.context.newPage();
  await page.goto("/dashboard/accounting/fiscal-periods");
  const yearCard = page.getByTestId(`fiscal-year-${fiscalYearId}`);
  await expect(yearCard).toBeVisible();
  await yearCard.getByRole("button", { name: "Close Year" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("No blocking issues. This fiscal year can be closed.")).toBeVisible({
    timeout: 20_000,
  });
  const confirmClose = dialog.getByRole("button", { name: "Confirm Close" });
  await expect(confirmClose).toBeDisabled();
  await dialog
    .getByPlaceholder("Describe why this fiscal year is being closed now...")
    .fill("E2E verified fiscal-year close with backend readiness.");
  await expect(confirmClose).toBeEnabled();
  await confirmClose.click();
  await expect(dialog).not.toBeVisible();
  await expect(yearCard.locator("span.uppercase.tracking-wider")).toHaveText("CLOSED");

  // --- Verify posting is blocked into the now-closed fiscal year. ---
  const accountantAgain = await roleContext(browser, authStateFor, "e2eAccountant");
  const blockedPosting = await accountantAgain.context.request.post(
    `${API_BASE_URL}/accounting/journals`,
    {
      headers: csrfHeaders(accountantAgain.state),
      data: {
        entryDate: fiscalStartDate,
        narration: `Blocked closed-year journal ${runKey}`,
        lines: [
          { chartAccountId: cash!.id, side: "DEBIT", amount: 100 },
          { chartAccountId: income!.id, side: "CREDIT", amount: 100 },
        ],
      },
    },
  );
  expect(blockedPosting.status()).toBe(409);
  await accountantAgain.context.close();

  // --- Existing posted journal remains readable after close. ---
  const readBackResponse = await fiscalController.context.request.get(
    `${API_BASE_URL}/accounting/journals/${createdJournal.data.id}`,
  );
  expect(readBackResponse.ok()).toBeTruthy();

  // --- Cross-tenant access fails closed without leaking tenant data. ---
  const otherTenant = await roleContext(browser, authStateFor, "otherTenant");
  const crossTenantReadiness = await otherTenant.context.request.get(
    `${API_BASE_URL}/accounting/fiscal-years/${fiscalYearId}/close-readiness`,
  );
  expect([403, 404]).toContain(crossTenantReadiness.status());
  const crossTenantBody = await crossTenantReadiness.text();
  expect(crossTenantBody).not.toContain(fiscalYearName);
  expect(crossTenantBody).not.toContain('"tenantId"');
  await otherTenant.context.close();

  // --- Unauthorized school user is denied direct API access. ---
  const unauthorized = await roleContext(browser, authStateFor, "unauthorized");
  const unauthorizedReadiness = await unauthorized.context.request.get(
    `${API_BASE_URL}/accounting/fiscal-years/${fiscalYearId}/close-readiness`,
  );
  expect(unauthorizedReadiness.status()).toBe(403);
  const unauthorizedClose = await unauthorized.context.request.post(
    `${API_BASE_URL}/accounting/fiscal-years/${fiscalYearId}/close-year`,
    {
      headers: csrfHeaders(unauthorized.state),
      data: { reason: "Should never be allowed to close." },
    },
  );
  expect(unauthorizedClose.status()).toBe(403);
  await unauthorized.context.close();

  // --- Read-only roles can inspect readiness but see no mutating controls. ---
  for (const readOnlyRole of ["principalReadOnly", "auditorReadOnly"] as const) {
    const readOnly = await roleContext(browser, authStateFor, readOnlyRole);
    const readOnlyReadiness = await readOnly.context.request.get(
      `${API_BASE_URL}/accounting/fiscal-years/${fiscalYearId}/close-readiness`,
    );
    expect(readOnlyReadiness.ok()).toBeTruthy();

    const readOnlyPage = await readOnly.context.newPage();
    await readOnlyPage.goto("/dashboard/accounting/fiscal-periods");
    const readOnlyCard = readOnlyPage.getByTestId(`fiscal-year-${fiscalYearId}`);
    await expect(readOnlyCard).toBeVisible();
    await expect(readOnlyCard.getByRole("button", { name: "Close Year" })).toHaveCount(0);
    await expect(readOnlyCard.getByRole("button", { name: "Reopen" })).toHaveCount(0);
    await readOnly.context.close();
  }

  // --- Reopen requires the separate reopen permission and an audited reason. ---
  await page.reload();
  await expect(yearCard.locator("span.uppercase.tracking-wider")).toHaveText("CLOSED");
  await yearCard.getByRole("button", { name: "Reopen", exact: true }).click();
  const reopenDialog = page.getByRole("dialog");
  const confirmReopen = reopenDialog.getByRole("button", { name: "Confirm Reopen" });
  await expect(confirmReopen).toBeDisabled();
  await reopenDialog
    .getByPlaceholder("Describe why this fiscal year needs to be reopened...")
    .fill("E2E authorized correction requires fiscal-year reopen.");
  await expect(confirmReopen).toBeEnabled();
  await confirmReopen.click();
  await expect(reopenDialog).not.toBeVisible();
  await expect(yearCard.locator("span.uppercase.tracking-wider")).toHaveText("OPEN");

  await fiscalController.context.close();
});

async function getReadiness(
  actor: { context: { request: { get: (url: string) => Promise<{ json: () => Promise<unknown> }> } } },
  fiscalYearId: string,
) {
  const response = await actor.context.request.get(
    `${API_BASE_URL}/accounting/fiscal-years/${fiscalYearId}/close-readiness`,
  );
  const body = (await response.json()) as {
    data: {
      readyToClose: boolean;
      readinessStatus: string;
      blockingIssueCount: number;
      allowedActions: string[];
      issues: Array<{ code: string; severity: string }>;
    };
  };
  return body.data;
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
