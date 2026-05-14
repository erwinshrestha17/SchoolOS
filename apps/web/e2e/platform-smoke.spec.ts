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
