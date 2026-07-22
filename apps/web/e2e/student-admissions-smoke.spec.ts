import { expect, test, type Page } from "@playwright/test";

const credentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG,
  email: process.env.SCHOOLOS_E2E_EMAIL,
  password: process.env.SCHOOLOS_E2E_PASSWORD,
};
const qrMutationStudentSearch =
  process.env.SCHOOLOS_E2E_M1_QR_STUDENT_SEARCH?.trim();
const m1MutationsEnabled = process.env.SCHOOLOS_E2E_M1_MUTATIONS === "true";
const m1ReminderFixturesEnabled =
  process.env.SCHOOLOS_E2E_M1_REMINDER_FIXTURES === "true";
const m1WaitlistFixturesEnabled =
  process.env.SCHOOLOS_E2E_M1_WAITLIST_FIXTURES === "true";
const m1BulkImportEnabled = process.env.SCHOOLOS_E2E_M1_BULK_IMPORT === "true";
const apiBaseUrl =
  process.env.SCHOOLOS_E2E_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000/api/v1";

test.describe("Students & Admissions Workflow Smoke", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !credentials.tenantSlug || !credentials.email || !credentials.password,
      "Set E2E credentials to run student/admissions smoke tests.",
    );
    await login(page);
  });

  test("keeps Admissions selected and exposes server-backed queues", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard/admissions");

    await expect(
      page.getByRole("heading", { name: "Admissions", exact: true }),
    ).toBeVisible();
    await expect(sidebarLink(page, "Admissions")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(sidebarLink(page, "Students")).not.toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("tab", { name: "Needs info" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Completed" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "New admission" }).first(),
    ).toBeVisible();

    await expectDesktopSummaryRow(page);
    await expectNoHorizontalTabOverflow(page, "Admission queue views");

    const queueWorkspace = page.getByTestId("admission-queue-workspace");
    await expect(queueWorkspace).toBeVisible();
    const workspaceBox = await queueWorkspace.boundingBox();
    expect(workspaceBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(900);

    const emptyState = queueWorkspace.locator('[data-slot="empty"]');
    if (await emptyState.isVisible()) {
      const emptyBox = await emptyState.boundingBox();
      expect(emptyBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
        420,
      );
    }

    await expectResponsiveWorkspace(
      page,
      "admission-queue-workspace",
      "Admission queue views",
    );

    await page.getByRole("tab", { name: "Review", exact: true }).click();
    await expect(page).toHaveURL(/queue=WAITING_FOR_REVIEW/);
    await page.goBack();
    await expect(page.getByRole("tab", { name: "Needs info" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("keeps Students selected, preserves lifecycle state, and opens the admission workflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard/students");

    await expect(
      page.getByRole("heading", { name: "Students", exact: true }),
    ).toBeVisible();
    await expect(sidebarLink(page, "Students")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(sidebarLink(page, "Admissions")).not.toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      page.getByRole("group", { name: "Directory filters" }),
    ).toBeVisible();
    await expect(page.getByTestId("student-roster-workspace")).toBeVisible();
    await expectDesktopSummaryRow(page);
    await expectNoHorizontalTabOverflow(page, "Student lifecycle views");

    const rosterBox = await page
      .getByTestId("student-roster-workspace")
      .boundingBox();
    expect(rosterBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(900);
    await expectResponsiveWorkspace(
      page,
      "student-roster-workspace",
      "Student lifecycle views",
    );
    await page.getByRole("tab", { name: "Transferred" }).click();
    await expect(page).toHaveURL(/status=TRANSFERRED/);
    await page.reload();
    await expect(
      page.getByRole("tab", { name: "Transferred" }),
    ).toHaveAttribute("aria-selected", "true");

    await page.getByRole("link", { name: "New admission" }).click();
    await expect(page).toHaveURL(/\/dashboard\/admissions\/new/);
    await expect(sidebarLink(page, "Admissions")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("rotates, revokes, and restores a dedicated seeded student QR credential", async ({
    page,
  }) => {
    test.skip(
      !m1MutationsEnabled || !qrMutationStudentSearch,
      "Set SCHOOLOS_E2E_M1_MUTATIONS=true and SCHOOLOS_E2E_M1_QR_STUDENT_SEARCH to run the state-changing M1 QR lifecycle smoke.",
    );

    await page.goto("/dashboard/admissions/qr");
    await expect(
      page.getByRole("heading", { name: "QR / ID Cards", exact: true }),
    ).toBeVisible();

    await page
      .getByRole("textbox", { name: "Search QR card records" })
      .fill(qrMutationStudentSearch ?? "");

    const studentRow = page.getByRole("row").filter({
      has: page.getByText(qrMutationStudentSearch ?? "", { exact: true }),
    });
    await expect(studentRow).toHaveCount(1);
    await studentRow.getByRole("button", { name: "Manage" }).click();
    await expect(
      page.getByRole("heading", { name: "Student Identity QR" }),
    ).toBeVisible();

    await ensureActiveQrCredential(page);

    await page.getByRole("button", { name: "Rotate (Lost Card)" }).click();
    const rotateDialog = page.getByRole("dialog");
    await expect(rotateDialog).toBeVisible();
    await expect(
      rotateDialog.getByRole("heading", {
        name: "Rotate student QR credential?",
      }),
    ).toBeVisible();
    await page
      .locator("#student-qr-rotate-reason")
      .fill("Automated seeded QR rotation verification");
    await page
      .getByRole("button", { name: "Rotate credential", exact: true })
      .click();
    await expect(rotateDialog).toBeHidden();
    await expect(page.getByText("Protected ID card generated")).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(
      page.getByRole("button", { name: "Revoke Access" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Revoke Access" }).click();
    const revokeDialog = page.getByRole("dialog");
    await expect(revokeDialog).toBeVisible();
    await expect(
      revokeDialog.getByRole("heading", {
        name: "Revoke student QR credential?",
      }),
    ).toBeVisible();
    await page
      .locator("#student-qr-revoke-reason")
      .fill("Automated seeded QR revocation verification");
    await page
      .getByRole("button", { name: "Revoke credential", exact: true })
      .click();
    await expect(revokeDialog).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Generate Identity" }),
    ).toBeVisible();

    await ensureActiveQrCredential(page);
    await expect(
      page.getByText("ACTIVE", { exact: true }).last(),
    ).toBeVisible();
  });

  test("checks dedicated seeded admission document reminders with honest delivery state", async ({
    page,
  }) => {
    test.skip(
      !m1MutationsEnabled || !m1ReminderFixturesEnabled,
      "Set SCHOOLOS_E2E_M1_MUTATIONS=true and SCHOOLOS_E2E_M1_REMINDER_FIXTURES=true after seeding the dedicated reminder cases.",
    );

    await page.goto("/dashboard/admissions/documents");
    await expect(
      page.getByRole("heading", { name: "Document Request Center" }),
    ).toBeVisible();

    await expect(
      page.getByText("Mira Adhikari", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Nima Gurung", { exact: true })).toBeVisible();
    await page.getByRole("checkbox", { name: "Select Mira Adhikari" }).check();
    await page.getByRole("checkbox", { name: "Select Nima Gurung" }).check();

    await page.getByRole("button", { name: "Queue reminders" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(
      "1 of 2 selected cases currently have a guardian phone.",
    );
    await dialog
      .getByRole("button", { name: "Queue reminders", exact: true })
      .click();

    const result = page.getByRole("status");
    await expect(result).toContainText("Reminder requests checked");
    await expect(result).toContainText("out of 2 selected");
    await expect(result).toContainText("No guardian phone: 1");
    await expect(result).toContainText(
      /1 (queued|already queued)|Delivery unavailable: 1/,
    );
  });

  test("returns a dedicated seeded waitlist case to review after a live capacity check", async ({
    page,
  }) => {
    test.skip(
      !m1MutationsEnabled || !m1WaitlistFixturesEnabled,
      "Set SCHOOLOS_E2E_M1_MUTATIONS=true and SCHOOLOS_E2E_M1_WAITLIST_FIXTURES=true after seeding the dedicated waitlist case.",
    );

    await page.goto("/dashboard/admissions");
    await page.getByRole("button", { name: "More queues" }).click();
    await page.getByRole("menuitem", { name: "Waitlisted" }).click();
    await expect(page).toHaveURL(/queue=WAITLISTED/);

    const waitlistRow = page.getByRole("row").filter({
      has: page.getByText("Aarushi Karki", { exact: true }),
    });
    await expect(waitlistRow).toHaveCount(1);
    await expect(waitlistRow).toContainText("5 seats available");
    await expect(waitlistRow).toContainText("Class 5");
    await expect(waitlistRow).toContainText("Section Annapurna E2E");

    await waitlistRow.getByRole("button", { name: "Return to review" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Return this applicant to review?");
    await expect(dialog).toContainText("Class 5, Section Annapurna E2E");
    await dialog
      .getByRole("button", { name: "Return to review", exact: true })
      .click();

    await expect(
      page.getByRole("status").filter({
        hasText: "Aarushi Karki was returned to the admission review workflow.",
      }),
    ).toBeVisible();
    await expect(waitlistRow).toHaveCount(0);
  });

  test("validates and creates a tenant-scoped admission from CSV", async ({
    page,
  }) => {
    test.skip(
      !m1MutationsEnabled || !m1BulkImportEnabled,
      "Set SCHOOLOS_E2E_M1_MUTATIONS=true and SCHOOLOS_E2E_M1_BULK_IMPORT=true to run the state-changing M1 admission CSV smoke.",
    );

    const [academicYearsResponse, classesResponse] = await Promise.all([
      page.request.get(`${apiBaseUrl}/academic-years`),
      page.request.get(`${apiBaseUrl}/classes`),
    ]);
    expect(academicYearsResponse.ok()).toBe(true);
    expect(classesResponse.ok()).toBe(true);

    const academicYears = unwrapApiData<
      Array<{ id: string; startsOn: string; isCurrent: boolean }>
    >(await academicYearsResponse.json());
    const classes = unwrapApiData<
      Array<{ id: string; level?: number; name: string }>
    >(await classesResponse.json());
    const academicYear =
      academicYears.find((candidate) => candidate.isCurrent) ??
      academicYears[0];
    const classroom =
      classes.find((candidate) => candidate.level === 5) ?? classes[0];

    if (!academicYear || !classroom) {
      throw new Error(
        "The authenticated E2E tenant requires an academic year and class.",
      );
    }

    const uniqueSuffix = alphabeticSuffix(Date.now());
    const studentName = `Aditi Karki ${uniqueSuffix}`;
    const guardianPhone = `98${String(Date.now()).slice(-8)}`;
    const admissionDate = academicYear.startsOn.slice(0, 10);
    const csvContent = [
      "firstNameEn,lastNameEn,dateOfBirth,gender,admissionDate,academicYearId,classId,guardianFullName,guardianRelation,guardianPhone,confirmNoDisability",
      [
        "Aditi",
        `Karki ${uniqueSuffix}`,
        "2015-05-12",
        "FEMALE",
        admissionDate,
        academicYear.id,
        classroom.id,
        `Maya Karki ${uniqueSuffix}`,
        "mother",
        guardianPhone,
        "true",
      ].join(","),
    ].join("\n");

    await page.goto("/dashboard/admissions/iemis");
    await expect(
      page.getByRole("heading", { name: "iEMIS Readiness", exact: true }),
    ).toBeVisible();

    await page.locator('input[type="file"][accept*="csv"]').setInputFiles({
      name: "m1-bulk-import-e2e.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent),
    });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(
      "Create the validated admission records?",
    );
    await expect(dialog).toContainText("Ready");
    await expect(dialog).toContainText("Need attention");
    await expect(dialog.getByText("1", { exact: true })).toHaveCount(2);
    await expect(dialog.getByText("0", { exact: true })).toHaveCount(1);
    await dialog
      .getByRole("button", { name: "Create 1 admission", exact: true })
      .click();

    await expect(page.getByRole("status")).toContainText("Import processed");
    await expect(page.getByRole("status")).toContainText(
      "1 created, 0 failed, 0 validated.",
    );

    await page.goto("/dashboard/students");
    await page
      .getByRole("textbox", {
        name: "Search students by name, student code, guardian name, or phone",
      })
      .fill(studentName);
    const roster = page.getByTestId("student-roster-workspace");
    await expect(roster.getByText(studentName, { exact: true })).toHaveCount(1);
    await expect(roster).toContainText(classroom.name);
  });
});

function unwrapApiData<T>(payload: unknown): T {
  if (typeof payload === "object" && payload !== null && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function alphabeticSuffix(value: number) {
  let remaining = value;
  let result = "";
  while (remaining > 0) {
    result = String.fromCharCode(97 + (remaining % 26)) + result;
    remaining = Math.floor(remaining / 26);
  }
  return result || "a";
}

async function ensureActiveQrCredential(page: Page) {
  const generateButton = page.getByRole("button", {
    name: "Generate Identity",
  });
  if (await generateButton.isVisible()) {
    await generateButton.click();
    await expect(page.getByText("Protected ID card generated")).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();
  }

  await expect(
    page.getByRole("button", { name: "Rotate (Lost Card)" }),
  ).toBeVisible();
}

async function expectDesktopSummaryRow(page: Page) {
  const cards = page
    .locator('[data-schoolos-ui="summary-grid"]')
    .first()
    .locator(":scope > a");
  await expect(cards).toHaveCount(4);
  const first = await cards.nth(0).boundingBox();
  const last = await cards.nth(3).boundingBox();
  expect(Math.abs((first?.y ?? 0) - (last?.y ?? 0))).toBeLessThanOrEqual(2);
}

async function expectNoHorizontalTabOverflow(page: Page, name: string) {
  const tabs = page.getByRole("tablist", { name });
  const dimensions = await tabs.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(
    dimensions.clientWidth + 1,
  );
}

async function expectResponsiveWorkspace(
  page: Page,
  workspaceTestId: string,
  tabListName: string,
) {
  for (const width of [1280, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByTestId(workspaceTestId)).toBeVisible();
    await expectNoHorizontalTabOverflow(page, tabListName);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId(workspaceTestId)).toBeVisible();
  await expect(page.getByRole("tablist", { name: tabListName })).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 900 });
}

function sidebarLink(page: Page, name: string) {
  return page
    .getByRole("complementary")
    .getByRole("link", { name, exact: true });
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/School Code/i).fill(credentials.tenantSlug ?? "");
  await page.getByLabel(/Email/i).fill(credentials.email ?? "");
  await page.getByLabel(/Password/i).fill(credentials.password ?? "");
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL("**/dashboard*", { timeout: 20_000 });
}
