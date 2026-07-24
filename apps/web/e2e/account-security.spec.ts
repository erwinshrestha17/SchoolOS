import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const API_BASE_URL =
  process.env.SCHOOLOS_E2E_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:4000/api/v1';

const schoolCredentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG,
  email: process.env.SCHOOLOS_E2E_EMAIL,
  password: process.env.SCHOOLOS_E2E_PASSWORD,
};

const passwordTestAccount = {
  email: process.env.SCHOOLOS_E2E_PASSWORD_TEST_EMAIL,
  temporaryPassword: process.env.SCHOOLOS_E2E_PASSWORD_TEST_TEMP,
  finalPassword: process.env.SCHOOLOS_E2E_PASSWORD_TEST_FINAL,
};

type Credentials = {
  tenantSlug?: string;
  email?: string;
  password?: string;
};

test.describe.serial('M0 Account & Security browser E2E', () => {
  test.beforeEach(async ({ context, page }) => {
    test.skip(
      !schoolCredentials.tenantSlug ||
        !schoolCredentials.email ||
        !schoolCredentials.password,
      'Account & Security E2E requires seeded school admin credentials.',
    );
    await requireHealthyApi(page);
    await clearBrowserSession(context, page);
  });

  test('shows school-friendly wrong-current-password feedback', async ({
    page,
  }) => {
    await login(page, schoolCredentials);
    await page.goto('/dashboard/settings/personal/security');
    await expect(
      page.getByRole('heading', { name: /Account & Security/i }),
    ).toBeVisible();

    await page.getByLabel(/^Current password$/i).fill('WrongCurrent1!');
    await page.getByLabel(/^New password$/i).fill('ValidWrong1!');
    await page.getByLabel(/^Confirm new password$/i).fill('ValidWrong1!');
    await page.getByRole('button', { name: /^Change password$/i }).click();

    await expect(
      page.getByText(
        /Current password is incorrect|Could not change password/i,
      ),
    ).toBeVisible();
  });

  test('shows neutral password rules and accessible live validation', async ({
    page,
  }) => {
    await login(page, schoolCredentials);
    await page.goto('/dashboard/settings/personal/security');

    const lengthRule = page
      .getByRole('listitem')
      .filter({ hasText: 'Minimum 8 characters' });
    const uppercaseRule = page
      .getByRole('listitem')
      .filter({ hasText: 'At least 1 uppercase letter' });
    const newPassword = page.getByLabel(/^New password$/i);
    const confirmation = page.getByLabel(/^Confirm new password$/i);
    const visibilityControl = page.getByRole('button', {
      // The accessible name flips between "Show new password" and
      // "Hide new password" when toggled, so this must match both states
      // for the same locator to keep resolving after the click below.
      name: /^(Show|Hide) new password$/i,
    });

    await expect(lengthRule).toContainText('Required');
    await expect(lengthRule).not.toContainText('Met');

    await newPassword.fill('longpassword1!');
    await expect(lengthRule).toContainText('Met');
    await expect(uppercaseRule).toContainText('Not met');

    await confirmation.fill('DoesNotMatch1!');
    await confirmation.blur();
    await expect(
      page.getByText(/Confirm password must match new password/i),
    ).toBeVisible();
    await expect(confirmation).toHaveAttribute('aria-invalid', 'true');

    await expect(newPassword).toHaveAttribute('type', 'password');
    await visibilityControl.click();
    await expect(newPassword).toHaveAttribute('type', 'text');
    await expect(visibilityControl).toHaveAttribute('aria-pressed', 'true');
  });

  test('shows admin reset action in tenant-scoped user management', async ({
    page,
  }) => {
    const loginResult = await login(page, schoolCredentials);
    test.skip(
      loginResult.mustChangePassword,
      'Admin reset visibility requires an admin account that is not forced through password change.',
    );

    await page.goto('/dashboard/settings/access/users');
    await expect(
      page.getByRole('heading', { name: /Users & access/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Reset password/i }).first(),
    ).toBeVisible();
  });

  test('admin reset forces next-login password change, then user changes password', async ({
    context,
    page,
  }) => {
    test.skip(
      !passwordTestAccount.email ||
        !passwordTestAccount.temporaryPassword ||
        !passwordTestAccount.finalPassword,
      'Set SCHOOLOS_E2E_PASSWORD_TEST_EMAIL, SCHOOLOS_E2E_PASSWORD_TEST_TEMP, and SCHOOLOS_E2E_PASSWORD_TEST_FINAL for mutating password E2E.',
    );

    const loginResult = await login(page, schoolCredentials);
    test.skip(
      loginResult.mustChangePassword,
      'Admin reset setup requires an admin account that is not forced through password change.',
    );

    await page.goto('/dashboard/settings/access/users');
    const userRow = page.getByTestId(
      `settings-user-row-${passwordTestAccount.email}`,
    );
    await expect(userRow).toBeVisible();
    await userRow.getByRole('button', { name: /Reset password/i }).click();
    await page
      .getByPlaceholder(/Minimum 8 characters, mixed/i)
      .fill(passwordTestAccount.temporaryPassword!);
    await page.getByRole('button', { name: /Confirm reset/i }).click();
    await expect(page.getByText(/Password reset/i)).toBeVisible();

    await clearBrowserSession(context, page);
    const forcedLogin = await login(page, {
      tenantSlug: schoolCredentials.tenantSlug!,
      email: passwordTestAccount.email!,
      password: passwordTestAccount.temporaryPassword!,
    });
    expect(forcedLogin.mustChangePassword).toBe(true);
    await expect(page).toHaveURL(
      /\/dashboard\/settings\/personal\/security(?:$|[?#])/,
    );

    await page
      .getByLabel(/^Current password$/i)
      .fill(passwordTestAccount.temporaryPassword!);
    await page
      .getByLabel(/^New password$/i)
      .fill(passwordTestAccount.finalPassword!);
    await page
      .getByLabel(/^Confirm new password$/i)
      .fill(passwordTestAccount.finalPassword!);
    await page.getByRole('button', { name: /^Change password$/i }).click();

    await expect(
      page.getByText(/Password changed successfully/i),
    ).toBeVisible();
  });
});

async function requireHealthyApi(page: Page) {
  try {
    const response = await page.request.get(`${API_BASE_URL}/health`);
    test.skip(!response.ok(), 'API is not healthy');
  } catch {
    test.skip(true, 'API is not reachable');
  }
}

async function clearBrowserSession(context: BrowserContext, page: Page) {
  await context.clearCookies();
  await page.goto('/login');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

async function login(page: Page, credentials: Credentials) {
  await page.goto('/login');
  await expect(page.getByLabel(/School Code/i)).toBeVisible();
  await page.getByLabel(/School Code/i).fill(credentials.tenantSlug ?? '');
  await page.getByLabel(/Email/i).fill(credentials.email ?? '');
  await page.getByLabel(/Password/i).fill(credentials.password ?? '');

  await Promise.all([
    page.waitForURL(
      /\/(?:dashboard(?:\/settings\/personal\/security)?|platform(?:\/account-security)?)(?:$|[/?#])/,
      { timeout: 20_000 },
    ),
    page.getByRole('button', { name: /Sign in/i }).click(),
  ]);

  return {
    mustChangePassword:
      /\/(?:account-security|settings\/personal\/security)(?:$|[?#])/.test(
        page.url(),
      ),
  };
}
