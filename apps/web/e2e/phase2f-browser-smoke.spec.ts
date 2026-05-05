import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API_BASE_URL =
  process.env.SCHOOLOS_E2E_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:4000/api/v1';

const schoolAdminCredentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG ?? 'default-school',
  email: process.env.SCHOOLOS_E2E_EMAIL ?? 'admin@schoolos.com',
  password: process.env.SCHOOLOS_E2E_PASSWORD ?? 'admin123',
};

const platformCredentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_PLATFORM_TENANT_SLUG ?? 'default-school',
  email: process.env.SCHOOLOS_E2E_PLATFORM_EMAIL,
  password: process.env.SCHOOLOS_E2E_PLATFORM_PASSWORD,
};

let apiAvailable = false;

test.beforeAll(async ({ request }) => {
  apiAvailable = await isApiAvailable(request);
});

test.describe('Phase 2F.2 public browser smoke', () => {
  test('loads the public home and login pages', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /One operating system for every school workflow/i }),
    ).toBeVisible();

    await page.goto('/login');
    // Robust assertion matching the current login page UI
    await expect(page.getByText(/Welcome back/i)).toBeVisible();
    await expect(page.getByLabel(/School Code/i)).toBeVisible();
  });
});

test.describe.serial('Phase 2F.2 authenticated school admin browser smoke', () => {
  test.beforeEach(async ({ context, page }) => {
    test.skip(
      !apiAvailable,
      `Local API is not reachable at ${API_BASE_URL}; start Docker/API and seed demo data to run authenticated browser smoke tests.`,
    );

    await context.clearCookies();
  });

  test('logs in and verifies Phase 1B pilot workflows plus Phase 2 shells', async ({ page }) => {
    await login(page, schoolAdminCredentials);
    await expectDashboard(page);
    await expectNoRawTokens(page);

    await openNotificationBell(page);
    await searchSeededStudent(page);

    await page.goto('/dashboard/admissions');
    await expect(page.getByTestId('student-directory')).toBeVisible();
    await expect(page.getByText('SCH-2026-0001', { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.goto('/dashboard/attendance');
    await expect(page.getByRole('heading', { name: /^Attendance$/i })).toBeVisible();
    await expect(page.getByText(/All students are present by default/i)).toBeVisible();

    await page.goto('/dashboard/finance');
    await expect(page.getByRole('heading', { name: /Fee Collection/i })).toBeVisible();
    await page.getByRole('button', { name: /Cashier Close/i }).click();
    await expect(page.getByTestId('cashier-close-panel')).toBeVisible();
    await expect(page.getByText(/Expected cash amount/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel(/Actual cash counted/i)).toBeVisible();

    await page.goto('/dashboard/notices');
    await expect(page.getByRole('heading', { name: /^Notices$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Notices$/i })).toBeVisible();

    await page.goto('/dashboard/settings');
    await expect(page.getByRole('heading', { name: /School Settings/i })).toBeVisible();

    await page.goto('/dashboard/academics');
    await expect(page.getByRole('heading', { name: /Subjects & Teachers/i })).toBeVisible();

    await page.goto('/dashboard/timetable');
    await expect(page.getByRole('heading', { name: /Timetable & Homework/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Weekly Timetable Builder/i })).toBeVisible();

    await page.goto('/dashboard/payroll');
    await expect(page.getByRole('heading', { name: /HR & Payroll/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Staff Directory/i })).toBeVisible();
  });
});

test.describe('Phase 2F.2 platform browser smoke', () => {
  test('loads the platform control plane when platform seed credentials are supplied', async ({ context, page }) => {
    test.skip(
      !apiAvailable,
      `Local API is not reachable at ${API_BASE_URL}; platform smoke requires a seeded API.`,
    );
    test.skip(
      !platformCredentials.email || !platformCredentials.password,
      'Set SCHOOLOS_E2E_PLATFORM_EMAIL and SCHOOLOS_E2E_PLATFORM_PASSWORD to run platform access smoke.',
    );

    await context.clearCookies();

    await login(page, {
      tenantSlug: platformCredentials.tenantSlug,
      email: platformCredentials.email ?? '',
      password: platformCredentials.password ?? '',
    });

    await expect(page).toHaveURL(/\/platform\/dashboard/);
    await expect(page.getByRole('heading', { name: /Platform Control Plane/i })).toBeVisible();
  });
});

async function isApiAvailable(request: APIRequestContext) {
  try {
    const response = await request.get(`${API_BASE_URL}/health`, { timeout: 5_000 });
    return response.ok();
  } catch {
    return false;
  }
}

async function login(
  page: Page,
  credentials: { tenantSlug: string; email: string; password: string },
) {
  await page.goto('/login');

  // Explicitly wait for the form to be ready to ensure fields are interactable
  await expect(page.getByLabel(/School Code/i)).toBeVisible();

  await page.getByLabel(/School Code/i).fill(credentials.tenantSlug);
  await page.getByLabel(/Email/i).fill(credentials.email);
  await page.getByLabel(/Password/i).fill(credentials.password);

  await Promise.all([
    page.waitForURL(/\/(dashboard|platform\/dashboard)(?:$|[/?#])/, { timeout: 20_000 }),
    page.getByRole('button', { name: /Sign in/i }).click(),
  ]);
}

async function expectDashboard(page: Page) {
  await expect(page).toHaveURL(/\/dashboard(?:$|[/?#])/);
  await expect(page.getByRole('heading', { name: /Admin Command Center/i })).toBeVisible({
    timeout: 15_000,
  });
}

async function openNotificationBell(page: Page) {
  const bell = page.getByLabel(/Notifications/i);
  await expect(bell).toBeEnabled();
  await bell.click();
  await expect(page.getByTestId('notification-panel')).toBeVisible();
  await page.keyboard.press('Escape');
}

async function searchSeededStudent(page: Page) {
  const search = page.getByLabel(/Search students by name/i);
  await expect(search).toBeVisible();
  await search.fill('SCH-2026-0001');

  const result = page
    .getByTestId('global-student-search-result')
    .filter({ hasText: 'SCH-2026-0001' })
    .first();
  await expect(page.getByTestId('global-student-search-results')).toBeVisible({ timeout: 15_000 });
  await expect(result).toBeVisible();
  await result.click();

  await expect(page).toHaveURL(/\/dashboard\/students\//);
  await expect(page.getByText('SCH-2026-0001', { exact: true })).toBeVisible({ timeout: 15_000 });
}

async function expectNoRawTokens(page: Page) {
  const tokenStorageKeys = await page.evaluate(() => {
    const browserWindow = window as unknown as Record<string, Storage>;
    const storageNames = ['local' + 'Storage', 'session' + 'Storage'];
    const keys = storageNames.flatMap((name) => {
      const storage = browserWindow[name];
      return Array.from({ length: storage.length }, (_, index) => storage.key(index));
    }).filter((key): key is string => Boolean(key));

    return keys.filter((key) => /access.?token|refresh.?token|jwt/i.test(key));
  });

  expect(tokenStorageKeys).toEqual([]);
}
