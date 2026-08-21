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
    const page = read('components/platform/tenant-detail/tenant-billing.tsx');

    assert.match(page, /platformApi\.listPlatformSaaSInvoices\(tenant\.id\)/);
    assert.match(page, /platformApi\.createPlatformSaaSInvoice/);
    assert.match(page, /platformApi\.recordPlatformSaaSPayment/);
    assert.match(page, /platformApi\.cancelPlatformSaaSInvoice/);
    assert.doesNotMatch(page, /SO-2024-00124/);
    assert.doesNotMatch(page, /fake billing records/i);
  });

  it('uses shared platform operator state components', () => {
    const page = read('components/platform/tenant-detail/tenant-billing.tsx');

    for (const expected of [
      'PlatformSectionSkeleton',
      'PlatformEmptyState',
      'PlatformInlineError',
      'PlatformBoundaryNote',
      'from "@/app/platform/_components/platform-operator-states"',
    ]) {
      assert.match(page, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });

  it('keeps SaaS billing clearly separated from M3 and M11', () => {
    const page = read('components/platform/tenant-detail/tenant-billing.tsx');
    const normalizedPage = page.replace(/\s+/g, ' ');

    for (const expected of [
      'SaaS billing',
      'SchoolOS-to-school subscription billing',
      'not M3 student fee collection',
      'M11 Accounting',
      'school fee invoice',
    ]) {
      assert.match(normalizedPage, new RegExp(expected));
    }
  });

  it('shows billing risk summaries and safe states', () => {
    const page = read('components/platform/tenant-detail/tenant-billing.tsx');

    for (const expected of [
      'No SaaS invoices yet',
      'SaaS invoices unavailable',
      'New invoice',
      'Update profile',
      'Audit reason',
      'Date not recorded',
    ]) {
      assert.match(page, new RegExp(expected));
    }

    assert.doesNotMatch(page, /bg-slate-900|bg-slate-950|shadow-xl|shadow-2xl|N\/A|Unknown failure|SO-2024-00124/);
  });

  it('keeps billing writes behind the existing manage permission', () => {
    const page = read('components/platform/tenant-detail/tenant-billing.tsx');

    assert.match(page, /platform:billing:manage/);
    assert.match(page, /!canManageBilling/);
    assert.match(page, /canManageBilling \?/);
  });
});
