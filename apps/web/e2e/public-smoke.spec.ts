import { expect, test } from '@playwright/test';

test.describe('Public route smoke', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await context.clearPermissions();
  });

  test('home page renders the public SchoolOS landing page', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('banner')).toContainText('SchoolOS');
    await expect(
      page.getByRole('banner').getByRole('link', { name: /^Sign in$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('banner').getByRole('link', { name: /^Request a demo$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('banner').getByRole('link', { name: /Register school/i }),
    ).not.toBeVisible();

    // Assert the hero heading
    await expect(
      page.getByRole('heading', {
        name: /One connected place to run your school/i,
      }),
    ).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(
      page.getByText('Illustrative product preview', { exact: false }),
    ).toBeVisible();

    // The public navigation points to substantive routes and the demo flow.
    await expect(
      page
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('link', { name: /^Product$/i }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('link', { name: /^Solutions$/i }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('link', { name: /^How it works$/i }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('link', { name: /^Security$/i }),
    ).toBeVisible();

    // Assert forbidden keywords do not exist in navbar/banner
    await expect(
      page.getByRole('banner').getByRole('link', { name: /^Platform$/i }),
    ).not.toBeVisible();
    await expect(
      page.getByRole('banner').getByRole('link', { name: /^Pricing$/i }),
    ).not.toBeVisible();
    await expect(
      page.getByRole('banner').getByRole('link', { name: /^Schools$/i }),
    ).not.toBeVisible();
  });

  test('marketing pages have meaningful routes, active navigation, and metadata', async ({
    page,
  }) => {
    const routes = [
      {
        path: '/product',
        nav: 'Product',
        heading: 'Bring the school day into focus.',
      },
      {
        path: '/solutions',
        nav: 'Solutions',
        heading: 'The right view for every part of the school.',
      },
      {
        path: '/security',
        nav: 'Security',
        heading: 'Access should follow responsibility.',
      },
    ];

    for (const route of routes) {
      await page.goto(route.path);
      await expect(page.locator('h1')).toHaveText(route.heading);
      await expect(page.getByRole('main')).toBeVisible();
      await expect(
        page
          .getByRole('navigation', { name: 'Main navigation' })
          .getByRole('link', { name: route.nav }),
      ).toHaveAttribute('aria-current', 'page');
      await expect(page).toHaveTitle(/SchoolOS/);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        /SchoolOS/i,
      );
      await expect(
        page
          .getByRole('contentinfo')
          .getByRole('link', { name: 'Request a demo' }),
      ).toHaveAttribute('href', '/request-demo');
    }

    await page.goto('/solutions');
    await page.getByRole('link', { name: 'Parents & guardians' }).click();
    await expect(page).toHaveURL(/\/solutions#parents$/);
    await expect(
      page.getByRole('heading', { name: 'Know what matters for your child.' }),
    ).toBeVisible();
  });

  test('mobile navigation and landing layout remain usable across widths', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const menu = page.getByRole('button', { name: 'Open menu' });
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(
      page.getByRole('navigation', { name: 'Mobile navigation' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('navigation', { name: 'Mobile navigation' }),
    ).not.toBeVisible();
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page
      .getByRole('navigation', { name: 'Mobile navigation' })
      .getByRole('link', { name: 'Solutions' })
      .click();
    await expect(page).toHaveURL(/\/solutions$/);
    await expect(
      page.getByRole('navigation', { name: 'Mobile navigation' }),
    ).not.toBeVisible();

    for (const path of [
      '/',
      '/product',
      '/solutions',
      '/security',
      '/privacy',
      '/terms',
      '/request-demo',
    ]) {
      await page.goto(path);
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const documentWidth = await page.evaluate(
          () => document.documentElement.scrollWidth,
        );
        expect(
          documentWidth,
          `horizontal overflow on ${path} at ${width}px`,
        ).toBeLessThanOrEqual(width);
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page
      .getByRole('navigation', { name: 'Mobile navigation' })
      .getByRole('link', { name: 'Request a demo' })
      .click();
    await expect(page).toHaveURL(/\/request-demo(?:$|[?#])/);
  });

  test('marketing entrances respect reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/product');

    const heading = page.getByRole('heading', {
      name: 'Bring the school day into focus.',
    });
    await expect(heading).toBeVisible();
    expect(
      await heading.evaluate(
        (element) => getComputedStyle(element.parentElement!).animationName,
      ),
    ).toBe('none');
  });

  test('keyboard users can skip the shared marketing navigation', async ({
    page,
  }) => {
    await page.goto('/product');
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', { name: 'Skip to content' }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
  });

  test('legal drafts and indexing stay closed until launch configuration is approved', async ({
    page,
    request,
  }) => {
    for (const path of ['/privacy', '/terms']) {
      await page.goto(path);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.getByRole('note')).toContainText('Draft for review');
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        /noindex/,
      );
    }

    const robots = await request.get('/robots.txt');
    expect(robots.ok()).toBeTruthy();
    expect(await robots.text()).toContain('Disallow: /');

    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.ok()).toBeTruthy();
    expect(await sitemap.text()).not.toContain('/product');

    const missing = await page.goto('/a-page-that-does-not-exist');
    expect(missing?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { name: 'This page isn’t here.' }),
    ).toBeVisible();
  });

  test('public assets and baseline response headers are present', async ({
    request,
  }) => {
    const homepage = await request.get('/');
    expect(homepage.headers()['x-content-type-options']).toBe('nosniff');
    expect(homepage.headers()['referrer-policy']).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(homepage.headers()['strict-transport-security']).toContain(
      'max-age=',
    );
    expect(homepage.headers()['content-security-policy']).toContain(
      "object-src 'none'",
    );

    const icon = await request.get('/icon.svg');
    expect(icon.ok()).toBeTruthy();
    expect(icon.headers()['content-type']).toMatch(/image\/svg\+xml/);

    const social = await request.get('/opengraph-image');
    expect(social.ok()).toBeTruthy();
    expect(social.headers()['content-type']).toMatch(/image\/png/);
  });

  test('public marketing links resolve to live routes and fragments', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    const origin = new URL(page.url()).origin;
    const links = new Set<string>();
    for (const path of [
      '/',
      '/product',
      '/solutions',
      '/security',
      '/privacy',
      '/terms',
      '/request-demo',
    ]) {
      await page.goto(path);
      const hrefs = await page
        .locator('a[href]')
        .evaluateAll((elements) =>
          elements.map((element) => element.getAttribute('href')!),
        );
      for (const href of hrefs) {
        const url = new URL(href, origin + path);
        if (url.origin === origin) links.add(url.pathname + url.hash);
      }
    }

    for (const href of links) {
      const url = new URL(href, origin);
      const response = await request.get(url.pathname);
      expect(response.status(), `broken marketing link: ${href}`).toBeLessThan(
        400,
      );
      if (url.hash) {
        await page.goto(url.pathname);
        const id = decodeURIComponent(url.hash.slice(1));
        await expect(
          page.locator(`[id="${id}"]`),
          `missing fragment: ${href}`,
        ).toHaveCount(1);
      }
    }
  });

  test('login page renders expected UI', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveURL(/\/login(?:$|[?#])/);
    await expect(page.getByLabel(/School Code/i)).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/^Password$/i)).toBeVisible();
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

  test('request-demo page renders expected UI and can be submitted', async ({
    page,
  }) => {
    await page.route('**/api/v1/demo-requests', async (route) => {
      const request = route.request();
      expect(request.method()).toBe('POST');
      expect(await request.postDataJSON()).toMatchObject({
        schoolName: 'Shree Janata Secondary School',
        contactName: 'Ram Bahadur',
        email: 'ram@janataschool.edu.np',
        interestedModules: [
          'Admissions & Student Profiles',
          'Fees & Receipts',
          'Accounting & Finance',
        ],
      });

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Demo request submitted',
          data: {
            id: 'demo-request-e2e',
            status: 'NEW',
            createdAt: '2026-06-04T00:00:00.000Z',
          },
          meta: null,
        }),
      });
    });

    await page.goto('/request-demo');

    await expect(page).toHaveURL(/\/request-demo(?:$|[?#])/);
    await expect(
      page.getByRole('heading', { name: /^Request a SchoolOS Demo$/i }),
    ).toBeVisible();

    // Verify the current public B2B intake fields are visible.
    await expect(page.getByLabel(/School Name/i)).toBeVisible();
    await expect(page.getByLabel(/Contact Person Name/i)).toBeVisible();
    await expect(page.getByLabel(/Role \/ Designation/i)).toBeVisible();
    await expect(page.getByLabel(/School Location/i)).toBeVisible();
    await expect(page.getByLabel(/Phone Number/i)).toBeVisible();
    await expect(page.getByLabel(/Email Address/i)).toBeVisible();
    await expect(page.getByLabel(/School Type/i)).toBeVisible();
    await expect(page.getByLabel(/Number of Students/i)).toBeVisible();
    await expect(page.getByLabel(/Current System Used/i)).toBeVisible();
    await expect(page.getByLabel(/Expected Rollout Timeline/i)).toBeVisible();
    await expect(page.getByLabel(/Preferred Contact Method/i)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Modules Interested In/i }),
    ).toBeVisible();

    // Fill form fields
    await page.getByLabel(/School Name/i).fill('Shree Janata Secondary School');
    await page.getByLabel(/Contact Person Name/i).fill('Ram Bahadur');
    await page.getByLabel(/Role \/ Designation/i).fill('Principal');
    await page.getByLabel(/School Location/i).fill('Pokhara, Gandaki');
    await page.getByLabel(/Phone Number/i).fill('9801234567');
    await page.getByLabel(/Email Address/i).fill('ram@janataschool.edu.np');
    await page.getByLabel(/School Type/i).selectOption('Secondary School');
    await page.getByLabel(/Number of Students/i).selectOption('1,000–2,000');
    await page.getByLabel(/Current System Used/i).fill('Ledger Books');
    await page
      .getByLabel(/Expected Rollout Timeline/i)
      .selectOption('Immediately');
    await page.getByLabel(/Preferred Contact Method/i).selectOption('Phone');

    // Click module buttons (toggles)
    await page
      .getByRole('button', { name: /Admissions/i })
      .first()
      .click();
    await page
      .getByRole('button', { name: /Fees & Receipts/i })
      .first()
      .click();
    await page
      .getByRole('button', { name: /Accounting/i })
      .first()
      .click();

    // Submit form
    await page.getByRole('button', { name: /^Submit Demo Request$/i }).click();

    // Verify API-backed B2B success state
    await expect(
      page.getByRole('heading', { name: /^Demo request submitted\.$/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/Shree Janata Secondary School/i),
    ).toBeVisible();
    await expect(page.getByText(/Ram Bahadur/i)).toBeVisible();
    await expect(page.getByText(/demo-request-e2e/i)).toBeVisible();
  });
});
