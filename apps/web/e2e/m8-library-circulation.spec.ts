import { expect, test } from './fixtures/auth';

// Matches apps/api/prisma/seed-m8-library-e2e.ts's fixed IDs.
const FIXTURE_BOOK_TITLE = 'The Wind-Up Bird (E2E Fixture)';
const FIXTURE_COPY_BARCODE = 'LIB-E2E-0001';
const FIXTURE_STUDENT_NAME = 'Ashika Library E2E';

const m8LibraryFixturesEnabled =
  process.env.SCHOOLOS_E2E_M8_LIBRARY_FIXTURES === 'true';

test.describe.serial('M8 Library circulation lifecycle', () => {
  test.beforeEach(() => {
    test.skip(
      !m8LibraryFixturesEnabled,
      'Set SCHOOLOS_E2E_M8_LIBRARY_FIXTURES=true after seeding db:seed:e2e:m8-library to run the M8 library circulation lifecycle test.',
    );
  });

  test('a librarian issues the fixture copy to the fixture student', async ({
    page,
  }) => {
    await page.goto('/dashboard/library/issues');
    await expect(
      page.getByRole('heading', { name: 'Issue copy' }),
    ).toBeVisible();

    await page
      .getByRole('button', { name: 'Search available barcode or book title...' })
      .click();
    await page.getByPlaceholder('Search catalogue...').fill(FIXTURE_COPY_BARCODE);
    await page
      .getByRole('button', { name: FIXTURE_BOOK_TITLE, exact: false })
      .click();

    await page
      .getByRole('button', { name: 'Search by name or ID...' })
      .click();
    await page.getByPlaceholder('Type to search...').fill('Ashika');
    await page
      .getByRole('button', { name: FIXTURE_STUDENT_NAME, exact: false })
      .click();

    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    await page.getByLabel('Due date').fill(dueDate);

    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/library/issues') &&
          response.request().method() === 'POST' &&
          response.ok(),
      ),
      page.getByRole('button', { name: 'Issue book now' }).click(),
    ]);

    await expect(page.getByText('Book issued.')).toBeVisible();

    await page.goto('/dashboard/library/copies');
    await page.getByPlaceholder('Search barcode').fill(FIXTURE_COPY_BARCODE);
    await expect(
      page.getByText(FIXTURE_COPY_BARCODE).locator('..').getByText('Issued', {
        exact: false,
      }),
    ).toBeVisible();
  });

  test('the librarian returns the fixture copy and it clears back to available', async ({
    page,
  }) => {
    await page.goto('/dashboard/library/issues');
    await expect(
      page.getByRole('heading', { name: 'Issue copy' }),
    ).toBeVisible();

    const issueRow = page
      .locator('div')
      .filter({ hasText: FIXTURE_BOOK_TITLE })
      .filter({ hasText: FIXTURE_STUDENT_NAME })
      .filter({ has: page.getByRole('button', { name: 'Return Copy' }) })
      .last();
    await expect(issueRow.getByRole('button', { name: /Return Copy/i })).toBeVisible();
    await issueRow.getByRole('button', { name: /Return Copy/i }).click();

    await Promise.all([
      page.waitForResponse(
        (response) =>
          /\/library\/issues\/.+\/return/.test(response.url()) &&
          response.request().method() === 'PATCH' &&
          response.ok(),
      ),
      page.getByRole('button', { name: 'Return now' }).click(),
    ]);

    await expect(page.getByText('Book returned.')).toBeVisible();

    await page.goto('/dashboard/library/copies');
    await page.getByPlaceholder('Search barcode').fill(FIXTURE_COPY_BARCODE);
    await expect(
      page
        .getByText(FIXTURE_COPY_BARCODE)
        .locator('..')
        .getByText('Available', { exact: false }),
    ).toBeVisible();
  });
});
