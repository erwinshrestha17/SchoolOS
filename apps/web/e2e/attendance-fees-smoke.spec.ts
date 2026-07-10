import { expect, test, type Page } from "@playwright/test";

const credentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG,
  email: process.env.SCHOOLOS_E2E_EMAIL,
  password: process.env.SCHOOLOS_E2E_PASSWORD,
};

test.describe("Attendance & Fees Workflow Smoke", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !credentials.tenantSlug || !credentials.email || !credentials.password,
      "Set E2E credentials to run attendance/fees smoke tests.",
    );
    await login(page);
  });

  test("attendance page loads and class selector renders", async ({ page }) => {
    await page.goto("/dashboard/attendance");
    await expect(
      page.getByRole("heading", { name: /Smart Attendance/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/Class/i)).toBeVisible();
    await expect(page.getByLabel(/Date/i)).toBeVisible();
  });

  test("attendance register page loads and displays filters", async ({
    page,
  }) => {
    await page.goto("/dashboard/attendance/register");
    await expect(
      page.getByRole("heading", { name: /Attendance Register/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/Academic Year/i)).toBeVisible();
    await expect(page.getByLabel(/Month/i)).toBeVisible();
  });

  test("canonical fees overview and collection workspace load", async ({
    page,
  }) => {
    await page.goto("/dashboard/fees");
    await expect(
      page.getByRole("heading", { name: /Fees & Receipts/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: /Fees and receipts navigation/i }),
    ).toBeVisible();

    await page.getByRole("link", { name: /^Collect$/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/fees\/collect/);
    await expect(
      page.getByRole("heading", { name: /Collect payment/i }),
    ).toBeVisible();
    const studentSearch = page.getByPlaceholder(
      /student ID, invoice number or guardian phone/i,
    );
    await expect(studentSearch).toBeVisible();
    await studentSearch.fill("Aayush");
    await page
      .getByRole("button", { name: /Aayush/i })
      .first()
      .click();
    await expect(
      page.getByText(/Outstanding invoices for this student only/i),
    ).toBeVisible();
  });

  test("legacy finance route redirects to canonical fees", async ({ page }) => {
    await page.goto("/dashboard/finance");
    await expect(page).toHaveURL(/\/dashboard\/fees(?:$|[?#])/);
    await expect(
      page.getByRole("heading", { name: /Fees & Receipts/i }),
    ).toBeVisible();
  });

  test("fees route navigation preserves one primary job per screen", async ({
    page,
  }) => {
    await page.goto("/dashboard/fees");
    await page.getByRole("link", { name: /^Receipts$/i }).click();
    await expect(
      page.getByRole("heading", { name: /Receipt center/i }),
    ).toBeVisible();

    await page.getByRole("link", { name: /Cashier Close/i }).click();
    await expect(
      page.getByRole("heading", { name: "Cashier close", exact: true }),
    ).toBeVisible();
  });

  test("student ledger search and backend pagination render from the canonical route", async ({
    page,
  }) => {
    await page.goto("/dashboard/fees/ledgers");
    await expect(
      page.getByRole("heading", { name: /Student ledgers/i }),
    ).toBeVisible();

    const search = page.getByPlaceholder(
      /Search student name, student ID or invoice number/i,
    );
    await search.fill("Aayush");
    await page
      .getByRole("button", { name: /Aayush/i })
      .first()
      .click();

    await expect(page.getByText(/Ledger activity/i)).toBeVisible();
    await expect(page.getByLabel(/Transaction type/i)).toBeVisible();
    await expect(page.getByText(/matching entr/i)).toBeVisible();
  });

  test("report catalog switches to backend payment-method totals", async ({
    page,
  }) => {
    await page.goto("/dashboard/fees/reports?report=payment-methods");
    await expect(
      page.getByRole("heading", { name: /Fees reports/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/Report catalog/i)).toHaveValue(
      "payment-methods",
    );
    await expect(
      page.getByRole("heading", { name: /Payment methods/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: /Net/i }),
    ).toBeVisible();
  });
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/School Code/i).fill(credentials.tenantSlug ?? "");
  await page.getByLabel(/Email/i).fill(credentials.email ?? "");
  await page.getByLabel(/Password/i).fill(credentials.password ?? "");
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL("**/dashboard*", { timeout: 20_000 });
}
