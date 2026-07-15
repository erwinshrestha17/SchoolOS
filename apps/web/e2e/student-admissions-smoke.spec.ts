import { expect, test, type Page } from '@playwright/test';

const credentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG,
  email: process.env.SCHOOLOS_E2E_EMAIL,
  password: process.env.SCHOOLOS_E2E_PASSWORD,
};

test.describe('Students & Admissions Workflow Smoke', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !credentials.tenantSlug || !credentials.email || !credentials.password,
      'Set E2E credentials to run student/admissions smoke tests.',
    );
    await login(page);
  });

  test('keeps Admissions selected and exposes server-backed queues', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard/admissions');

    await expect(page.getByRole('heading', { name: 'Admissions', exact: true })).toBeVisible();
    await expect(sidebarLink(page, 'Admissions')).toHaveAttribute('aria-current', 'page');
    await expect(sidebarLink(page, 'Students')).not.toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('tab', { name: 'Needs Information' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Completed' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New admission' }).first()).toBeVisible();

    await expectDesktopSummaryRow(page);
    await expectNoHorizontalTabOverflow(page, 'Admission queue views');

    const queueWorkspace = page.getByTestId('admission-queue-workspace');
    await expect(queueWorkspace).toBeVisible();
    const workspaceBox = await queueWorkspace.boundingBox();
    expect(workspaceBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(900);

    const emptyState = queueWorkspace.locator('[data-slot="empty"]');
    if (await emptyState.isVisible()) {
      const emptyBox = await emptyState.boundingBox();
      expect(emptyBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(420);
    }

    await expectResponsiveWorkspace(page, 'admission-queue-workspace', 'Admission queue views');

    await page.getByRole('tab', { name: 'Waiting for Review' }).click();
    await expect(page).toHaveURL(/queue=WAITING_FOR_REVIEW/);
    await page.goBack();
    await expect(page.getByRole('tab', { name: 'Needs Information' })).toHaveAttribute('data-state', 'active');
  });

  test('keeps Students selected, preserves lifecycle state, and opens the admission workflow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard/students');

    await expect(page.getByRole('heading', { name: 'Students', exact: true })).toBeVisible();
    await expect(sidebarLink(page, 'Students')).toHaveAttribute('aria-current', 'page');
    await expect(sidebarLink(page, 'Admissions')).not.toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('group', { name: 'Directory filters' })).toBeVisible();
    await expect(page.getByTestId('student-roster-workspace')).toBeVisible();
    await expectDesktopSummaryRow(page);
    await expectNoHorizontalTabOverflow(page, 'Student lifecycle views');

    const rosterBox = await page.getByTestId('student-roster-workspace').boundingBox();
    expect(rosterBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(900);
    await expectResponsiveWorkspace(page, 'student-roster-workspace', 'Student lifecycle views');
    await page.getByRole('tab', { name: 'Transferred' }).click();
    await expect(page).toHaveURL(/status=TRANSFERRED/);
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Transferred' })).toHaveAttribute('data-state', 'active');

    await page.getByRole('link', { name: 'New admission' }).click();
    await expect(page).toHaveURL(/\/dashboard\/admissions\/new/);
    await expect(sidebarLink(page, 'Admissions')).toHaveAttribute('aria-current', 'page');
  });
});

async function expectDesktopSummaryRow(page: Page) {
  const cards = page.getByTestId('m1-summary-grid').locator(':scope > a');
  await expect(cards).toHaveCount(4);
  const first = await cards.nth(0).boundingBox();
  const last = await cards.nth(3).boundingBox();
  expect(Math.abs((first?.y ?? 0) - (last?.y ?? 0))).toBeLessThanOrEqual(2);
}

async function expectNoHorizontalTabOverflow(page: Page, name: string) {
  const tabs = page.getByRole('tablist', { name });
  const dimensions = await tabs.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function expectResponsiveWorkspace(page: Page, workspaceTestId: string, tabListName: string) {
  for (const width of [1280, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByTestId(workspaceTestId)).toBeVisible();
    await expectNoHorizontalTabOverflow(page, tabListName);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId(workspaceTestId)).toBeVisible();
  await expect(page.getByRole('tablist', { name: tabListName })).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 900 });
}

function sidebarLink(page: Page, name: string) {
  return page.getByRole('complementary').getByRole('link', { name, exact: true });
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/School Code/i).fill(credentials.tenantSlug ?? '');
  await page.getByLabel(/Email/i).fill(credentials.email ?? '');
  await page.getByLabel(/Password/i).fill(credentials.password ?? '');
  await page.getByRole('button', { name: /Sign in/i }).click();
  await page.waitForURL('**/dashboard*', { timeout: 20_000 });
}
