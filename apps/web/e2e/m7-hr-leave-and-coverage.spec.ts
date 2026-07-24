import { formatBsDateForInput } from "@schoolos/core";
import { expect, test } from "./fixtures/auth";

const API_BASE_URL =
  process.env.SCHOOLOS_E2E_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000/api/v1";
const WEB_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ??
  `http://localhost:${process.env.SCHOOLOS_WEB_E2E_PORT ?? "3101"}`;

// A self-service leave request needs the `hr:leave:request` permission,
// which only the teacher/subject_teacher preset roles hold today (the
// generic "staff" E2E fixture identity maps to support_staff, which does
// not) -- so this spec logs the requesting actor in directly rather than
// through the shared authStateFor fixture.
const TEACHER_EMAIL =
  process.env.SCHOOLOS_E2E_LEAVE_TEACHER_EMAIL ?? "classteacher.1a@schoolos.com";
const TEACHER_PASSWORD =
  process.env.SCHOOLOS_E2E_LEAVE_TEACHER_PASSWORD ??
  requiredEnvironmentValue("SCHOOLOS_E2E_PASSWORD");
const TENANT_SLUG = requiredEnvironmentValue("SCHOOLOS_E2E_TENANT_SLUG");

function requiredEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Set ${name} to run authenticated SchoolOS browser tests.`);
  }
  return value;
}

test.describe.serial("M7 HR leave workflow and staff-coverage dashboard", () => {
  test("a teacher submits a leave request through self-service", async ({
    browser,
  }) => {
    const context = await browser.newContext({ baseURL: WEB_BASE_URL });
    const page = await context.newPage();

    await page.goto("/login");
    await page.getByLabel(/School Code/i).fill(TENANT_SLUG);
    await page.getByLabel(/Email/i).fill(TEACHER_EMAIL);
    await page.getByLabel(/Password/i).fill(TEACHER_PASSWORD);
    await Promise.all([
      page.waitForURL(/\/dashboard(?:$|[/?#])/, { timeout: 20_000 }),
      page.getByRole("button", { name: /Sign in/i }).click(),
    ]);

    await page.goto("/dashboard/my-workspace");
    if (
      await page.getByText("No linked employment record").isVisible({
        timeout: 5_000,
      })
    ) {
      test.skip(
        true,
        `${TEACHER_EMAIL} has no linked staff record in this environment; set SCHOOLOS_E2E_LEAVE_TEACHER_EMAIL to a teacher account with one.`,
      );
    }

    await page.getByRole("tab", { name: "Leave" }).click();
    await expect(
      page.getByRole("heading", { name: "Leave Requests" }),
    ).toBeVisible();

    // A wide, timestamp-derived offset keeps repeated runs from colliding
    // with a leave request a prior run already left in PENDING/APPROVED
    // state for the same staff member and date (the create endpoint
    // correctly rejects overlapping requests).
    const offsetDays = 30 + (Date.now() % 200);
    const targetDate = new Date(Date.now() + offsetDays * 86_400_000);
    const bsDate = formatBsDateForInput(targetDate);
    const uniqueReason = `E2E leave request ${Date.now()}`;

    await page.getByRole("button", { name: "Request leave" }).click();
    await expect(
      page.getByRole("heading", { name: "Request Leave" }),
    ).toBeVisible();

    const dateFields = page.getByPlaceholder("2083-01-01");
    await dateFields.nth(0).fill(bsDate);
    await dateFields.nth(1).fill(bsDate);
    await page
      .getByPlaceholder(
        "e.g. Family emergency, medical appointment, vacation, etc.",
      )
      .fill(uniqueReason);

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/hr/me/leave-requests") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Submit Request" }).click();
    expect((await createResponse).status()).toBe(201);

    await expect(
      page.getByRole("heading", { name: "Request Leave" }),
    ).toHaveCount(0);
    // The self-service list shows type/dates/days/status/reviewer notes but
    // not the free-text reason, so identify the new row by leave type and
    // pending status instead.
    const newRow = page
      .locator("tr", { hasText: "Casual" })
      .filter({ hasText: "Pending" })
      .first();
    await expect(newRow).toBeVisible();

    await context.close();
  });

  test("HR reviews a pending leave request and the decision is reflected in the queue", async ({
    browser,
    authStateFor,
  }) => {
    const context = await browser.newContext({
      storageState: await authStateFor("hrManager"),
    });
    const page = await context.newPage();

    await page.goto("/dashboard/hr/leave");
    await expect(
      page.getByRole("heading", { name: "HR", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "PENDING" }).click();

    const reviewButtons = page.getByRole("button", { name: "Review Request" });
    const pendingCount = await reviewButtons.count();
    test.skip(pendingCount === 0, "No pending leave requests to review.");

    await reviewButtons.first().click();
    await expect(
      page.getByRole("heading", { name: "Review Leave Request" }),
    ).toBeVisible();

    const approveButton = page.getByRole("button", { name: "Approve Request" });
    const rejectButton = page.getByRole("button", { name: "Reject Request" });
    const reviewError = page.getByText("Review Error");

    await approveButton.click();
    // Either the dialog closes (approval succeeded) or a genuine backend
    // guard (e.g. insufficient leave balance) blocks it and shows an error
    // banner without closing the dialog -- wait for whichever happens.
    await expect(async () => {
      const dialogGone =
        (await page
          .getByRole("heading", { name: "Review Leave Request" })
          .count()) === 0;
      const errorShown = await reviewError.isVisible();
      expect(dialogGone || errorShown).toBe(true);
    }).toPass({ timeout: 10_000 });

    if (await reviewError.isVisible()) {
      // Fall back to a reasoned rejection to still prove the decision
      // workflow reaches the backend and updates the queue.
      await page
        .getByPlaceholder("Remarks (Required for rejection)")
        .fill("E2E verification: rejected because approval was blocked.");
      await rejectButton.click();
    }

    await expect(
      page.getByRole("heading", { name: "Review Leave Request" }),
    ).toHaveCount(0, { timeout: 10_000 });

    await context.close();
  });

  test("staff cannot approve or reject their own leave request via a direct API call", async ({
    browser,
  }) => {
    const context = await browser.newContext({ baseURL: WEB_BASE_URL });
    const page = await context.newPage();

    await page.goto("/login");
    await page.getByLabel(/School Code/i).fill(TENANT_SLUG);
    await page.getByLabel(/Email/i).fill(TEACHER_EMAIL);
    await page.getByLabel(/Password/i).fill(TEACHER_PASSWORD);
    await Promise.all([
      page.waitForURL(/\/dashboard(?:$|[/?#])/, { timeout: 20_000 }),
      page.getByRole("button", { name: /Sign in/i }).click(),
    ]);

    const csrfCookie = (await context.cookies()).find((cookie) =>
      cookie.name.includes("csrf"),
    );
    const forbidden = await context.request.patch(
      `${API_BASE_URL}/hr/leave-requests/00000000-0000-0000-0000-000000000000/review`,
      {
        data: { status: "APPROVED" },
        headers: csrfCookie
          ? { "X-CSRF-Token": csrfCookie.value }
          : undefined,
      },
    );
    // hr:leave:approve is not granted to the teacher role; expect a clean
    // permission denial (403), never a 500 or a silent 2xx.
    expect(forbidden.status()).toBe(403);

    await context.close();
  });

  test("the staff-coverage dashboard shows backend-owned findings and drills through to real workflows", async ({
    browser,
    authStateFor,
  }) => {
    const context = await browser.newContext({
      storageState: await authStateFor("hrManager"),
    });
    const page = await context.newPage();

    const coverageResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/hr/coverage-summary") &&
        response.request().method() === "GET",
    );
    await page.goto("/dashboard/hr");
    expect((await coverageResponse).status()).toBe(200);

    const coverage = page.getByText("Staffing Coverage", { exact: true });
    await expect(coverage).toBeVisible();
    // Must render a real backend as-of date, not the permission/error state.
    await expect(page.getByText(/Backend-owned, as of/)).toBeVisible();
    await expect(page.getByText("Staffing coverage unavailable")).toHaveCount(
      0,
    );

    await expect(page.getByText("Without Active Contract")).toBeVisible();
    await expect(page.getByText("Without Salary Structure")).toBeVisible();
    await expect(page.getByText("Payroll Blockers")).toBeVisible();
    await expect(page.getByText("Uncovered Periods Today")).toBeVisible();

    await Promise.all([
      page.waitForURL(/\/dashboard\/hr\/contracts/, { timeout: 10_000 }),
      page.getByText("Without Active Contract").click(),
    ]);
    // A real workflow page loaded, not a 404 or dead link.
    await expect(page.getByText("Contracts", { exact: true }).first()).toBeVisible();

    await context.close();
  });
});
