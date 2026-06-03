import { expect, test } from '@playwright/test';

test.describe('Public route smoke', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await context.clearPermissions();
  });

  test('home page renders the public SchoolOS landing page', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('banner')).toContainText('SchoolOS');
    await expect(
      page.getByRole('banner').getByRole('link', { name: /^Sign in$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('banner').getByRole('link', { name: /^Request Demo$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('banner').getByRole('link', { name: /Register school/i }),
    ).not.toBeVisible();
    
    // Assert the hero heading
    await expect(
      page.getByRole('heading', { name: /Run your school from one connected operating system/i })
    ).toBeVisible();

    // Assert navbar items exist
    await expect(page.getByRole('navigation').getByRole('link', { name: /^Product$/i })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: /^Modules$/i })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: /^For Schools$/i })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: /^Onboarding$/i })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: /^Security$/i })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: /^Plans$/i })).toBeVisible();

    // Assert forbidden keywords do not exist in navbar/banner
    await expect(page.getByRole('banner').getByRole('link', { name: /^Platform$/i })).not.toBeVisible();
    await expect(page.getByRole('banner').getByRole('link', { name: /^Pricing$/i })).not.toBeVisible();
    await expect(page.getByRole('banner').getByRole('link', { name: /^Schools$/i })).not.toBeVisible();
  });

  test('login page renders expected UI', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveURL(/\/login(?:$|[?#])/);
    await expect(page.getByLabel(/School Code/i)).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign in/i })).toBeVisible();
    
    await expect(
      page.getByText(/Need access\? Contact your school administrator\./i),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Request a demo/i }),
    ).toBeVisible();
  });

  test('register page redirects to request-demo page', async ({ page }) => {
    await page.goto('/register');

    await expect(page).toHaveURL(/\/request-demo(?:$|[?#])/);
  });

  test('request-demo page renders expected UI and can be submitted', async ({ page }) => {
    await page.goto('/request-demo');

    await expect(page).toHaveURL(/\/request-demo(?:$|[?#])/);
    await expect(
      page.getByRole('heading', { name: /^Request a SchoolOS Demo$/i }),
    ).toBeVisible();

    // Verify all B2B intake form fields are visible
    await expect(page.getByLabel(/School Name/i)).toBeVisible();
    await expect(page.getByLabel(/Contact Person Name/i)).toBeVisible();
    await expect(page.getByLabel(/Role \/ Designation/i)).toBeVisible();
    await expect(page.getByLabel(/School Location/i)).toBeVisible();
    await expect(page.getByLabel(/Phone Number/i)).toBeVisible();
    await expect(page.getByLabel(/Email Address/i)).toBeVisible();
    await expect(page.getByLabel(/School Type/i)).toBeVisible();
    await expect(page.getByLabel(/Number of Students/i)).toBeVisible();
    await expect(page.getByLabel(/Number of Branches/i)).toBeVisible();
    await expect(page.getByLabel(/Current System Used/i)).toBeVisible();
    await expect(page.getByLabel(/Expected Rollout Timeline/i)).toBeVisible();
    await expect(page.getByLabel(/Preferred Contact Method/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Modules Interested In/i })).toBeVisible();

    // Fill form fields
    await page.getByLabel(/School Name/i).fill('Shree Janata Secondary School');
    await page.getByLabel(/Contact Person Name/i).fill('Ram Bahadur');
    await page.getByLabel(/Role \/ Designation/i).fill('Principal');
    await page.getByLabel(/School Location/i).fill('Pokhara, Gandaki');
    await page.getByLabel(/Phone Number/i).fill('9801234567');
    await page.getByLabel(/Email Address/i).fill('ram@janataschool.edu.np');
    await page.getByLabel(/School Type/i).selectOption('Secondary School');
    await page.getByLabel(/Number of Students/i).selectOption('1,000–2,000');
    await page.getByLabel(/Number of Branches/i).selectOption('Single branch');
    await page.getByLabel(/Current System Used/i).fill('Ledger Books');
    await page.getByLabel(/Expected Rollout Timeline/i).selectOption('Immediately');
    await page.getByLabel(/Preferred Contact Method/i).selectOption('Phone');

    // Click module buttons (toggles)
    await page.getByRole('button', { name: /Admissions/i }).first().click();
    await page.getByRole('button', { name: /Fees & Receipts/i }).first().click();
    await page.getByRole('button', { name: /Accounting/i }).first().click();

    // Submit form
    await page.getByRole('button', { name: /^Submit Demo Request$/i }).click();

    // Verify local B2B success state
    await expect(
      page.getByRole('heading', { name: /^Demo request prepared\.$/i }),
    ).toBeVisible();
    await expect(page.getByText(/Shree Janata Secondary School/i)).toBeVisible();
    await expect(page.getByText(/Ram Bahadur/i)).toBeVisible();
  });
});
