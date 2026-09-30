import { execSync } from 'node:child_process';
import { chromium } from 'playwright';
const OUT = process.argv[2];
const PASS = 'schoolos-local-demo-only';
const personas = [
  ['admin', 'admin@schoolos.com', null],
  ['principal', 'principal@schoolos.com', null],
  ['principal-teaching', 'principal@schoolos.com', 'Teaching'],
  ['accountant', 'accountant@schoolos.com', null],
  ['hr', 'staff@schoolos.com', null],
  ['teacher', 'classteacher.1a@schoolos.com', null],
  ['config-owner', 'e2e.unauthorized@schoolos.test', null],
];
const browser = await chromium.launch({ executablePath: 'process.env.CHROMIUM_PATH' });
const report = [];
for (const [name, email, home] of personas) {
  execSync('redis-cli FLUSHALL');
  const login = await browser.newContext();
  const lp = await login.newPage();
  await lp.goto('http://localhost:3000/login');
  await lp.getByLabel(/School Code/i).fill('default-school');
  await lp.getByLabel(/Email/i).fill(email);
  await lp.getByLabel(/^Password$/i).fill(PASS);
  await Promise.all([lp.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => {}), lp.getByRole('button', { name: /Sign in/i }).click()]);
  const state = await login.storageState();
  await login.close();
  for (const [vw, vh, tag] of [[1440, 2000, 'desktop'], [390, 2600, 'phone']]) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, storageState: state });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)));
    page.on('response', (r) => { if (r.url().includes('/api/v1/') && r.status() >= 400) errors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle').catch(() => {});
    if (home) { await page.getByRole('radio', { name: home }).click({ timeout: 10000 }).catch((e) => errors.push('switcher: ' + e.message.slice(0, 60))); }
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
    await page.evaluate(() => { window.scrollTo(0, 0); for (const el of document.querySelectorAll('*')) { if (el.scrollTop > 0) el.scrollTop = 0; } });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    const heading = await page.locator('h1').first().textContent().catch(() => null);
    await page.screenshot({ path: `${OUT}/${name}-${tag}.png`, fullPage: true });
    report.push({ name, tag, url: page.url(), heading, overflow, errors: [...new Set(errors)] });
    await ctx.close();
  }
}
await browser.close();
console.log(JSON.stringify(report, null, 1));
