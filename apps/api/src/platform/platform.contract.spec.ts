import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('M0 Platform Control Plane contracts', () => {
  const root = join(__dirname, '..', '..');

  function read(relativePath: string) {
    return readFileSync(join(root, relativePath), 'utf8');
  }

  it('keeps platform tenant routes guarded, permissioned, and separated from tenant operations', () => {
    const controller = read('src/platform/platform.controller.ts');

    expect(controller).toContain("@Controller('platform')");
    expect(controller).toContain('@UseGuards(JwtAuthGuard, PlatformGuard)');

    for (const endpoint of [
      "@Get('tenants')",
      "@Get('tenants/page')",
      "@Get('tenants/:tenantId')",
      "@Patch('tenants/:tenantId/status')",
      "@Get('tenants/:tenantId/usage')",
    ]) {
      expect(controller).toContain(endpoint);
    }

    expect(controller).toContain("@Permissions('platform:tenants:read')");
    expect(controller).toContain("@Permissions('platform:tenants:status')");
    expect(controller).toContain("@Permissions('platform:plans:manage')");
    expect(controller).toContain("@Permissions('platform:billing:manage')");
    expect(controller).toContain("@Permissions('platform:providers:manage')");
    expect(controller).toContain("@Permissions('platform:queues:retry')");
    expect(controller).toContain('UpdatePlatformTenantStatusDto');
    expect(controller).toContain('ListPlatformTenantsDto');
  });

  it('supports paginated and filterable platform tenant reads', () => {
    const dto = read('src/platform/dto/list-platform-tenants.dto.ts');
    const service = read('src/platform/platform.service.ts');

    for (const field of [
      'page?: number',
      'limit?: number',
      'search?: string',
      'plan?: string',
      'status?:',
    ]) {
      expect(dto).toContain(field);
    }

    expect(service).toContain('listTenantsPage');
    expect(service).toContain('skip');
    expect(service).toContain('take: limit');
    expect(service).toContain('this.prisma.tenant.count({ where })');
    expect(service).toContain("status === 'active'");
    expect(service).toContain("status === 'suspended'");
    expect(service).toContain("mode: 'insensitive'");
  });

  it('requires structured tenant status updates and records platform audit reasons', () => {
    const dto = read('src/platform/dto/update-platform-tenant-status.dto.ts');
    const service = read('src/platform/platform.service.ts');

    expect(dto).toContain('isActive!: boolean');
    expect(dto).toContain('reason?: string');
    expect(dto).toContain('@MinLength(5)');

    for (const auditMarker of [
      'tenant_activated',
      'tenant_suspended',
      'tenant_status_noop',
      "tenantId: 'platform'",
      'reason.trim()',
    ]) {
      expect(service).toContain(auditMarker);
    }
  });

  it('validates tenant existence before usage reads', () => {
    const service = read('src/platform/platform.service.ts');

    expect(service).toContain('getTenantUsage');
    expect(service).toContain('findUnique({');
    expect(service).toContain('Tenant with ID ${tenantId} not found');
  });

  it('keeps M0 SaaS billing, providers, queues, reports, and onboarding inside platform routes', () => {
    const controller = read('src/platform/platform.controller.ts');
    const service = read('src/platform/platform.service.ts');
    const schema = read('prisma/schema.prisma');

    for (const endpoint of [
      "@Get('plans')",
      "@Post('tenants/:tenantId/subscriptions')",
      "@Post('tenants/:tenantId/feature-overrides')",
      "@Get('tenants/:tenantId/saas-invoices')",
      "@Post('providers')",
      "@Get('queues')",
      "@Post('queues/retry')",
      "@Get('health')",
      "@Get('report-exports')",
      "@Get('tenants/:tenantId/onboarding')",
    ]) {
      expect(controller).toContain(endpoint);
    }

    for (const model of [
      'model PlatformPlan',
      'model TenantSubscription',
      'model TenantFeatureOverride',
      'model UsageCounter',
      'model TenantBillingProfile',
      'model SaaSInvoice',
      'model SaaSPayment',
      'model ProviderConfig',
      'model ReportExport',
      'model TenantOnboardingChecklistOverride',
    ]) {
      expect(schema).toContain(model);
    }

    expect(service).toContain('saas_invoice_created');
    expect(service).toContain('provider_config_updated');
    expect(service).toContain("'********'");
    expect(service).toContain('queue_failed_job_retry_requested');
    expect(service).toContain('onboarding_override_updated');
    expect(service).not.toContain('AccountingPostingService');
  });
});
