import { test, expect } from '@playwright/test';

// Controlled API fixtures exercise the rendered workflow. Database authority
// and live-session denial are covered separately by the PostgreSQL suite.
const permissions = [
  'hr:read',
  'hr:attendance:read',
  'hr:attendance-corrections:approve',
];
const tenant = {
  id: 'synthetic-school',
  slug: 'synthetic-school',
  name: 'Synthetic School',
  securityDomain: 'SCHOOL',
};
const user = {
  id: 'checker',
  tenantId: tenant.id,
  tenantSlug: tenant.slug,
  email: 'checker@example.test',
  authMethod: 'PASSWORD',
  securityDomain: 'SCHOOL',
  mustChangePassword: false,
  roles: ['hr_manager'],
  permissions,
};
const original = {
  id: 'request-1',
  attendanceId: 'attendance-1',
  staffId: 'staff-1',
  attendanceDate: '2026-11-02T00:00:00Z',
  originalStatus: 'ABSENT',
  requestedStatus: 'PRESENT',
  originalCheckInAt: null,
  requestedCheckInAt: '2026-11-02T03:00:00Z',
  originalCheckOutAt: null,
  requestedCheckOutAt: null,
  reason: 'Verified missing check-in',
  requesterId: 'maker',
  approverId: null,
  decidedAt: null,
  status: 'PENDING',
  staff: { fullName: 'Synthetic Staff' },
};

async function prepare(
  page: import('@playwright/test').Page,
  locked = false,
  self = false,
) {
  let item = { ...original, requesterId: self ? user.id : 'maker' };
  await page.addInitScript(
    ({ user, tenant }) =>
      localStorage.setItem(
        'schoolos.auth-session',
        JSON.stringify({ user, tenant }),
      ),
    { user, tenant },
  );
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    let status = 200;
    if (path.endsWith('/auth/me'))
      data = {
        ...user,
        userId: user.id,
        tenant,
        profileType: 'user',
        staff: null,
        student: null,
      };
    else if (path.endsWith('/me/entitlements'))
      data = {
        tier: 'PREMIUM',
        modules: ['hr', 'payroll', 'attendance'],
        features: [],
        addOns: [],
      };
    else if (path.endsWith('/staff-attendance-corrections'))
      data = { items: [item], total: 1, page: 1, limit: 25 };
    else if (path.endsWith('/payroll-impact'))
      data = {
        correctionId: item.id,
        workingDays: 30,
        paidDaysDelta: 1,
        unpaidDaysDelta: -1,
        payrollLocked: locked,
        basis: 'CURRENT_PAYROLL_DAY_RULES',
        provisional: true,
      };
    else if (path.endsWith('/approve')) {
      item = {
        ...item,
        status: locked ? 'PENDING_PAYROLL_ADJUSTMENT' : 'APPROVED',
      };
      data = item;
    } else if (path.endsWith('/reject')) {
      item = { ...item, status: 'REJECTED' };
      data = item;
    } else if (path.endsWith('/summary'))
      data = { items: [], staff: [], totals: {}, month: 11, year: 2026 };
    else if (path.endsWith('/sync/authority')) {
      status = 403;
      data = null;
    }
    await route.fulfill({
      status,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': 'http://localhost:3117',
        'access-control-allow-credentials': 'true',
      },
      body: JSON.stringify({
        success: status === 200,
        data,
        message: status === 200 ? 'OK' : 'Unavailable',
      }),
    });
  });
  await page.goto('/dashboard/hr/attendance');
  await expect(
    page.getByRole('heading', { name: 'Attendance correction review' }),
  ).toBeVisible();
}

test('approver reviews original/requested state, impact and queued approval on desktop and narrow web', async ({
  page,
}) => {
  await prepare(page, true);
  await expect(page.getByText('Synthetic Staff')).toBeVisible();
  await page.getByRole('button', { name: 'Review request' }).click();
  await expect(page.getByText('Verified missing check-in')).toBeVisible();
  await expect(page.getByText(/paid days \+1; unpaid days -1/)).toBeVisible();
  await page.screenshot({
    path: 'output/playwright/staff-correction-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(
    page.getByRole('button', { name: 'Approve', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: 'output/playwright/staff-correction-narrow.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Approve', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByText(/Approved · Pending payroll adjustment/),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Approve', exact: true }),
  ).toHaveCount(0);
});

test('requester cannot decide their own correction', async ({ page }) => {
  await prepare(page, false, true);
  await page.getByRole('button', { name: 'Review request' }).click();
  await expect(
    page.getByText('A different authorized user must decide this request.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Approve', exact: true }),
  ).toHaveCount(0);
});

test('rejection requires a reason and refreshes the decided state', async ({
  page,
}) => {
  await prepare(page);
  await page.getByRole('button', { name: 'Review request' }).click();
  const reject = page.getByRole('button', { name: 'Reject', exact: true });
  await expect(reject).toBeDisabled();
  await page
    .getByLabel('Decision reason (required to reject)')
    .fill('Evidence does not support this request');
  await reject.click();
  await expect(page.getByText('REJECTED', { exact: true })).toBeVisible();
});

test('a denied refresh removes previously loaded protected correction details', async ({
  page,
}) => {
  await prepare(page);
  await page.getByRole('button', { name: 'Review request' }).click();
  await expect(page.getByText('Verified missing check-in')).toBeVisible();
  await page.route('**/api/v1/hr/staff-attendance-corrections**', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        data: null,
        message: 'Correction access denied',
      }),
    }),
  );
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh queue' }).click();
  await expect(
    page.getByText('Unable to load correction requests.'),
  ).toBeVisible();
  await expect(page.getByText('Verified missing check-in')).toHaveCount(0);
  await expect(page.getByText('Synthetic Staff', { exact: true })).toHaveCount(
    0,
  );
});
