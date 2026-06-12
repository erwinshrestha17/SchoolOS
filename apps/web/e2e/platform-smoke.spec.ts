import { test, expect } from '@playwright/test';

test.describe('Platform Control Plane Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Login as Platform Super Admin
    await page.goto('/login');
    const tenantSlug = process.env.SCHOOLOS_E2E_PLATFORM_TENANT_SLUG || 'default-school';
    const email = process.env.SCHOOLOS_E2E_PLATFORM_EMAIL || 'platform@schoolos.com';
    const password = process.env.SCHOOLOS_E2E_PLATFORM_PASSWORD || 'platform123';
    await page.getByLabel(/School Code/i).fill(tenantSlug);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    
    // Verify we are logged in
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('Access Platform Dashboard and check metrics', async ({ page }) => {
    await page.goto('/platform/dashboard');
    
    // Verify essential elements
    await expect(page.getByRole('heading', { level: 1 }).last()).toContainText('Operator Attention Dashboard');
    await expect(page.getByText('Control Plane', { exact: true })).toBeVisible();
    await expect(page.locator('text=Total Schools')).toBeVisible();
    await expect(page.locator('text=Active Schools')).toBeVisible();
    
    // Check system health badge
    const healthBadge = page.locator('text=System Ready');
    await expect(healthBadge).toBeVisible();
  });
 
  test('Navigate to School Directory and search', async ({ page }) => {
    await page.goto('/platform/schools');
    
    await expect(page.getByRole('heading', { level: 1 }).last()).toContainText('Schools');
    
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
    await page.goto('/login');
    await page.getByLabel(/School Code/i).fill('default-school');
    await page.fill('input[name="email"]', 'admin@schoolos.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Try to access platform route
    await page.goto('/platform/dashboard');
    
    // Should be redirected to school dashboard since standard admins cannot access platform control plane
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('Platform Settings - Provider safety check', async ({ page }) => {
    await page.goto('/platform/settings');
    
    // Click on Providers tab
    await page.click('button:has-text("Providers")');
    
    // Verify we see masked config
    await expect(page.locator('text=********').first()).toBeVisible();
    
    // Verify New Provider dialog
    await page.click('button:has-text("New Provider")');
    await expect(page.locator('text=Provider Configuration')).toBeVisible();
  });

  test('Tenant Status Management with Audit Reason', async ({ page }) => {
    await page.goto('/platform/schools');
    
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
    await expect(page.getByText('SUSPENDED', { exact: true }).first()).toBeVisible();
  });

  test('Verify SaaS Billing visibility', async ({ page }) => {
    await page.goto('/platform/schools');
    await page.click('text=Trial Academy');
    
    // Go to Billing tab
    await page.click('button:has-text("SaaS Billing")');
    
    // Check for invoice presence (from our seed)
    await expect(page.locator('text=SO-2024').first()).toBeVisible();
    await expect(page.locator('text=NPR 50,000').first()).toBeVisible();
  });

  test('Tenant Change Plan workflow renders with guarded submit', async ({ page }) => {
    await page.goto('/platform/schools');
    await page.click('text=Trial Academy');

    await expect(page.getByRole('button', { name: 'Change Plan' })).toBeVisible();
    await page.getByRole('button', { name: 'Change Plan' }).click();

    await expect(page).toHaveURL(/.*platform\/schools\/.*\/change-plan/);
    await expect(page.getByRole('heading', { level: 1 }).last()).toContainText('Change Subscription Plan');
    await expect(page.getByLabel('New subscription plan')).toBeVisible();
    await expect(page.getByText('Audit reason')).toBeVisible();
    await expect(page.getByText(/SchoolOS subscription billing only/i)).toBeVisible();

    const submit = page.getByRole('button', { name: 'Change Plan' });
    await expect(submit).toBeDisabled();
    await page.getByPlaceholder(/School upgraded/i).fill('Pilot upgrade approved');
    await expect(submit).toBeEnabled();
  });

  test('Tenant detail operator dialogs render for support, billing, invoices, and onboarding', async ({ page }) => {
    await page.goto('/platform/schools');
    await page.click('text=Trial Academy');

    await page.getByTestId('support-mode-button').click();
    await expect(page.getByRole('heading', { name: 'Enter Support Mode' })).toBeVisible();
    const supportSubmit = page.getByRole('button', { name: 'Enter Support Mode' }).last();
    await expect(supportSubmit).toBeDisabled();
    await page.getByPlaceholder(/support case/i).fill('Support ticket verification');
    await expect(supportSubmit).toBeEnabled();
    await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();

    await page.click('button:has-text("SaaS Billing")');
    await page.getByTestId('new-saas-invoice-button').click();
    await expect(page.getByRole('heading', { name: 'Create SchoolOS Subscription Invoice' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();

    await page.getByTestId('billing-profile-edit-button').click();
    await expect(page.getByRole('heading', { name: 'Edit Billing Profile' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();

    await page.click('button:has-text("Overview")');
    await page.getByTestId('onboarding-checklist-button').click();
    await expect(page.getByRole('heading', { name: 'Onboarding Checklist' })).toBeVisible();
  });

  test('Platform settings deep links and operator dialogs render', async ({ page }) => {
    await page.goto('/platform/settings?tab=providers');
    await expect(page.getByRole('tab', { name: 'Providers' })).toHaveAttribute('data-state', 'active');
    await page.getByTestId('provider-edit-button').first().click();
    await expect(page.getByRole('heading', { name: 'Edit Provider' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.goto('/platform/settings?tab=queues');
    await expect(page.getByRole('tab', { name: 'Queues' })).toHaveAttribute('data-state', 'active');
    const retryAll = page.getByRole('button', { name: /Retry All/i }).first();
    if (await retryAll.isEnabled()) {
      await retryAll.click();
      await expect(page.getByRole('heading', { name: 'Retry Failed Job' })).toBeVisible();
      await page.getByRole('button', { name: 'Cancel' }).click();
    }

    await page.goto('/platform/settings?tab=audit');
    await expect(page.getByRole('tab', { name: 'Global Audit' })).toHaveAttribute('data-state', 'active');
    await expect(page.getByText('Resource ID').first()).toBeVisible();
    await expect(page.getByText('Export current page CSV').first()).toBeVisible();
  });

  test('Feature Override Workflow', async ({ page }) => {
    await page.goto('/platform/schools');
    await page.click('text=Trial Academy');
    
    // Go to Entitlements tab
    await page.click('button:has-text("Entitlements")');
    
    // Find a feature and toggle it
    const transportToggle = page.getByText(/^transport$/i).locator('xpath=../..').getByRole('button');
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
    await page.goto('/platform/settings');
    
    // Click on Queues tab
    await page.getByRole('tab', { name: 'Queues' }).click();
    
    // Click Inspect on any queue
    await page.click('button:has-text("Inspect Failed") >> nth=0');
    
    // Verify dialog header
    await expect(page.getByRole('heading', { name: /Failed Jobs/i })).toBeVisible();
    await expect(page.locator('text=Sensitive data in payloads is masked')).toBeVisible();
  });
});

