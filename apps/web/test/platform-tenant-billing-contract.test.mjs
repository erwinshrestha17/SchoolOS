import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
}

describe('Platform tenant SaaS billing page contracts', () => {
  it('keeps the focused tenant SaaS billing route present', () => {
    const route = 'app/platform/schools/[tenantId]/billing/page.tsx';

    assert.equal(existsSync(join(webRoot, route)), true, `Missing ${route}`);
  });

  it('uses real platform APIs and no fake billing data', () => {
    const page = read('app/platform/schools/[tenantId]/billing/page.tsx');

    assert.match(page, /api\.getPlatformTenantDetail\(tenantId\)/);
    assert.match(page, /api\.listPlatformSaaSInvoices\(tenantId\)/);
    assert.doesNotMatch(page, /SO-2024-00124/);
    assert.doesNotMatch(page, /fake billing records/i);
  });

  it('uses shared platform operator state components', () => {
    const page = read('app/platform/schools/[tenantId]/billing/page.tsx');

    for (const expected of [
      'PlatformSectionSkeleton',
      'PlatformEmptyState',
      'PlatformInlineError',
      'PlatformBoundaryNote',
      "from '../../../_components/platform-operator-states'",
    ]) {
      assert.match(page, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });

  it('keeps SaaS billing clearly separated from M3 and M9', () => {
    const page = read('app/platform/schools/[tenantId]/billing/page.tsx');

    for (const expected of [
      'SchoolOS SaaS Billing',
      'SchoolOS-to-school subscription billing',
      'not M3 student fee collection',
      'M9 Accounting',
      'Student fee invoices remain in M3 Fees',
    ]) {
      assert.match(page, new RegExp(expected));
    }
  });

  it('shows billing risk summaries and safe states', () => {
    const page = read('app/platform/schools/[tenantId]/billing/page.tsx');

    for (const expected of [
      'Unpaid balance',
      'Overdue invoices',
      'No SaaS invoices yet',
      'Tenant billing unavailable',
      'Back to tenant detail',
      'Change plan',
      'Synthetic billing records are never shown here',
      'Date not recorded',
      'color-mod-platform-accent',
    ]) {
      assert.match(page, new RegExp(expected));
    }

    assert.doesNotMatch(page, /bg-slate-900|bg-slate-950|shadow-xl|shadow-2xl|N\/A|Unknown failure/);
  });
});
