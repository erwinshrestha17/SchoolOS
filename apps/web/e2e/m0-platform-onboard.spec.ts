import { expect, test } from '@playwright/test';

const platformCredentials = {
  tenantSlug:
    process.env.SCHOOLOS_E2E_PLATFORM_TENANT_SLUG ??
    process.env.PLATFORM_SEED_TENANT_SLUG ??
    'platform',
  email:
    process.env.SCHOOLOS_E2E_PLATFORM_EMAIL ??
    process.env.PLATFORM_SEED_EMAIL ??
    'admin@schoolos.io',
  password:
    process.env.SCHOOLOS_E2E_PLATFORM_PASSWORD ??
    process.env.PLATFORM_SEED_PASSWORD ??
    'SchoolOS@2026',
};

test.describe('M0 Platform onboard browser E2E', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !platformCredentials.email || !platformCredentials.password,
      'Platform onboard E2E requires seeded platform operator credentials.',
    );

    await page.goto('/login');
    await page.getByLabel(/School Code/i).fill(platformCredentials.tenantSlug);
    await page.fill('input[name="email"]', platformCredentials.email);
    await page.fill('input[name="password"]', platformCredentials.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('onboards a school from the platform directory and opens onboarding checklist', async ({
    page,
  }) => {
    const slugSuffix = Date.now().toString(36);
    const schoolName = `M0 Onboard ${slugSuffix}`;
    const schoolSlug = `m0-onboard-${slugSuffix}`;
    const adminEmail = `admin-${slugSuffix}@schoolos.test`;
    const adminPassword = 'OnboardTest1!';

    await page.goto('/platform/schools');
    await expect(page.getByRole('heading', { level: 1 }).last()).toContainText(
      'Schools',
    );

    await page.getByRole('button', { name: /Onboard school/i }).first().click();
    await expect(
      page.getByRole('heading', { name: /Onboard new school/i }),
    ).toBeVisible();

    await page.getByPlaceholder('e.g. Antigravity Academy').fill(schoolName);
    await page.getByPlaceholder('e.g. antigravity-academy').fill(schoolSlug);
    await page.getByPlaceholder('admin@school.com').fill(adminEmail);
    await page.getByPlaceholder('Min 8 characters').fill(adminPassword);
    await page
      .locator('form')
      .getByRole('button', { name: /Onboard school/i })
      .click();

    await expect(page.getByText(schoolName)).toBeVisible({ timeout: 15000 });

    await page.getByRole('link', { name: schoolName }).click();
    await expect(page.getByRole('heading', { name: schoolName })).toBeVisible();

    await page.getByRole('link', { name: 'Onboarding' }).click();
    await expect(page.getByRole('heading', { name: 'Onboarding' })).toBeVisible();
  });
});
