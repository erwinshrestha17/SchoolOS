import { expect, test } from '@playwright/test';

const credentials = {
  tenantSlug: process.env.SCHOOLOS_E2E_TENANT_SLUG,
  email: process.env.SCHOOLOS_E2E_EMAIL,
  password: process.env.SCHOOLOS_E2E_PASSWORD,
};

const API_BASE_URL =
  process.env.SCHOOLOS_E2E_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:4000/api/v1';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel(/school code|tenant slug/i).fill(credentials.tenantSlug!);
  await page.getByLabel(/^email$/i).fill(credentials.email!);
  await page.getByLabel(/^password$/i).fill(credentials.password!);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/dashboard/);
}

test.describe('Service requests Action Centre smoke', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(
      !credentials.tenantSlug || !credentials.email || !credentials.password,
      'Set SCHOOLOS_E2E_TENANT_SLUG, SCHOOLOS_E2E_EMAIL, and SCHOOLOS_E2E_PASSWORD for authenticated smoke.',
    );

    const health = await request
      .get(`${API_BASE_URL.replace(/\/api\/v1$/, '')}/health`)
      .catch(() => null);
    test.skip(!health?.ok(), 'API must be reachable for authenticated Action Centre smoke.');
  });

  test('loads the Action Centre queue from the real service-requests API', async ({
    page,
  }) => {
    const listResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/service-requests') &&
        response.request().method() === 'GET' &&
        response.status() === 200,
      { timeout: 20_000 },
    );

    await login(page);
    await page.goto('/dashboard/service-requests');

    await expect(page.getByRole('heading', { name: /parent & school requests/i })).toBeVisible();
    await expect(page.getByText(/request queue/i)).toBeVisible();

    const listResponse = await listResponsePromise;
    const payload = (await listResponse.json()) as {
      items?: unknown[];
      total?: number;
    };
    expect(Array.isArray(payload.items)).toBeTruthy();
    expect(typeof payload.total).toBe('number');
  });
});
