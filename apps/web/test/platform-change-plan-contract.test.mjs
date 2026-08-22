import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
}

function readMany(relativePaths) {
  return relativePaths.map((relativePath) => read(relativePath)).join('\n');
}

describe('Platform tenant subscription change workflow contracts', () => {
  it('wires the tenant detail Change Plan action to the change-plan route', () => {
    const subscription = read(
      'components/platform/tenant-detail/tenant-subscription.tsx',
    );

    assert.match(subscription, />Change plan</);
    assert.match(
      subscription,
      /href=\{`\/platform\/schools\/\$\{encodeURIComponent\(tenant\.id\)\}\/change-plan`\}/,
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

    assert.match(page, /color-mod-platform-accent/);
    assert.doesNotMatch(page, /bg-slate-900|bg-slate-950|shadow-xl|shadow-2xl/);
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
    const apiClient = readMany([
      'lib/api/platform.ts',
      'lib/api/client.ts',
    ]);

    assert.match(apiClient, /AssignPlatformTenantSubscriptionPayload/);
    assert.match(apiClient, /assignPlatformTenantSubscription:/);
    assert.match(apiClient, /PlatformTenantSubscriptionSummary/);
  });

  it('wires remaining tenant detail M0 workflows to real dialogs and helpers', () => {
    const access = read(
      'components/platform/tenant-detail/tenant-access.tsx',
    );
    const billing = read(
      'components/platform/tenant-detail/tenant-billing.tsx',
    );
    const onboarding = read(
      'components/platform/tenant-detail/tenant-onboarding.tsx',
    );
    const audit = read('components/platform/tenant-detail/tenant-audit.tsx');

    assert.match(access, /Enter support mode/);
    assert.match(access, /platformApi\.enterPlatformSupportOverride/);

    assert.match(billing, /Create SchoolOS subscription invoice/);
    assert.match(billing, /platformApi\.createPlatformSaaSInvoice/);
    assert.match(billing, /Record SaaS payment/);
    assert.match(billing, /platformApi\.recordPlatformSaaSPayment/);
    assert.match(billing, /Cancel SaaS invoice/);
    assert.match(billing, /platformApi\.cancelPlatformSaaSInvoice/);
    assert.match(billing, /Edit billing profile/);
    assert.match(billing, /platformApi\.updatePlatformBillingProfile/);

    assert.match(onboarding, /Checklist progress/);
    assert.match(onboarding, /platformApi\.setTenantOnboardingOverride/);

    assert.match(audit, /Export current page CSV/);
    assert.match(audit, /platformApi\.listPlatformAuditLogs/);
  });

  it('keeps tenant detail purpose tabs and support access audit cues visible', () => {
    const routes = read(
      'components/platform/tenant-detail/tenant-detail-routes.ts',
    );
    const detailPage = read(
      'components/platform/tenant-detail/tenant-detail-page.tsx',
    );
    const access = read(
      'components/platform/tenant-detail/tenant-access.tsx',
    );
    const subscription = read(
      'components/platform/tenant-detail/tenant-subscription.tsx',
    );
    const billing = read(
      'components/platform/tenant-detail/tenant-billing.tsx',
    );
    const integrations = read(
      'components/platform/tenant-detail/tenant-integrations.tsx',
    );
    const routeBackedTenantDetail = readMany([
      'components/platform/tenant-detail/tenant-detail-routes.ts',
      'components/platform/tenant-detail/tenant-detail-page.tsx',
      'components/platform/tenant-detail/tenant-access.tsx',
      'components/platform/tenant-detail/tenant-subscription.tsx',
      'components/platform/tenant-detail/tenant-billing.tsx',
      'components/platform/tenant-detail/tenant-integrations.tsx',
    ]);

    for (const label of [
      'Overview',
      'Access',
      'Modules',
      'Subscription',
      'SaaS Billing',
      'Onboarding',
      'Integrations',
      'API Keys',
      'Audit',
    ]) {
      assert.match(routes, new RegExp(`label: "${label}"`));
    }

    assert.match(detailPage, /TENANT_SECTIONS/);
    assert.match(detailPage, /color-mod-platform-text/);
    assert.match(access, /Support override history/);
    assert.match(access, /time-bound support access controls/);
    assert.match(access, /scoped, read-only override/);
    assert.match(access, /Date not recorded/);
    assert.match(subscription, /Usage and limits/);
    assert.match(billing, /Create a platform SaaS invoice only/);
    assert.match(integrations, /Provider readiness/);

    assert.doesNotMatch(
      routeBackedTenantDetail,
      /bg-slate-900|bg-slate-950|shadow-xl|shadow-2xl|N\/A|Unknown failure|fake|mock|Coming soon/,
    );
  });

  it('wires platform settings provider, queue, audit, and tab deep-link workflows', () => {
    const settings = read('app/platform/settings/page.tsx');
    const shell = read('components/layout/platform-shell.tsx');
    const apiClient = readMany([
      'lib/api/platform.ts',
      'lib/api/client.ts',
    ]);

    for (const expected of [
      'Edit Provider',
      'api.updatePlatformProviderStatus',
      'api.getPlatformProviderReadiness',
      'Provider Readiness Detail',
      'Retry Failed Job',
      'Retry is per job',
      'single-job only',
      'Retry audit history',
      'Discard Failed Job',
      'Audit reason',
      'discardReason.trim().length < 5',
      'Export current page CSV',
      'resourceId',
      'startDate',
      'asArray<PlatformFailedJobSummary>(fjResult)',
      'const safeFailedJobs = asArray<PlatformFailedJobSummary>(failedJobs)',
      'const failedJobsForInspectingQueue = safeFailedJobs.filter',
      'failedJobsForInspectingQueue.map',
      'router.replace(`/platform/settings?tab=${value}`)',
      'color-mod-platform-accent',
      'color-mod-platform-text',
      'Date not recorded',
      'Resource ID not recorded',
      'raw provider errors are never exposed here',
      'job.failureSummary',
      'Export file unavailable',
      'downloadProtectedFile',
    ]) {
      assert.match(
        settings,
        new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      );
    }

    assert.doesNotMatch(settings, /failedJobs\.filter/);
    assert.doesNotMatch(settings, /Retry All/);
    assert.doesNotMatch(settings, /Promise\.all\(\s*failedInQueue\.map/);
    assert.doesNotMatch(settings, /api\.getFileView/);
    assert.doesNotMatch(settings, /window\.open/);
    assert.match(apiClient, /removePlatformJob: \(queueName: string, jobId: string, reason: string\)/);
    assert.match(apiClient, /json: \{ reason \}/);
    assert.doesNotMatch(
      settings,
      /bg-slate-900|bg-slate-950|rounded-\[2\.5rem\]|shadow-xl|shadow-2xl|primary-(50|100|200|500|600|700|800|900)|N\/A|Unknown failure|fake production metrics/,
    );
    assert.match(shell, /\/platform\/settings\/plans/);
    assert.match(shell, /\/platform\/settings\/providers/);
    assert.match(shell, /\/platform\/settings\/modules/);
    assert.match(shell, /\/platform\/settings\/feature-flags/);
    assert.match(shell, /\/platform\/settings\?tab=health/);
    assert.match(shell, /\/platform\/settings\?tab=queues/);
    assert.match(apiClient, /enterPlatformSupportOverride/);
    assert.match(apiClient, /exitPlatformSupportOverride/);
    assert.match(apiClient, /cancelPlatformSaaSInvoice/);
    assert.match(apiClient, /updatePlatformProviderStatus/);
    assert.match(apiClient, /getPlatformProviderReadiness/);
    assert.match(apiClient, /getPlatformJobDetail/);
  });

  it('keeps Plans and SchoolOS SaaS billing visible through platform-only navigation', () => {
    const shell = read('components/layout/platform-shell.tsx');
    const schoolsPage = read('app/platform/schools/page.tsx');

    assert.equal(
      existsSync(join(webRoot, 'app/platform/settings/plans/page.tsx')),
      true,
      'Missing platform settings plans redirect route',
    );
    assert.equal(
      existsSync(join(webRoot, 'app/platform/settings/providers/page.tsx')),
      true,
      'Missing platform settings providers focused route',
    );
    assert.equal(
      existsSync(join(webRoot, 'app/platform/settings/modules/page.tsx')),
      true,
      'Missing platform settings modules focused route',
    );
    assert.equal(
      existsSync(join(webRoot, 'app/platform/settings/feature-flags/page.tsx')),
      true,
      'Missing platform settings feature-flags focused route',
    );

    for (const expected of [
      "label: 'Platform'",
      "label: 'Operations'",
      "label: 'Configuration'",
      "label: 'Billing'",
      "label: 'Plans'",
      "href: '/platform/settings/plans'",
      "permissions: ['platform:plans:read']",
      "label: 'Subscriptions'",
      "href: '/platform/billing/subscriptions'",
      "permissions: ['platform:subscriptions:read']",
      "label: 'SaaS Invoices'",
      "href: '/platform/billing/invoices'",
      "label: 'Payments'",
      "href: '/platform/billing/payments'",
      "permissions: ['platform:billing:read']",
    ]) {
      assert.match(
        shell,
        new RegExp(
          expected
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/'/g, `['"]`),
        ),
      );
    }

    assert.match(schoolsPage, /SchoolOS SaaS billing/);
    assert.match(schoolsPage, /not M3 student fee/);
    assert.match(schoolsPage, /M11 school accounting/);
  });

  it('keeps focused platform billing wrappers and redirect helper available', () => {
    const helper = read('app/platform/_components/platform-route-redirect.tsx');

    assert.match(helper, /redirectToPlatformRoute/);
    assert.match(helper, /next\/navigation/);

    for (const route of [
      'app/platform/billing/page.tsx',
      'app/platform/billing/subscriptions/page.tsx',
      'app/platform/billing/invoices/page.tsx',
      'app/platform/billing/payments/page.tsx',
    ]) {
      assert.equal(existsSync(join(webRoot, route)), true, `Missing ${route}`);
      const page = read(route);
      assert.match(page, /redirectToPlatformRoute/);
      assert.match(page, /\/platform\/schools/);
    }
  });

  it('keeps focused platform settings wrappers using the shared redirect helper', () => {
    for (const route of [
      'app/platform/settings/plans/page.tsx',
      'app/platform/settings/providers/page.tsx',
      'app/platform/settings/modules/page.tsx',
      'app/platform/settings/feature-flags/page.tsx',
    ]) {
      assert.equal(existsSync(join(webRoot, route)), true, `Missing ${route}`);
      const page = read(route);
      assert.match(page, /redirectToPlatformRoute/);
    }
  });

  it('keeps the redesigned platform dashboard focused on operator attention', () => {
    const dashboard = read('app/platform/dashboard/page.tsx');

    for (const expected of [
      'Operator Attention Dashboard',
      'Attention queue',
      'Overdue SaaS invoices',
      'Provider issues',
      'usage warning',
      'SaaS billing boundary',
      'M3 student fee collection',
      'M11 school',
      'PlatformDashboardSkeleton',
      'color-mod-platform-accent',
      'color-mod-platform-text',
    ]) {
      assert.match(
        dashboard,
        new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      );
    }

    assert.doesNotMatch(
      dashboard,
      /bg-slate-900|bg-slate-950|rounded-\[20px\]|shadow-xl|shadow-2xl/,
    );
  });

  it('keeps the redesigned schools page focused on tenant operations', () => {
    const schoolsPage = read('app/platform/schools/page.tsx');

    for (const expected of [
      'Tenant Operations',
      'Find a tenant',
      'Visible schools',
      'Active on page',
      'Suspended on page',
      'Confirm audited action',
      'Minimum 5 characters',
      'Open SaaS billing',
      'SchoolOS SaaS billing',
      'color-mod-platform-accent',
      'color-mod-platform-text',
    ]) {
      assert.match(
        schoolsPage,
        new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      );
    }

    assert.doesNotMatch(schoolsPage, /LayoutGrid/);
    assert.doesNotMatch(
      schoolsPage,
      /bg-slate-900|bg-slate-950|rounded-\[20px\]|shadow-xl|shadow-2xl/,
    );
  });

  it('keeps the platform audit log route tokenized and explicit', () => {
    const auditPage = read('app/platform/audit/page.tsx');

    for (const expected of [
      'Audit Logs',
      'api.listPlatformAuditLogs',
      'Resource ID not recorded',
      'Request ID not recorded',
      'color-mod-platform-accent',
      'No audit logs found.',
    ]) {
      assert.match(
        auditPage,
        new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      );
    }

    assert.doesNotMatch(
      auditPage,
      /N\/A|primary-(50|100|200|500|600|700|800|900)|bg-slate-900|bg-slate-950|shadow-xl|shadow-2xl|fake|mock|Coming soon/,
    );
  });
});
