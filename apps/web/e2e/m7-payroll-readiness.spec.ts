import { expect, test } from "./fixtures/auth";

test.describe.serial("M7 payroll readiness and exception workflow", () => {
  test("renders backend readiness, acknowledges a warning, and keeps source links actionable", async ({
    browser,
    authStateFor,
  }) => {
    const context = await browser.newContext({
      storageState: await authStateFor("payrollReviewer"),
    });
    const page = await context.newPage();
    const exceptionResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/payroll/exceptions") &&
        response.request().method() === "GET",
    );

    await page.goto("/dashboard/payroll/readiness");
    expect((await exceptionResponse).status()).toBe(200);
    await expect(
      page.getByRole("heading", {
        name: "Payroll readiness and exceptions",
      }),
    ).toBeVisible();
    await expect(page.getByText("Backend-owned readiness")).toBeVisible();
    await expect(page.getByText("Exception queue and history")).toBeVisible();

    await page.getByLabel("Month").selectOption("9");
    await page.getByRole("button", { name: "Apply period" }).click();
    await page.getByLabel("Severity").selectOption("WARNING");

    const firstOpenWarning = page
      .locator("article")
      .filter({ hasText: "WARNING" })
      .filter({ hasText: "OPEN" })
      .first();
    await expect(firstOpenWarning).toBeVisible({ timeout: 20_000 });
    await expect(
      firstOpenWarning.getByRole("link", { name: "Resolve at source" }),
    ).toHaveAttribute("href", /\/dashboard\//);

    await firstOpenWarning
      .getByRole("button", { name: "Acknowledge warning" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Acknowledge payroll warning" }),
    ).toBeVisible();
    await page
      .getByLabel("Acknowledgement reason")
      .fill("Reviewed for local readiness workflow verification.");
    const acknowledgeResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/payroll/exceptions/") &&
        response.url().endsWith("/acknowledge") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Confirm acknowledgement" }).click();
    expect((await acknowledgeResponse).status()).toBe(201);
    await expect(
      page.getByRole("heading", { name: "Acknowledge payroll warning" }),
    ).toHaveCount(0);
    await page.getByLabel("Status").selectOption("ACKNOWLEDGED");
    await expect(
      page.locator("article").filter({ hasText: "ACKNOWLEDGED" }).first(),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByText("Exception queue and history")).toBeVisible();
    await page.getByLabel("Month").selectOption("9");
    await page.getByRole("button", { name: "Apply period" }).click();
    await page.getByLabel("Severity").selectOption("WARNING");
    await page.getByLabel("Status").selectOption("ACKNOWLEDGED");
    await expect(
      page.locator("article").filter({ hasText: "ACKNOWLEDGED" }).first(),
    ).toBeVisible();
    await context.close();
  });

  test("shows a safe unavailable state to a school user without payroll access", async ({
    browser,
    authStateFor,
  }) => {
    const context = await browser.newContext({
      storageState: await authStateFor("unauthorized"),
    });
    const page = await context.newPage();
    await page.goto("/dashboard/payroll/readiness");
    await expect(
      page.getByRole("heading", { name: "Payroll access is restricted" }),
    ).toBeVisible();
    await expect(page.getByText(/Prisma|database|stack trace/i)).toHaveCount(0);
    await context.close();
  });
});
