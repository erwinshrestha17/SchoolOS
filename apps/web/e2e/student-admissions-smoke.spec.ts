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

  test('completes a full admission wizard flow', async ({ page }) => {
    await page.goto('/dashboard/admissions');
    
    // Step 0: Personal Info
    await expect(page.getByText('Personal Information')).toBeVisible();
    await page.getByLabel('First Name (EN)').fill('John');
    await page.getByLabel('Last Name (EN)').fill('Doe');
    await page.getByLabel('Date of Birth').fill('2015-05-15');
    await page.getByLabel('Gender').selectOption('MALE');
    await page.getByText('No known disability').click();
    await page.getByRole('button', { name: /Next Step/i }).click();

    // Step 1: Academic Placement
    await expect(page.getByText('Academic Placement')).toBeVisible();
    // Assuming academic years and classes are already seeded
    await page.getByRole('button', { name: /Next Step/i }).click();

    // Step 2: Guardian Contacts
    await expect(page.getByText('Guardian Contacts')).toBeVisible();
    await page.getByLabel('Full Name').first().fill('Robert Doe');
    await page.getByLabel('Relation').first().fill('Father');
    await page.getByLabel('Phone Number').first().fill('9800000001');
    await page.getByRole('button', { name: /Next Step/i }).click();

    // Step 3: Review & Documents
    await expect(page.getByText('Review & Documents')).toBeVisible();
    await expect(page.getByText('John Doe')).toBeVisible();
    await expect(page.getByText('Robert Doe')).toBeVisible();
    
    // We won't actually submit to avoid cluttering DB unless it's a dedicated test DB
    // but the UI check is done.
  });

  test('verifies student directory filters and profile navigation', async ({ page }) => {
    await page.goto('/dashboard/students');
    
    await expect(page.getByText('Directory Filters')).toBeVisible();
    await expect(page.getByRole('button', { name: /Enroll Student/i })).toBeVisible();
    
    // Search for a known student (if any) or just check empty state
    await page
      .getByLabel(/Search students by name, student code, guardian name, or phone/i)
      .fill('UnknownStudentXYZ');
    await expect(page.getByText(/No students found/i)).toBeVisible();
    
    await page.getByRole('button', { name: /Reset All/i }).click();
    await expect(
      page.getByLabel(/Search students by name, student code, guardian name, or phone/i),
    ).toHaveValue('');
  });
});

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/School Code/i).fill(credentials.tenantSlug ?? '');
  await page.getByLabel(/Email/i).fill(credentials.email ?? '');
  await page.getByLabel(/Password/i).fill(credentials.password ?? '');
  await page.getByRole('button', { name: /Sign in/i }).click();
  await page.waitForURL('**/dashboard*', { timeout: 20_000 });
}
