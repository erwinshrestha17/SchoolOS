import {
  expect,
  test as base,
  type Browser,
  type BrowserContext,
} from "@playwright/test";

export type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

export type SchoolE2eRole =
  | "schoolAdmin"
  | "principal"
  | "accountant"
  | "hrManager"
  | "staff"
  | "hrOfficer"
  | "payrollOfficer"
  | "payrollReviewer"
  | "payrollApprover"
  | "payrollPoster"
  | "e2eAccountant"
  | "accountingReviewer"
  | "accountingApprover"
  | "accountingFiscalController"
  | "principalReadOnly"
  | "auditorReadOnly"
  | "staffSelfService"
  | "unauthorized"
  | "otherTenant";

type AuthStateFactory = (role: SchoolE2eRole) => Promise<StorageState>;

type WorkerFixtures = {
  authStateFor: AuthStateFactory;
  schoolAdminState: StorageState;
};

const API_BASE_URL =
  process.env.SCHOOLOS_E2E_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000/api/v1";
const WEB_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ??
  `http://localhost:${process.env.SCHOOLOS_WEB_E2E_PORT ?? "3101"}`;

export const test = base.extend<object, WorkerFixtures>({
  authStateFor: [
    async ({ browser }, use) => {
      const healthContext = await browser.newContext();
      const health = await healthContext.request.get(`${API_BASE_URL}/health`);
      await healthContext.close();
      if (!health.ok()) {
        throw new Error(
          `SchoolOS API health check failed with HTTP ${health.status()}`,
        );
      }

      const states = new Map<SchoolE2eRole, Promise<StorageState>>();
      await use((role) => {
        const existing = states.get(role);
        if (existing) return existing;

        const state = createAuthenticatedState(browser, role);
        states.set(role, state);
        return state;
      });
    },
    { scope: "worker" },
  ],

  schoolAdminState: [
    async ({ authStateFor }, use) => {
      await use(await authStateFor("schoolAdmin"));
    },
    { scope: "worker" },
  ],

  storageState: async ({ schoolAdminState }, use) => {
    // `use` here is Playwright's fixture-provider callback, not React's
    // `use()` hook; the rule below false-positives on the naming convention.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(schoolAdminState);
  },
});

export { expect };

async function createAuthenticatedState(
  browser: Browser,
  role: SchoolE2eRole,
): Promise<StorageState> {
  const credentials = credentialsFor(role);
  const context = await browser.newContext({ baseURL: WEB_BASE_URL });
  const page = await context.newPage();

  await page.goto("/login");
  await expect(page.getByLabel(/School Code/i)).toBeVisible();
  await page.getByLabel(/School Code/i).fill(credentials.tenantSlug);
  await page.getByLabel(/Email/i).fill(credentials.email);
  await page.getByLabel(/Password/i).fill(credentials.password);

  await Promise.all([
    page.waitForURL(/\/dashboard(?:$|[/?#])/, { timeout: 20_000 }),
    page.getByRole("button", { name: /Sign in/i }).click(),
  ]);

  const state = await context.storageState();
  await context.close();
  return state;
}

function credentialsFor(role: SchoolE2eRole) {
  const primaryTenantSlug = requiredEnvironmentValue(
    "SCHOOLOS_E2E_TENANT_SLUG",
  );
  const sharedPassword = requiredEnvironmentValue("SCHOOLOS_E2E_PASSWORD");
  const roleConfig: Record<
    SchoolE2eRole,
    { email: string; passwordEnv?: string; tenantSlug?: string }
  > = {
    schoolAdmin: {
      email: requiredEnvironmentValue("SCHOOLOS_E2E_EMAIL"),
    },
    principal: {
      email:
        process.env.SCHOOLOS_E2E_PRINCIPAL_EMAIL ?? "principal@schoolos.com",
      passwordEnv: "SCHOOLOS_E2E_PRINCIPAL_PASSWORD",
    },
    accountant: {
      email:
        process.env.SCHOOLOS_E2E_ACCOUNTANT_EMAIL ?? "accountant@schoolos.com",
      passwordEnv: "SCHOOLOS_E2E_ACCOUNTANT_PASSWORD",
    },
    hrManager: {
      email: process.env.SCHOOLOS_E2E_HR_EMAIL ?? "hr@schoolos.com",
      passwordEnv: "SCHOOLOS_E2E_HR_PASSWORD",
    },
    staff: {
      email: process.env.SCHOOLOS_E2E_STAFF_EMAIL ?? "staff@schoolos.com",
      passwordEnv: "SCHOOLOS_E2E_STAFF_PASSWORD",
    },
    hrOfficer: { email: "e2e.hr-officer@schoolos.test" },
    payrollOfficer: { email: "e2e.payroll-officer@schoolos.test" },
    payrollReviewer: { email: "e2e.payroll-reviewer@schoolos.test" },
    payrollApprover: { email: "e2e.payroll-approver@schoolos.test" },
    payrollPoster: { email: "e2e.payroll-poster@schoolos.test" },
    e2eAccountant: { email: "e2e.accountant@schoolos.test" },
    accountingReviewer: { email: "e2e.accounting-reviewer@schoolos.test" },
    accountingApprover: { email: "e2e.accounting-approver@schoolos.test" },
    accountingFiscalController: {
      email: "e2e.accounting-fiscal-controller@schoolos.test",
    },
    principalReadOnly: { email: "e2e.principal-read-only@schoolos.test" },
    auditorReadOnly: { email: "e2e.auditor-read-only@schoolos.test" },
    staffSelfService: { email: "e2e.staff-self-service@schoolos.test" },
    unauthorized: { email: "e2e.unauthorized@schoolos.test" },
    otherTenant: {
      email: "e2e.other-tenant@schoolos.test",
      tenantSlug:
        process.env.SCHOOLOS_E2E_OTHER_TENANT_SLUG ?? "e2e-other-school",
    },
  };
  const config = roleConfig[role];

  return {
    tenantSlug: config.tenantSlug ?? primaryTenantSlug,
    email: config.email,
    password:
      (config.passwordEnv ? process.env[config.passwordEnv] : undefined) ??
      sharedPassword,
  };
}

function requiredEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Set ${name} to run authenticated SchoolOS browser tests.`);
  }
  return value;
}
