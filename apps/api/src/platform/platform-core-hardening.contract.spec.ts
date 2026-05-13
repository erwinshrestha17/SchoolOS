import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('M0 Platform Core hardening contracts', () => {
  const root = join(__dirname, '..', '..');

  function read(relativePath: string) {
    return readFileSync(join(root, relativePath), 'utf8');
  }

  it('keeps all Platform Core endpoints behind platform auth and granular permissions', () => {
    const controller = read('src/platform/platform.controller.ts');

    expect(controller).toContain("@Controller('platform')");
    expect(controller).toContain('@UseGuards(JwtAuthGuard, PlatformGuard)');

    for (const permission of [
      "@Permissions('platform:dashboard:read')",
      "@Permissions('platform:tenants:read')",
      "@Permissions('platform:tenants:status')",
      "@Permissions('platform:billing:read')",
      "@Permissions('platform:billing:manage')",
      "@Permissions('platform:providers:read')",
      "@Permissions('platform:providers:manage')",
      "@Permissions('platform:queues:read')",
      "@Permissions('platform:queues:retry')",
      "@Permissions('platform:health:read')",
      "@Permissions('platform:reports:read')",
      "@Permissions('platform:audit:read')",
    ]) {
      expect(controller).toContain(permission);
    }
  });

  it('keeps tenant override and tenant-affecting platform actions reasoned and audited', () => {
    const dto = read('src/platform/dto/update-platform-tenant-status.dto.ts');
    const service = read('src/platform/platform.service.ts');

    expect(dto).toContain('reason?: string');
    expect(dto).toContain('@MinLength(5)');
    expect(service).toContain('Tenant status changes require a reason');
    expect(service).toContain('tenant_activated');
    expect(service).toContain('tenant_suspended');
    expect(service).toContain('tenant_status_noop');
    expect(service).toContain("tenantId: 'platform'");
    expect(service).toContain('reason.trim()');
  });

  it('keeps entitlement and usage checks feature-key based instead of sidebar or plan-name based', () => {
    const service = read('src/platform/platform.service.ts');
    const entitlementGuard = read('src/auth/guards/entitlement.guard.ts');
    const plansService = read('src/plans/plans.service.ts');

    expect(service).toContain('FEATURE_KEYS');
    expect(service).toContain('USAGE_KEYS');
    expect(service).toContain('checkEntitlement');
    expect(service).toContain('checkFeatureEnabled');
    expect(entitlementGuard).toContain('RequiresFeature');
    expect(entitlementGuard).toContain('ForbiddenException');
    expect(plansService).toContain('featureKey');
  });

  it('keeps SaaS billing separate from school fee collection and accounting posting', () => {
    const service = read('src/platform/platform.service.ts');
    const schema = read('prisma/schema.prisma');

    for (const marker of [
      'model SaaSInvoice',
      'model SaaSPayment',
      'model TenantBillingProfile',
      'model TenantSubscription',
    ]) {
      expect(schema).toContain(marker);
    }

    expect(service).toContain('createSaaSInvoice');
    expect(service).toContain('recordSaaSPayment');
    expect(service).toContain('cancelSaaSInvoice');
    expect(service).toContain('saas_invoice_created');
    expect(service).toContain('saas_payment_recorded');
    expect(service).toContain('saas_invoice_cancelled');
    expect(service).not.toContain('AccountingPostingService');
  });

  it('keeps provider config responses masked and provider changes audited', () => {
    const service = read('src/platform/platform.service.ts');

    expect(service).toContain('toProviderSummary');
    expect(service).toContain('secretKeys');
    expect(service).toContain("'********'");
    expect(service).toContain('provider_config_updated');
    expect(service).toContain('encryptProviderConfig');
  });

  it('keeps queue operations bounded, permissioned, and audited', () => {
    const controller = read('src/platform/platform.controller.ts');
    const service = read('src/platform/platform.service.ts');

    expect(controller).toContain("@Get('queues')");
    expect(controller).toContain("@Get('queues/failed-jobs')");
    expect(controller).toContain("@Post('queues/retry')");
    expect(controller).toContain("@Permissions('platform:queues:read')");
    expect(controller).toContain("@Permissions('platform:queues:retry')");
    expect(service).toContain('getJobCounts');
    expect(service).toContain('getFailed(0, 50)');
    expect(service).toContain('job.retry()');
    expect(service).toContain('queue_failed_job_retry_requested');
  });

  it('keeps platform report export and audit history paginated', () => {
    const controller = read('src/platform/platform.controller.ts');
    const service = read('src/platform/platform.service.ts');
    const schema = read('prisma/schema.prisma');

    expect(schema).toContain('model ReportExport');
    expect(controller).toContain("@Get('report-exports')");
    expect(controller).toContain("@Permissions('platform:reports:read')");
    expect(service).toContain('listReportExportsPage');
    expect(service).toContain('listAuditLogs');
    expect(service).toContain('skip');
    expect(service).toContain('take: limit');
    expect(service).toContain('hasNextPage');
  });

  it('keeps platform health checks safe and non-secret-bearing', () => {
    const controller = read('src/platform/platform.controller.ts');
    const service = read('src/platform/platform.service.ts');

    expect(controller).toContain("@Get('health')");
    expect(controller).toContain("@Permissions('platform:health:read')");
    expect(service).toContain('getPlatformHealth');
    expect(service).toContain('database');
    expect(service).toContain('redis');
    expect(service).toContain('queues');
    expect(service).not.toContain('accessKey');
    expect(service).not.toContain('secretAccessKey');
  });
});
