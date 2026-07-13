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
const WEB_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ??
  `http://localhost:${process.env.SCHOOLOS_WEB_E2E_PORT ?? "3101"}`;

test.describe.serial("M7/M11 role and tenant boundaries", () => {
  test("separates payroll preparation, review, approval, and posting permissions", async ({
    authStateFor,
    browser,
  }) => {
    const runId = await firstPayrollRunId(authStateFor, browser);
    const cases: Array<{
      role: SchoolE2eRole;
      forbiddenAction: string;
    }> = [
      { role: "payrollOfficer", forbiddenAction: "approve" },
      { role: "payrollReviewer", forbiddenAction: "approve" },
      { role: "payrollApprover", forbiddenAction: "review" },
      { role: "payrollPoster", forbiddenAction: "approve" },
    ];

    for (const roleCase of cases) {
      const state = await authStateFor(roleCase.role);
      const context = await browser.newContext({ storageState: state });
      const list = await context.request.get(`${API_BASE_URL}/payroll/runs`);
      expect(list.ok(), `${roleCase.role} can read payroll runs`).toBeTruthy();
      const forbidden = await context.request.post(
        `${API_BASE_URL}/payroll/runs/${runId}/${roleCase.forbiddenAction}`,
        {
          data: { reason: "E2E permission boundary verification" },
          headers: csrfHeaders(state),
        },
      );
      expect(
        forbidden.status(),
        `${roleCase.role} cannot invoke ${roleCase.forbiddenAction}`,
      ).toBe(403);
      await context.close();
    }
  });

  test("separates accounting preparation, review, and approval permissions", async ({
    authStateFor,
    browser,
  }) => {
    const journalId = await firstJournalId(authStateFor, browser);
    const cases: Array<{
      role: SchoolE2eRole;
      forbiddenAction: string;
    }> = [
      { role: "e2eAccountant", forbiddenAction: "approve" },
      { role: "accountingReviewer", forbiddenAction: "approve" },
      { role: "accountingApprover", forbiddenAction: "submit" },
    ];

    for (const roleCase of cases) {
      const state = await authStateFor(roleCase.role);
      const context = await browser.newContext({ storageState: state });
      const list = await context.request.get(
        `${API_BASE_URL}/accounting/journals`,
      );
      expect(list.ok(), `${roleCase.role} can read journals`).toBeTruthy();
      const forbidden = await context.request.post(
        `${API_BASE_URL}/accounting/journals/${journalId}/${roleCase.forbiddenAction}`,
        {
          data: { reason: "E2E permission boundary verification" },
          headers: csrfHeaders(state),
        },
      );
      expect(
        forbidden.status(),
        `${roleCase.role} cannot invoke ${roleCase.forbiddenAction}`,
      ).toBe(403);
      await context.close();
    }
  });

  test("keeps read-only, self-service, and unauthorized identities within scope", async ({
    authStateFor,
    browser,
  }) => {
    for (const role of ["principalReadOnly", "auditorReadOnly"] as const) {
      const context = await browser.newContext({
        storageState: await authStateFor(role),
      });
      expect(
        (await context.request.get(`${API_BASE_URL}/payroll/runs`)).ok(),
      ).toBeTruthy();
      expect(
        (await context.request.get(`${API_BASE_URL}/accounting/journals`)).ok(),
      ).toBeTruthy();
      expect(
        (
          await context.request.post(`${API_BASE_URL}/accounting/journals`, {
            data: {},
          })
        ).status(),
      ).toBe(403);
      await context.close();
    }

    const staffContext = await browser.newContext({
      storageState: await authStateFor("staffSelfService"),
    });
    expect(
      (
        await staffContext.request.get(`${API_BASE_URL}/payroll/me/payslips`)
      ).ok(),
    ).toBeTruthy();
    expect(
      (
        await staffContext.request.get(`${API_BASE_URL}/payroll/payslips`)
      ).status(),
    ).toBe(403);
    await staffContext.close();

    const unauthorizedContext = await browser.newContext({
      storageState: await authStateFor("unauthorized"),
    });
    expect(
      (
        await unauthorizedContext.request.get(`${API_BASE_URL}/payroll/runs`)
      ).status(),
    ).toBe(403);
    expect(
      (
        await unauthorizedContext.request.get(
          `${API_BASE_URL}/accounting/journals`,
        )
      ).status(),
    ).toBe(403);
    await unauthorizedContext.close();
  });

  test("fails closed for cross-tenant payroll and accounting identifiers", async ({
    authStateFor,
    browser,
  }) => {
    const runId = await firstPayrollRunId(authStateFor, browser);
    const journalId = await firstJournalId(authStateFor, browser);
    const context = await browser.newContext({
      storageState: await authStateFor("otherTenant"),
    });

    for (const path of [
      `payroll/runs/${runId}`,
      `accounting/journals/${journalId}`,
    ]) {
      const response = await context.request.get(`${API_BASE_URL}/${path}`);
      expect([403, 404]).toContain(response.status());
      expect(await response.text()).not.toContain("tenantId");
    }
    await context.close();
  });

  test("denies a suspended tenant before opening a school workspace", async ({
    browser,
  }) => {
    const password = requiredEnvironmentValue("SCHOOLOS_E2E_PASSWORD");
    const context = await browser.newContext({ baseURL: WEB_BASE_URL });
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel(/School Code/i).fill("e2e-suspended-school");
    await page.getByLabel(/Email/i).fill("e2e.suspended-tenant@schoolos.test");
    await page.getByLabel(/Password/i).fill(password);
    await page.getByRole("button", { name: /Sign in/i }).click();

    await expect(page).toHaveURL(/\/login/);
    // Authentication deliberately does not disclose whether the tenant or the
    // credentials caused the denial.
    await expect(page.getByText(/Invalid tenant or credentials/i)).toBeVisible();
    await expect(page).not.toHaveURL(/\/dashboard/);
    await context.close();
  });
});

async function firstPayrollRunId(
  authStateFor: (role: SchoolE2eRole) => Promise<StorageState>,
  browser: Browser,
) {
  const context = await browser.newContext({
    storageState: await authStateFor("schoolAdmin"),
  });
  const response = await context.request.get(`${API_BASE_URL}/payroll/runs`);
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  const items = payload.data?.items ?? payload.data ?? [];
  expect(items.length).toBeGreaterThan(0);
  await context.close();
  return items[0].id as string;
}

async function firstJournalId(
  authStateFor: (role: SchoolE2eRole) => Promise<StorageState>,
  browser: Browser,
) {
  const context = await browser.newContext({
    storageState: await authStateFor("schoolAdmin"),
  });
  const response = await context.request.get(
    `${API_BASE_URL}/accounting/journals`,
  );
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  const items = payload.data?.items ?? payload.data ?? [];
  expect(items.length).toBeGreaterThan(0);
  await context.close();
  return items[0].id as string;
}

function requiredEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(`Set ${name} to run authenticated SchoolOS browser tests.`);
  return value;
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
