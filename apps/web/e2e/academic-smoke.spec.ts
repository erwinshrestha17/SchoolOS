import { expect, test, type Page } from '@playwright/test';

const API_BASE_URL =
  process.env.SCHOOLOS_E2E_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:4000/api/v1';

const schoolAdminCredentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG ?? 'default-school',
  email: process.env.SCHOOLOS_E2E_EMAIL ?? 'admin@schoolos.com',
  password: process.env.SCHOOLOS_E2E_PASSWORD ?? 'admin123',
};

test.describe.serial('SchoolOS Academic Workflow Smoke Tests', () => {
  test.beforeEach(async ({ context, page }) => {
    // Check if API is available
    try {
      const response = await page.request.get(`${API_BASE_URL}/health`);
      if (!response.ok()) {
        test.skip(true, 'API is not healthy');
      }
    } catch {
      test.skip(true, 'API is not reachable');
    }

    await context.clearCookies();
    await login(page, schoolAdminCredentials);
  });

  test('Academic Overview: Navigation and shell integrity', async ({ page }) => {
    await page.goto('/dashboard/academics');
    await expect(page).toHaveURL(/\/dashboard\/academics/);
    await expect(page.getByRole('heading', { name: 'Academics', exact: true })).toBeVisible();

    // Backend-owned KPI cards replaced the earlier decorative module-card
    // grid; verify the real overview surfaces instead of stale card labels.
    const overviewKpis = [
      'Marks Entry Open',
      'Mark Lock Requests',
      'Report Cards Unpublished',
    ];

    for (const kpi of overviewKpis) {
      await expect(page.getByText(kpi, { exact: true })).toBeVisible();
    }
  });

  test('Homework: List and creation form', async ({ page }) => {
    await page.goto('/dashboard/homework');
    await expect(page.getByRole('heading', { name: /^Homework$/i })).toBeVisible();
    
    // Check loading state resolves
    await expect(page.getByText(/Loading homework/i)).not.toBeVisible();
    
    // Navigate to create homework
    await page.getByRole('link', { name: /Create Homework/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/homework\/new/);
    await expect(page.getByRole('heading', { name: /Create Homework/i })).toBeVisible();
    
    // Verify form fields
    await expect(page.getByLabel(/Assignment Title/i)).toBeVisible();
    await expect(page.getByLabel(/Instructions/i)).toBeVisible();
    await expect(page.getByLabel(/Due Date/i)).toBeVisible();
    await expect(page.getByLabel(/Academic Year/i)).toBeVisible();
    await expect(page.getByLabel(/Class/i)).toBeVisible();
    await expect(page.getByLabel(/Subject/i)).toBeVisible();
  });

  test('Timetable: Workspace and tabs', async ({ page }) => {
    await page.goto('/dashboard/timetable');
    await expect(page.getByRole('heading', { name: /Weekly Timetable Builder/i })).toBeVisible();
    
    // Verify tabs
    const tabs = ['Timetable Builder', 'Teacher Workload', 'Homework'];
    for (const tab of tabs) {
      const tabButton = page.getByRole('tab', { name: new RegExp(tab, 'i') });
      await expect(tabButton).toBeVisible();
      await tabButton.click();
    }
  });

  test('Exams: Management and components', async ({ page }) => {
    await page.goto('/dashboard/academics/exams');
    await expect(page.getByRole('heading', { name: /Exam Terms/i })).toBeVisible();
    
    // Check empty state or list
    const hasExams = await page.getByRole('row').count() > 1;
    if (!hasExams) {
      await expect(page.getByText(/No exams found/i)).toBeVisible();
    }

    // Verify create button
    await expect(page.getByRole('button', { name: /Create Exam Term/i })).toBeVisible();
  });

  test('Marks Entry: Roster filters', async ({ page }) => {
    await page.goto('/dashboard/academics/marks');
    await expect(page.getByText(/Select context to begin/i)).toBeVisible();
    
    // Verify filters exist
    await expect(page.getByTestId('filter-exam-term')).toBeVisible();
    await expect(page.getByTestId('filter-class')).toBeVisible();
    await expect(page.getByTestId('filter-subject')).toBeVisible();
    await expect(page.getByTestId('filter-component')).toBeVisible();
  });

  test('Results: Publishing dashboard', async ({ page }) => {
    await page.goto('/dashboard/academics/results');
    await expect(page.getByText(/Select class and term/i)).toBeVisible();
  });

  test('Report Cards: Generation hub', async ({ page }) => {
    await page.goto('/dashboard/academics/report-cards');
    await expect(page.getByRole('heading', { name: /Report Cards/i })).toBeVisible();
    
    // Verify batch generation button exists
    await expect(page.getByRole('button', { name: /Start Generation/i })).toBeVisible();
  });
});

async function login(
  page: Page,
  credentials: { tenantSlug: string; email: string; password: string },
) {
  await page.goto('/login');
  await expect(page.getByLabel(/School Code/i)).toBeVisible();

  await page.getByLabel(/School Code/i).fill(credentials.tenantSlug);
  await page.getByLabel(/Email/i).fill(credentials.email);
  await page.getByLabel(/Password/i).fill(credentials.password);

  await Promise.all([
    page.waitForURL(/\/dashboard(?:$|[/?#])/, { timeout: 20_000 }),
    page.getByRole('button', { name: /Sign in/i }).click(),
  ]);
}
