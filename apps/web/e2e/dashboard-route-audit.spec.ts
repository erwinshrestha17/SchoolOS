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

const schoolRoutes = [
  '/dashboard',
  '/dashboard/students',
  '/dashboard/admissions',
  '/dashboard/attendance',
  '/dashboard/fees',
  '/dashboard/finance',
  '/dashboard/notices',
  '/dashboard/activity',
  '/dashboard/academics',
  '/dashboard/academics/exam-terms',
  '/dashboard/academics/assessment-components',
  '/dashboard/academics/marks',
  '/dashboard/academics/cas',
  '/dashboard/academics/results',
  '/dashboard/academics/locks',
  '/dashboard/academics/report-cards',
  '/dashboard/academics/promotion',
  '/dashboard/academics/publishing',
  '/dashboard/homework',
  '/dashboard/timetable',
  '/dashboard/hr',
  '/dashboard/payroll',
  '/dashboard/accounting',
  '/dashboard/library',
  '/dashboard/canteen',
  '/dashboard/transport',
  '/dashboard/settings',
] as const;

const platformRoutes = [
  '/platform/dashboard',
  '/platform/schools',
  '/platform/audit',
] as const;

test.describe('Dashboard route audit smoke', () => {
  test.beforeEach(() => {
    test.skip(
      !schoolCredentials.tenantSlug ||
        !schoolCredentials.email ||
        !schoolCredentials.password,
      'Set school E2E credentials to run authenticated route audit.',
    );
  });

  test('loads every implemented school dashboard route without a fatal page', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await login(page, schoolCredentials);
    await expect(page.getByLabel(/User profile menu/i)).toBeVisible();

    for (const route of schoolRoutes) {
      await page.goto(route);
      await expectUsableRoute(page, route);
    }

    await page.goto('/dashboard/students');
    const firstStudentLink = page
      .locator('a[href^="/dashboard/students/"]')
      .first();

    if (await firstStudentLink.isVisible()) {
      await firstStudentLink.click();
      await expectUsableRoute(page, '/dashboard/students/[studentId]');
    }

    expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  });
});

test.describe('Platform route audit smoke', () => {
  test.beforeEach(() => {
    test.skip(
      !platformCredentials.tenantSlug ||
        !platformCredentials.email ||
        !platformCredentials.password,
      'Set platform E2E credentials to run platform route audit.',
    );
  });

  test('loads implemented platform routes for platform users', async ({ page }) => {
    await login(page, platformCredentials);

    for (const route of platformRoutes) {
      await page.goto(route);
      await expectUsableRoute(page, route);
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

async function expectUsableRoute(page: Page, route: string) {
  await expect(
    page.locator('h1:visible, h2:visible, [role="heading"]:visible').first(),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByText(
      /Application error|Unhandled Runtime Error|This page could not be found|Internal Server Error/i,
    ),
    `${route} rendered a framework or fatal error page`,
  ).toHaveCount(0);
}
