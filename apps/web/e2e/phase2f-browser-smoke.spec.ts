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
      { route: '/dashboard/admissions', visible: /Admissions|New admission|Applications Needing Review/i },
      { route: '/dashboard/attendance', visible: /Attendance Roster|Smart Attendance/i },
      { route: '/dashboard/fees/collect', visible: /Collect payment|Find student or invoice/i },
      { route: '/dashboard/academics', visible: /Academics|Active Exam Terms|Workflow Readiness/i },
      { route: '/dashboard/accounting', visible: /Fiscal Status|Financial Reporting Hub/i },
      { route: '/dashboard/reports', visible: /Reports & Exports|Recent Exports|Module Locked/i },
      { route: '/dashboard/library/issues', visible: /Issue \/ Return|Issue copy/i },
      { route: '/dashboard/canteen/pos', visible: /POS|Create POS sale/i },
      { route: '/dashboard/canteen/serving', visible: /Student ID \/ QR Serving|Serve meal now/i },
      { route: '/dashboard/transport/trips', visible: /Trip Monitor|Start trip/i },
      { route: '/dashboard/settings', visible: /Setup readiness|School Profile/i },
    ] as const;

    for (const target of targets) {
      await page.goto(target.route);
      await expect(page.locator('main').getByText(target.visible).first()).toBeVisible({
        timeout: 15_000,
      });
      await expectNoFatalPage(page, target.route);
    }
  });

  test('student directory filters and profile link are safe with seeded data', async ({
    page,
  }) => {
    await page.goto('/dashboard/students');
    await expect(
      page.getByRole('group', { name: /Directory filters/i }),
    ).toBeVisible();

    // Test search with real seeded data
    await page
      .getByLabel(/Search students by name, student code, guardian name, or phone/i)
      .fill('STU001');
    await expect(page.locator('main')).toContainText(
      /Student Roster|No students found|STU001|S2024-001/i,
      { timeout: 10_000 },
    );

    // Test search with no results
    await page
      .getByLabel(/Search students by name, student code, guardian name, or phone/i)
      .fill('NoSuchStudentForSmoke');
    await expect(
      page.getByText('No students match these filters', { exact: true }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Reset', exact: true }).click();

    const firstStudent = page.locator('a[href^="/dashboard/students/"]').first();
    if (await firstStudent.isVisible()) {
      await firstStudent.click();
      await expect(page.getByText(/Student Profile/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Edit/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /ID Card/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Documents/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /History/i })).toBeVisible();
      await expect(page.getByText(/QR Identity|QR/i).first()).toBeVisible();
      await page.getByRole('tab', { name: /Documents/i }).click();
      await expect(page.getByText(/Document Audit Trail/i)).toBeVisible();
      await page.getByRole('button', { name: /Edit/i }).click();
      await expect(page.getByText(/Student Photo/i)).toBeVisible();
      await expect(
        page.getByText(/Upload|Replace/i).or(page.getByText(/Remove/i)).first(),
      ).toBeVisible();
    }
  });

  test('attendance and admissions validation controls render', async ({ page }) => {
    await page.goto('/dashboard/attendance/mark');
    await expect(page.getByLabel(/^Class$/i)).toBeVisible();
    await expect(page.getByLabel(/^Date$/i)).toBeVisible();
    await expect(page.locator('main')).toContainText(
      /Smart Attendance|Attendance Roster|Expected Students/i,
    );

    await page.goto('/dashboard/admissions');
    await expect(
      page.locator('main').getByRole('heading', { name: /Admissions/i }),
    ).toBeVisible();
    await page
      .locator('[data-schoolos-ui="module-header"]')
      .getByRole('link', { name: 'New admission', exact: true })
      .click();
    await expect(
      page.locator('main').getByRole('heading', { name: /New admission/i }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Start school-office admission', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Student and guardian', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByText('Enter valid student names.', { exact: true })).toBeVisible();
  });

  test('platform routes are denied or redirected for a school user', async ({ page }) => {
    await page.goto('/platform/dashboard');
    await expectNoFatalPage(page, '/platform/dashboard');

    const platformUrl = page.url().includes('/platform');
    if (platformUrl) {
      await expect(
        page.locator('main').getByText(/permission|not authorized|access denied|School Dashboard/i).first(),
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

  // Wait for either the dashboard/platform or an error message
  await Promise.race([
    page.waitForURL(/\/(?:dashboard|platform)(?:$|[/?#])/, { timeout: 20_000 }),
    expect(page.getByText(/Invalid credentials|Account suspended|not authorized/i).first()).toBeVisible({ timeout: 20_000 }),
  ]);

  if (!page.url().includes('/dashboard') && !page.url().includes('/platform')) {
    throw new Error(`Login failed for ${credentials.email}. Still at ${page.url()}`);
  }

  if (page.url().includes('/platform')) {
    await expect(
      page
        .getByRole('button', { name: /Logout/i })
        .or(page.getByText(/Platform operator console/i))
        .first(),
    ).toBeVisible({ timeout: 15_000 });
    return;
  }

  await expect(
    page.getByRole('button', { name: /User profile menu/i }),
  ).toBeVisible({ timeout: 15_000 });
}

async function expectNoFatalPage(page: Page, route: string) {
  const fatalMessages = [
    /Application error/i,
    /Unhandled Runtime Error/i,
    /This page could not be found/i,
    /Internal Server Error/i,
    /Next.js-specific error/i,
    /500 - Internal Server Error/i,
    /404 - Page Not Found/i,
  ];

  for (const msg of fatalMessages) {
    await expect(
      page.getByText(msg),
      `${route} rendered a fatal page matching ${msg}`,
    ).toHaveCount(0);
  }
}
