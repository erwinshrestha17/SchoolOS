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

  test("attendance page loads and shows daily class summary", async ({
    page,
  }) => {
    await page.goto("/dashboard/attendance");
    await expect(
      page.getByRole("heading", { name: /Smart Attendance/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Mark Attendance/i }),
    ).toBeVisible();
    await expect(page.getByText("Classes marked", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Classes not marked", { exact: true }),
    ).toBeVisible();
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
      page.getByRole("tablist", { name: /Fees and receipts navigation/i }),
    ).toBeVisible();

    await page.getByRole("tab", { name: /^Collect$/i }).click();
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
    await page.getByRole("tab", { name: /^Receipts$/i }).click();
    await expect(
      page.getByRole("heading", { name: /Receipt center/i }),
    ).toBeVisible();

    await page.getByRole("tab", { name: /Cashier Close/i }).click();
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

async function login(page: Page, overrides?: Partial<typeof credentials>) {
  const resolved = { ...credentials, ...overrides };
  await page.goto("/login");
  await page.getByLabel(/School Code/i).fill(resolved.tenantSlug ?? "");
  await page.getByLabel(/Email/i).fill(resolved.email ?? "");
  await page.getByLabel(/Password/i).fill(resolved.password ?? "");
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL("**/dashboard*", { timeout: 20_000 });
}

const m2TeacherCredentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG,
  email: process.env.SCHOOLOS_E2E_M2_TEACHER_EMAIL,
  password: process.env.SCHOOLOS_E2E_M2_TEACHER_PASSWORD,
};
const m2OfflineMutationsEnabled =
  process.env.SCHOOLOS_E2E_M2_OFFLINE_MUTATIONS === "true";

test.describe("Attendance Offline Draft & Reconnect Smoke", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !m2OfflineMutationsEnabled ||
        !m2TeacherCredentials.tenantSlug ||
        !m2TeacherCredentials.email ||
        !m2TeacherCredentials.password,
      "Set SCHOOLOS_E2E_M2_OFFLINE_MUTATIONS=true, SCHOOLOS_E2E_TENANT_SLUG, SCHOOLOS_E2E_M2_TEACHER_EMAIL, and SCHOOLOS_E2E_M2_TEACHER_PASSWORD for a class teacher with an assigned section to run the M2 offline attendance smoke.",
    );
    await login(page, m2TeacherCredentials);
  });

  test("saves an attendance draft while offline and replays it automatically on reconnect", async ({
    page,
    context,
  }) => {
    await page.goto("/dashboard/attendance/mark");
    await expect(
      page.getByRole("heading", { name: "Daily Attendance Marking" }),
    ).toBeVisible();

    const absentButtons = page.getByRole("button", { name: /Absent/i });
    await expect(absentButtons.first()).toBeVisible();

    await context.setOffline(true);
    try {
      await absentButtons.first().click();

      await expect(
        page.getByText(/Not synced\. Draft saved locally/i),
      ).toBeVisible();

      // Genuinely offline: nothing was sent to the server yet.
      await expect(page.getByText(/Draft synced with SchoolOS/i)).toHaveCount(
        0,
      );
    } finally {
      await context.setOffline(false);
    }

    // The browser's "online" event auto-triggers a server draft save.
    await expect(
      page.getByText(/Draft synced with SchoolOS/i),
    ).toBeVisible({ timeout: 15_000 });
  });
});

const m3AccountantCredentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG,
  email: process.env.SCHOOLOS_E2E_M3_ACCOUNTANT_EMAIL,
  password: process.env.SCHOOLOS_E2E_M3_ACCOUNTANT_PASSWORD,
};
const m3CollectionMutationsEnabled =
  process.env.SCHOOLOS_E2E_M3_COLLECTION_MUTATIONS === "true";
// Matches apps/api/prisma/seed-m3-collection-e2e.ts's fixed IDs; used only to
// verify persisted balances via the real API, never to derive UI truth.
const M3_COLLECTION_INVOICE_ID = "c2f4a8e1-3b6d-4f2a-9e1c-7d5b6a2f9c02";
const m3ApiBaseUrl =
  process.env.SCHOOLOS_E2E_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000/api/v1";

test.describe("Fees Collection Offline-Ledger Smoke", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !m3CollectionMutationsEnabled ||
        !m3AccountantCredentials.tenantSlug ||
        !m3AccountantCredentials.email ||
        !m3AccountantCredentials.password,
      "Set SCHOOLOS_E2E_M3_COLLECTION_MUTATIONS=true, SCHOOLOS_E2E_TENANT_SLUG, SCHOOLOS_E2E_M3_ACCOUNTANT_EMAIL, and SCHOOLOS_E2E_M3_ACCOUNTANT_PASSWORD for a seeded accountant to run the M3 collection smoke.",
    );
    await login(page, m3AccountantCredentials);
  });

  test("collects a partial payment then completes it, with backend-owned balances at each step", async ({
    page,
  }) => {
    await page.goto("/dashboard/fees/collect");
    await expect(
      page.getByRole("heading", { name: "Collect payment" }),
    ).toBeVisible();

    const search = page.getByPlaceholder(
      /student ID, invoice number or guardian phone/i,
    );
    await search.fill("Sanjana Collection E2E");
    await page
      .getByRole("button", { name: /Sanjana Collection E2E/i })
      .first()
      .click();
    await expect(
      page.getByText(/Outstanding invoices for this student only/i),
    ).toBeVisible();

    // Exactly one outstanding invoice on this dedicated fixture, so it
    // auto-selects and the payment form renders without a manual click.
    const amountInput = page.getByLabel("Collection amount in NPR");
    await expect(amountInput).toBeVisible();

    await amountInput.fill("600");
    await page.getByRole("button", { name: "Cash" }).click();
    await page.getByRole("button", { name: "Review payment" }).click();
    await page
      .getByRole("button", { name: "Confirm and issue receipt" })
      .click();
    await expect(page.getByText(/Payment collected/i)).toBeVisible();
    await expect(page.getByText(/CASH/)).toBeVisible();

    const afterPartial = await page.request.get(
      `${m3ApiBaseUrl}/fees/invoices/${M3_COLLECTION_INVOICE_ID}`,
    );
    expect(afterPartial.ok()).toBe(true);
    const partialDetail = unwrapFeesApiData<{
      status: string;
      paidAmount: number;
      outstandingAmount: number;
    }>(await afterPartial.json());
    expect(partialDetail.status).toBe("PARTIAL");
    expect(partialDetail.paidAmount).toBe(600);
    expect(partialDetail.outstandingAmount).toBe(400);

    // Fresh page load: the invoice-detail query isn't invalidated by the
    // first payment, and the selected student/invoice persists in the URL,
    // so reload lands back in the same context with a freshly fetched
    // (not client-cached) balance.
    await page.reload();
    await expect(amountInput).toBeVisible({ timeout: 15_000 });

    await amountInput.fill("400");
    await page.getByRole("button", { name: "Bank" }).click();
    await page.getByRole("button", { name: "Review payment" }).click();
    await page
      .getByRole("button", { name: "Confirm and issue receipt" })
      .click();
    await expect(page.getByText(/Payment collected/i)).toBeVisible();
    await expect(page.getByText(/BANK/)).toBeVisible();

    const afterFull = await page.request.get(
      `${m3ApiBaseUrl}/fees/invoices/${M3_COLLECTION_INVOICE_ID}`,
    );
    expect(afterFull.ok()).toBe(true);
    const fullDetail = unwrapFeesApiData<{
      status: string;
      paidAmount: number;
      outstandingAmount: number;
    }>(await afterFull.json());
    expect(fullDetail.status).toBe("PAID");
    expect(fullDetail.paidAmount).toBe(1000);
    expect(fullDetail.outstandingAmount).toBe(0);
  });
});

function unwrapFeesApiData<T>(payload: unknown): T {
  if (typeof payload === "object" && payload !== null && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}
