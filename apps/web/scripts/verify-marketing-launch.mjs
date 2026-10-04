const requiredValues = [
  'SCHOOLOS_PUBLIC_SITE_URL',
  'SCHOOLOS_LEGAL_OPERATOR_NAME',
  'SCHOOLOS_PRIVACY_CONTACT_EMAIL',
  'SCHOOLOS_PRIVACY_RETENTION',
  'SCHOOLOS_DATA_RECIPIENTS',
  'SCHOOLOS_COOKIE_AND_LOG_NOTICE',
  'SCHOOLOS_TERMS_GOVERNING_LAW',
  'SCHOOLOS_LEGAL_EFFECTIVE_DATE',
];

const blockers = [];
for (const name of requiredValues) {
  const value = process.env[name]?.trim();
  if (!value || /^\[.*\]$/.test(value))
    blockers.push(`${name} is not approved`);
}
if (process.env.SCHOOLOS_LEGAL_POLICY_APPROVED !== 'true') {
  blockers.push('SCHOOLOS_LEGAL_POLICY_APPROVED is not true');
}

let site;
try {
  site = new URL(process.env.SCHOOLOS_PUBLIC_SITE_URL ?? '');
  if (site.protocol !== 'https:' || site.pathname !== '/') {
    blockers.push('SCHOOLOS_PUBLIC_SITE_URL must be an HTTPS origin');
  }
} catch {
  blockers.push('SCHOOLOS_PUBLIC_SITE_URL is invalid');
}
try {
  if (
    new URL(process.env.NEXT_PUBLIC_API_BASE_URL ?? '').protocol !== 'https:'
  ) {
    blockers.push('NEXT_PUBLIC_API_BASE_URL must use HTTPS');
  }
} catch {
  blockers.push('NEXT_PUBLIC_API_BASE_URL is invalid');
}

if (blockers.length) {
  for (const blocker of blockers) console.error(`BLOCKED: ${blocker}`);
  process.exit(1);
}

async function probe(path, expectedType) {
  const url = new URL(path, site);
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) blockers.push(`${path} returned HTTP ${response.status}`);
  if (
    expectedType &&
    !response.headers.get('content-type')?.includes(expectedType)
  ) {
    blockers.push(`${path} did not return ${expectedType}`);
  }
  return response;
}

try {
  const homepage = await probe('/', 'text/html');
  const html = await homepage.text();
  if (!homepage.headers.has('strict-transport-security')) {
    blockers.push('HTTPS homepage has no HSTS header');
  }
  if (!homepage.headers.has('content-security-policy')) {
    blockers.push('HTTPS homepage has no CSP header');
  }
  if (!html.includes('<meta name="robots" content="index, follow"')) {
    blockers.push('Homepage is not indexable');
  }
  if (
    !html.includes(`rel="canonical" href="${site.origin}"`) &&
    !html.includes(`rel="canonical" href="${site.origin}/"`)
  ) {
    blockers.push('Homepage canonical URL does not match the site origin');
  }

  const robots = await probe('/robots.txt', 'text/plain');
  if (!(await robots.text()).includes(`Sitemap: ${site.origin}/sitemap.xml`)) {
    blockers.push('robots.txt does not advertise the production sitemap');
  }
  const sitemap = await probe('/sitemap.xml', 'xml');
  if (!(await sitemap.text()).includes(`${site.origin}/privacy`)) {
    blockers.push('Sitemap does not include the Privacy Policy');
  }

  for (const path of ['/privacy', '/terms', '/request-demo']) {
    const response = await probe(path, 'text/html');
    const body = await response.text();
    if (/\[[A-Z][A-Z0-9_]+\]/.test(body)) {
      blockers.push(`${path} still contains legal placeholders`);
    }
  }
  await probe('/icon.svg', 'image/svg+xml');
  await probe('/opengraph-image', 'image/png');

  const httpUrl = new URL(site);
  httpUrl.protocol = 'http:';
  const insecure = await fetch(httpUrl, {
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  });
  const redirect = insecure.headers.get('location');
  if (
    ![301, 302, 307, 308].includes(insecure.status) ||
    !redirect ||
    new URL(redirect, httpUrl).protocol !== 'https:'
  ) {
    blockers.push('HTTP homepage does not redirect to HTTPS');
  }
} catch (error) {
  blockers.push(`Production probe failed: ${error.message}`);
}

if (blockers.length) {
  for (const blocker of blockers) console.error(`BLOCKED: ${blocker}`);
  process.exitCode = 1;
} else {
  console.log(
    'Marketing launch checks passed for the configured production URL.',
  );
}
