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

  test('blocks the retired parent web view and loads staff M5/M6 workspaces without fatal pages', async ({
    page,
  }) => {
    const targets = [
      {
        route: '/dashboard/activity',
        visible: /Activity Feed|Feed Preview|Milestones/i,
      },
      {
        route: '/dashboard/homework',
        visible: /Homework|Due Today|Upcoming|Review/i,
      },
      {
        // /dashboard/homework/review is now a client-side redirect into
        // /dashboard/homework?tab=completion (apps/web/app/dashboard/homework/review/page.tsx)
        // — the standalone review page was consolidated into the Homework
        // page's Completion tab, which is titled "Needs follow-up", not
        // "Review"/"Submissions".
        route: '/dashboard/homework/review',
        visible: /Needs follow-up|Nothing needs follow-up|completion register/i,
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

    await page.goto('/dashboard/activity/parent');
    await expect(page).toHaveURL(/\/login\?notice=parent-mobile-only$/);
    await expect(page.locator('body')).toContainText(/Staff & Admin Portal/i);
    await expectNoFatalPage(page, '/dashboard/activity/parent');
  });

  test('keeps activity media privacy language visible in the teacher surface', async ({
    page,
  }) => {
    await page.goto('/dashboard/activity');
    await expect(page.locator('body')).toContainText(/private media|consent/i);
    await expectNoFatalPage(page, '/dashboard/activity');
  });
});

const m5TeacherCredentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG,
  email: process.env.SCHOOLOS_E2E_M5_TEACHER_EMAIL,
  password: process.env.SCHOOLOS_E2E_M5_TEACHER_PASSWORD,
};
const m5AdminCredentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG,
  email: process.env.SCHOOLOS_E2E_EMAIL,
  password: process.env.SCHOOLOS_E2E_PASSWORD,
};
// Dilip Gautam, Class 1 Section A — already linked to guardian.c01a002@schoolos.test
// (reused from the M4 report-card fixture; no dedicated M5 fixture needed).
// classteacher.1a is Section A's homeroom teacher (Section.classTeacherId),
// not a subject teacher, so the section must be selected explicitly rather
// than "whole class" (which only subject-teacher assignments satisfy).
const M5_CLASS_ID = 'cbf6af3f-bc7c-4798-91d2-817bcd3d5475';
const M5_SECTION_ID = 'bc5b67a8-0dd9-42a3-89cc-c91aa1c5e080';
const M5_PARENT_STUDENT_ID = 'b464b734-550e-4cdd-8a77-9f60fda31109';
const M5_TEST_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const m5ActivityMutationsEnabled =
  process.env.SCHOOLOS_E2E_M5_ACTIVITY_MUTATIONS === 'true';

test.describe('M5 Activity Post Moderation & Parent Visibility', () => {
  test.beforeEach(async ({ context }) => {
    test.skip(
      !m5ActivityMutationsEnabled ||
        !m5TeacherCredentials.tenantSlug ||
        !m5TeacherCredentials.email ||
        !m5TeacherCredentials.password,
      'Set SCHOOLOS_E2E_M5_ACTIVITY_MUTATIONS=true, SCHOOLOS_E2E_TENANT_SLUG, SCHOOLOS_E2E_M5_TEACHER_EMAIL, and SCHOOLOS_E2E_M5_TEACHER_PASSWORD for a class teacher to run the M5 moderation/visibility smoke.',
    );
    await context.clearCookies();
  });

  test('an approval-required post stays hidden from the linked parent until moderated, then becomes visible', async ({
    page,
  }) => {
    const postTitle = `M5 E2E Achievement ${Date.now()}`;

    await login(page, m5TeacherCredentials);
    await page.goto('/dashboard/activity/new');
    await expect(
      page.getByRole('heading', { name: 'Create activity' }),
    ).toBeVisible();

    const selects = page.locator('select');
    await selects.nth(0).selectOption(M5_CLASS_ID);
    await selects.nth(1).selectOption(M5_SECTION_ID);
    await page.getByRole('button', { name: 'Next' }).click();

    // Content & media step: category select is first on this step.
    await page.locator('select').nth(0).selectOption('ACHIEVEMENT');
    await page.getByPlaceholder('Post title').fill(postTitle);
    await page
      .getByPlaceholder(/What happened in class today/i)
      .fill('E2E moderation and parent-visibility smoke test post.');
    // At least one photo is required for the post to be considered complete.
    await page.locator('input[type="file"]').setInputFiles({
      name: 'm5-e2e-activity.png',
      mimeType: 'image/png',
      buffer: Buffer.from(M5_TEST_IMAGE_BASE64, 'base64'),
    });
    await page.getByRole('button', { name: 'Next' }).click();

    // Review & submit step: approval-required category must say so honestly.
    const submitButton = page.getByRole('button', {
      name: /Submit for approval/i,
    });
    await expect(submitButton).toBeVisible();
    // Matches a real post UUID, not the starting "/dashboard/activity/new"
    // itself (a looser [^/]+ pattern would trivially match "new" and let a
    // silently failed submission look like a successful navigation).
    await Promise.all([
      page.waitForURL(/\/dashboard\/activity\/[0-9a-f-]{36}$/, {
        timeout: 15_000,
      }),
      submitButton.click(),
    ]);

    const createdPostId = page.url().split('/').pop()!;

    // Not yet approved: the linked parent must not see it.
    await login(page, {
      tenantSlug: m5TeacherCredentials.tenantSlug,
      email: 'guardian.c01a002@schoolos.test',
      password:
        process.env.SCHOOLOS_E2E_M5_GUARDIAN_PASSWORD ??
        'schoolos-local-demo-only',
    });
    const beforeApproval = await page.request.get(
      `${API_BASE_URL}/mobile/students/${M5_PARENT_STUDENT_ID}/activity-feed`,
    );
    expect(beforeApproval.ok()).toBe(true);
    const beforeItems = unwrapM5ApiData<{ items: Array<{ id: string }> }>(
      await beforeApproval.json(),
    );
    expect(beforeItems.items.some((item) => item.id === createdPostId)).toBe(
      false,
    );

    // Admin approves the post through the real moderation workflow. Approving
    // removes the post from this Pending Approval-filtered view immediately
    // (its row's underlying data disappears from the list), so the drawer
    // and any transient success message unmount right away — assert on the
    // row leaving the queue instead of a message that may already be gone.
    await login(page, m5AdminCredentials);
    await page.goto('/dashboard/activity/moderation');
    const pendingRow = page.locator('tr').filter({ hasText: postTitle });
    await expect(pendingRow).toHaveCount(1);
    await pendingRow.click();
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(pendingRow).toHaveCount(0);

    // Now approved: the linked parent must see it.
    await login(page, {
      tenantSlug: m5TeacherCredentials.tenantSlug,
      email: 'guardian.c01a002@schoolos.test',
      password:
        process.env.SCHOOLOS_E2E_M5_GUARDIAN_PASSWORD ??
        'schoolos-local-demo-only',
    });
    const afterApproval = await page.request.get(
      `${API_BASE_URL}/mobile/students/${M5_PARENT_STUDENT_ID}/activity-feed`,
    );
    expect(afterApproval.ok()).toBe(true);
    const afterItems = unwrapM5ApiData<{ items: Array<{ id: string }> }>(
      await afterApproval.json(),
    );
    expect(afterItems.items.some((item) => item.id === createdPostId)).toBe(
      true,
    );
  });
});

function unwrapM5ApiData<T>(payload: unknown): T {
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

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
