import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("Platform tenant detail route contracts", () => {
  const routes = [
    ["page.tsx", "overview"],
    ["access/page.tsx", "access"],
    ["modules/page.tsx", "modules"],
    ["subscription/page.tsx", "subscription"],
    ["billing/page.tsx", "billing"],
    ["onboarding/page.tsx", "onboarding"],
    ["integrations/page.tsx", "integrations"],
    ["api-keys/page.tsx", "api-keys"],
    ["audit/page.tsx", "audit"],
  ];

  it("keeps every tenant workflow on a canonical route", () => {
    for (const [relativePath, section] of routes) {
      const route = `app/platform/schools/[tenantId]/${relativePath}`;
      assert.equal(existsSync(join(webRoot, route)), true, `Missing ${route}`);
      assert.match(read(route), new RegExp(`section=["']${section}["']`));
    }
  });

  it("uses route-backed navigation and redirects legacy tab links", () => {
    const shell = read(
      "components/platform/tenant-detail/tenant-detail-page.tsx",
    );
    const routeConfig = read(
      "components/platform/tenant-detail/tenant-detail-routes.ts",
    );
    const overviewRoute = read("app/platform/schools/[tenantId]/page.tsx");
    const directory = read("app/platform/schools/page.tsx");

    for (const section of routes.map(([, value]) => value)) {
      assert.match(routeConfig, new RegExp(`key: ['"]${section}['"]`));
    }
    assert.match(routeConfig, /entitlements: ["']modules["']/);
    assert.match(overviewRoute, /TENANT_LEGACY_TAB_ROUTES/);
    assert.match(overviewRoute, /redirect\(/);
    assert.match(directory, /\/platform\/schools\/\$\{tenant\.id\}\/billing/);
    assert.doesNotMatch(directory, /\?tab=billing/);
    assert.doesNotMatch(
      shell,
      /useState\(['"]overview['"]\)|TabsContent|TabsTrigger/,
    );
  });

  it("loads child collections only in the owning route component", () => {
    const shell = read(
      "components/platform/tenant-detail/tenant-detail-page.tsx",
    );
    const billing = read(
      "components/platform/tenant-detail/tenant-billing.tsx",
    );
    const apiKeys = read(
      "components/platform/tenant-detail/tenant-api-keys.tsx",
    );
    const audit = read("components/platform/tenant-detail/tenant-audit.tsx");
    const overview = read(
      "components/platform/tenant-detail/tenant-overview.tsx",
    );

    assert.match(shell, /getPlatformTenantDetail/);
    assert.doesNotMatch(
      shell,
      /listPlatformSaaSInvoices|listPlatformApiKeys|listPlatformAuditLogs/,
    );
    assert.match(billing, /listPlatformSaaSInvoices/);
    assert.doesNotMatch(billing, /listPlatformApiKeys|listPlatformAuditLogs/);
    assert.match(apiKeys, /listPlatformApiKeys/);
    assert.doesNotMatch(
      apiKeys,
      /listPlatformSaaSInvoices|listPlatformAuditLogs/,
    );
    assert.match(audit, /listPlatformAuditLogs/);
    assert.doesNotMatch(audit, /listPlatformSaaSInvoices|listPlatformApiKeys/);
    assert.doesNotMatch(overview, /platformApi|\bapi\./);
  });

  it("fails closed before tenant detail or child queries for restricted routes", () => {
    const shell = read(
      "components/platform/tenant-detail/tenant-detail-page.tsx",
    );
    const routeConfig = read(
      "components/platform/tenant-detail/tenant-detail-routes.ts",
    );
    const changePlan = read(
      "app/platform/schools/[tenantId]/change-plan/page.tsx",
    );

    for (const permission of [
      "platform:tenants:read",
      "platform:tenants:status",
      "platform:support:override",
      "platform:subscriptions:read",
      "platform:billing:read",
      "platform:onboarding:read",
      "platform:providers:read",
      "platform:api-keys:read",
      "platform:audit:read",
    ]) {
      assert.match(routeConfig, new RegExp(permission.replace(":", "\\:")));
    }

    assert.match(shell, /if \(tenantId && canViewSection\)/);
    assert.match(shell, /if \(!canViewSection\)/);
    assert.match(shell, /No tenant detail or workflow data was loaded/);
    assert.match(changePlan, /if \(tenantId && canChangePlan\)/);
    assert.match(changePlan, /if \(!canChangePlan\)/);
  });

  it("permission-gates overview cross-domain cards, identifiers, links, and actions", () => {
    const overview = read(
      "components/platform/tenant-detail/tenant-overview.tsx",
    );
    const access = read("components/platform/tenant-detail/tenant-access.tsx");
    const subscription = read(
      "components/platform/tenant-detail/tenant-subscription.tsx",
    );
    const directory = read("app/platform/schools/page.tsx");

    for (const marker of [
      "canReadUsage",
      "canReadSubscriptions",
      "canReadBilling",
      "canReadOnboarding",
      "canReadProviders",
      "canReadPlanLimits",
    ]) {
      assert.match(overview, new RegExp(marker));
    }

    assert.match(access, /!canChangeStatus/);
    assert.match(access, /!canEnterSupportMode/);
    assert.match(subscription, /canReadBilling/);
    assert.match(subscription, /canReadUsage/);
    assert.match(directory, /if \(!canOnboard\) return/);
    assert.match(directory, /canReadBilling && billingWorkflow/);
    assert.match(directory, /canChangeStatus \?/);
  });

  it("uses honest record-count labels and server pagination for tenant audit", () => {
    const overview = read(
      "components/platform/tenant-detail/tenant-overview.tsx",
    );
    const directory = read("app/platform/schools/page.tsx");
    const audit = read("components/platform/tenant-detail/tenant-audit.tsx");

    assert.match(overview, /Student records/);
    assert.match(overview, /Staff records/);
    assert.doesNotMatch(overview, /Active students|Active staff/);
    assert.match(directory, /Record counts/);
    assert.match(directory, /Student records/);
    assert.match(directory, /Staff records/);

    assert.match(audit, /PaginatedResult<PlatformAuditLog>/);
    assert.match(audit, /page,\s*limit: AUDIT_PAGE_SIZE/);
    assert.match(audit, /<TablePagination/);
    assert.match(audit, /total=\{data\.total\}/);
    assert.match(audit, /onPageChange=\{setPage\}/);
    assert.doesNotMatch(audit, /page:\s*1,\s*limit:\s*50/);
  });

  it("preserves audited high-risk actions and one-time secrets", () => {
    const access = read("components/platform/tenant-detail/tenant-access.tsx");
    const modules = read(
      "components/platform/tenant-detail/tenant-modules.tsx",
    );
    const subscription = read(
      "components/platform/tenant-detail/tenant-subscription.tsx",
    );
    const billing = read(
      "components/platform/tenant-detail/tenant-billing.tsx",
    );
    const apiKeys = read(
      "components/platform/tenant-detail/tenant-api-keys.tsx",
    );
    const onboarding = read(
      "components/platform/tenant-detail/tenant-onboarding.tsx",
    );

    for (const expected of [
      "updatePlatformTenantStatus",
      "enterPlatformSupportOverride",
      "SUPPORT_OVERRIDE_SCOPE_DEFINITIONS",
      "durationMinutes",
      "scopes: supportScopes",
      "expiresAt",
      "entryPath",
      "queryClient.clear",
    ]) {
      assert.match(access, new RegExp(expected.replace(".", "\\.")));
    }
    assert.match(
      access,
      /useState<SupportOverrideScope\[\]>\(\s*\[\],?\s*\)/,
    );
    assert.match(access, /supportScopes\.length === 0/);
    assert.match(access, /item\.permissionScopes/);
    assert.match(access, /Read-only support excludes finance, payroll/);
    assert.match(modules, /setPlatformFeatureOverride/);
    assert.match(subscription, /updatePlatformSubscriptionStatus/);
    assert.match(billing, /cancelPlatformSaaSInvoice/);
    assert.match(onboarding, /setTenantOnboardingOverride/);
    assert.match(apiKeys, /One-time API key secret/);
    assert.match(apiKeys, /revokeReason\.trim\(\)\.length < 5/);
  });
});
