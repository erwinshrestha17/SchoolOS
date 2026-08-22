import { expect, test } from "./fixtures/auth";

const API_BASE_URL =
  process.env.SCHOOLOS_E2E_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000/api/v1";
const WEB_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ??
  `http://localhost:${process.env.SCHOOLOS_WEB_E2E_PORT ?? "3101"}`;

test.describe.serial("Principal leadership web", () => {
  test("opens the Principal home, attention, approval, and oversight workspaces", async ({
    authStateFor,
    browser,
  }) => {
    const context = await browser.newContext({
      baseURL: WEB_BASE_URL,
      storageState: await authStateFor("principal"),
    });
    const page = await context.newPage();

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Principal Home" })).toBeVisible();
    await expect(page.getByText("Finance health", { exact: true })).toBeVisible();
    await expect(page.getByText("Staff availability", { exact: true })).toBeVisible();

    const routes = [
      ["/dashboard/attention", "Attention Centre"],
      ["/dashboard/approvals", "Approval Centre"],
      ["/dashboard/attendance/overview", "Attendance Oversight"],
      ["/dashboard/academics/readiness", "Academic Readiness"],
      ["/dashboard/finance-overview", "Finance Overview"],
      ["/dashboard/hr/overview", "Staff Overview"],
      ["/dashboard/students/overview", "Enrollment Overview"],
      ["/dashboard/admissions/overview", "Admissions Overview"],
      ["/dashboard/activity/oversight", "Activity Oversight"],
      ["/dashboard/communications/oversight", "Communication Oversight"],
      ["/dashboard/operations/overview", "School Operations Overview"],
    ] as const;

    for (const [route, heading] of routes) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }

    await context.close();
  });

  test("keeps operator write actions unavailable to the Principal", async ({
    authStateFor,
    browser,
  }) => {
    const state = await authStateFor("principal");
    const context = await browser.newContext({ storageState: state });
    const csrf = csrfHeaders(state);

    const forbiddenRequests = [
      context.request.post(`${API_BASE_URL}/students`, {
        data: {},
        headers: csrf,
      }),
      context.request.post(`${API_BASE_URL}/accounting/journals`, {
        data: {},
        headers: csrf,
      }),
    ];

    for (const response of await Promise.all(forbiddenRequests)) {
      expect(response.status()).toBe(403);
    }
    await context.close();
  });

  test("returns purpose-limited operations summaries and not operator records", async ({
    authStateFor,
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: await authStateFor("principal"),
    });
    const response = await context.request.get(
      `${API_BASE_URL}/dashboard/principal/operations-summary`,
    );
    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    const data = payload.data ?? payload;
    expect(Object.keys(data.modules).sort()).toEqual([
      "canteen",
      "library",
      "transport",
    ]);
    expect(JSON.stringify(data)).not.toContain("studentWallet");
    expect(JSON.stringify(data)).not.toContain("locationPings");
    expect(JSON.stringify(data)).not.toContain("borrowerId");
    await context.close();
  });
});

function csrfHeaders(state: Awaited<ReturnType<Parameters<typeof test>[0]>> extends never ? never : any) {
  const csrfCookie = state.cookies.find(
    (cookie: { name: string }) =>
      cookie.name === "__Host-schoolos_csrf" || cookie.name === "schoolos_csrf",
  );
  if (!csrfCookie) throw new Error("Authenticated E2E state is missing its CSRF cookie.");
  return { "X-CSRF-Token": csrfCookie.value };
}
