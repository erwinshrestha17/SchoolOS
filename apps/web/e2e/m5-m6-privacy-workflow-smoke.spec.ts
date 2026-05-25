import { expect, test, type Page } from '@playwright/test';

const API_BASE_URL =
  process.env.SCHOOLOS_E2E_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:4000/api/v1';

const schoolCredentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG,
  email: process.env.SCHOOLOS_E2E_EMAIL,
  password: process.env.SCHOOLOS_E2E_PASSWORD,
};

test.describe.serial('M5/M6 privacy workflow smoke', () => {
  test.beforeEach(async ({ context, page }) => {
    test.skip(
      !schoolCredentials.tenantSlug ||
        !schoolCredentials.email ||
        !schoolCredentials.password,
      'M5/M6 browser smoke requires seeded local school credentials.',
    );

    try {
      const response = await page.request.get(`${API_BASE_URL}/health`);
      if (!response.ok()) {
        test.skip(true, 'API is not healthy');
      }
    } catch {
      test.skip(true, 'API is not reachable');
    }

    await context.clearCookies();
    await login(page, schoolCredentials);
  });

  test('loads activity parent view, moderation detail, homework, and timetable without fatal pages', async ({
    page,
  }) => {
    const targets = [
      {
        route: '/dashboard/activity',
        visible: /Activity Feed|Feed Preview|Milestones/i,
      },
      {
        route: '/dashboard/activity/parent',
        visible: /Parent Activity Feed|No classroom activities shared yet/i,
      },
      {
        route: '/dashboard/homework',
        visible: /Homework|Due Today|Upcoming|Review/i,
      },
      {
        route: '/dashboard/homework/review',
        visible: /Review|Submissions|No submissions/i,
      },
      {
        route: '/dashboard/timetable',
        visible: /Timetable|Conflict|Version|Substitution/i,
      },
      {
        route: '/dashboard/timetable/substitutions',
        visible: /Substitution|Absent|Coverage/i,
      },
    ] as const;

    for (const target of targets) {
      await page.goto(target.route);
      await expect(page.locator('body')).toContainText(target.visible, {
        timeout: 15_000,
      });
      await expectNoFatalPage(page, target.route);
    }
  });

  test('keeps activity media privacy language visible in teacher and parent surfaces', async ({
    page,
  }) => {
    await page.goto('/dashboard/activity');
    await expect(page.locator('body')).toContainText(/private media|consent/i);
    await expectNoFatalPage(page, '/dashboard/activity');

    await page.goto('/dashboard/activity/parent');
    await expect(page.locator('body')).toContainText(
      /Approved classroom activities|photo consent|No classroom activities/i,
    );
    await expectNoFatalPage(page, '/dashboard/activity/parent');
  });
});

async function login(
  page: Page,
  credentials: { tenantSlug?: string; email?: string; password?: string },
) {
  await page.goto('/login');
  await page.getByLabel(/School Code/i).fill(credentials.tenantSlug ?? '');
  await page.getByLabel(/Email/i).fill(credentials.email ?? '');
  await page.getByLabel(/Password/i).fill(credentials.password ?? '');

  await Promise.all([
    page.waitForURL(/\/dashboard(?:$|[/?#])/, { timeout: 20_000 }),
    page.getByRole('button', { name: /Sign in/i }).click(),
  ]);
}

async function expectNoFatalPage(page: Page, route: string) {
  const fatalMessages = [
    /Application error/i,
    /Unhandled Runtime Error/i,
    /This page could not be found/i,
    /Internal Server Error/i,
    /500 - Internal Server Error/i,
    /404 - Page Not Found/i,
  ];

  for (const message of fatalMessages) {
    await expect(
      page.getByText(message),
      `${route} rendered a fatal page matching ${message}`,
    ).toHaveCount(0);
  }
}
