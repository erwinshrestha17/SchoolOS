import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
}

describe('Platform tenant subscription change workflow contracts', () => {
  it('wires the tenant detail Change Plan action to the change-plan route', () => {
    const detailPage = read('app/platform/schools/[tenantId]/page.tsx');

    assert.match(detailPage, /Change Plan/);
    assert.match(
      detailPage,
      /router\.push\(`\/platform\/schools\/\$\{tenant\.id\}\/change-plan`\)/,
    );
  });

  it('keeps the change-plan route present and helper-backed', () => {
    assert.equal(
      existsSync(
        join(webRoot, 'app/platform/schools/[tenantId]/change-plan/page.tsx'),
      ),
      true,
      'Missing platform tenant change-plan route',
    );

    const page = read('app/platform/schools/[tenantId]/change-plan/page.tsx');

    assert.match(page, /api\.getPlatformTenantDetail\(tenantId\)/);
    assert.match(page, /api\.listPlatformPlans\(\)/);
    assert.match(
      page,
      /api\.assignPlatformTenantSubscription\(tenant\.id, compactPayload\(payload\)\)/,
    );
  });

  it('renders the required operator controls and safe billing boundary text', () => {
    const page = read('app/platform/schools/[tenantId]/change-plan/page.tsx');

    for (const label of [
      'Current plan',
      'Selected plan preview',
      'Plan',
      'Status',
      'Starts at',
      'Renews at',
      'Audit reason',
      'SchoolOS subscription billing only',
      'does not create student fee invoices',
    ]) {
      assert.match(page, new RegExp(label), `Missing workflow text: ${label}`);
    }
  });

  it('guards submit on selected plan, audit reason length, and saving state', () => {
    const page = read('app/platform/schools/[tenantId]/change-plan/page.tsx');

    assert.match(
      page,
      /const canSubmit = Boolean\(selectedPlan\) && reason\.trim\(\)\.length >= 5 && !saving/,
    );
    assert.match(page, /disabled=\{!canSubmit\}/);
    assert.match(page, /No active platform plans are available/);
  });

  it('exposes typed API helpers for platform subscription assignment', () => {
    const apiClient = read('lib/api.ts');

    assert.match(apiClient, /AssignPlatformTenantSubscriptionPayload/);
    assert.match(apiClient, /assignPlatformTenantSubscription:/);
    assert.match(apiClient, /PlatformTenantSubscriptionSummary/);
  });

  it('wires remaining tenant detail M0 workflows to real dialogs and helpers', () => {
    const page = read('app/platform/schools/[tenantId]/page.tsx');

    for (const expected of [
      'Enter Support Mode',
      'api.enterPlatformSupportOverride',
      'Create SchoolOS Subscription Invoice',
      'api.createPlatformSaaSInvoice',
      'Record SaaS Payment',
      'api.recordPlatformSaaSPayment',
      'Cancel SaaS Invoice',
      'api.cancelPlatformSaaSInvoice',
      'Edit Billing Profile',
      'api.updatePlatformBillingProfile',
      'Onboarding Checklist',
      'api.setTenantOnboardingOverride',
      'Export current page CSV',
      'api.listPlatformAuditLogs',
    ]) {
      assert.match(
        page,
        new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      );
    }
  });

  it('wires platform settings provider, queue, audit, and tab deep-link workflows', () => {
    const settings = read('app/platform/settings/page.tsx');
    const shell = read('components/layout/platform-shell.tsx');
    const apiClient = read('lib/api.ts');

    for (const expected of [
      'Edit Provider',
      'api.updatePlatformProviderStatus',
      'api.getPlatformProviderReadiness',
      'Provider Readiness Detail',
      'Retry Failed Job',
      'Retry audit history',
      'Discard Failed Job',
      'Export current page CSV',
      'resourceId',
      'startDate',
      'router.replace(`/platform/settings?tab=${value}`)',
    ]) {
      assert.match(
        settings,
        new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      );
    }

    assert.match(shell, /\/platform\/settings\?tab=plans/);
    assert.match(shell, /\/platform\/settings\?tab=health/);
    assert.match(apiClient, /enterPlatformSupportOverride/);
    assert.match(apiClient, /exitPlatformSupportOverride/);
    assert.match(apiClient, /cancelPlatformSaaSInvoice/);
    assert.match(apiClient, /updatePlatformProviderStatus/);
    assert.match(apiClient, /getPlatformProviderReadiness/);
    assert.match(apiClient, /getPlatformJobDetail/);
  });
});
