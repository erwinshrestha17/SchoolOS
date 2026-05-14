import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:3101';

test.describe('Platform Control Plane Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Login as Platform Super Admin
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', 'superadmin@schoolos.com');
    await page.fill('input[name="password"]', 'superadmin123');
    await page.click('button[type="submit"]');
    
    // Verify we are logged in
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('Access Platform Dashboard and check metrics', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/dashboard`);
    
    // Verify essential elements
    await expect(page.locator('h1')).toContainText('Platform Overview');
    await expect(page.locator('text=Control Plane')).toBeVisible();
    await expect(page.locator('text=Total Schools')).toBeVisible();
    await expect(page.locator('text=Active Schools')).toBeVisible();
    
    // Check system health badge
    const healthBadge = page.locator('text=System Ready');
    await expect(healthBadge).toBeVisible();
  });

  test('Navigate to School Directory and search', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/schools`);
    
    await expect(page.locator('h1')).toContainText('Global Schools');
    
    // Test search functionality
    const searchInput = page.locator('input[placeholder*="Search school name"]');
    await searchInput.fill('Trial Academy');
    
    // Verify result appears (seeded in our new seed.ts)
    await expect(page.locator('text=Trial Academy')).toBeVisible();
  });

  test('Verify Tenant Isolation - Restricted access for standard admin', async ({ page, context }) => {
    // Logout superadmin
    await context.clearCookies();
    
    // Login as a normal school admin
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', 'admin@schoolos.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Try to access platform route
    await page.goto(`${BASE_URL}/platform/dashboard`);
    
    // Should see Permission Denied component or be redirected
    // Given our component, we should see "Access Restricted"
    await expect(page.locator('h1')).toContainText('Access Restricted');
    await expect(page.locator('text=403_FORBIDDEN_PLATFORM')).toBeVisible();
  });

  test('Platform Settings - Provider safety check', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/settings`);
    
    // Click on Providers tab
    await page.click('button:has-text("Providers")');
    
    // Verify we see masked config
    await expect(page.locator('text=••••••••')).toBeVisible();
    
    // Verify New Provider dialog
    await page.click('button:has-text("New Provider")');
    await expect(page.locator('text=Provider Configuration')).toBeVisible();
  });

  test('Tenant Status Management with Audit Reason', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/schools`);
    
    // Find Trial Academy and open details
    await page.click('text=Trial Academy');
    await expect(page).toHaveURL(/.*platform\/schools\/.*/);
    
    // Click Suspend
    await page.click('button:has-text("Suspend School")');
    
    // Verify Dialog and Audit Reason Requirement
    await expect(page.locator('text=Audit Reason')).toBeVisible();
    
    const confirmBtn = page.locator('button:has-text("Confirm Status Change")');
    await expect(confirmBtn).toBeDisabled();
    
    // Fill reason
    await page.fill('textarea', 'Security audit follow-up');
    await expect(confirmBtn).toBeEnabled();
    
    await confirmBtn.click();
    
    // Should reflect suspended state
    await expect(page.locator('text=SUSPENDED')).toBeVisible();
  });
  test('Verify SaaS Billing visibility', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/schools`);
    await page.click('text=Trial Academy');
    
    // Go to Billing tab
    await page.click('button:has-text("SaaS Billing")');
    
    // Check for invoice presence (from our seed)
    await expect(page.locator('text=SO-2024')).toBeVisible();
    await expect(page.locator('text=NPR 50,000')).toBeVisible();
  });

  test('Tenant Change Plan workflow renders with guarded submit', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/schools`);
    await page.click('text=Trial Academy');

    await expect(page.getByRole('button', { name: 'Change Plan' })).toBeVisible();
    await page.getByRole('button', { name: 'Change Plan' }).click();

    await expect(page).toHaveURL(/.*platform\/schools\/.*\/change-plan/);
    await expect(page.locator('h1')).toContainText('Change Subscription Plan');
    await expect(page.getByLabel('New subscription plan')).toBeVisible();
    await expect(page.getByText('Audit reason')).toBeVisible();
    await expect(page.getByText(/SchoolOS subscription billing only/i)).toBeVisible();

    const submit = page.getByRole('button', { name: 'Change Plan' });
    await expect(submit).toBeDisabled();
    await page.getByPlaceholder(/School upgraded/i).fill('Pilot upgrade approved');
    await expect(submit).toBeEnabled();
  });

  test('Tenant detail operator dialogs render for support, billing, invoices, and onboarding', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/schools`);
    await page.click('text=Trial Academy');

    await page.getByTestId('support-mode-button').click();
    await expect(page.getByText('Enter Support Mode')).toBeVisible();
    const supportSubmit = page.getByRole('button', { name: 'Enter Support Mode' });
    await expect(supportSubmit).toBeDisabled();
    await page.getByPlaceholder(/support case/i).fill('Support ticket verification');
    await expect(supportSubmit).toBeEnabled();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.click('button:has-text("SaaS Billing")');
    await page.getByTestId('new-saas-invoice-button').click();
    await expect(page.getByText('Create SchoolOS Subscription Invoice')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.getByTestId('billing-profile-edit-button').click();
    await expect(page.getByText('Edit Billing Profile')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.click('button:has-text("Overview")');
    await page.getByTestId('onboarding-checklist-button').click();
    await expect(page.getByText('Onboarding Checklist')).toBeVisible();
  });

  test('Platform settings deep links and operator dialogs render', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/settings?tab=providers`);
    await expect(page.getByRole('tab', { name: 'Providers' })).toHaveAttribute('data-state', 'active');
    await page.getByTestId('provider-edit-button').first().click();
    await expect(page.getByText('Edit Provider')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.goto(`${BASE_URL}/platform/settings?tab=queues`);
    await expect(page.getByRole('tab', { name: 'Queues' })).toHaveAttribute('data-state', 'active');
    const retryAll = page.getByRole('button', { name: /Retry All/i }).first();
    if (await retryAll.isEnabled()) {
      await retryAll.click();
      await expect(page.getByText('Retry Failed Job')).toBeVisible();
      await page.getByRole('button', { name: 'Cancel' }).click();
    }

    await page.goto(`${BASE_URL}/platform/settings?tab=audit`);
    await expect(page.getByRole('tab', { name: 'Global Audit' })).toHaveAttribute('data-state', 'active');
    await expect(page.getByText('Resource ID')).toBeVisible();
    await expect(page.getByText('Export current page CSV')).toBeVisible();
  });

  test('Feature Override Workflow', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/schools`);
    await page.click('text=Trial Academy');
    
    // Go to Entitlements tab
    await page.click('button:has-text("Entitlements")');
    
    // Find a feature and toggle it
    const transportToggle = page.locator('div:has-text("Transport") >> button');
    const initialState = await transportToggle.innerText();
    
    await transportToggle.click();
    
    // Should see override dialog
    await expect(page.locator('text=Confirm Feature Override')).toBeVisible();
    await page.fill('textarea', 'Pilot program activation');
    await page.click('button:has-text("Confirm Override")');
    
    // State should change
    const newState = await transportToggle.innerText();
    expect(newState).not.toBe(initialState);
    
    // Should appear in overrides list
    await expect(page.locator('text=Pilot program activation')).toBeVisible();
  });

  test('Queue Job Inspection safety', async ({ page }) => {
    await page.goto(`${BASE_URL}/platform/settings`);
    
    // Click on Queues tab
    await page.click('button:has-text("Infrastructure & Queues")');
    
    // Click Inspect on any queue
    await page.click('button:has-text("Inspect Failed") >> nth=0');
    
    // Verify dialog header
    await expect(page.locator('text=Failed Jobs')).toBeVisible();
    await expect(page.locator('text=Sensitive data in payloads is masked')).toBeVisible();
  });
});
