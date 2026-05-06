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

    expect(controller).toContain("@Permissions('platform:read')");
    expect(controller).toContain("@Permissions('platform:manage')");
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
      'reason: reason ?? null',
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
});
