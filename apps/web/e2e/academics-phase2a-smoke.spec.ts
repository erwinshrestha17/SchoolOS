import { expect, test, type Locator, type Page } from "@playwright/test";

const API_BASE_URL =
  process.env.SCHOOLOS_E2E_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000/api/v1";

const schoolAdminCredentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG ?? "default-school",
  email: process.env.SCHOOLOS_E2E_EMAIL ?? "admin@schoolos.com",
  password:
    process.env.SCHOOLOS_E2E_PASSWORD ?? "schoolos-local-demo-only",
};

test.describe.serial("SchoolOS M4 Academics Admin Flow Smoke Tests", () => {
  test.beforeEach(async ({ context, page }) => {
    // Check if API is available
    try {
      const response = await page.request.get(`${API_BASE_URL}/health`);
      if (!response.ok()) {
        test.skip(true, "API is not healthy");
      }
    } catch {
      test.skip(true, "API is not reachable");
    }

    await context.clearCookies();
    await login(page, schoolAdminCredentials);
  });

  test("Academics Hub: Workflow navigation", async ({ page }) => {
    await page.goto("/dashboard/academics");
    await expect(page).toHaveURL(/\/dashboard\/academics/);
    await expect(
      page.getByRole("heading", { name: "Academics", exact: true }),
    ).toBeVisible();

    // Backend-owned KPI cards replaced the earlier decorative workflow-step
    // cards; verify the real overview surfaces instead of the stale steps.
    const overviewKpis = [
      "Marks Entry Open",
      "Mark Lock Requests",
      "Report Cards Unpublished",
    ];

    for (const kpi of overviewKpis) {
      await expect(page.getByText(kpi, { exact: true })).toBeVisible();
    }
  });

  test("Exam Terms Setup: Navigation and workspace", async ({ page }) => {
    await page.goto("/dashboard/academics/exam-terms");
    await expect(
      page.getByRole("heading", { name: /Exam Terms/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Initialize Exam Term/i }),
    ).toBeVisible();
  });

  test("Assessment Components: Setup workspace", async ({ page }) => {
    await page.goto("/dashboard/academics/assessment-components");
    await expect(
      page.getByRole("heading", { name: /Assessment Components/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Add Assessment Map/i }),
    ).toBeVisible();
  });

  test("Marks Entry: Filter integration", async ({ page }) => {
    await page.goto("/dashboard/academics/marks");
    await expect(
      page.getByRole("heading", { name: /Marks Entry/i }),
    ).toBeVisible();
    await expect(page.getByText(/Select context to begin/i)).toBeVisible();

    await expect(
      page.locator('[data-testid="filter-exam-term"]'),
    ).toBeVisible();
    await expect(page.locator('[data-testid="filter-class"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-subject"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="filter-component"]'),
    ).toBeVisible();
  });

  test("CAS Records: Management workspace", async ({ page }) => {
    await page.goto("/dashboard/academics/cas");
    await expect(
      page.getByRole("heading", { name: /CAS Records/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Continuous Assessment" }),
    ).toBeVisible();
  });

  test("Marks Lock & Review: Request list", async ({ page }) => {
    await page.goto("/dashboard/academics/locks");
    await expect(
      page.getByRole("heading", { name: "Marks Lock", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Security & Locks" }),
    ).toBeVisible();
  });

  test("Report Cards: Batch generation", async ({ page }) => {
    await page.goto("/dashboard/academics/report-cards");
    await expect(
      page.getByRole("heading", { name: /Report Cards/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Start Generation/i }),
    ).toBeVisible();
    const downloadButtons = page.locator(
      '[data-testid="report-card-download-pdf"]',
    );
    if ((await downloadButtons.count()) > 0) {
      await expect(downloadButtons.first()).toBeVisible();
    }
    const correctionButtons = page.locator(
      '[data-testid="report-card-regenerate"]',
    );
    if ((await correctionButtons.count()) > 0) {
      await correctionButtons.first().click();
      await expect(
        page.getByTestId("report-card-correction-panel"),
      ).toBeVisible();
      await expect(
        page.getByTestId("report-card-submit-correction"),
      ).toBeDisabled();
      await page
        .getByTestId("report-card-correction-reason")
        .fill("Corrected teacher remark after review");
      await expect(
        page.getByTestId("report-card-submit-correction"),
      ).toBeEnabled();
    }
    await expect(
      page
        .getByTestId("report-card-history")
        .or(page.getByText(/Select History on a report card/i)),
    ).toBeVisible();
  });

  test("Result Preview: Backend-calculated validation screen", async ({
    page,
  }) => {
    await page.goto("/dashboard/academics/results");
    await expect(
      page.getByRole("heading", { name: /Result Preview/i }),
    ).toBeVisible();
    await expect(page.getByText(/Select class and term/i)).toBeVisible();
    await expect(
      page.getByText(/preview calculated results and validation warnings/i),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Review & Lock/i }),
    ).toBeVisible();
  });

  test("Promotion Readiness: Eligibility check", async ({ page }) => {
    await page.goto("/dashboard/academics/promotion");
    await expect(
      page.getByRole("heading", { name: "Promotion", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Year-End Promotion" }),
    ).toBeVisible();
  });

  test("Result Publishing: Notifications and visibility", async ({ page }) => {
    await page.goto("/dashboard/academics/publishing");
    await expect(
      page.getByRole("heading", { name: /Result Publishing/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/Select an exam term to control result visibility/i),
    ).toBeVisible();
  });
});

const m4TeacherCredentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG,
  email: process.env.SCHOOLOS_E2E_M4_TEACHER_EMAIL,
  password: process.env.SCHOOLOS_E2E_M4_TEACHER_PASSWORD,
};
const m4MarksMutationsEnabled =
  process.env.SCHOOLOS_E2E_M4_MARKS_MUTATIONS === "true";

test.describe("M4 Marks Entry Assigned-Teacher Smoke", () => {
  test.beforeEach(async ({ context, page }) => {
    test.skip(
      !m4MarksMutationsEnabled ||
        !m4TeacherCredentials.tenantSlug ||
        !m4TeacherCredentials.email ||
        !m4TeacherCredentials.password,
      "Set SCHOOLOS_E2E_M4_MARKS_MUTATIONS=true, SCHOOLOS_E2E_TENANT_SLUG, SCHOOLOS_E2E_M4_TEACHER_EMAIL, and SCHOOLOS_E2E_M4_TEACHER_PASSWORD for a class/subject teacher with an unlocked exam term to run the M4 marks-entry smoke.",
    );
    await context.clearCookies();
    await login(
      page,
      m4TeacherCredentials as {
        tenantSlug: string;
        email: string;
        password: string;
      },
    );
  });

  test("CAS entry pickers expose only the teacher's assigned classes and subjects", async ({
    page,
  }) => {
    const assignmentsResponse = await page.request.get(
      `${API_BASE_URL}/teacher-assignments`,
    );
    expect(assignmentsResponse.ok()).toBe(true);
    const assignments = unwrapAcademicsApiData<
      Array<{ classId: string; subjectId: string | null }>
    >(await assignmentsResponse.json());
    const subjectAssignment = assignments.find(
      (assignment) => Boolean(assignment.subjectId),
    );
    expect(subjectAssignment).toBeTruthy();

    await page.goto("/dashboard/academics/cas");
    await expect(
      page.getByRole("heading", { name: /CAS Records/i }),
    ).toBeVisible();

    const classSelect = page.getByTestId("cas-entry-class");
    const visibleClassIds = await optionValues(classSelect);
    expect(visibleClassIds.length).toBeGreaterThan(0);
    const assignedClassIds = new Set(
      assignments.map((assignment) => assignment.classId),
    );
    for (const classId of visibleClassIds) {
      expect(assignedClassIds.has(classId)).toBe(true);
    }

    await classSelect.selectOption(subjectAssignment!.classId);
    const subjectSelect = page.getByTestId("cas-entry-subject");
    const visibleSubjectIds = await optionValues(subjectSelect);
    const expectedSubjectIds = [
      ...new Set(
        assignments
          .filter(
            (assignment) =>
              assignment.classId === subjectAssignment!.classId &&
              assignment.subjectId,
          )
          .map((assignment) => assignment.subjectId as string),
      ),
    ].sort();

    expect(visibleSubjectIds.sort()).toEqual(expectedSubjectIds);
  });

  test("an assigned teacher enters a mark within bounds and it persists through the real API", async ({
    page,
  }) => {
    await page.goto("/dashboard/academics/marks");
    await expect(
      page.getByRole("heading", { name: /Marks Entry/i }),
    ).toBeVisible();

    const classId = await selectFirstAvailableOption(
      page.getByTestId("filter-class"),
    );
    const subjectId = await selectFirstAvailableOption(
      page.getByTestId("filter-subject"),
    );
    const examTermSelect = page.getByTestId("filter-exam-term");
    await expect(examTermSelect).toBeVisible();
    const componentSelect = page.getByTestId("filter-component");
    const { examTermId, assessmentComponentId } =
      await selectUnlockedTermWithComponent(examTermSelect, componentSelect);

    const markInput = page.locator("#mark-input-0");
    await expect(markInput).toBeVisible();
    const saveButton = page.getByRole("button", { name: /^Save/ });

    // Boundary check: the client does not clamp an over-limit value (the
    // backend is the authority), so saving an extreme value against the component
    // must surface a real error, not a false "Sync Complete".
    await markInput.fill("999999");
    await saveButton.click();
    await expect(page.getByText(/Save failed/i)).toBeVisible();
    await expect(page.getByText(/Sync Complete/i)).toHaveCount(0);

    await markInput.fill("1");
    await saveButton.click();

    await expect(page.getByText(/Sync Complete/i)).toBeVisible();
    await expect(page.getByText(/Successfully saved 1 entr/i)).toBeVisible();

    const marksResponse = await page.request.get(
      `${API_BASE_URL}/academics/marks?${new URLSearchParams({ examTermId, classId, subjectId, assessmentComponentId })}`,
    );
    expect(marksResponse.ok()).toBe(true);
    const persisted = unwrapAcademicsApiData<{
      items: Array<{ marksObtained: string | number; isLocked: boolean }>;
    }>(await marksResponse.json());
    expect(persisted.items.length).toBeGreaterThan(0);
    expect(Number(persisted.items[0].marksObtained)).toBe(1);
  });
});

// Matches apps/api/prisma/seed-m4-report-card-e2e.ts's fixed IDs.
const M4_REPORT_CARD_PUBLISHED_TERM_ID = "d4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4a01";
const M4_REPORT_CARD_PUBLISHED_ID = "d4a1f2b3-1c2d-4e5f-8a9b-0c1d2e3f4a04";
const m4ReportCardFixturesEnabled =
  process.env.SCHOOLOS_E2E_M4_REPORT_CARD_FIXTURES === "true";

test.describe("M4 Report Card Protected File Smoke", () => {
  test.beforeEach(async ({ context, page }) => {
    test.skip(
      !m4ReportCardFixturesEnabled,
      "Set SCHOOLOS_E2E_M4_REPORT_CARD_FIXTURES=true after seeding db:seed:e2e:m4-report-card to run the M4 report card protected-file smoke.",
    );
    await context.clearCookies();
    await login(page, schoolAdminCredentials);
  });

  test("admin downloads a real protected report card PDF, not a raw storage link", async ({
    page,
  }) => {
    await page.goto("/dashboard/academics/report-cards");
    await expect(
      page.getByRole("heading", { name: /Report Cards/i }),
    ).toBeVisible();

    const selects = page.locator("select");
    const academicYearValue = await selects
      .nth(0)
      .locator('option:not([value=""])')
      .first()
      .getAttribute("value");
    expect(academicYearValue).toBeTruthy();
    await selects.nth(0).selectOption(academicYearValue!);
    await selects.nth(1).selectOption(M4_REPORT_CARD_PUBLISHED_TERM_ID);
    await selects.nth(2).selectOption({ label: "Class 1" });

    // The row rendering with a download action confirms the generated report
    // card is real (not a placeholder); fetch through the same authenticated
    // browser session to verify the actual protected-file bytes, since the
    // click-triggered blob download isn't reliably interceptable.
    const downloadButton = page.getByTestId("report-card-download-pdf").first();
    await expect(downloadButton).toBeVisible();

    const pdfResponse = await page.request.get(
      `${API_BASE_URL}/academics/report-cards/${M4_REPORT_CARD_PUBLISHED_ID}.pdf`,
    );
    expect(pdfResponse.ok()).toBe(true);
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
    const body = await pdfResponse.body();
    expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});

const m4ParentCredentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG ?? "default-school",
  linkedEmail: "guardian.c01a002@schoolos.test",
  unrelatedEmail: "guardian.c01a003@schoolos.test",
  password:
    process.env.SCHOOLOS_E2E_M4_GUARDIAN_PASSWORD ?? "schoolos-local-demo-only",
};

test.describe("M4 Parent Published-Only Report Card Access", () => {
  test.describe.configure({ mode: "serial" });
  let reportCardStudentId = "";

  test.beforeEach(async ({ context }) => {
    test.skip(
      !m4ReportCardFixturesEnabled,
      "Set SCHOOLOS_E2E_M4_REPORT_CARD_FIXTURES=true after seeding db:seed:e2e:m4-report-card to run the M4 parent access smoke.",
    );
    await context.clearCookies();
  });

  test("a linked parent sees only the published report card, never the unpublished one", async ({
    page,
  }) => {
    await login(page, {
      tenantSlug: m4ParentCredentials.tenantSlug,
      email: m4ParentCredentials.linkedEmail,
      password: m4ParentCredentials.password,
    });

    const childrenResponse = await page.request.get(
      `${API_BASE_URL}/mobile/me/students`,
    );
    expect(childrenResponse.ok()).toBe(true);
    const children = unwrapAcademicsApiData<{
      items: Array<{ id: string }>;
    }>(await childrenResponse.json()).items;
    let result: {
      items: Array<{ id: string; examTerm: { name: string } }>;
    } | null = null;
    for (const child of children) {
      const response = await page.request.get(
        `${API_BASE_URL}/mobile/students/${child.id}/report-cards`,
      );
      if (!response.ok()) continue;
      const candidate = unwrapAcademicsApiData<{
        items: Array<{ id: string; examTerm: { name: string } }>;
      }>(await response.json());
      if (
        candidate.items.some((item) => item.id === M4_REPORT_CARD_PUBLISHED_ID)
      ) {
        reportCardStudentId = child.id;
        result = candidate;
        break;
      }
    }

    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].id).toBe(M4_REPORT_CARD_PUBLISHED_ID);
    expect(result!.items[0].examTerm.name).toBe("M4 E2E Published Term");
    expect(
      result!.items.some((item) => item.examTerm.name.includes("Unpublished")),
    ).toBe(false);
  });

  test("an unrelated parent is denied access to another guardian's child", async ({
    page,
  }) => {
    await login(page, {
      tenantSlug: m4ParentCredentials.tenantSlug,
      email: m4ParentCredentials.unrelatedEmail,
      password: m4ParentCredentials.password,
    });

    const response = await page.request.get(
      `${API_BASE_URL}/mobile/students/${reportCardStudentId}/report-cards`,
    );
    expect([403, 404]).toContain(response.status());
  });
});

function unwrapAcademicsApiData<T>(payload: unknown): T {
  if (typeof payload === "object" && payload !== null && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

async function selectFirstAvailableOption(select: Locator) {
  const option = select.locator('option:not([value=""])').first();
  await expect(option).toBeAttached();
  const value = await option.getAttribute("value");
  expect(value).toBeTruthy();
  await select.selectOption(value!);
  return value!;
}

async function optionValues(select: Locator) {
  return select.locator('option:not([value=""])').evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value),
  );
}

async function selectUnlockedTermWithComponent(
  examTermSelect: Locator,
  componentSelect: Locator,
) {
  const options = await examTermSelect
    .locator('option:not([value=""])')
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        value: (node as HTMLOptionElement).value,
        label: node.textContent ?? "",
      })),
    );

  for (const option of options) {
    if (option.label.includes("(Locked)")) continue;

    await examTermSelect.selectOption(option.value);
    const component = componentSelect
      .locator('option:not([value=""])')
      .first();
    const found = await component
      .waitFor({ state: "attached", timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    if (!found) continue;

    const assessmentComponentId = await component.getAttribute("value");
    expect(assessmentComponentId).toBeTruthy();
    await componentSelect.selectOption(assessmentComponentId!);
    return {
      examTermId: option.value,
      assessmentComponentId: assessmentComponentId!,
    };
  }

  throw new Error(
    "No unlocked exam term has an assessment component for the selected teacher assignment",
  );
}

async function login(
  page: Page,
  credentials: { tenantSlug: string; email: string; password: string },
) {
  await page.goto("/login");
  await expect(page.getByLabel(/School Code/i)).toBeVisible();

  await page.getByLabel(/School Code/i).fill(credentials.tenantSlug);
  await page.getByLabel(/Email/i).fill(credentials.email);
  await page.getByLabel(/^Password$/i).fill(credentials.password);

  await Promise.all([
    page.waitForURL(/\/dashboard(?:$|[/?#])/, { timeout: 20_000 }),
    page.getByRole("button", { name: /Sign in/i }).click(),
  ]);
}
