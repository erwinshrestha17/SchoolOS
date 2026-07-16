import { test, expect } from './fixtures/auth';

const authenticatedEvidenceAvailable = Boolean(
  process.env.SCHOOLOS_E2E_TENANT_SLUG &&
  process.env.SCHOOLOS_E2E_EMAIL &&
  process.env.SCHOOLOS_E2E_PASSWORD,
);

test.describe.serial('M12 and M15 authenticated notice workflows', () => {
  test.skip(
    !authenticatedEvidenceAvailable,
    'Set authenticated seeded SchoolOS E2E credentials before collecting notice workflow evidence.',
  );

  test('normal draft can be edited, previewed, published, archived, and restored without a second publish', async ({
    page,
  }) => {
    const title = `E2E normal notice ${Date.now()}`;
    await page.goto('/dashboard/notices/new');
    await page.getByLabel('Title').fill(title);
    await page
      .getByLabel('Concise message')
      .fill('This notice verifies the draft-first web workflow.');
    await page.getByRole('button', { name: 'Preview recipients' }).click();
    await expect(page.getByText('Backend-selected channels')).toBeVisible();
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page).toHaveURL(/\/dashboard\/notices\/[^/]+$/);

    await page.getByRole('link', { name: 'Edit draft' }).click();
    await page
      .getByLabel('Concise message')
      .fill('Edited before publication through the real draft endpoint.');
    await page.getByRole('button', { name: 'Save draft' }).click();

    await page.getByRole('link', { name: 'Preview & publish' }).click();
    await expect(page.getByText('Backend recipient preview')).toBeVisible();
    await page.getByRole('button', { name: 'Publish now' }).click();
    const publishDialog = page.getByRole('dialog');
    await expect(publishDialog).toContainText('eligible recipients');
    await publishDialog.getByRole('button', { name: 'Publish now' }).click();
    await expect(page.getByText('Published', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Archive' }).click();
    await page
      .getByLabel('Reason')
      .fill('Authenticated archive workflow evidence.');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Archive' })
      .click();
    await expect(page.getByText('Archived', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Restore' }).click();
    await page
      .getByLabel('Reason')
      .fill('Restore lifecycle evidence without redispatch.');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Restore' })
      .click();
    await expect(page.getByText('Published', { exact: true })).toBeVisible();
  });

  test('scheduled notice appears in the scheduled workspace and can be cancelled with a reason', async ({
    page,
  }) => {
    const title = `E2E scheduled notice ${Date.now()}`;
    await page.goto('/dashboard/notices/new');
    await page.getByLabel('Title').fill(title);
    await page
      .getByLabel('Concise message')
      .fill('Scheduled lifecycle evidence.');
    await page.getByRole('button', { name: 'Save draft' }).click();

    await page.getByRole('link', { name: 'Preview & publish' }).click();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const localValue = new Date(
      future.getTime() - future.getTimezoneOffset() * 60_000,
    )
      .toISOString()
      .slice(0, 16);
    await page.getByLabel('Optional Nepal-local schedule').fill(localValue);
    await page.getByRole('button', { name: 'Schedule' }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Schedule' })
      .click();

    await page.goto('/dashboard/notices/scheduled');
    await expect(page.getByRole('link', { name: title })).toBeVisible();
    await page.getByRole('link', { name: title }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page
      .getByLabel('Reason')
      .fill('Schedule cancelled by authenticated E2E.');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Cancel' })
      .click();
    await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
  });

  test('urgent draft requires approval and pagination remains server driven', async ({
    page,
  }) => {
    const title = `E2E urgent notice ${Date.now()}`;
    await page.goto('/dashboard/notices/new');
    await page.getByLabel('Title').fill(title);
    await page
      .getByLabel('Concise message')
      .fill('Approval boundary evidence.');
    await page.getByLabel('Priority').selectOption('URGENT');
    await expect(page.getByText(/cannot bypass approval/i)).toBeVisible();
    await page.getByRole('button', { name: 'Save draft' }).click();

    await page.getByRole('link', { name: 'Preview & publish' }).click();
    await expect(
      page.getByRole('button', { name: 'Submit for approval' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Publish now' }),
    ).toHaveCount(0);

    const request = page.waitForRequest(
      (candidate) =>
        candidate.url().includes('/notices?') &&
        candidate.url().includes('page=2'),
    );
    await page.goto('/dashboard/notices?page=2&priority=URGENT');
    const paginationRequest = await request;
    expect(paginationRequest.url()).toContain('priority=URGENT');
  });

  for (const width of [1440, 1280, 1024]) {
    test(`notice operations render without browser errors at ${width}px`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/dashboard/notices');
      await expect(page.getByTestId('notice-list-workspace')).toBeVisible();
      await page.goto('/dashboard/notices/deliveries');
      await expect(
        page.getByRole('heading', { name: 'Delivery logs' }),
      ).toBeVisible();
      await page.goto('/dashboard/notifications');
      await expect(
        page.getByRole('heading', { name: 'Notification center' }),
      ).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});
