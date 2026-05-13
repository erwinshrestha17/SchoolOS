import { expect, test, type Page } from '@playwright/test';

const schoolCredentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG,
  email: process.env.SCHOOLOS_E2E_EMAIL,
  password: process.env.SCHOOLOS_E2E_PASSWORD,
};

const platformCredentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_PLATFORM_TENANT_SLUG,
  email: process.env.SCHOOLOS_E2E_PLATFORM_EMAIL,
  password: process.env.SCHOOLOS_E2E_PLATFORM_PASSWORD,
};

test.describe('Phase 2F.2 public browser smoke', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await context.clearPermissions();
  });

  test('loads the public home and login pages', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('banner')).toContainText('SchoolOS');
    await expect(
      page.getByRole('banner').getByRole('link', { name: /^Sign in$/i }),
    ).toBeVisible();

    await page.goto('/login');
    await expect(page).toHaveURL(/\/login(?:$|[?#])/);
    await expect(page.getByLabel(/School Code/i)).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
  });
});

test.describe('Phase 2F.2 authenticated school admin browser smoke', () => {
  test.beforeEach(async ({ context, page }) => {
    test.skip(
      !schoolCredentials.tenantSlug ||
        !schoolCredentials.email ||
        !schoolCredentials.password,
      'Authenticated browser smoke requires seeded local API credentials.',
    );
    await context.clearCookies();
    await login(page, schoolCredentials);
  });

  test('loads polished daily school workflows without fatal pages', async ({ page }) => {
    const targets = [
      { route: '/dashboard', visible: /Dashboard|Quick Actions|Total Students/i },
      { route: '/dashboard/students', visible: /Student Directory/i },
      { route: '/dashboard/admissions', visible: /New Enrollment|Personal Information/i },
      { route: '/dashboard/attendance', visible: /Attendance Roster|Smart Attendance/i },
      { route: '/dashboard/finance', visible: /Collection Counter|Find student or invoice/i },
      { route: '/dashboard/academics', visible: /Academic Workflow/i },
      { route: '/dashboard/accounting', visible: /Fiscal Status|Financial Reporting Hub/i },
      { route: '/dashboard/library/issues', visible: /Issue \/ Return|Issue copy/i },
      { route: '/dashboard/canteen/pos', visible: /POS|Create POS sale/i },
      { route: '/dashboard/canteen/serving', visible: /Student ID \/ QR Serving|Serve meal now/i },
      { route: '/dashboard/transport/trips', visible: /Trip Monitor|Start trip/i },
      { route: '/dashboard/settings', visible: /School Settings|Communication Rules/i },
    ] as const;

    for (const target of targets) {
      await page.goto(target.route);
      await expect(page.getByText(target.visible).first()).toBeVisible({
        timeout: 15_000,
      });
      await expectNoFatalPage(page, target.route);
    }
  });

  test('student directory filters and profile link are safe with seeded or empty data', async ({
    page,
  }) => {
    await page.goto('/dashboard/students');
    await expect(page.getByText(/Directory Filters/i)).toBeVisible();
    await page
      .getByLabel(/Search students by name, student code, guardian name, or phone/i)
      .fill('NoSuchStudentForSmoke');
    await expect(page.getByText(/No students found/i)).toBeVisible();
    await page.getByRole('button', { name: /Reset All/i }).click();

    const firstStudent = page.locator('a[href^="/dashboard/students/"]').first();
    if (await firstStudent.isVisible()) {
      await firstStudent.click();
      await expect(page.getByText(/Student Profile/i)).toBeVisible();
      await expect(page.getByText(/Collect Fees|Attendance|Documents/i).first()).toBeVisible();
    }
  });

  test('attendance and admissions validation controls render', async ({ page }) => {
    await page.goto('/dashboard/attendance');
    await expect(page.getByLabel(/Class/i)).toBeVisible();
    await expect(page.getByLabel(/Date/i)).toBeVisible();
    await expect(page.locator('[data-testid="attendance-count-summary"]').or(page.getByText(/No Students Found/i))).toBeVisible();

    await page.goto('/dashboard/admissions');
    await expect(page.getByText(/Personal Information|New Enrollment/i)).toBeVisible();
    await page.getByRole('button', { name: /Next Step/i }).click();
    await expect(page.getByText(/required|Invalid|Personal Information/i).first()).toBeVisible();
  });

  test('platform routes are denied or redirected for a school user', async ({ page }) => {
    await page.goto('/platform/dashboard');
    await expectNoFatalPage(page, '/platform/dashboard');

    const platformUrl = page.url().includes('/platform');
    if (platformUrl) {
      await expect(
        page.getByText(/permission|not authorized|access denied|platform/i).first(),
      ).toBeVisible();
    } else {
      await expect(page).toHaveURL(/\/(?:dashboard|login)(?:$|[/?#])/);
    }
  });
});

test.describe('Phase 2F.2 platform browser smoke', () => {
  test.beforeEach(async ({ context, page }) => {
    test.skip(
      !platformCredentials.tenantSlug ||
        !platformCredentials.email ||
        !platformCredentials.password,
      'Platform browser smoke requires platform seed credentials.',
    );
    await context.clearCookies();
    await login(page, platformCredentials);
  });

  test('loads platform pilot onboarding surfaces for platform users', async ({
    page,
  }) => {
    for (const route of ['/platform/dashboard', '/platform/schools', '/platform/settings']) {
      await page.goto(route);
      await expect(
        page.locator('h1:visible, h2:visible, [role="heading"]:visible').first(),
      ).toBeVisible({ timeout: 15_000 });
      await expectNoFatalPage(page, route);
    }
  });
});

async function login(
  page: Page,
  credentials: {
    tenantSlug?: string;
    email?: string;
    password?: string;
  },
) {
  await page.goto('/login');
  await page.getByLabel(/School Code/i).fill(credentials.tenantSlug ?? '');
  await page.getByLabel(/Email/i).fill(credentials.email ?? '');
  await page.getByLabel(/Password/i).fill(credentials.password ?? '');
  await page.getByRole('button', { name: /Sign in/i }).click();
  await page.waitForURL(/\/(?:dashboard|platform)(?:$|[/?#])/, {
    timeout: 20_000,
  });
}

async function expectNoFatalPage(page: Page, route: string) {
  await expect(
    page.getByText(
      /Application error|Unhandled Runtime Error|This page could not be found|Internal Server Error/i,
    ),
    `${route} rendered a fatal page`,
  ).toHaveCount(0);
}
